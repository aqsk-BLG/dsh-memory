# dsh-memory

English | [中文](README.zh.md)

An installable DSH profile bundle for WorkBuddy-style layered memory: global persona and memory files, live explicitly bound workspace memory, skip-aware reminders and background consolidation, hybrid session recall, post-compaction flush, and a bundled usage skill. This repository is the standalone Git distribution of the implementation developed in DeepSeek Harness.

## Install or remove

Install the Git bundle into a profile:

```sh
dsh plugin --profile web add github:aqsk-BLG/dsh-memory
```

For a reproducible deployment, pin the repository to a commit:

```sh
dsh plugin --profile web add github:aqsk-BLG/dsh-memory#<commit>
```

`dsh plugin` records the dependency and appends this package to the profile's `dsh.profile.bundles` list. The bundle inserts the `memory` row and enables the session-query index at `$DSH_HOME/session-query.sqlite`; later profile and home patches may override either row. The repository commits its built `lib/index.js`, so installation does not need a dependency lifecycle build. Remove both the dependency and layer with `dsh plugin --profile web remove dsh-memory`.

## What it does

Mounting the bundle composes five bundled capabilities and the guide:

- **Persona files** — seeds and injects frozen `$DSH_HOME/IDENTITY.md` and `$DSH_HOME/SOUL.md` snapshots, logged as `persona/bootstrap`.
- **Memory bootstrap** — injects frozen global `USER.md` and `MEMORY.md`, live project `MEMORY.md`, and a lightweight every-turn reminder that skips greetings, simple lookups, and short Q&A.
- **Background consolidator** — reviews completed substantive turns, writes bounded managed regions with conflict checks, and appends daily project notes only for the still-bound workspace.
- **Hybrid session search** — semantically ranks bounded past-session surfaces when a model route is available, with an explicitly labeled full-text fallback.
- **Compaction flush** — queues a post-compaction reminder to persist important context at the permitted memory layer.
- A bundled `memory` runtime skill — explains file roles, what to record and skip, append-only daily logs, semantic recall, and the 30-day distillation rule. A project or preset may override it with a same-named skill.

The standalone build compiles all five capabilities into one `lib/index.js` and leaves only DSH host packages as runtime peers. Persona files remain a separate identity concern internally even though the facade installs them together with memory.

## Workspace authority

Project memory exists only when the session is explicitly attached to a registered workspace. At every prompt assembly, the bootstrap resolves the current session id through `ctx.workspaceRegistry.list()` and emits a live `MEMORY SCOPE` containing the exact project-memory directory and bounded `.dsh/memory/MEMORY.md` content. Dated `.dsh/memory/YYYY-MM-DD.md` logs remain on-demand.

A session with no matching membership — including the Web UI's Ungrouped group — receives global memory and session recall only. The plugin never infers ownership from `cwd`, never scans all workspaces, never auto-registers the source checkout, and never deletes project memory when a workspace registration is removed.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `dshHome` | `$DSH_HOME` or `~/.dsh` | Directory containing persona and global memory files |
| `memoryBudgetChars` | `4000` | Code-point budget for global `MEMORY.md` |
| `userBudgetChars` | `1500` | Code-point budget for global `USER.md` |
| `projectMemoryBudgetChars` | `3000` | Code-point budget for live project `MEMORY.md` |
| `reminderEnabled` | `true` | Include the skip-aware every-turn memory reminder |
| `memorySectionOrder` | `5` | Frozen global-memory prompt order |
| `identityBudgetChars` | `4000` | Code-point budget for `IDENTITY.md` |
| `soulBudgetChars` | `4000` | Code-point budget for `SOUL.md` |
| `seedMissingPersonaFiles` | `true` | Seed conservative persona defaults when absent |
| `personaSectionOrder` | `-50` | Persona-file prompt order before deployment persona |
| `maxHits` | `20` | Maximum sessions one `session_search` call may return |
| `semanticEnabled` | `true` | Use semantic ranking when a model route is available |
| `semanticProvider` | `""` | Optional dedicated semantic provider, paired with `semanticModel` |
| `semanticModel` | `""` | Optional dedicated semantic model, paired with `semanticProvider` |
| `semanticBatchSize` | `30` | Candidates per semantic-ranking request |
| `semanticCandidateChars` | `2000` | Code-point budget retained from each past session |
| `semanticMaxTokens` | `2048` | Output-token cap for each ranking request |
| `semanticReadConcurrency` | `4` | Concurrent past-session surface reads |
| `semanticFallbackEnabled` | `true` | Use and label full-text fallback when semantics cannot run |
| `flushEnabled` | `true` | Queue the reminder after successful compaction |
| `consolidationEnabled` | `true` | Run skip-aware reviews after eligible completed turns |
| `consolidationMode` | `automatic` | Write controlled regions or log `proposal` candidates only |
| `consolidationEveryEligibleTurns` | `10` | Ordinary eligible-turn review cadence |
| `consolidationMinUserChars` | `12` | Minimum human code points for a non-tool turn |
| `consolidationMinAssistantChars` | `24` | Minimum assistant code points for a non-tool turn |
| `consolidationMaxTurnsPerReview` | `20` | Maximum eligible turns in one review |
| `consolidationTranscriptBudgetChars` | `12000` | Bounded review transcript text |
| `consolidationDailyBudgetChars` | `1200` | Complete daily section budget per review |
| `consolidationMaxTokens` | `2048` | Review output-token cap |
| `consolidationTimeoutMs` | `60000` | End-to-end review deadline in milliseconds |
| `consolidationProvider` | `""` | Optional dedicated review provider, paired with `consolidationModel` |
| `consolidationModel` | `""` | Optional dedicated review model, paired with `consolidationProvider` |

For a raw Cordis composition rather than a profile bundle:

```yaml
- name: dsh-memory
  config:
    dshHome: ~
    reminderEnabled: true
    semanticEnabled: true
    flushEnabled: true
    consolidationEnabled: true
```

## Export shape

A function/namespace plugin: it exports `name` / `inject` / `Config` / `apply` and no default.

## Model Experience

### Prompt context, recall tool, and skill catalog

#### What the model sees

Every session receives frozen persona and global-memory sections. Each request also receives a live `MEMORY SCOPE`: either one exact workspace plus its curated `MEMORY.md`, or an explicit statement that project memory is unavailable. The compact reminder distinguishes substantive project work from greetings and short Q&A. After an eligible turn, a separate tools-free reviewer receives bounded transcript and file evidence; its output never enters the conversation. `session_search` exposes evidence and its actual ranking mode, while the complete file policy is available on demand as the `memory` skill.

#### Token effect

Persona and global snapshots spend bounded prompt tokens on every request. The live scope adds a bounded project snapshot and short reminder only where authorized. Daily logs and the full skill cost tokens only when read. Semantic recall makes separate bounded model calls only when the tool is invoked. Background consolidation makes one bounded auxiliary call after ten eligible turns by default, or immediately after an explicit remember request.

#### KV Cache effect

Persona and global sections are frozen per session and prefix-stable. Workspace membership, curated project memory, and reminders travel in the dynamic runtime-context channel. Tool calls and loaded skill content append after the reusable prefix.

## Requirements and provenance

- A current DeepSeek Harness installation providing the declared `@deepseek-ai/*` peer packages.
- Node `^22.19.0 || >=24`.

This package is a standalone distribution of `packages/memory/*` and `packages/identity/persona-files` from [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), licensed under MIT. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Known Limitations and Deferred Work

- **Frozen home files per session** — edits to `IDENTITY.md`, `SOUL.md`, `USER.md`, or global `MEMORY.md` enter existing model context only in a new session.
- **No daily-log injection** — dated project history remains on-demand even though curated project memory is live.
- **No historical daily-log distillation yet** — the background consolidator reviews newly completed turns; 30-day daily-log distillation remains a manual maintenance rule.
- **Proposal mode is inspection-only** — there is no later approve/apply command or UI.
- **Provider-visible semantic candidates** — semantic recall sends bounded past-session excerpts to the selected model provider; disable it for local full-text-only recall.
- **No cross-device corpus or cloud sync** — session discovery and full-text fallback use the composed DSH session-query store; cloud synchronization remains an optional future layer.

## License

[MIT](LICENSE)
