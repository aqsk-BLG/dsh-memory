/**
 * Dependency-free turn selection for background memory consolidation.
 * The structural event type keeps this policy runnable without DSH packages.
 */

/** Minimal session-event surface used by the selector. */
export interface ConsolidationSessionEvent {
  type: string
  seq: number
  data: unknown
}

/** Short-turn thresholds used by the selector. */
export interface EligibleTurnConfig {
  minUserChars: number
  minAssistantChars: number
}

/** One eligible completed turn represented to the reviewer. */
export interface ConsolidationTurn {
  turn: number
  startSeq: number
  endSeq: number
  sourceEventSeqs: number[]
  user: string
  assistant: string
  toolNames: string[]
  toolResults: string
  explicitRemember: boolean
  explicitForget: boolean
}

interface OpenTurn {
  turn: number
  startSeq: number
  sourceEventSeqs: number[]
  human: string[]
  assistant: string[]
  toolNames: string[]
  toolResults: string[]
  hasImage: boolean
}

const GREETING_ONLY = /^(?:你(?:好|好呀|好啊)|您好|哈[喽啰罗]|嗨|早上好|上午好|中午好|下午好|晚上好|hello|hi|hey|good\s+(?:morning|afternoon|evening))[\s!！。.?？~～]*$/iu
const EXPLICIT_REMEMBER = /(?:记住|记得|请记|别忘|写入记忆|保存(?:到|进)?记忆|remember\b|don['’]?t\s+forget\b|save\b.{0,20}\bmemory\b)/iu
const EXPLICIT_FORGET = /(?:忘(?:掉|记)|删(?:除|掉).{0,30}记忆|从记忆中(?:删除|移除)|不要再记|清空.{0,20}记忆|forget\b|(?:remove|delete)\b.{0,30}\bmemory\b)/iu
const NEGATED_FORGET = /(?:别忘|不要忘|don['’]?t\s+forget\b|do\s+not\s+forget\b)/iu

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : undefined
}

/** Convert supported model-visible blocks to compact reviewer text. */
function textFromBlocks(value: unknown): string {
  if (!Array.isArray(value)) return ''
  const parts: string[] = []
  for (const valueBlock of value) {
    const block = record(valueBlock)
    if (block?.type === 'text' && typeof block.text === 'string') parts.push(block.text)
    else if (block?.type === 'image') parts.push('[image]')
    else if (block?.type === 'tool-result') parts.push(textFromBlocks(block.content))
  }
  return parts.filter(Boolean).join('\n').trim()
}

function containsImage(value: unknown): boolean {
  return Array.isArray(value) && value.some(item => record(item)?.type === 'image')
}

/** Whether one completed turn is substantive enough to count. */
function eligibleTurn(open: OpenTurn, config: EligibleTurnConfig): boolean {
  const user = open.human.join('\n').trim()
  const assistant = open.assistant.join('\n').trim()
  if (EXPLICIT_REMEMBER.test(user)) return true
  if (GREETING_ONLY.test(user)) return false
  if (open.toolNames.length > 0 || open.hasImage) return true
  return Array.from(user).length >= config.minUserChars
    && Array.from(assistant).length >= config.minAssistantChars
}

function isExplicitForget(text: string): boolean {
  return !NEGATED_FORGET.test(text) && EXPLICIT_FORGET.test(text)
}

/** Derive eligible successful human turns after a durable consolidation boundary. */
export function collectEligibleTurns(
  events: readonly ConsolidationSessionEvent[],
  afterSeq: number,
  config: EligibleTurnConfig,
): ConsolidationTurn[] {
  const turns: ConsolidationTurn[] = []
  let open: OpenTurn | undefined
  for (const event of events) {
    const data = record(event.data)
    if (data === undefined) continue
    if (event.type === 'turn/start') {
      if (typeof data.turn !== 'number') continue
      open = {
        turn: data.turn,
        startSeq: event.seq,
        sourceEventSeqs: [event.seq],
        human: [],
        assistant: [],
        toolNames: [],
        toolResults: [],
        hasImage: false,
      }
      continue
    }
    if (open === undefined) continue
    if (event.type === 'user/message' && record(data.source)?.kind === 'user') {
      open.sourceEventSeqs.push(event.seq)
      open.human.push(textFromBlocks(data.content))
      open.hasImage ||= containsImage(data.content)
    } else if (event.type === 'assistant/message' && data.turn === open.turn) {
      open.sourceEventSeqs.push(event.seq)
      open.assistant.push(textFromBlocks(record(data.message)?.content))
    } else if (event.type === 'tool/call' && data.turn === open.turn && typeof data.name === 'string') {
      open.sourceEventSeqs.push(event.seq)
      open.toolNames.push(data.name)
    } else if (event.type === 'tool/result' && data.turn === open.turn) {
      open.sourceEventSeqs.push(event.seq)
      open.toolResults.push(textFromBlocks(record(data.message)?.content))
    } else if (event.type === 'turn/end' && data.turn === open.turn) {
      open.sourceEventSeqs.push(event.seq)
      const reason = record(data.reason)?.kind
      const successful = reason === 'completed' || reason === 'max-tokens'
      if (successful && event.seq > afterSeq && open.human.length > 0 && eligibleTurn(open, config)) {
        const user = open.human.filter(Boolean).join('\n').trim()
        turns.push({
          turn: open.turn,
          startSeq: open.startSeq,
          endSeq: event.seq,
          sourceEventSeqs: [...open.sourceEventSeqs],
          user,
          assistant: open.assistant.filter(Boolean).join('\n').trim(),
          toolNames: [...new Set(open.toolNames)],
          toolResults: open.toolResults.filter(Boolean).join('\n').trim(),
          explicitRemember: EXPLICIT_REMEMBER.test(user),
          explicitForget: isExplicitForget(user),
        })
      }
      open = undefined
    }
  }
  return turns
}
