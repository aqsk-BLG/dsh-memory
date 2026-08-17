import assert from 'node:assert/strict'
import { parseExactEvidenceRanking, rankTournament } from '../src/ranking-policy.ts'

const exactCandidate = { sessionId: 'exact', text: 'the exact evidence lives here' }
assert.deepEqual(parseExactEvidenceRanking('{"hits":[]}', [exactCandidate], 5), [])
assert.throws(
  () => parseExactEvidenceRanking(
    '{"hits":[{"sessionId":"exact","score":1,"evidence":"paraphrased evidence"}]}',
    [exactCandidate],
    5,
  ),
  /no valid candidate hits/,
)
assert.equal(
  parseExactEvidenceRanking(
    '{"hits":[{"sessionId":"exact","score":1,"evidence":"exact evidence"}]}',
    [exactCandidate],
    5,
  )[0].candidate,
  exactCandidate,
)

for (const size of [0, 31, 61]) {
  const candidates = Array.from({ length: size }, (_, index) => index)
  let calls = 0
  const ranked = await rankTournament(candidates, 30, 20, async (batch, limit) => {
    calls += 1
    // A precise query may legitimately miss entire shards.
    if (batch[0] !== undefined && batch[0] >= 30 && batch[0] < 60) return []
    return batch.slice(0, limit).map(candidate => ({ candidate }))
  })
  assert.ok(ranked.length <= 20)
  if (size === 0) assert.equal(calls, 0)
  if (size > 0) assert.ok(calls > 0)
}

await assert.rejects(
  rankTournament([1, 2, 3], 2, 2, async batch => batch.map(candidate => ({ candidate }))),
  /made no progress/,
)

console.log('semantic tournament accepts empty shards and converges for 31/61 candidates')
