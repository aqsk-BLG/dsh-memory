import z from "@deepseek-ai/schemastery";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { createUserMessage } from "@deepseek-ai/dsh-llm";

//#region src/bootstrap.ts
const MEMORY_SECTION = "memory";
/**
* The model-facing memory pointer, kept minimal to save prompt budget: the frozen snapshot is the
* data, this text names the layers and points at the complete guide, which ships as the `memory`
* runtime skill of this package (or a user override with the same name).
*/
const MEMORY_GUIDE = `\
You have a layered file memory.

- The snapshot above is Layer 1: the global user profile and mandatory rules (scope: all projects).
- Layer 2 is the workspace memory at <workspace>/.dsh/memory/: append-only YYYY-MM-DD.md daily logs
  and a curated MEMORY.md for the current project. Read them with your file tools when past work
  of this project may matter.
- Layer 3 is the session_search tool: self-contained queries over past session transcripts.

Before your first memory read or write, load the memory skill for the complete usage guide
(what to record, what to skip, and the 30-day maintenance rule).`;
/**
* Read a UTF-8 file with a code-point budget. A missing file yields empty text.
* @param path - absolute file path to read.
* @param budget - maximum stored code points.
* @returns the bounded content.
*/
function readBounded(path, budget) {
	let raw;
	try {
		raw = readFileSync(path, "utf8");
	} catch {
		return {
			text: "",
			truncated: false
		};
	}
	if (raw.length === 0) return {
		text: "",
		truncated: false
	};
	const chars = Array.from(raw);
	if (chars.length <= budget) return {
		text: raw,
		truncated: false
	};
	return {
		text: chars.slice(0, budget).join(""),
		truncated: true
	};
}
/**
* Render the frozen prompt section: usage headers, the two snapshots, and the layer pointer.
* @param user - bounded `USER.md` content.
* @param memory - bounded `MEMORY.md` content.
* @param memoryBudget - the global-memory budget shown in the header.
* @param userBudget - the user-profile budget shown in the header.
* @returns the complete section text.
*/
function renderSection(user, memory, memoryBudget, userBudget) {
	const userChars = Array.from(user.text).length;
	const memoryChars = Array.from(memory.text).length;
	const userHeader = `USER PROFILE (USER.md) [${userChars}/${userBudget} chars${user.truncated ? ", truncated" : ""}]`;
	const memoryHeader = `GLOBAL MEMORY (MEMORY.md) [${memoryChars}/${memoryBudget} chars${memory.truncated ? ", truncated" : ""}]`;
	return [
		userHeader,
		"<user>",
		user.text.length === 0 ? "(missing)" : user.text,
		"</user>",
		"",
		memoryHeader,
		"<memory>",
		memory.text.length === 0 ? "(missing)" : memory.text,
		"</memory>",
		"",
		"Layered memory",
		"",
		MEMORY_GUIDE
	].join("\n");
}
/**
* Register the per-session memory snapshot on the root event tree.
* @param ctx - registrant context observing the agent lifecycle.
* @param config - the memory home and snapshot budgets.
*/
function applyBootstrap(ctx, config) {
	const home = resolveDshHome(config.dshHome);
	const memoryPath = join(home, "MEMORY.md");
	const userPath = join(home, "USER.md");
	ctx.effect(() => ctx.root.on("agent/created", ({ agent }) => {
		const memory = readBounded(memoryPath, config.memoryBudgetChars);
		const user = readBounded(userPath, config.userBudgetChars);
		agent.ctx.systemPrompt.section({
			name: MEMORY_SECTION,
			order: config.sectionOrder,
			text: renderSection(user, memory, config.memoryBudgetChars, config.userBudgetChars)
		});
		agent.session.append("memory/bootstrap", {
			user: user.text,
			userTruncated: user.truncated,
			memory: memory.text,
			memoryTruncated: memory.truncated
		});
	}), "dsh-memory bootstrap listener");
}

//#endregion
//#region src/search.ts
const DESCRIPTION = [
	"Search your past session transcripts for a specific event or discussion that is not",
	"available in the current context. The query must be self-contained: describe what you",
	"are looking for and any known time frame or background. This tool has zero access to",
	"the current conversation — the calling session is always excluded from the results.",
	"Do not use it to look up general preferences or habits; those are covered by the",
	"injected memory files."
].join(" ");
/**
* Resolve the optional session-query capability through the global service store.
* @param ctx - the registrant context.
* @returns the composed engine, or `undefined` when the capability is absent.
*/
function sessionQueryOf(ctx) {
	return ctx.get("sessionQuery");
}
/**
* Register the `session_search` tool on `ctx.tools`.
* @param ctx - registrant context carrying the tool registry.
* @param maxHits - the search page bound.
*/
function applySearch(ctx, maxHits) {
	ctx.tools.register(defineTool({
		name: "session_search",
		description: DESCRIPTION,
		parameters: {
			query: {
				type: "string",
				required: true,
				description: "Self-contained search query: what you are looking for plus any known time frame or background."
			},
			limit: {
				type: "integer",
				description: "Maximum number of matching sessions to return; larger values are clamped to the deployment bound."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					hits: {
						type: "array",
						required: true,
						items: {
							type: "object",
							additionalProperties: false,
							properties: {
								sessionId: {
									type: "string",
									required: true
								},
								createdAt: {
									type: "integer",
									required: true
								},
								cwd: { type: "string" },
								time: {
									type: "integer",
									required: true
								},
								snippet: {
									type: "string",
									required: true
								}
							}
						}
					},
					count: {
						type: "integer",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: value.count === 0 ? "No matching past sessions." : `Found ${value.count} matching session(s).`
			}]
		},
		async execute(args, exec) {
			const service = sessionQueryOf(ctx);
			if (service === void 0) throw new Error("session search unavailable: the session-query capability is not composed in this deployment");
			const limit = Math.min(args.limit ?? maxHits, maxHits);
			const page = await service.searchSessions({
				query: args.query,
				limit
			}, { signal: exec.signal });
			const current = exec.agent?.session.header.id;
			const hits = page.items.filter((hit) => hit.header.id !== current).map((hit) => ({
				sessionId: hit.header.id,
				createdAt: hit.header.createdAt,
				...hit.header.cwd === void 0 ? {} : { cwd: hit.header.cwd },
				time: hit.bestMatch.time,
				snippet: hit.bestMatch.snippet
			}));
			return {
				hits,
				count: hits.length
			};
		},
		presentCall: (args) => ({
			card: "generic",
			title: "Search past sessions",
			kind: "other",
			rawInput: args.query
		})
	}));
}

//#endregion
//#region src/flush.ts
/** The fixed model-facing reminder text. */
const FLUSH_REMINDER = [
	"The conversation was just compacted. Before continuing, persist anything important that is not",
	"yet saved: update $DSH_HOME/MEMORY.md for durable global facts or mandatory rules, and append",
	"brief notes to <workspace>/.dsh/memory/YYYY-MM-DD.md for this project's work, decisions, or",
	"conventions worth keeping across sessions. Skip this if nothing new is worth saving."
].join(" ");
/**
* Listen for successful compactions and queue the flush reminder on the owning live agent.
* @param ctx - registrant context observing the session event stream.
* @param enabled - whether the reminder is enabled.
*/
function applyFlush(ctx, enabled) {
	if (!enabled) return;
	ctx.effect(() => ctx.root.on("session/event", (session, event) => {
		if (event.type !== "compaction/end" || event.data.error !== void 0) return;
		const agent = ctx.agents.get(session.id);
		if (agent === void 0) return;
		queueMicrotask(() => {
			if (ctx.agents.get(session.id) !== agent) return;
			agent.inject(createUserMessage({
				content: [{
					type: "text",
					text: FLUSH_REMINDER
				}],
				source: {
					kind: "plugin",
					plugin: "dsh-memory"
				}
			}));
		});
	}), "dsh-memory flush listener");
}

//#endregion
//#region src/skill.ts
/**
* The bundled runtime skill body: the complete model-facing guide to the layered file memory.
* The plugin registers it as the `memory` runtime skill; users may override it with their own
* `memory` skill in a project or preset layer.
* @module dsh-memory/skill
*/
/** The registered skill name. */
const MEMORY_SKILL_NAME = "memory";
/** The skill summary the catalog shows. */
const MEMORY_SKILL_DESCRIPTION = "How to use the layered file memory: what to record, what to skip, and how to maintain the memory files.";
/** The complete skill body. */
const MEMORY_SKILL_CONTENT = `\
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
`;

//#endregion
//#region src/index.ts
/** Cordis plugin name. */
const name = "dsh-memory";
/** The registry seams this plugin contributes through. */
const inject = [
	"skills",
	"agents",
	"tools",
	"systemPrompt"
];
/** Runtime schema for the memory plugin. */
const Config = z.object({
	dshHome: z.string(),
	memoryBudgetChars: z.number().default(4e3),
	userBudgetChars: z.number().default(1500),
	maxHits: z.number().default(20),
	flushEnabled: z.boolean().default(true)
});
/** Default code-point budget for the injected `MEMORY.md` snapshot. */
const DEFAULT_MEMORY_BUDGET_CHARS = 4e3;
/** Default code-point budget for the injected `USER.md` snapshot. */
const DEFAULT_USER_BUDGET_CHARS = 1500;
/** Default `session_search` page bound. */
const DEFAULT_MAX_HITS = 20;
/**
* Compose the three memory capability parts and register the bundled guide skill.
* @param ctx - registrant context.
* @param config - the flattened plugin configuration.
*/
function apply(ctx, config) {
	applyBootstrap(ctx, {
		...config.dshHome === void 0 ? {} : { dshHome: config.dshHome },
		memoryBudgetChars: config.memoryBudgetChars,
		userBudgetChars: config.userBudgetChars,
		sectionOrder: 5
	});
	applySearch(ctx, config.maxHits);
	applyFlush(ctx, config.flushEnabled);
	ctx.skills.register({
		name: MEMORY_SKILL_NAME,
		description: MEMORY_SKILL_DESCRIPTION,
		source: "runtime",
		content: MEMORY_SKILL_CONTENT
	});
}

//#endregion
export { Config, DEFAULT_MAX_HITS, DEFAULT_MEMORY_BUDGET_CHARS, DEFAULT_USER_BUDGET_CHARS, apply, inject, name };