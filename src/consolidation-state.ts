/**
 * File-backed durable state for background memory consolidation.
 *
 * Since 1.1.0 the consolidator never appends `memory/consolidation-request` or
 * `memory/consolidation-result` session events. Official DeepSeek Harness builds refuse a session
 * log containing event types outside their catalog unless the event carries the `ignorable`
 * envelope marker (SessionFormatUnsupportedError), and `Session.append` exposes no way to set
 * that marker — so durable state must not depend on custom catalog events. The per-session
 * consolidation watermark, last review result, and retry control instead live in
 * `$DSH_HOME/memory/consolidation/<session-id>.json`, written atomically after each review.
 *
 * Sessions written by v1.0.x still carry the legacy events. On first load with no state file the
 * last legacy `memory/consolidation-result` and `memory/consolidation-request` events are folded
 * into a fresh state file (only when the hosting harness can already decode those events); new
 * writes always go to the file. A rebuilt watermark is safe: sequence numbers are stable, daily
 * appends are idempotent per marker, and managed-region rewrites of unchanged entries are noops.
 *
 * This module is dependency-free so the regression check can exercise the policy directly.
 * @module dsh-memory/consolidation-state
 */

import { join } from 'node:path'
import { advancesConsolidationWatermark } from './consolidation-policy.ts'

/** Schema version of the per-session consolidation state file. */
export const CONSOLIDATION_STATE_SCHEMA_VERSION = 1

/** Overall statuses shared by the state file and legacy result payloads. */
export type ConsolidationStateStatus =
  | 'applied'
  | 'noop'
  | 'proposed'
  | 'partial'
  | 'conflict'
  | 'failed'

/** Per-target commit statuses recorded inside one result. */
export type ConsolidationStateOutcomeStatus =
  | 'applied'
  | 'noop'
  | 'proposed'
  | 'skipped'
  | 'conflict'
  | 'failed'

/** Validated materialized managed lists plus new daily entries for one result. */
export interface ConsolidationStateCandidates {
  user: string[]
  global: string[]
  project: string[]
  daily: string[]
}

/** Per-file commit outcome retained even when another target fails. */
export interface ConsolidationStateOutcome {
  target: 'user' | 'global' | 'project' | 'daily'
  path: string
  status: ConsolidationStateOutcomeStatus
  diff?: { added: number; kept: number; removed: number }
  error?: string
}

/** Persisted retry control for an unfinished source batch. */
export interface ConsolidationStateRetry {
  fingerprint: string
  attempt: number
  disposition: 'backoff' | 'file-change'
  fileStateHash?: string
  retryAfter?: number
}

/** Durable record of the latest completed (or failed) review. */
export interface ConsolidationStateResult {
  throughSeq: number
  status: ConsolidationStateStatus
  candidates: ConsolidationStateCandidates
  outcomes: ConsolidationStateOutcome[]
  retry?: ConsolidationStateRetry
  rawTextHash?: string
  error?: string
  /** Epoch milliseconds when the result was recorded. */
  at: number
}

/** Compact audit record of the latest prepared review call. */
export interface ConsolidationStateRequest {
  throughSeq: number
  sourceTurns: number[]
  route: { provider: string; model: string }
  maxTokens: number
  mode: 'automatic' | 'proposal'
  /** Epoch milliseconds when the request was prepared. */
  at: number
}

/** Complete per-session consolidation state persisted under `$DSH_HOME/memory/consolidation/`. */
export interface ConsolidationState {
  schemaVersion: typeof CONSOLIDATION_STATE_SCHEMA_VERSION
  sessionId: string
  /** Epoch milliseconds of the last write. */
  updatedAt: number
  /**
   * Durable watermark: the highest turn `endSeq` fully covered by a review result whose status
   * advances the watermark. `-1` means nothing has been consolidated yet.
   */
  throughSeq: number
  lastResult?: ConsolidationStateResult
  lastRequest?: ConsolidationStateRequest
}

/** A fresh state record for a session that has never been consolidated. */
export function freshConsolidationState(sessionId: string, now = Date.now()): ConsolidationState {
  return {
    schemaVersion: CONSOLIDATION_STATE_SCHEMA_VERSION,
    sessionId,
    updatedAt: now,
    throughSeq: -1,
  }
}

/** Minimal structural event envelope used to read legacy v1.0.x consolidation events. */
export interface LegacyConsolidationEvent {
  type: string
  seq?: number
  time?: number
  data: unknown
}

const RESULT_STATUSES: ReadonlySet<string> = new Set([
  'applied', 'noop', 'proposed', 'partial', 'conflict', 'failed',
])
const OUTCOME_STATUSES: ReadonlySet<string> = new Set([
  'applied', 'noop', 'proposed', 'skipped', 'conflict', 'failed',
])
const TARGETS: ReadonlySet<string> = new Set(['user', 'global', 'project', 'daily'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asSafeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
    ? [...value]
    : undefined
}

function asNumberArray(value: unknown): number[] | undefined {
  return Array.isArray(value) && value.every(item => typeof item === 'number' && Number.isSafeInteger(item))
    ? [...value]
    : undefined
}

/** Coerce one untrusted legacy result event payload into the durable state record. */
function coerceLegacyResult(throughSeq: number, data: unknown, at: number): ConsolidationStateResult | undefined {
  if (!isRecord(data)) return undefined
  const status = asNonEmptyString(data.status)
  if (status === undefined || !RESULT_STATUSES.has(status)) return undefined
  const candidatesRecord = isRecord(data.candidates) ? data.candidates : {}
  const candidates: ConsolidationStateCandidates = {
    user: asStringArray(candidatesRecord.user) ?? [],
    global: asStringArray(candidatesRecord.global) ?? [],
    project: asStringArray(candidatesRecord.project) ?? [],
    daily: asStringArray(candidatesRecord.daily) ?? [],
  }
  const rawOutcomes = Array.isArray(data.outcomes) ? data.outcomes : []
  const outcomes: ConsolidationStateOutcome[] = []
  for (const item of rawOutcomes) {
    if (!isRecord(item)) continue
    const target = asNonEmptyString(item.target)
    const outcomeStatus = asNonEmptyString(item.status)
    if (target === undefined || outcomeStatus === undefined
      || !TARGETS.has(target) || !OUTCOME_STATUSES.has(outcomeStatus)) continue
    const diff = isRecord(item.diff)
      && [item.diff.added, item.diff.kept, item.diff.removed].every(count => asSafeInteger(count) !== undefined)
      ? {
          added: asSafeInteger(item.diff.added)!,
          kept: asSafeInteger(item.diff.kept)!,
          removed: asSafeInteger(item.diff.removed)!,
        }
      : undefined
    const error = asNonEmptyString(item.error)
    outcomes.push({
      target: target as ConsolidationStateOutcome['target'],
      path: typeof item.path === 'string' ? item.path : '',
      status: outcomeStatus as ConsolidationStateOutcome['status'],
      ...(diff === undefined ? {} : { diff }),
      ...(error === undefined ? {} : { error }),
    })
  }
  const retryRecord = isRecord(data.retry) ? data.retry : undefined
  const retryFingerprint = retryRecord === undefined ? undefined : asNonEmptyString(retryRecord.fingerprint)
  const retryAttempt = retryRecord === undefined ? undefined : asSafeInteger(retryRecord.attempt)
  const retryDisposition = retryRecord?.disposition === 'backoff' || retryRecord?.disposition === 'file-change'
    ? retryRecord.disposition
    : undefined
  const retryFileStateHash = retryRecord === undefined ? undefined : asNonEmptyString(retryRecord.fileStateHash)
  const retryAfter = retryRecord === undefined ? undefined : asFiniteNumber(retryRecord.retryAfter)
  const retry: ConsolidationStateRetry | undefined = retryFingerprint === undefined
    || retryAttempt === undefined || retryDisposition === undefined
    ? undefined
    : {
        fingerprint: retryFingerprint,
        attempt: retryAttempt,
        disposition: retryDisposition,
        ...(retryFileStateHash === undefined ? {} : { fileStateHash: retryFileStateHash }),
        ...(retryAfter === undefined ? {} : { retryAfter }),
      }
  const rawTextHash = asNonEmptyString(data.rawTextHash)
  const error = asNonEmptyString(data.error)
  const result: ConsolidationStateResult = {
    throughSeq,
    status: status as ConsolidationStateStatus,
    candidates,
    outcomes,
    at,
    ...(retry === undefined ? {} : { retry }),
    ...(rawTextHash === undefined ? {} : { rawTextHash }),
    ...(error === undefined ? {} : { error }),
  }
  return result
}

/** Coerce one untrusted legacy request event payload into the compact request record. */
function coerceLegacyRequest(throughSeq: number, data: unknown, at: number): ConsolidationStateRequest | undefined {
  if (!isRecord(data)) return undefined
  const route = isRecord(data.route) ? data.route : {}
  const provider = asNonEmptyString(route.provider)
  const model = asNonEmptyString(route.model)
  if (provider === undefined || model === undefined) return undefined
  const maxTokens = asSafeInteger(data.maxTokens)
  if (maxTokens === undefined) return undefined
  const mode = data.mode === 'automatic' || data.mode === 'proposal' ? data.mode : undefined
  return {
    throughSeq,
    sourceTurns: asNumberArray(data.sourceTurns) ?? [],
    route: { provider, model },
    maxTokens,
    mode: mode ?? 'automatic',
    at,
  }
}

/**
 * Fold legacy v1.0.x consolidation events into a fresh state record. The watermark follows the
 * original semantics: the LAST result event whose status advances the watermark wins, so a later
 * failed result never moves the boundary backwards.
 */
export function legacyConsolidationState(
  events: readonly LegacyConsolidationEvent[],
  sessionId: string,
  now = Date.now(),
): ConsolidationState {
  const state = freshConsolidationState(sessionId, now)
  for (const event of events) {
    if (event.type !== 'memory/consolidation-result') continue
    const throughSeq = asSafeInteger(isRecord(event.data) ? event.data.throughSeq : undefined)
    if (throughSeq === undefined) continue
    const result = coerceLegacyResult(throughSeq, event.data, event.time ?? now)
    if (result !== undefined && advancesConsolidationWatermark(result)) {
      state.throughSeq = Math.max(state.throughSeq, throughSeq)
    }
  }
  const lastResultEvent = events.findLast(event =>
    event.type === 'memory/consolidation-result')
  if (lastResultEvent !== undefined) {
    const throughSeq = asSafeInteger(isRecord(lastResultEvent.data)
      ? lastResultEvent.data.throughSeq
      : undefined)
    if (throughSeq !== undefined) {
      const result = coerceLegacyResult(
        throughSeq,
        lastResultEvent.data,
        lastResultEvent.time ?? now,
      )
      if (result !== undefined) state.lastResult = result
    }
  }
  const lastRequestEvent = events.findLast(event =>
    event.type === 'memory/consolidation-request')
  if (lastRequestEvent !== undefined) {
    const throughSeq = asSafeInteger(isRecord(lastRequestEvent.data)
      ? lastRequestEvent.data.throughSeq
      : undefined)
    if (throughSeq !== undefined) {
      const request = coerceLegacyRequest(
        throughSeq,
        lastRequestEvent.data,
        lastRequestEvent.time ?? now,
      )
      if (request !== undefined) state.lastRequest = request
    }
  }
  return state
}

/** Merge one persisted review outcome into the durable state. */
export interface ConsolidationStatePatch {
  /** Compact audit record of the prepared review call; omitted when the call never prepared. */
  request?: ConsolidationStateRequest
  /** The review result to record; the watermark advances only when its status allows it. */
  result?: ConsolidationStateResult
}

/**
 * Apply one patch to a state record. The watermark is strictly monotonic and only ever advances
 * for a result whose status passes {@link advancesConsolidationWatermark}, so a partial failure
 * retains the batch for a controlled retry exactly like the legacy event log did.
 */
export function mergeConsolidationState(
  state: ConsolidationState,
  patch: ConsolidationStatePatch,
  now = Date.now(),
): ConsolidationState {
  const next: ConsolidationState = {
    ...state,
    sessionId: state.sessionId,
    updatedAt: now,
  }
  if (patch.request !== undefined) next.lastRequest = patch.request
  if (patch.result !== undefined) {
    next.lastResult = patch.result
    if (advancesConsolidationWatermark(patch.result)) {
      next.throughSeq = Math.max(next.throughSeq, patch.result.throughSeq)
    }
  }
  return next
}

/**
 * Parse and validate a persisted state record. Throws when the file is not the expected shape;
 * callers treat a malformed file as missing and rebuild from legacy events or a fresh watermark.
 */
export function parseConsolidationState(raw: unknown, sessionId: string): ConsolidationState {
  if (!isRecord(raw)) throw new Error('memory-consolidator: consolidation state file is malformed')
  if (raw.schemaVersion !== CONSOLIDATION_STATE_SCHEMA_VERSION) {
    throw new Error('memory-consolidator: consolidation state file is malformed')
  }
  const throughSeq = asSafeInteger(raw.throughSeq)
  const updatedAt = asFiniteNumber(raw.updatedAt)
  if (throughSeq === undefined || updatedAt === undefined || throughSeq < -1) {
    throw new Error('memory-consolidator: consolidation state file is malformed')
  }
  const state: ConsolidationState = {
    schemaVersion: CONSOLIDATION_STATE_SCHEMA_VERSION,
    sessionId,
    updatedAt,
    throughSeq,
  }
  if (raw.lastResult !== undefined) {
    if (!isRecord(raw.lastResult)) throw new Error('memory-consolidator: consolidation state file is malformed')
    const resultThroughSeq = asSafeInteger(raw.lastResult.throughSeq)
    const at = asFiniteNumber(raw.lastResult.at)
    if (resultThroughSeq === undefined || at === undefined) {
      throw new Error('memory-consolidator: consolidation state file is malformed')
    }
    const result = coerceLegacyResult(resultThroughSeq, raw.lastResult, at)
    if (result === undefined) throw new Error('memory-consolidator: consolidation state file is malformed')
    state.lastResult = result
  }
  if (raw.lastRequest !== undefined) {
    if (!isRecord(raw.lastRequest)) throw new Error('memory-consolidator: consolidation state file is malformed')
    const requestThroughSeq = asSafeInteger(raw.lastRequest.throughSeq)
    const at = asFiniteNumber(raw.lastRequest.at)
    if (requestThroughSeq === undefined || at === undefined) {
      throw new Error('memory-consolidator: consolidation state file is malformed')
    }
    const request = coerceLegacyRequest(requestThroughSeq, raw.lastRequest, at)
    if (request === undefined) throw new Error('memory-consolidator: consolidation state file is malformed')
    state.lastRequest = request
  }
  return state
}

/** Render the state record back to stable JSON for the atomic file write. */
export function serializeConsolidationState(state: ConsolidationState): string {
  return `${JSON.stringify(state, null, 2)}\n`
}

/** Turn a session id into one safe filename segment. */
export function safeConsolidationStateFile(sessionId: string): string {
  const sanitized = sessionId.replace(/[^A-Za-z0-9._-]/gu, '_').slice(0, 128)
  return sanitized.length === 0 ? 'session' : sanitized
}

/** Absolute path of the per-session consolidation state file under the DSH home. */
export function consolidationStatePath(home: string, sessionId: string): string {
  return join(home, 'memory', 'consolidation', `${safeConsolidationStateFile(sessionId)}.json`)
}
