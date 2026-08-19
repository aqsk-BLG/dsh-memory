/**
 * The installable bundle and one-plugin entry to layered file memory. Mounting this package composes five
 * capability parts — persona files (`dsh-persona-files`), global and project memory injection
 * (`dsh-memory-bootstrap`), hybrid session recall (`dsh-tool-session-search`), and the
 * post-compaction flush (`dsh-memory-flush`), plus skip-aware background consolidation
 * (`dsh-memory-consolidator`) — and registers
 * the bundled `memory` runtime skill whose body is the complete usage guide. The standalone
 * distribution bundles those internal parts behind this one recommended facade row.
 * @module dsh-memory
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import * as PersonaFiles from './persona.ts'
import * as MemoryBootstrap from './bootstrap.ts'
import * as MemoryConsolidator from './consolidator.ts'
import * as MemoryFlush from './flush.ts'
import * as ToolSessionSearch from './search.ts'
import { enforceHostVersionGate, type VersionGateMode } from './host-version.ts'
import type {} from '@deepseek-ai/dsh-skill'
import { MEMORY_SKILL_CONTENT, MEMORY_SKILL_DESCRIPTION, MEMORY_SKILL_NAME } from './skill.ts'

/** Cordis plugin name. */
export const name = 'memory'

/** The registry seams this facade contributes through. */
export const inject = ['skills']

/**
 * Plugin config: flattened user-facing knobs forwarded to the five capability parts.
 */
export interface Config {
  /** Harness home containing `USER.md` and `MEMORY.md`; defaults to `$DSH_HOME` or `~/.dsh`. */
  dshHome?: string
  /** Host-version gate at load: `error` (default), `warn`, or `off`. */
  versionGate: VersionGateMode
  /** Code-point budget for the injected `MEMORY.md` snapshot; overflow is truncated. */
  memoryBudgetChars: number
  /** Code-point budget for the injected `USER.md` snapshot; overflow is truncated. */
  userBudgetChars: number
  /** Code-point budget for the live workspace `.dsh/memory/MEMORY.md`. */
  projectMemoryBudgetChars: number
  /** Include a lightweight every-turn memory reminder. */
  reminderEnabled: boolean
  /** Prompt order for the global memory section. */
  memorySectionOrder: number
  /** Code-point budget for `$DSH_HOME/IDENTITY.md`. */
  identityBudgetChars: number
  /** Code-point budget for `$DSH_HOME/SOUL.md`. */
  soulBudgetChars: number
  /** Seed default persona files when either is missing. */
  seedMissingPersonaFiles: boolean
  /** Seed short `USER.md`/`MEMORY.md` templates when missing; never overwrites. */
  seedMissingMemoryFiles: boolean
  /** Prompt order for the persona-files section. */
  personaSectionOrder: number
  /** Maximum sessions one `session_search` call may return. */
  maxHits: number
  /** Semantically rank bounded past-session surfaces with an available model route. */
  semanticEnabled: boolean
  /** Optional dedicated semantic-ranker provider, paired with `semanticModel`. */
  semanticProvider: string
  /** Optional dedicated semantic-ranker model, paired with `semanticProvider`. */
  semanticModel: string
  /** Maximum candidates per semantic-ranking request. */
  semanticBatchSize: number
  /** Code-point budget retained from each candidate session. */
  semanticCandidateChars: number
  /** Maximum output tokens for each semantic-ranking request. */
  semanticMaxTokens: number
  /** Concurrent session-surface read bound. */
  semanticReadConcurrency: number
  /** Fall back to full-text retrieval if semantic ranking cannot run. */
  semanticFallbackEnabled: boolean
  /** Queue the flush reminder after a successful compaction when true. */
  flushEnabled: boolean
  /** Run skip-aware background memory reviews after completed turns. */
  consolidationEnabled: boolean
  /** Apply controlled writes or retain review candidates as log-only proposals. */
  consolidationMode: MemoryConsolidator.Config['mode']
  /** Eligible completed tasks per review; values above one opt into batching. */
  consolidationEveryEligibleTurns: number
  /** Minimum direct-human code points for a non-tool turn to count. */
  consolidationMinUserChars: number
  /** Minimum visible assistant code points for a non-tool turn to count. */
  consolidationMinAssistantChars: number
  /** Maximum eligible turns represented by one review. */
  consolidationMaxTurnsPerReview: number
  /** Combined code-point budget for transcript text sent to one review. */
  consolidationTranscriptBudgetChars: number
  /** Maximum code points appended to a dated project log by one review. */
  consolidationDailyBudgetChars: number
  /** Optional model-route output-cap override; normally omit to use the adapter default. */
  consolidationMaxTokens?: number
  /** Optional reviewer effort override; normally omit to inherit the live route/default. */
  consolidationReasoningEffort?: string
  /** End-to-end deadline for one background review in milliseconds. */
  consolidationTimeoutMs: number
  /** Maximum fraction of existing managed entries one automatic review may remove. */
  consolidationMaxDeletionRatio: number
  /** Initial delay before retrying one transient consolidation failure. */
  consolidationRetryBaseDelayMs: number
  /** Maximum delay between repeated transient consolidation failures. */
  consolidationRetryMaxDelayMs: number
  /** Optional dedicated review provider, paired with `consolidationModel`. */
  consolidationProvider: string
  /** Optional dedicated review model, paired with `consolidationProvider`. */
  consolidationModel: string
}

/** Runtime schema for the memory facade. */
export const Config: z<Config> = z.object({
  dshHome: z.string(),
  versionGate: z.union(['error', 'warn', 'off'] as const).default('error'),
  memoryBudgetChars: z.number().default(4000),
  userBudgetChars: z.number().default(1500),
  projectMemoryBudgetChars: z.number().default(3000),
  reminderEnabled: z.boolean().default(true),
  memorySectionOrder: z.number().default(5),
  identityBudgetChars: z.number().default(4000),
  soulBudgetChars: z.number().default(4000),
  seedMissingPersonaFiles: z.boolean().default(true),
  seedMissingMemoryFiles: z.boolean().default(true),
  personaSectionOrder: z.number().default(-50),
  maxHits: z.number().default(20),
  semanticEnabled: z.boolean().default(true),
  semanticProvider: z.string().default(''),
  semanticModel: z.string().default(''),
  semanticBatchSize: z.number().default(30),
  semanticCandidateChars: z.number().default(2000),
  semanticMaxTokens: z.number().default(2048),
  semanticReadConcurrency: z.number().default(4),
  semanticFallbackEnabled: z.boolean().default(true),
  flushEnabled: z.boolean().default(true),
  consolidationEnabled: z.boolean().default(true),
  consolidationMode: z.union(['automatic', 'proposal'] as const).default('automatic'),
  consolidationEveryEligibleTurns: z.number().step(1).min(1)
    .default(MemoryConsolidator.DEFAULT_EVERY_ELIGIBLE_TURNS),
  consolidationMinUserChars: z.number().step(1).min(0).default(12),
  consolidationMinAssistantChars: z.number().step(1).min(0).default(24),
  consolidationMaxTurnsPerReview: z.number().step(1).min(1).default(20),
  consolidationTranscriptBudgetChars: z.number().step(1).min(1).default(12000),
  consolidationDailyBudgetChars: z.number().step(1).min(1).default(1200),
  consolidationMaxTokens: z.number().step(1).min(1),
  consolidationReasoningEffort: z.string(),
  consolidationTimeoutMs: z.number().step(1).min(1)
    .default(MemoryConsolidator.DEFAULT_TIMEOUT_MS),
  consolidationMaxDeletionRatio: z.number().min(0).max(1).default(0.5),
  consolidationRetryBaseDelayMs: z.number().step(1).min(1).default(60000),
  consolidationRetryMaxDelayMs: z.number().step(1).min(1).default(3600000),
  consolidationProvider: z.string().default(''),
  consolidationModel: z.string().default(''),
})

/** Defaults mirrored here for the exported contract, not re-derived from the schema. */
export const DEFAULT_MEMORY_BUDGET_CHARS = 4000
/** Default code-point budget for the injected `USER.md` snapshot. */
export const DEFAULT_USER_BUDGET_CHARS = 1500
/** Default code-point budget for live project memory. */
export const DEFAULT_PROJECT_MEMORY_BUDGET_CHARS = 3000
/** Default `session_search` page bound. */
export const DEFAULT_MAX_HITS = 20

/**
 * Compose the five memory capability parts under one row and register the bundled guide skill.
 * @param ctx - registrant context.
 * @param config - the flattened facade configuration.
 */
export function apply(ctx: Context, config: Config): void {
  enforceHostVersionGate(ctx.logger, config.versionGate)
  ctx.plugin(PersonaFiles, {
    ...(config.dshHome === undefined ? {} : { dshHome: config.dshHome }),
    identityBudgetChars: config.identityBudgetChars,
    soulBudgetChars: config.soulBudgetChars,
    seedMissingFiles: config.seedMissingPersonaFiles,
    sectionOrder: config.personaSectionOrder,
  })
  ctx.plugin(MemoryBootstrap, {
    ...(config.dshHome === undefined ? {} : { dshHome: config.dshHome }),
    memoryBudgetChars: config.memoryBudgetChars,
    userBudgetChars: config.userBudgetChars,
    projectMemoryBudgetChars: config.projectMemoryBudgetChars,
    reminderEnabled: config.reminderEnabled,
    seedMissingFiles: config.seedMissingMemoryFiles,
    sectionOrder: config.memorySectionOrder,
  })
  ctx.plugin(ToolSessionSearch, {
    maxHits: config.maxHits,
    semanticEnabled: config.semanticEnabled,
    semanticProvider: config.semanticProvider,
    semanticModel: config.semanticModel,
    semanticBatchSize: config.semanticBatchSize,
    semanticCandidateChars: config.semanticCandidateChars,
    semanticMaxTokens: config.semanticMaxTokens,
    semanticReadConcurrency: config.semanticReadConcurrency,
    semanticFallbackEnabled: config.semanticFallbackEnabled,
  })
  ctx.plugin(MemoryFlush, { enabled: config.flushEnabled })
  ctx.plugin(MemoryConsolidator, {
    ...(config.dshHome === undefined ? {} : { dshHome: config.dshHome }),
    enabled: config.consolidationEnabled,
    mode: config.consolidationMode,
    everyEligibleTurns: config.consolidationEveryEligibleTurns,
    minUserChars: config.consolidationMinUserChars,
    minAssistantChars: config.consolidationMinAssistantChars,
    maxTurnsPerReview: config.consolidationMaxTurnsPerReview,
    transcriptBudgetChars: config.consolidationTranscriptBudgetChars,
    userBudgetChars: config.userBudgetChars,
    globalBudgetChars: config.memoryBudgetChars,
    projectBudgetChars: config.projectMemoryBudgetChars,
    dailyBudgetChars: config.consolidationDailyBudgetChars,
    ...(config.consolidationMaxTokens === undefined
      ? {}
      : { maxTokens: config.consolidationMaxTokens }),
    ...(config.consolidationReasoningEffort === undefined
      ? {}
      : { reasoningEffort: config.consolidationReasoningEffort }),
    timeoutMs: config.consolidationTimeoutMs,
    maxDeletionRatio: config.consolidationMaxDeletionRatio,
    retryBaseDelayMs: config.consolidationRetryBaseDelayMs,
    retryMaxDelayMs: config.consolidationRetryMaxDelayMs,
    provider: config.consolidationProvider,
    model: config.consolidationModel,
  })
  ctx.skills.register({
    name: MEMORY_SKILL_NAME,
    description: MEMORY_SKILL_DESCRIPTION,
    source: 'runtime',
    content: MEMORY_SKILL_CONTENT,
  })
}
