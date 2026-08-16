/**
 * One-plugin entry to the layered file memory: global snapshot injection, session
 * recall, post-compaction flush, and the bundled usage skill.
 * @module dsh-memory
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-skill'
import { applyBootstrap } from './bootstrap.ts'
import { applySearch } from './search.ts'
import { applyFlush } from './flush.ts'
import { MEMORY_SKILL_CONTENT, MEMORY_SKILL_DESCRIPTION, MEMORY_SKILL_NAME } from './skill.ts'

/** Cordis plugin name. */
export const name = 'dsh-memory'

/** The registry seams this plugin contributes through. */
export const inject = ['skills', 'agents', 'tools', 'systemPrompt']

/**
 * Plugin config: the flattened user-facing knobs forwarded to the three capability parts.
 */
export interface Config {
  /** Harness home containing `USER.md` and `MEMORY.md`; defaults to `$DSH_HOME` or `~/.dsh`. */
  dshHome?: string
  /** Code-point budget for the injected `MEMORY.md` snapshot; overflow is truncated. */
  memoryBudgetChars: number
  /** Code-point budget for the injected `USER.md` snapshot; overflow is truncated. */
  userBudgetChars: number
  /** Maximum sessions one `session_search` call may return. */
  maxHits: number
  /** Queue the flush reminder after a successful compaction when true. */
  flushEnabled: boolean
}

/** Runtime schema for the memory plugin. */
export const Config: z<Config> = z.object({
  dshHome: z.string(),
  memoryBudgetChars: z.number().default(4000),
  userBudgetChars: z.number().default(1500),
  maxHits: z.number().default(20),
  flushEnabled: z.boolean().default(true),
})

/** Default code-point budget for the injected `MEMORY.md` snapshot. */
export const DEFAULT_MEMORY_BUDGET_CHARS = 4000
/** Default code-point budget for the injected `USER.md` snapshot. */
export const DEFAULT_USER_BUDGET_CHARS = 1500
/** Default `session_search` page bound. */
export const DEFAULT_MAX_HITS = 20

/**
 * Compose the three memory capability parts and register the bundled guide skill.
 * @param ctx - registrant context.
 * @param config - the flattened plugin configuration.
 */
export function apply(ctx: Context, config: Config): void {
  applyBootstrap(ctx, {
    ...(config.dshHome === undefined ? {} : { dshHome: config.dshHome }),
    memoryBudgetChars: config.memoryBudgetChars,
    userBudgetChars: config.userBudgetChars,
    sectionOrder: 5,
  })
  applySearch(ctx, config.maxHits)
  applyFlush(ctx, config.flushEnabled)
  ctx.skills.register({
    name: MEMORY_SKILL_NAME,
    description: MEMORY_SKILL_DESCRIPTION,
    source: 'runtime',
    content: MEMORY_SKILL_CONTENT,
  })
}
