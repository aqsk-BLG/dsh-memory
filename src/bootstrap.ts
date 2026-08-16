/**
 * Frozen per-session injection of the global memory files. Reads `$DSH_HOME/USER.md` and
 * `$DSH_HOME/MEMORY.md` once per agent session and registers a frozen `memory` prompt section.
 * @module dsh-memory/bootstrap
 */

import type { Context } from '@deepseek-ai/cordis'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from './types.ts'

export const MEMORY_SECTION = 'memory'

/**
 * The model-facing memory pointer, kept minimal to save prompt budget: the frozen snapshot is the
 * data, this text names the layers and points at the complete guide, which ships as the `memory`
 * runtime skill of this package (or a user override with the same name).
 */
export const MEMORY_GUIDE = `\
You have a layered file memory.

- The snapshot above is Layer 1: the global user profile and mandatory rules (scope: all projects).
- Layer 2 is the workspace memory at <workspace>/.dsh/memory/: append-only YYYY-MM-DD.md daily logs
  and a curated MEMORY.md for the current project. Read them with your file tools when past work
  of this project may matter.
- Layer 3 is the session_search tool: self-contained queries over past session transcripts.

Before your first memory read or write, load the memory skill for the complete usage guide
(what to record, what to skip, and the 30-day maintenance rule).`

/** A bounded file read: the stored text plus whether the budget clipped it. */
export interface BoundedText {
  /** File content, truncated to `budget` code points when larger. */
  text: string
  /** True when the budget clipped the original content. */
  truncated: boolean
}

/**
 * Read a UTF-8 file with a code-point budget. A missing file yields empty text.
 * @param path - absolute file path to read.
 * @param budget - maximum stored code points.
 * @returns the bounded content.
 */
export function readBounded(path: string, budget: number): BoundedText {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return { text: '', truncated: false }
  }
  if (raw.length === 0) return { text: '', truncated: false }
  const chars = Array.from(raw)
  if (chars.length <= budget) return { text: raw, truncated: false }
  return { text: chars.slice(0, budget).join(''), truncated: true }
}

/**
 * Render the frozen prompt section: usage headers, the two snapshots, and the layer pointer.
 * @param user - bounded `USER.md` content.
 * @param memory - bounded `MEMORY.md` content.
 * @param memoryBudget - the global-memory budget shown in the header.
 * @param userBudget - the user-profile budget shown in the header.
 * @returns the complete section text.
 */
export function renderSection(
  user: BoundedText,
  memory: BoundedText,
  memoryBudget: number,
  userBudget: number,
): string {
  const userChars = Array.from(user.text).length
  const memoryChars = Array.from(memory.text).length
  const userHeader = `USER PROFILE (USER.md) [${userChars}/${userBudget} chars${user.truncated ? ', truncated' : ''}]`
  const memoryHeader = `GLOBAL MEMORY (MEMORY.md) [${memoryChars}/${memoryBudget} chars${memory.truncated ? ', truncated' : ''}]`
  const userBody = user.text.length === 0 ? '(missing)' : user.text
  const memoryBody = memory.text.length === 0 ? '(missing)' : memory.text
  return [
    userHeader,
    '<user>',
    userBody,
    '</user>',
    '',
    memoryHeader,
    '<memory>',
    memoryBody,
    '</memory>',
    '',
    'Layered memory',
    '',
    MEMORY_GUIDE,
  ].join('\n')
}

/** Bootstrap part config. */
export interface BootstrapConfig {
  /** Harness home containing `USER.md` and `MEMORY.md`. */
  dshHome?: string
  /** Code-point budget for the injected `MEMORY.md` snapshot. */
  memoryBudgetChars: number
  /** Code-point budget for the injected `USER.md` snapshot. */
  userBudgetChars: number
  /** Prompt-section order. */
  sectionOrder: number
}

/**
 * Register the per-session memory snapshot on the root event tree.
 * @param ctx - registrant context observing the agent lifecycle.
 * @param config - the memory home and snapshot budgets.
 */
export function applyBootstrap(ctx: Context, config: BootstrapConfig): void {
  const home = resolveDshHome(config.dshHome)
  const memoryPath = join(home, 'MEMORY.md')
  const userPath = join(home, 'USER.md')
  // Registered on the root so the listener hears every published agent, including agents created
  // by compositions that mount this package as a nested child of another plugin.
  ctx.effect(() => ctx.root.on('agent/created', ({ agent }) => {
    const memory = readBounded(memoryPath, config.memoryBudgetChars)
    const user = readBounded(userPath, config.userBudgetChars)
    agent.ctx.systemPrompt.section({
      name: MEMORY_SECTION,
      order: config.sectionOrder,
      text: renderSection(user, memory, config.memoryBudgetChars, config.userBudgetChars),
    })
    agent.session.append('memory/bootstrap', {
      user: user.text,
      userTruncated: user.truncated,
      memory: memory.text,
      memoryTruncated: memory.truncated,
    })
  }), 'dsh-memory bootstrap listener')
}
