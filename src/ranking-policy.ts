/**
 * Provider-neutral tournament orchestration for bounded semantic ranking.
 */

/** Minimal ranked value shape: the winning candidate is fed into the next round. */
export interface TournamentRanked<T> {
  candidate: T
}

/** Candidate fields required for exact-evidence validation. */
export interface ExactEvidenceCandidate {
  sessionId: string
  text: string
}

/** A validated semantic hit. */
export interface ExactEvidenceRanked<T> extends TournamentRanked<T> {
  evidence: string
}

/**
 * Parse one strict ranking object. A genuinely empty hit list is a successful
 * no-match result; a non-empty list whose rows are all invalid remains an error.
 */
export function parseExactEvidenceRanking<T extends ExactEvidenceCandidate>(
  text: string,
  candidates: readonly T[],
  limit: number,
): ExactEvidenceRanked<T>[] {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('semantic ranking returned no JSON object')
  const value: unknown = JSON.parse(text.slice(start, end + 1))
  if (typeof value !== 'object' || value === null || !Array.isArray((value as { hits?: unknown }).hits)) {
    throw new Error('semantic ranking JSON must contain a hits array')
  }
  const rawHits = (value as { hits: unknown[] }).hits
  if (rawHits.length === 0) return []

  const byId = new Map(candidates.map(candidate => [candidate.sessionId, candidate]))
  const seen = new Set<string>()
  const ranked: ExactEvidenceRanked<T>[] = []
  for (const raw of rawHits) {
    if (ranked.length >= limit) break
    if (typeof raw !== 'object' || raw === null) continue
    const { sessionId, score, evidence } = raw as Record<string, unknown>
    if (typeof sessionId !== 'string' || seen.has(sessionId)) continue
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1) continue
    const candidate = byId.get(sessionId)
    if (candidate === undefined || typeof evidence !== 'string' || evidence.length === 0
      || !candidate.text.includes(evidence)) continue
    seen.add(sessionId)
    ranked.push({ candidate, evidence })
  }
  if (ranked.length === 0) throw new Error('semantic ranking returned no valid candidate hits')
  return ranked
}

/**
 * Rank arbitrarily many candidates through bounded batches.
 *
 * Empty batches are legitimate and contribute no survivors. Configuration
 * normally guarantees `limit < batchSize`; the progress check also prevents a
 * malformed direct caller from recursing forever.
 */
export async function rankTournament<T, R extends TournamentRanked<T>>(
  candidates: readonly T[],
  batchSize: number,
  limit: number,
  rankBatch: (batch: readonly T[], batchLimit: number) => Promise<readonly R[]>,
): Promise<R[]> {
  if (candidates.length === 0) return []
  if (candidates.length <= batchSize) {
    return [...await rankBatch(candidates, Math.min(limit, candidates.length))]
  }

  const survivors: T[] = []
  for (let start = 0; start < candidates.length; start += batchSize) {
    const batch = candidates.slice(start, start + batchSize)
    const ranked = await rankBatch(batch, Math.min(limit, batch.length))
    survivors.push(...ranked.map(item => item.candidate))
  }
  if (survivors.length === 0) return []
  if (survivors.length >= candidates.length) {
    throw new Error('semantic ranking tournament made no progress')
  }
  return rankTournament(survivors, batchSize, limit, rankBatch)
}
