import assert from 'node:assert/strict'
import { collectSemanticRankingText } from '../src/ranking-output.ts'

assert.equal(
  collectSemanticRankingText([
    { type: 'reasoning', text: 'private chain of thought' },
    { type: 'text', text: '{"hits":[]}' },
  ]),
  '{"hits":[]}',
)

assert.throws(
  () => collectSemanticRankingText([{ type: 'reasoning', text: 'reasoning only' }]),
  /produced no text/,
)

assert.throws(
  () => collectSemanticRankingText([{ type: 'image' }]),
  /unsupported block type/,
)

console.log('semantic ranker accepts reasoning plus final text and rejects unsupported output')
