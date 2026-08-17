/**
 * Pure reliability policies shared by the background consolidator and its
 * dependency-free regression checks.
 */

/** Commit statuses that can affect durable watermark advancement. */
export type ConsolidationOutcomeStatus =
  | 'applied'
  | 'noop'
  | 'proposed'
  | 'skipped'
  | 'conflict'
  | 'failed'

/** Minimal result shape needed to decide whether a source batch is complete. */
export interface ConsolidationWatermarkResult {
  status: 'applied' | 'noop' | 'proposed' | 'partial' | 'conflict' | 'failed'
  outcomes: readonly { status: ConsolidationOutcomeStatus }[]
}

/** A case-insensitive set diff that preserves the original entry text. */
export interface ManagedEntryDiff {
  added: string[]
  kept: string[]
  removed: string[]
}

/** Complete-list rewrite decision, including the only list safe to write automatically. */
export interface ManagedRewritePlan {
  blocked: boolean
  ratio: number
  diff: ManagedEntryDiff
  entries: string[]
}

/** Default maximum fraction of existing managed entries one automatic review may remove. */
export const DEFAULT_MAX_DELETION_RATIO = 0.5
/** Initial retry delay for transient consolidation failures. */
export const DEFAULT_RETRY_BASE_DELAY_MS = 60_000
/** Maximum retry delay for repeated transient consolidation failures. */
export const DEFAULT_RETRY_MAX_DELAY_MS = 3_600_000

/**
 * Successful results advance immediately. A mixed result advances only when
 * every non-success outcome is terminal (currently a revoked workspace write).
 */
export function advancesConsolidationWatermark(result: ConsolidationWatermarkResult): boolean {
  if (result.status === 'applied' || result.status === 'noop' || result.status === 'proposed') {
    return true
  }
  if (result.status !== 'partial') return false
  return !result.outcomes.some(outcome =>
    outcome.status === 'conflict' || outcome.status === 'failed')
}

function uniqueEntries(entries: readonly string[]): Map<string, string> {
  const values = new Map<string, string>()
  for (const entry of entries) {
    const folded = entry.toLocaleLowerCase()
    if (!values.has(folded)) values.set(folded, entry)
  }
  return values
}

/** Compare complete managed lists without treating casing-only changes as deletion. */
export function diffManagedEntries(
  before: readonly string[],
  after: readonly string[],
): ManagedEntryDiff {
  const previous = uniqueEntries(before)
  const next = uniqueEntries(after)
  return {
    added: [...next].filter(([key]) => !previous.has(key)).map(([, value]) => value),
    kept: [...next].filter(([key]) => previous.has(key)).map(([, value]) => value),
    removed: [...previous].filter(([key]) => !next.has(key)).map(([, value]) => value),
  }
}

/** Whether an automatic complete-list rewrite needs human review before deletion. */
export function deletionGuard(
  before: readonly string[],
  after: readonly string[],
  maxDeletionRatio: number,
  explicitForget: boolean,
): { blocked: boolean; ratio: number; diff: ManagedEntryDiff } {
  const diff = diffManagedEntries(before, after)
  const previousCount = uniqueEntries(before).size
  const ratio = previousCount === 0 ? 0 : diff.removed.length / previousCount
  const clearsManagedRegion = previousCount > 0 && uniqueEntries(after).size === 0
  return {
    blocked: !explicitForget
      && diff.removed.length > 0
      && (clearsManagedRegion || ratio > maxDeletionRatio),
    ratio,
    diff,
  }
}

/**
 * Plan a complete-list rewrite. When destructive deletion is guarded, retain
 * every existing entry verbatim and append only genuinely new entries from the
 * reviewer result. This prevents a guarded deletion from discarding unrelated
 * additions from the same source batch.
 */
export function planManagedRewrite(
  before: readonly string[],
  after: readonly string[],
  maxDeletionRatio: number,
  explicitForget: boolean,
): ManagedRewritePlan {
  const guard = deletionGuard(before, after, maxDeletionRatio, explicitForget)
  return {
    ...guard,
    entries: guard.blocked ? [...before, ...guard.diff.added] : [...after],
  }
}

/** Stable idempotency marker for one session review boundary. */
export function dailyReviewMarker(sessionId: string, throughSeq: number): string {
  return `<!-- dsh-memory-consolidator:session=${sessionId} through=${throughSeq} -->`
}

/** Append a dated section once, even when another target forces the batch to retry. */
export function appendDailyOnce(content: string, marker: string, section: string): string {
  if (section.length === 0 || content.includes(marker)) return content
  const prefix = content.length === 0 ? '' : `${content.replace(/\s+$/u, '')}\n\n`
  return `${prefix}${section}`
}

/** Bounded exponential delay for repeated failures with the same fingerprint. */
export function consolidationRetryDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const exponent = Math.max(0, Math.min(30, attempt - 1))
  return Math.min(maxDelayMs, baseDelayMs * (2 ** exponent))
}

/** Decide whether a persisted retry record suppresses this idle transition. */
export function shouldBlockConsolidationRetry(
  retry: {
    disposition: 'backoff' | 'file-change'
    fileStateHash?: string
    retryAfter?: number
  } | undefined,
  currentFileStateHash: string,
  nowMs: number,
): boolean {
  if (retry === undefined) return false
  if (retry.fileStateHash !== undefined && retry.fileStateHash !== currentFileStateHash) {
    return false
  }
  if (retry.disposition === 'file-change') return true
  return retry.retryAfter !== undefined && nowMs < retry.retryAfter
}
