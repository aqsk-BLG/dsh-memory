/**
 * Post-compaction memory flush. After a successful `compaction/end`, the plugin queues one
 * reminder on the owning agent's inbox: persist anything important into the layered
 * memory files before it leaves context. The reminder rides the normal inbox, so it reaches the
 * next admitted request and is logged with it; a failed compaction stays silent.
 * @module dsh-memory/flush
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-compaction'
// Type-only: declares `ctx.agents` and the `session/event` stream.
import type {} from '@deepseek-ai/dsh-agent'

/** Cordis plugin name. */
export const name = 'memory-flush'

/** The live-agent registry used to resolve the compaction's owning agent. */
export const inject = ['agents']

/**
 * Plugin config: whether the post-compaction reminder is enabled.
 */
export interface Config {
  /** Queue the flush reminder after a successful compaction when true. */
  enabled: boolean
}

/** Runtime schema for the memory flush row. */
export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
})

/** The fixed model-facing reminder text. */
export const FLUSH_REMINDER = [
  'The conversation was just compacted. Before continuing, persist anything important that is not',
  'yet saved: update $DSH_HOME/MEMORY.md for durable global facts or mandatory rules. For project',
  'notes, obey the live MEMORY SCOPE: only a scope whose kind is workspace has project memory, at',
  'its exact memoryDirectory. Ungrouped and global-only sessions must not create project memory.',
  'Skip this if nothing new is worth saving.',
].join(' ')

/**
 * Listen for successful compactions and queue the flush reminder on the owning live agent.
 * @param ctx - registrant context observing the session event stream.
 * @param config - whether the reminder is enabled.
 */
export function apply(ctx: Context, config: Config): void {
  if (!config.enabled) return
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
        source: { kind: 'plugin', plugin: 'memory-flush' },
      }))
    })
  }), 'memory-flush session/event listener')
}
