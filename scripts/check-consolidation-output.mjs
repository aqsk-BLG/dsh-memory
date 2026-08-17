import assert from 'node:assert/strict'
import {
  EMPTY_PATCH_CANDIDATES,
  maxReviewOutputCodePoints,
  parseConsolidationOutput,
} from '../src/consolidation-output.ts'

const budgets = {
  userBudgetChars: 500,
  globalBudgetChars: 500,
  projectBudgetChars: 500,
  dailyBudgetChars: 500,
}

const parsed = parseConsolidationOutput(JSON.stringify({
  user: { add: ['Prefers concise answers', 'prefers concise answers'], remove: [] },
  global: { add: [], remove: ['Old exact rule'] },
  project: { add: ['Use pnpm'], remove: [] },
  daily: ['Implemented incremental memory review'],
}), budgets)
assert.deepEqual(parsed.user.add, ['Prefers concise answers'])
assert.deepEqual(parsed.global.remove, ['Old exact rule'])
assert.deepEqual(parsed.project.add, ['Use pnpm'])

assert.throws(() => parseConsolidationOutput(JSON.stringify({
  user: { add: ['same'], remove: ['SAME'] },
  global: { add: [], remove: [] },
  project: { add: [], remove: [] },
  daily: [],
}), budgets), /must not add and remove the same entry/u)

assert.throws(() => parseConsolidationOutput(JSON.stringify({
  user: { add: [], remove: [], replace: [] },
  global: { add: [], remove: [] },
  project: { add: [], remove: [] },
  daily: [],
}), budgets), /must contain exactly add and remove/u)

assert.throws(() => parseConsolidationOutput(JSON.stringify({
  user: { add: ['api_key=abcdefghijklmnop'], remove: [] },
  global: { add: [], remove: [] },
  project: { add: [], remove: [] },
  daily: [],
}), budgets), /secret-like/u)

assert.throws(() => parseConsolidationOutput(JSON.stringify({
  user: { add: ['x'.repeat(600)], remove: [] },
  global: { add: [], remove: [] },
  project: { add: [], remove: [] },
  daily: [],
}), budgets), /exceeds its 500-character budget/u)

const emptyEnvelopeSize = Array.from(JSON.stringify(EMPTY_PATCH_CANDIDATES())).length
assert.equal(
  maxReviewOutputCodePoints({
    userBudgetChars: 1,
    globalBudgetChars: 2,
    projectBudgetChars: 3,
    dailyBudgetChars: 4,
  }),
  emptyEnvelopeSize + 12 * (2 * (1 + 2 + 3) + 4),
)

console.log('incremental consolidation JSON validation and file-budget-derived output bound pass')
