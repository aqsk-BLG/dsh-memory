import assert from 'node:assert/strict'
import {
  advancesConsolidationWatermark,
  appendDailyOnce,
  consolidationReviewBatchSize,
  consolidationRetryDelay,
  dailyReviewMarker,
  deletionGuard,
  planManagedPatch,
  planManagedRewrite,
  shouldBlockConsolidationRetry,
  shouldStartConsolidationReview,
} from '../src/consolidation-policy.ts'

assert.equal(shouldStartConsolidationReview(0, 1, false), false)
assert.equal(shouldStartConsolidationReview(1, 1, false), true)
assert.equal(shouldStartConsolidationReview(1, 10, false), false)
assert.equal(shouldStartConsolidationReview(1, 10, true), true)
assert.equal(consolidationReviewBatchSize(0, 1, 20, false), 0)
assert.equal(consolidationReviewBatchSize(5, 1, 20, false), 1)
assert.equal(consolidationReviewBatchSize(12, 10, 20, false), 10)
assert.equal(consolidationReviewBatchSize(3, 10, 20, true), 3)
assert.equal(consolidationReviewBatchSize(12, 10, 5, false), 5)

assert.equal(advancesConsolidationWatermark({
  status: 'partial',
  outcomes: [{ status: 'applied' }, { status: 'conflict' }],
}), false)
assert.equal(advancesConsolidationWatermark({
  status: 'partial',
  outcomes: [{ status: 'noop' }, { status: 'skipped' }],
}), true)

const marker = dailyReviewMarker('session-1', 42)
const section = `${marker}\n## Memory consolidation\n\n- durable note\n`
const once = appendDailyOnce('', marker, section)
assert.equal(appendDailyOnce(once, marker, section), once)
assert.equal(once.match(/durable note/gu)?.length, 1)

assert.equal(deletionGuard(['one', 'two'], ['one'], 0.5, false).blocked, false)
assert.equal(deletionGuard(['one', 'two', 'three'], ['one'], 0.5, false).blocked, true)
assert.equal(deletionGuard(['one'], [], 0.5, false).blocked, true)
assert.equal(deletionGuard(['one'], [], 0.5, true).blocked, false)

const guardedRewrite = planManagedRewrite(
  ['keep', 'old-one', 'old-two'],
  ['KEEP', 'new-entry'],
  0.5,
  false,
)
assert.equal(guardedRewrite.blocked, true)
assert.deepEqual(guardedRewrite.diff.added, ['new-entry'])
assert.deepEqual(guardedRewrite.entries, ['keep', 'old-one', 'old-two', 'new-entry'])
assert.deepEqual(planManagedRewrite(['one', 'two'], ['one'], 0.5, false).entries, ['one'])
assert.deepEqual(planManagedRewrite(['one'], [], 0.5, true).entries, [])

const incremental = planManagedPatch(
  ['one', 'two'],
  { add: ['three'], remove: ['ONE'] },
  0.5,
  false,
)
assert.equal(incremental.blocked, false)
assert.deepEqual(incremental.entries, ['two', 'three'])
const unknownRemoval = planManagedPatch(
  ['keep'],
  { add: ['safe addition'], remove: ['hallucinated old entry'] },
  0.5,
  true,
)
assert.equal(unknownRemoval.blocked, true)
assert.deepEqual(unknownRemoval.unknownRemovals, ['hallucinated old entry'])
assert.deepEqual(unknownRemoval.entries, ['keep', 'safe addition'])
const guardedPatch = planManagedPatch(
  ['keep', 'old-one', 'old-two'],
  { add: ['new-entry'], remove: ['old-one', 'old-two'] },
  0.5,
  false,
)
assert.equal(guardedPatch.blocked, true)
assert.deepEqual(guardedPatch.entries, ['keep', 'old-one', 'old-two', 'new-entry'])
assert.deepEqual(planManagedPatch(
  ['one'],
  { add: [], remove: ['one'] },
  0.5,
  true,
).entries, [])
assert.equal(advancesConsolidationWatermark({
  status: 'proposed',
  outcomes: [{ status: 'proposed' }],
}), true)

assert.equal(consolidationRetryDelay(1, 1_000, 8_000), 1_000)
assert.equal(consolidationRetryDelay(4, 1_000, 8_000), 8_000)
assert.equal(consolidationRetryDelay(20, 1_000, 8_000), 8_000)
assert.equal(shouldBlockConsolidationRetry({
  disposition: 'file-change',
  fileStateHash: 'same',
}, 'same', 0), true)
assert.equal(shouldBlockConsolidationRetry({
  disposition: 'file-change',
  fileStateHash: 'old',
}, 'changed', 0), false)
assert.equal(shouldBlockConsolidationRetry({
  disposition: 'backoff',
  fileStateHash: 'same',
  retryAfter: 2_000,
}, 'same', 1_000), true)
assert.equal(shouldBlockConsolidationRetry({
  disposition: 'backoff',
  fileStateHash: 'same',
  retryAfter: 2_000,
}, 'same', 2_000), false)

console.log('consolidation trigger, watermark, idempotency, incremental patch, deletion guard, and retry policies pass')
