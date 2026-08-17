import assert from 'node:assert/strict'
import {
  advancesConsolidationWatermark,
  appendDailyOnce,
  consolidationRetryDelay,
  dailyReviewMarker,
  deletionGuard,
  shouldBlockConsolidationRetry,
} from '../src/consolidation-policy.ts'

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

console.log('consolidation watermark, idempotency, deletion guard, and retry policies pass')
