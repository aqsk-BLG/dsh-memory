/**
 * Post-compaction memory flush. After a successful `compaction/end`, queues one
 * reminder on the owning agent's inbox.
 * @module dsh-memory/flush
 */

import type { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-compaction'
import type {} from '@deepseek-ai/dsh-agent'

/** The fixed model-facing reminder text. */
export const FLUSH_REMINDER = [
  'The conversation was just compacted. Before continuing, persist anything important that is not',
  'yet saved: update $DSH_HOME/MEMORY.md for durable global facts or mandatory rules, and append',
  'brief notes to <workspace>/.dsh/memory/YYYY-MM-DD.md for this project\'s work, decisions, or',
  'conventions worth keeping across sessions. Skip this if nothing new is worth saving.',
].join(' ')

/**
 * Listen for successful compactions and queue the flush reminder on the owning live agent.
 * @param ctx - registrant context observing the session event stream.
 * @param enabled - whether the reminder is enabled.
 */
export function applyFlush(ctx: Context, enabled: boolean): void {
  if (!enabled) return
  // Registered on the root so the listener hears compactions dispatched through any session
  // carrier; the disposer rides this plugin's fiber like every other effect.
  ctx.effect(() => ctx.root.on('session/event', (session, event) => {
    if (event.type !== 'compaction/end' || event.data.error !== undefined) return
    const agent = ctx.agents.get(session.id)
    if (agent === undefined) return
    // The listener runs inside the `compaction/end` append's publication boundary, where a
    // synchronous inbox splice would reenter `Session.append`; defer the injection one microtask
    // so it lands after the append closes.
    queueMicrotask(() => {
      if (ctx.agents.get(session.id) !== agent) return
      agent.inject(createUserMessage({
        content: [{ type: 'text', text: FLUSH_REMINDER }],
        source: { kind: 'plugin', plugin: 'dsh-memory' },
      }))
    })
  }), 'dsh-memory flush listener')
}
