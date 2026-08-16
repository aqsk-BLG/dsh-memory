/**
 * The bundled runtime skill body: the complete model-facing guide to the layered file memory.
 * The plugin registers it as the `memory` runtime skill; users may override it with their own
 * `memory` skill in a project or preset layer.
 * @module dsh-memory/skill
 */

/** The registered skill name. */
export const MEMORY_SKILL_NAME = 'memory'

/** The skill summary the catalog shows. */
export const MEMORY_SKILL_DESCRIPTION =
  'How to use the layered file memory: what to record, what to skip, and how to maintain the memory files.'

/** The complete skill body. */
export const MEMORY_SKILL_CONTENT = `\
# Memory — the layered file memory guide

This harness keeps memory in plain files. What is on disk survives; what is not written does not.
Use the right layer for each need.

## Layer 1 — Global memory (every project)

- \`$DSH_HOME/USER.md\` — the user profile: name, preferences, communication style, boundaries.
- \`$DSH_HOME/MEMORY.md\` — durable global facts and mandatory rules. Budget: 4,000 chars per session.
  When the user explicitly asks you to remember something long-term that is not tied to a specific
  project, update this file in place with your file tools. Use it for precise rules that must be
  followed exactly (approval requirements, investigation doctrine, configuration-change policy).

These two files are injected into your context at session start as a frozen snapshot. Edits you make
during a session persist immediately but enter context next session.

## Layer 2 — Workspace memory (current project only)

Directory: \`<workspace>/.dsh/memory/\`

- \`YYYY-MM-DD.md\` — the daily work log. Append-only, never overwrite. After completing substantive
  work (built or modified an application, fixed a bug, wrote a report or document, chose a technical
  approach), append a brief note. Do not record transient information: search results, temporary
  paths, tool errors. Persist only what has lasting value across sessions.
- \`MEMORY.md\` — curated long-term project notes. Budget: 3,000 chars per session. Update in place
  when the user shares project conventions or preferences.
- If today's log does not exist, create the directory and the dated file first.

## Layer 3 — Session recall

The \`session_search\` tool searches your past session transcripts. Use it to recall a specific past
event or discussion that is not in the current context; the query must be self-contained (describe
what you are looking for plus any known time frame). It has zero access to the current conversation,
and it is not for general preferences — those are covered by the injected layers.

## Retrieving historical context

Choose the right source — no need to read everything.

- This project's past work → read the local daily logs (most recent first) or the workspace \`MEMORY.md\`.
- Items spanning projects or of uncertain location → call \`session_search\`.
- No historical dependency → skip reading memory files.

## Maintenance

- Daily logs older than 30 days: distill them into the workspace \`MEMORY.md\` by topic, then delete
  the old files.
- When \`MEMORY.md\` approaches its budget, consolidate entries in place instead of growing the file.
- Do not store secrets unless the user explicitly asks.

## After compaction

When the conversation is compacted, a reminder asks you to persist anything important that is not yet
saved before it leaves context. Write to the appropriate layer right away.
`
