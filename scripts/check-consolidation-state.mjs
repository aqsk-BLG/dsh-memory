import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CONSOLIDATION_STATE_SCHEMA_VERSION,
  consolidationStatePath,
  freshConsolidationState,
  legacyConsolidationState,
  mergeConsolidationState,
  parseConsolidationState,
  safeConsolidationStateFile,
  serializeConsolidationState,
} from '../src/consolidation-state.ts'

// Fresh state starts with no watermark and no recorded reviews.
const fresh = freshConsolidationState('session-a', 1_000)
assert.equal(fresh.schemaVersion, CONSOLIDATION_STATE_SCHEMA_VERSION)
assert.equal(fresh.throughSeq, -1)
assert.equal(fresh.lastResult, undefined)
assert.equal(fresh.lastRequest, undefined)

// A non-advancing patch (failed) must not move the watermark, but does record the result.
let state = freshConsolidationState('session-a', 1_000)
state = mergeConsolidationState(state, {
  result: {
    throughSeq: 9,
    status: 'failed',
    candidates: { user: [], global: [], project: [], daily: [] },
    outcomes: [{ target: 'global', path: '/MEMORY.md', status: 'failed', error: 'boom' }],
    retry: { fingerprint: 'f1', attempt: 1, disposition: 'backoff', retryAfter: 2_000 },
    error: 'boom',
    at: 1_100,
  },
}, 1_100)
assert.equal(state.throughSeq, -1)
assert.equal(state.lastResult?.status, 'failed')
assert.equal(state.lastResult?.retry?.attempt, 1)

// A partial result with a retryable conflict must not advance the watermark either.
state = mergeConsolidationState(state, {
  result: {
    throughSeq: 10,
    status: 'partial',
    candidates: { user: [], global: [], project: [], daily: [] },
    outcomes: [
      { target: 'user', path: '/USER.md', status: 'applied', diff: { added: 1, kept: 0, removed: 0 } },
      { target: 'global', path: '/MEMORY.md', status: 'conflict' },
    ],
    retry: { fingerprint: 'f2', attempt: 1, disposition: 'backoff', retryAfter: 5_000 },
    at: 1_200,
  },
}, 1_200)
assert.equal(state.throughSeq, -1)
assert.equal(state.lastResult?.status, 'partial')

// An applied result advances the watermark, monotonically.
state = mergeConsolidationState(state, {
  request: { throughSeq: 10, sourceTurns: [3, 4], route: { provider: 'p', model: 'm' }, maxTokens: 4096, mode: 'automatic', at: 1_250 },
  result: {
    throughSeq: 10,
    status: 'applied',
    candidates: { user: [], global: ['one'], project: [], daily: ['note'] },
    outcomes: [{ target: 'global', path: '/MEMORY.md', status: 'applied', diff: { added: 1, kept: 0, removed: 0 } }],
    at: 1_300,
  },
}, 1_300)
assert.equal(state.throughSeq, 10)
assert.equal(state.lastRequest?.route.model, 'm')

// A later failed result keeps the watermark.
state = mergeConsolidationState(state, {
  result: {
    throughSeq: 15,
    status: 'failed',
    candidates: { user: [], global: [], project: [], daily: [] },
    outcomes: [],
    retry: { fingerprint: 'f3', attempt: 1, disposition: 'backoff', retryAfter: 9_000 },
    error: 'x',
    at: 1_400,
  },
}, 1_400)
assert.equal(state.throughSeq, 10)

// Roundtrip through serialization keeps every field.
const parsed = parseConsolidationState(JSON.parse(serializeConsolidationState(state)), 'session-a')
assert.deepEqual(parsed, state)

// Legacy events migrate: the LAST advancing result wins the watermark, a later failure does not
// move it backwards, and the last result/request events become the recorded records.
const events = [
  { type: 'turn/start', seq: 0, data: { turn: 1 } },
  { type: 'memory/consolidation-result', seq: 1, time: 2_000, data: {
    throughSeq: 5, status: 'applied', candidates: { user: [], global: ['old'], project: [], daily: ['d'] },
    outcomes: [{ target: 'global', path: '/MEMORY.md', status: 'applied' }],
  } },
  { type: 'memory/consolidation-request', seq: 2, time: 2_100, data: {
    throughSeq: 9, sourceTurns: [3], route: { provider: 'p', model: 'm' }, maxTokens: 2048, mode: 'automatic',
  } },
  { type: 'memory/consolidation-result', seq: 3, time: 2_200, data: {
    throughSeq: 9, status: 'failed', candidates: { user: [], global: [], project: [], daily: [] },
    outcomes: [], retry: { fingerprint: 'r1', attempt: 2, disposition: 'backoff', retryAfter: 9_999 },
    error: 'transient',
  } },
]
const migrated = legacyConsolidationState(events, 'session-b', 3_000)
assert.equal(migrated.throughSeq, 5)
assert.equal(migrated.lastResult?.throughSeq, 9)
assert.equal(migrated.lastResult?.status, 'failed')
assert.equal(migrated.lastResult?.retry?.attempt, 2)
assert.equal(migrated.lastRequest?.maxTokens, 2048)

// A malformed legacy payload is skipped instead of poisoning the state.
const hostile = legacyConsolidationState([
  { type: 'memory/consolidation-result', seq: 0, data: { throughSeq: 'not-a-number', status: 'applied' } },
  { type: 'memory/consolidation-result', seq: 1, data: null },
], 'session-c')
assert.equal(hostile.throughSeq, -1)
assert.equal(hostile.lastResult, undefined)

// State file naming: session ids become safe filename segments.
assert.equal(safeConsolidationStateFile('086dde26-e556-46ee-ac51-33a4a5efdfe9'), '086dde26-e556-46ee-ac51-33a4a5efdfe9')
assert.equal(safeConsolidationStateFile('../../evil'), '.._.._evil')
assert.equal(safeConsolidationStateFile(''), 'session')
assert.equal(safeConsolidationStateFile('a'.repeat(300)).length, 128)
assert.ok(consolidationStatePath('/home', 's-1').includes(join('memory', 'consolidation')))
assert.ok(consolidationStatePath(join(tmpdir(), 'home'), 's-1').endsWith('.json'))

// A corrupt persisted file is rejected with the stable diagnostic.
assert.throws(() => parseConsolidationState({ schemaVersion: 99 }, 'session-d'), /consolidation state file is malformed/u)
assert.throws(() => parseConsolidationState('not json', 'session-d'), /consolidation state file is malformed/u)

console.log('consolidation state watermark, monotonic advance, retry control, serialization, legacy migration, and safe file naming pass')
