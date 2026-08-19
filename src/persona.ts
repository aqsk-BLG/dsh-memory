/**
 * Harness-home persona files injected as one frozen per-session system-prompt section.
 *
 * Since 1.1.0 no `persona/bootstrap` session event is appended: official DeepSeek Harness builds
 * refuse session logs containing catalog-unknown, non-ignorable event types. A resumed session
 * simply re-snapshots the current files when the section registers again.
 *
 * @module dsh-memory/persona
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import type {} from '@deepseek-ai/dsh-agent'

/** Cordis plugin name. */
export const name = 'persona-files'

/** The prompt registry receiving the per-agent persona section. */
export const inject = ['systemPrompt']

/** Default `IDENTITY.md` seeded into a new Harness home. */
export const DEFAULT_IDENTITY = `\
# IDENTITY.md

You are a DSH agent powered by DeepSeek Harness.
`

/** Default `SOUL.md` seeded into a new Harness home. */
export const DEFAULT_SOUL = `\
# SOUL.md

Be genuinely helpful, candid, resourceful, and concise.
Have reasoned opinions, state uncertainty plainly, and verify important work.
Respect the user's boundaries and preserve their data.
`

/** Plugin configuration for persona file storage and prompt budgets. */
export interface Config {
  /** Harness home containing `IDENTITY.md` and `SOUL.md`; defaults to `$DSH_HOME` or `~/.dsh`. */
  dshHome?: string
  /** Code-point budget for `IDENTITY.md`. */
  identityBudgetChars: number
  /** Code-point budget for `SOUL.md`. */
  soulBudgetChars: number
  /** Create the two default files when absent. */
  seedMissingFiles: boolean
  /** Prompt order before the deployment persona at order 0. */
  sectionOrder: number
}

/** Runtime schema for the persona-files plugin. */
export const Config: z<Config> = z.object({
  dshHome: z.string(),
  identityBudgetChars: z.number().default(4000),
  soulBudgetChars: z.number().default(4000),
  seedMissingFiles: z.boolean().default(true),
  sectionOrder: z.number().default(-50),
})

/** Default `IDENTITY.md` code-point budget. */
export const DEFAULT_IDENTITY_BUDGET_CHARS = 4000
/** Default `SOUL.md` code-point budget. */
export const DEFAULT_SOUL_BUDGET_CHARS = 4000
/** Default prompt position between Harness identity and deployment persona. */
export const DEFAULT_PERSONA_SECTION_ORDER = -50
/** Prompt section registered for the two files. */
export const PERSONA_FILES_SECTION = 'persona:files'

/**
 * Reject invalid budgets and ordering before any file is created.
 * @param config - Resolved persona-files configuration.
 */
export function validateConfig(config: Config): void {
  for (const [key, value] of [
    ['identityBudgetChars', config.identityBudgetChars],
    ['soulBudgetChars', config.soulBudgetChars],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error(`persona-files: ${key} must be a positive safe integer`)
    }
  }
  if (!Number.isFinite(config.sectionOrder)) {
    throw new Error('persona-files: sectionOrder must be finite')
  }
}

/** One bounded file snapshot. */
export interface BoundedPersonaFile {
  /** File content clipped by code points. */
  text: string
  /** Whether clipping removed content. */
  truncated: boolean
}

/**
 * Read one UTF-8 persona file without splitting surrogate pairs.
 * @param path - Absolute persona-file path.
 * @param budget - Maximum number of Unicode code points to retain.
 * @returns The bounded text and whether it was truncated.
 */
export function readPersonaFile(path: string, budget: number): BoundedPersonaFile {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return { text: '', truncated: false }
  }
  const chars = Array.from(raw)
  if (chars.length <= budget) return { text: raw, truncated: false }
  return { text: chars.slice(0, budget).join(''), truncated: true }
}

/** Whether an unknown write failure is the expected exclusive-create collision. */
function isExists(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST'
}

/**
 * Seed one operator-editable file without replacing an existing value.
 * @param path - Absolute file path to create exclusively.
 * @param content - Default UTF-8 content for a missing file.
 */
export function seedFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  try {
    writeFileSync(path, content, { encoding: 'utf8', flag: 'wx' })
  } catch (error: unknown) {
    if (!isExists(error)) throw error
  }
}

/**
 * Render the two snapshots as operator-authored persona instructions.
 * @param identity - Bounded `IDENTITY.md` snapshot.
 * @param soul - Bounded `SOUL.md` snapshot.
 * @param identityBudget - Configured identity code-point budget.
 * @param soulBudget - Configured soul code-point budget.
 * @returns Model-facing persona section text.
 */
export function renderPersonaSection(
  identity: BoundedPersonaFile,
  soul: BoundedPersonaFile,
  identityBudget: number,
  soulBudget: number,
): string {
  const identityChars = Array.from(identity.text).length
  const soulChars = Array.from(soul.text).length
  return [
    'HARNESS-HOME PERSONA FILES',
    'These are operator-authored identity instructions. A later deployment persona remains authoritative if it conflicts.',
    '',
    `SOUL (SOUL.md) [${soulChars}/${soulBudget} chars${soul.truncated ? ', truncated' : ''}]`,
    '<soul>',
    soul.text.length === 0 ? '(missing)' : soul.text,
    '</soul>',
    '',
    `IDENTITY (IDENTITY.md) [${identityChars}/${identityBudget} chars${identity.truncated ? ', truncated' : ''}]`,
    '<identity>',
    identity.text.length === 0 ? '(missing)' : identity.text,
    '</identity>',
  ].join('\n')
}

/** Seed missing files, then freeze and log their contents for every published agent. */
export function apply(ctx: Context, config: Config): void {
  validateConfig(config)
  const home = resolveDshHome(config.dshHome)
  const identityPath = join(home, 'IDENTITY.md')
  const soulPath = join(home, 'SOUL.md')
  if (config.seedMissingFiles) {
    seedFile(identityPath, DEFAULT_IDENTITY)
    seedFile(soulPath, DEFAULT_SOUL)
  }

  ctx.effect(() => ctx.root.on('agent/created', ({ agent }) => {
    const identity = readPersonaFile(identityPath, config.identityBudgetChars)
    const soul = readPersonaFile(soulPath, config.soulBudgetChars)
    agent.ctx.systemPrompt.section({
      name: PERSONA_FILES_SECTION,
      order: config.sectionOrder,
      text: renderPersonaSection(
        identity,
        soul,
        config.identityBudgetChars,
        config.soulBudgetChars,
      ),
    })
  }), 'persona-files agent/created listener')
}
