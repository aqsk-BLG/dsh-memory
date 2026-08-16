/**
 * Model-facing recall over past session transcripts. The `session_search` tool wraps
 * `ctx.sessionQuery.searchSessions`, always excluding the calling session.
 * @module dsh-memory/search
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { SessionQueryEngine } from '@deepseek-ai/dsh-session-query'

const DESCRIPTION = [
  'Search your past session transcripts for a specific event or discussion that is not',
  'available in the current context. The query must be self-contained: describe what you',
  'are looking for and any known time frame or background. This tool has zero access to',
  'the current conversation — the calling session is always excluded from the results.',
  'Do not use it to look up general preferences or habits; those are covered by the',
  'injected memory files.',
].join(' ')

/**
 * Resolve the optional session-query capability through the global service store.
 * @param ctx - the registrant context.
 * @returns the composed engine, or `undefined` when the capability is absent.
 */
export function sessionQueryOf(ctx: Context): SessionQueryEngine | undefined {
  // `ctx.get` returns `any`; the declared return type narrows the public contract.
  return ctx.get('sessionQuery')
}

/**
 * Register the `session_search` tool on `ctx.tools`.
 * @param ctx - registrant context carrying the tool registry.
 * @param maxHits - the search page bound.
 */
export function applySearch(ctx: Context, maxHits: number): void {
  ctx.tools.register(defineTool({
    name: 'session_search',
    description: DESCRIPTION,
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'Self-contained search query: what you are looking for plus any known time frame or background.',
      },
      limit: {
        type: 'integer',
        description: 'Maximum number of matching sessions to return; larger values are clamped to the deployment bound.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          hits: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                sessionId: { type: 'string', required: true },
                createdAt: { type: 'integer', required: true },
                cwd: { type: 'string' },
                time: { type: 'integer', required: true },
                snippet: { type: 'string', required: true },
              },
            },
          },
          count: { type: 'integer', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.count === 0
          ? 'No matching past sessions.'
          : `Found ${value.count} matching session(s).`,
      }],
    },
    async execute(args, exec) {
      const service = sessionQueryOf(ctx)
      if (service === undefined) {
        throw new Error('session search unavailable: the session-query capability is not composed in this deployment')
      }
      const limit = Math.min(args.limit ?? maxHits, maxHits)
      const page = await service.searchSessions({ query: args.query, limit }, { signal: exec.signal })
      const current = exec.agent?.session.header.id
      const hits = page.items
        .filter(hit => hit.header.id !== current)
        .map(hit => ({
          sessionId: hit.header.id,
          createdAt: hit.header.createdAt,
          ...(hit.header.cwd === undefined ? {} : { cwd: hit.header.cwd }),
          time: hit.bestMatch.time,
          snippet: hit.bestMatch.snippet,
        }))
      return { hits, count: hits.length }
    },
    presentCall: args => ({ card: 'generic', title: 'Search past sessions', kind: 'other', rawInput: args.query }),
  }))
}
