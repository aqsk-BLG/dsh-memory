import assert from 'node:assert/strict'
import { collectEligibleTurns } from '../src/eligible-turns.ts'

const events = []
let seq = 0
const add = (type, data) => {
  const event = { type, seq: ++seq, data }
  events.push(event)
  return event.seq
}

function turn(turnNumber, user, assistant, options = {}) {
  add('turn/start', { turn: turnNumber })
  const content = [{ type: 'text', text: user }]
  if (options.image) content.push({ type: 'image' })
  add('user/message', { source: { kind: options.sourceKind ?? 'user' }, content })
  for (const tool of options.tools ?? []) {
    add('tool/call', { turn: turnNumber, name: tool })
  }
  if (options.toolResult !== undefined) {
    add('tool/result', {
      turn: turnNumber,
      message: { content: [{ type: 'text', text: options.toolResult }] },
    })
  }
  if (assistant !== undefined) {
    add('assistant/message', {
      turn: turnNumber,
      message: { content: [{ type: 'text', text: assistant }] },
    })
  }
  if (options.incomplete) return undefined
  return add('turn/end', {
    turn: turnNumber,
    reason: { kind: options.reason ?? 'completed' },
  })
}

turn(1, '你好', '你好，很高兴见到你')
turn(2, '天气?', '晴')
const firstSubstantiveEnd = turn(3, 'Please keep this project convention', 'I will keep this project convention.')
turn(4, 'x', 'y', { tools: ['read_file', 'read_file'], toolResult: 'tool evidence' })
turn(5, '看', '已查看图片', { image: true })
turn(6, '记住代号是 ORBIT', '已经记录')
turn(7, '请忘掉记忆中的旧规则', '我会移除旧规则')
turn(8, '别忘代号是 NOVA', '不会忘记')
turn(9, 'This failed turn is otherwise substantive', 'It failed after producing text.', { reason: 'failed' })
turn(10, 'This max token turn is substantive', 'It reached the token boundary.', { reason: 'max-tokens' })
turn(11, 'This turn never completes', 'Still running', { incomplete: true })
turn(12, 'This is not a direct user message', 'It must not count.', { sourceKind: 'system' })

const config = { minUserChars: 5, minAssistantChars: 5 }
const selected = collectEligibleTurns(events, -1, config)
assert.deepEqual(selected.map(item => item.turn), [3, 4, 5, 6, 7, 8, 10])
assert.deepEqual(selected.find(item => item.turn === 4)?.toolNames, ['read_file'])
assert.equal(selected.find(item => item.turn === 4)?.toolResults, 'tool evidence')
assert.match(selected.find(item => item.turn === 5)?.user ?? '', /\[image\]/u)
assert.equal(selected.find(item => item.turn === 6)?.explicitRemember, true)
assert.equal(selected.find(item => item.turn === 7)?.explicitForget, true)
assert.equal(selected.find(item => item.turn === 8)?.explicitRemember, true)
assert.equal(selected.find(item => item.turn === 8)?.explicitForget, false)
assert.ok(selected.every(item => item.sourceEventSeqs.at(0) === item.startSeq))
assert.ok(selected.every(item => item.sourceEventSeqs.at(-1) === item.endSeq))

assert.deepEqual(
  collectEligibleTurns(events, firstSubstantiveEnd, config).map(item => item.turn),
  [4, 5, 6, 7, 8, 10],
)

console.log('eligible-turn success, threshold, tool, image, watermark, and remember/forget policies pass')
