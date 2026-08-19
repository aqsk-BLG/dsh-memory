/**
 * Vocabulary shared with the v1.0.x event log. Both events are LEGACY: since 1.1.0 the
 * consolidator never appends them (official DeepSeek Harness builds refuse logs containing
 * catalog-unknown, non-ignorable event types, and `Session.append` cannot set the ignorable
 * marker). They are retained solely so the migration path can type legacy events read from
 * old session logs. Durable state now lives in `$DSH_HOME/memory/consolidation/<session>.json`
 * (see src/consolidation-state.ts).
 * @module dsh-memory/consolidator-types
 */

import type { Message } from '@deepseek-ai/dsh-llm/types'

/** Whether a review may write files or only publish a proposal. */
export type MemoryConsolidationMode = 'automatic' | 'proposal'

/** Exact provider/model route used by one background review. */
export interface MemoryConsolidationRoute {
  provider: string
  model: string
}

/** Live workspace authority captured before one review. */
export type MemoryConsolidationWorkspace =
  | { kind: 'global-only' | 'ungrouped' }
  | {
    kind: 'workspace'
    workspacePath: string
    curatedMemoryFile: string
    dailyFile: string
  }

/** One file snapshot against which a controlled commit performs conflict detection. */
export interface MemoryConsolidationFileSnapshot {
  target: 'user' | 'global' | 'project' | 'daily'
  path: string
  contentHash: string
  existed: boolean
  managedRegionValid: boolean
}

/** Validated materialized managed lists plus new daily-log entries derived from the reviewer patch. */
export interface MemoryConsolidationCandidates {
  user: string[]
  global: string[]
  project: string[]
  daily: string[]
}

/** Auditable managed-list change counts without duplicating memory text into result metadata. */
export interface MemoryConsolidationEntryDiff {
  added: number
  kept: number
  removed: number
}

/** Per-file commit result retained even when another target fails. */
export interface MemoryConsolidationTargetOutcome {
  target: 'user' | 'global' | 'project' | 'daily'
  path: string
  status: 'applied' | 'noop' | 'proposed' | 'skipped' | 'conflict' | 'failed'
  /** Managed-list change counts; omitted for append-only daily logs. */
  diff?: MemoryConsolidationEntryDiff
  /** Safe diagnostic or proposal reason. */
  error?: string
}

/** Persisted retry control for an unfinished source batch. */
export interface MemoryConsolidationRetry {
  /** Hash of the batch boundary, file snapshot, and safe failure signature. */
  fingerprint: string
  /** Consecutive occurrence count for the same fingerprint. */
  attempt: number
  /** Transient failures wait; malformed managed regions wait for file repair. */
  disposition: 'backoff' | 'file-change'
  /** Hash of the file snapshot used to detect an operator repair or conflict change. */
  fileStateHash?: string
  /** Earliest retry time for transient failures, in epoch milliseconds. */
  retryAfter?: number
}

/** Overall result of one review. Retryable mixed results do not advance the durable watermark. */
export type MemoryConsolidationResultStatus =
  | 'applied'
  | 'noop'
  | 'proposed'
  | 'partial'
  | 'conflict'
  | 'failed'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * LEGACY (v1.0.x) tools-free auxiliary request record. No longer appended: the compact
     * `lastRequest` field of the consolidation state file replaces it. Declared only so the
     * migration path can type events read from old session logs.
     */
    'memory/consolidation-request': {
      throughSeq: number
      sourceTurns: number[]
      sourceEventSeqs: number[]
      route: MemoryConsolidationRoute
      system: string
      messages: Message[]
      maxTokens: number
      mode: MemoryConsolidationMode
      workspace: MemoryConsolidationWorkspace
      files: MemoryConsolidationFileSnapshot[]
    }
    /**
     * LEGACY (v1.0.x) validated review output and commit outcomes. No longer appended: the
     * consolidation state file (`$DSH_HOME/memory/consolidation/<session>.json`) now carries the
     * watermark, last result, and retry control. Declared only so the migration path can type
     * events read from old session logs.
     */
    'memory/consolidation-result': {
      throughSeq: number
      status: MemoryConsolidationResultStatus
      candidates: MemoryConsolidationCandidates
      outcomes: MemoryConsolidationTargetOutcome[]
      retry?: MemoryConsolidationRetry
      rawTextHash?: string
      error?: string
    }
  }
}

export {}
