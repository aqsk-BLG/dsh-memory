# dsh-memory

Layered file memory for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — one plugin row that brings global snapshot injection, workspace notes, session recall, post-compaction flush, and a bundled usage skill.

The design was informed by a survey of memory systems across the agent ecosystem (OpenClaw, Hermes, Codex, WorkBuddy, and others) and follows the file-first doctrine they share: memory is plain files on disk, a small curated layer is always in context, and detail lives in a deep layer reached on demand.

## What you get

| Layer | Files | Behavior |
|---|---|---|
| Global memory | `$DSH_HOME/USER.md`, `$DSH_HOME/MEMORY.md` | Injected into every session as a frozen snapshot (4,000 / 1,500 char budgets, truncated with a usage header) |
| Workspace memory | `<workspace>/.dsh/memory/MEMORY.md`, `<workspace>/.dsh/memory/YYYY-MM-DD.md` | Never injected; read on demand with the file tools. Daily logs are append-only; logs older than 30 days are distilled into `MEMORY.md` |
| Session recall | all session transcripts | The `session_search` tool (self-contained queries; the calling session is always excluded) |
| Compaction flush | — | After a successful compaction, a reminder asks the model to persist important context before it leaves the context |

The bundled **`memory` runtime skill** is the complete usage guide (what to record, what to skip, maintenance). The per-request injection carries only a three-line pointer, so the full guide costs tokens only when loaded. Users can override the guide with their own `memory` skill in a project or preset layer.

## Install

Installation is git-based — no npm registry needed:

```sh
dsh plugin --profile <name> add github:aqsk-BLG/dsh-memory
```

pnpm ≥ 10 refuses to run a git dependency's `prepare` build until you allowlist it. The first `add` fails and `dsh` prints the exact package key; copy it into the profile's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  dsh-memory: true
```

and re-run the `add`. The allowance means "run this package's build script at install time" — only allow packages you trust, and prefer pinning a commit (`github:aqsk-BLG/dsh-memory#<sha>`).

## Use

After installation the bundle adds one row to your profile's composition:

```yaml
- id: memory
  name: dsh-memory
  config:
    memoryBudgetChars: 4000
    userBudgetChars: 1500
    maxHits: 20
    flushEnabled: true
```

Verify with `dsh --profile <name> --dump-config`, then boot. Override any key in your profile's `cordis.patch.yml`; a patch replaces a row's whole `config`, so restate every key you change.

Create your memory files and start a session:

```sh
# $DSH_HOME/MEMORY.md — durable global facts and mandatory rules
# $DSH_HOME/USER.md — user profile
```

Tell the agent to remember something; in the next session the snapshot is injected, `session_search` recalls past discussions, and the `memory` skill explains the full usage on demand.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `dshHome` | `$DSH_HOME` or `~/.dsh` | Directory containing `USER.md` and `MEMORY.md` |
| `memoryBudgetChars` | `4000` | Code-point budget for the injected `MEMORY.md` snapshot; overflow is truncated |
| `userBudgetChars` | `1500` | Code-point budget for the injected `USER.md` snapshot; overflow is truncated |
| `maxHits` | `20` | Maximum sessions one `session_search` call may return |
| `flushEnabled` | `true` | Queue the flush reminder after a successful compaction when true |

## Requirements

- DeepSeek Harness installed locally (the `@deepseek-ai/*` packages this plugin imports are provided by the installation, not by npm).
- Node `^22.19.0 || >=24`.

## Upstream

This package is a standalone distribution of `packages/memory/*` from [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) (MIT). The bundled skill text is an original rewrite of the file-memory conventions shared across the agent ecosystem; no third-party source is included. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

[MIT](LICENSE)
