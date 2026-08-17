/** Dependency-free validation for the consolidator's incremental JSON protocol. */

import { managedRegionCodePoints } from './managed-region.ts'

/** Add/remove intent for one curated managed region. */
export interface ConsolidationManagedPatch {
  add: string[]
  remove: string[]
}

/** Strict model output after normalization. Daily notes remain append-only. */
export interface ConsolidationPatchCandidates {
  user: ConsolidationManagedPatch
  global: ConsolidationManagedPatch
  project: ConsolidationManagedPatch
  daily: string[]
}

/** Character budgets that ultimately authorize file writes. */
export interface ConsolidationOutputBudgets {
  userBudgetChars: number
  globalBudgetChars: number
  projectBudgetChars: number
  dailyBudgetChars: number
}

export const EMPTY_PATCH_CANDIDATES = (): ConsolidationPatchCandidates => ({
  user: { add: [], remove: [] },
  global: { add: [], remove: [] },
  project: { add: [], remove: [] },
  daily: [],
})

export const FORBIDDEN_INVISIBLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200d\u2060\ufeff]/u
const SECRET_ASSIGNMENT = /(?:api[ _-]?key|access[ _-]?token|token|password|secret)\s*[:=]\s*["']?[a-z0-9_+/.=-]{12,}/iu
const SECRET_PREFIXES = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/u,
  /\bsk-[A-Za-z0-9_-]{12,}\b/u,
  /\bghp_[A-Za-z0-9]{12,}\b/u,
  /\bgithub_pat_[A-Za-z0-9_]{12,}\b/u,
  /\bxox[baprs]-[A-Za-z0-9-]{12,}\b/u,
  /\bAKIA[A-Z0-9]{16}\b/u,
]

function strictRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`review output ${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function exactKeys(record: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(record).sort()
  const sortedExpected = [...expected].sort()
  if (actual.length !== sortedExpected.length
    || actual.some((key, index) => key !== sortedExpected[index])) {
    throw new Error(`review output ${label} must contain exactly ${expected.join(' and ')}`)
  }
}

function validatesEntry(value: unknown): value is string {
  return typeof value === 'string'
    && value.trim().length > 0
    && value === value.trim()
    && !/[\r\n]/u.test(value)
    && !FORBIDDEN_INVISIBLE.test(value)
    && !SECRET_ASSIGNMENT.test(value)
    && !SECRET_PREFIXES.some(pattern => pattern.test(value))
}

function normalizeEntries(value: unknown, key: string, budget: number): string[] {
  if (!Array.isArray(value)) throw new Error(`review output ${key} must be an array`)
  if (value.some(entry => !validatesEntry(entry))) {
    throw new Error(`review output ${key} contains an empty, multiline, invisible, or secret-like entry`)
  }
  const seen = new Set<string>()
  const entries: string[] = []
  for (const entry of value as string[]) {
    const folded = entry.toLocaleLowerCase()
    if (seen.has(folded)) continue
    seen.add(folded)
    entries.push(entry)
  }
  if (managedRegionCodePoints(entries) > budget) {
    throw new Error(`review output ${key} exceeds its ${budget}-character budget`)
  }
  return entries
}

function normalizePatch(value: unknown, key: string, budget: number): ConsolidationManagedPatch {
  const record = strictRecord(value, key)
  exactKeys(record, ['add', 'remove'], key)
  const add = normalizeEntries(record.add, `${key}.add`, budget)
  const remove = normalizeEntries(record.remove, `${key}.remove`, budget)
  const removeKeys = new Set(remove.map(entry => entry.toLocaleLowerCase()))
  if (add.some(entry => removeKeys.has(entry.toLocaleLowerCase()))) {
    throw new Error(`review output ${key} must not add and remove the same entry`)
  }
  return { add, remove }
}

/** Parse the strict incremental four-key reviewer contract. */
export function parseConsolidationOutput(
  text: string,
  budgets: ConsolidationOutputBudgets,
): ConsolidationPatchCandidates {
  let parsed: unknown
  try {
    parsed = JSON.parse(text.trim())
  } catch {
    throw new Error('review output must be one strict JSON object')
  }
  const record = strictRecord(parsed, 'root')
  exactKeys(record, ['user', 'global', 'project', 'daily'], 'root')
  return {
    user: normalizePatch(record.user, 'user', budgets.userBudgetChars),
    global: normalizePatch(record.global, 'global', budgets.globalBudgetChars),
    project: normalizePatch(record.project, 'project', budgets.projectBudgetChars),
    daily: normalizeEntries(record.daily, 'daily', budgets.dailyBudgetChars),
  }
}

/**
 * Visible-output circuit breaker derived only from the configured file
 * budgets. Twelve covers a JSON-escaped surrogate pair for each input code
 * point; the exact empty-envelope size covers structural syntax.
 */
export function maxReviewOutputCodePoints(budgets: ConsolidationOutputBudgets): number {
  const emptyEnvelope = JSON.stringify(EMPTY_PATCH_CANDIDATES())
  const entryBudget = 2 * (
    budgets.userBudgetChars
    + budgets.globalBudgetChars
    + budgets.projectBudgetChars
  ) + budgets.dailyBudgetChars
  return Array.from(emptyEnvelope).length + 12 * entryBudget
}
