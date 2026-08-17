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

## Persona files — identity and conduct, not factual memory

- \`$DSH_HOME/IDENTITY.md\` — who the DSH agent is.
- \`$DSH_HOME/SOUL.md\` — stable conduct, voice, judgment, and boundaries.

Both files are seeded when missing and injected as a frozen per-session snapshot. Edit them only
when the operator intentionally changes the agent persona. Do not put ordinary user facts, project
notes, or daily work history in these files; use the memory layers below.

## Layer 1 — Global memory (every project)

- \`$DSH_HOME/USER.md\` — the user profile: name, preferences, communication style, boundaries.
- \`$DSH_HOME/MEMORY.md\` — durable global facts and mandatory rules. Budget: 4,000 chars per session.
  Use it for precise rules that must be followed exactly (approval requirements, investigation
  doctrine, configuration-change policy).

These two files are injected into your context at session start as a frozen snapshot. Edits you make
during a session persist immediately but enter context next session.

Ordinary durable extraction is handled after eligible completed turns by the background
consolidator. It owns only the region between \`dsh-memory-consolidator:start\` and
\`dsh-memory-consolidator:end\`. Never edit inside those markers with file tools. If the user directly
asks for an immediate or exact manual file edit, write outside the managed region in the correct
global file.

## Layer 2 — Workspace memory (current project only)

This layer exists only when the live \`MEMORY SCOPE\` context says \`"kind":"workspace"\`.
Use the exact \`memoryDirectory\` reported there. If the scope says \`ungrouped\`, \`global-only\`,
or is absent, this session has no project-memory layer: never infer one from cwd, the source
checkout, or another registered workspace, and never scan all workspaces looking for memory.

- \`YYYY-MM-DD.md\` — the daily work log. Append-only, never overwrite. The background consolidator
  appends a brief note after substantive work (built or modified an application, fixed a bug, wrote
  a report or document, chose a technical approach). It skips transient search results, temporary
  paths, and tool errors.
- \`MEMORY.md\` — curated long-term project notes. Its bounded content is automatically injected on
  every prompt assembly for the explicitly bound workspace. Update it in place when the user shares
  project conventions or preferences.
- For a direct manual edit requested by the user, create the reported directory and dated file if
  needed and stay outside any consolidator-managed region.

The lightweight \`MEMORY REMINDER\` is present every turn, but it is not an instruction to write every
turn. Skip memory writes for greetings, simple lookups, and short Q&A unless the user explicitly asks
to remember a durable fact. It also tells you that ordinary automatic writes happen after the turn;
do not duplicate them. Daily files remain on-demand and are never automatically injected.

## Background consolidation

By default, every eligible completed human task triggers one tools-free background review on the
next idle transition. A single substantial result never waits for arbitrary later chat turns.
Greetings, short Q&A, and unsuccessful turns do not count; tool-using substantive turns count, and
an explicit remember or forget request triggers immediately even when an operator has configured a
larger batching cadence. The reviewer inherits the live route's reasoning effort, or the selected
adapter's default on a dedicated route, and the plugin does not impose a fixed output-token cap by
default. It returns incremental additions and exact removals for \`USER.md\`, global \`MEMORY.md\`,
and the live workspace \`MEMORY.md\`, plus new daily entries. The final file character budgets remain
the write authority; a visible-JSON safety bound is derived from those budgets and never counts
hidden reasoning. The plugin validates the patch, rejects secret-like values and unknown removals,
rechecks workspace binding, and refuses to overwrite a file changed after its snapshot. Retryable
mixed writes keep their source watermark and daily sections are idempotent by session/sequence.
Large managed-list deletions become proposals unless the user explicitly asked to forget the
affected memory; malformed regions wait for repair and transient failures back off. \`IDENTITY.md\`
and \`SOUL.md\` are never targets.

## Layer 3 — Session recall

The \`session_search\` tool searches your past session transcripts. With an available routed model it
semantically ranks bounded current surfaces from past sessions, so related wording can match without
sharing exact keywords. If semantic ranking cannot run, the result explicitly reports lexical
fallback instead of pretending full-text ranking is semantic. Use it to recall a specific past event
or discussion that is not in the current context; the query must be self-contained (describe what
you are looking for plus any known time frame). It has zero access to the current conversation, and
it is not for general preferences — those are covered by the injected layers.

## Retrieving historical context

Choose the right source — no need to read everything.

- Explicitly bound workspace's durable conventions → use the injected project \`MEMORY.md\`.
- Explicitly bound workspace's detailed past work → read only the relevant daily logs, most recent first.
- Ungrouped/global-only session → skip project files; use the injected global snapshot or \`session_search\`.
- Items spanning projects or of uncertain location → call \`session_search\`.
- No historical dependency → skip reading memory files.

## Maintenance

- For an explicitly bound workspace, distill daily logs older than 30 days into that workspace's
  \`MEMORY.md\` by topic, then delete the old files.
- When \`MEMORY.md\` approaches its budget, consolidate entries in place instead of growing the file.
- Do not store secrets unless the user explicitly asks.

## After compaction

When the conversation is compacted, a reminder asks you to persist anything important that is not yet
saved before it leaves context. Follow the live scope and write to the appropriate layer right away;
an ungrouped/global-only session must not create project memory.
`
