/**
 * Loopback HTTP routes for the settings-card file panel. External plugins
 * cannot publish Typert remotes to the browser, so file content goes here.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import {
  listMemoryPanelFiles,
  readMemoryPanelFile,
  writeMemoryPanelFile,
  type MemoryPanelFileId,
} from './panel-files.ts'
import { readMemoryPanelStatus } from './panel-status.ts'

/** Prefix owned by this plugin. */
export const MEMORY_PANEL_API_PREFIX = '/api/plugins/dsh-file-memory'

const FILE_IDS = new Set<MemoryPanelFileId>(['agents', 'soul', 'identity', 'user', 'memory'])

function json(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(text)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', reject)
  })
}

function fileIdFrom(pathname: string): MemoryPanelFileId | undefined {
  const prefix = `${MEMORY_PANEL_API_PREFIX}/files/`
  if (!pathname.startsWith(prefix)) return undefined
  const id = pathname.slice(prefix.length)
  return FILE_IDS.has(id as MemoryPanelFileId) ? id as MemoryPanelFileId : undefined
}

/** Handle one panel request. Unknown paths 404 so the SPA fallback stays unused. */
export async function handleMemoryPanelRequest(
  home: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const path = url.pathname.replace(/\/$/u, '') || '/'
  const method = (req.method ?? 'GET').toUpperCase()

  if (method === 'GET' && path === `${MEMORY_PANEL_API_PREFIX}/status`) {
    json(res, 200, await readMemoryPanelStatus(home))
    return
  }
  if (method === 'GET' && path === `${MEMORY_PANEL_API_PREFIX}/files`) {
    json(res, 200, { files: await listMemoryPanelFiles(home) })
    return
  }
  const id = fileIdFrom(path)
  if (id !== undefined && method === 'GET') {
    json(res, 200, await readMemoryPanelFile(home, id))
    return
  }
  if (id !== undefined && method === 'PUT') {
    let payload: { content?: unknown, expectedHash?: unknown }
    try {
      payload = JSON.parse(await readBody(req)) as { content?: unknown, expectedHash?: unknown }
    } catch {
      json(res, 400, { ok: false, reason: 'io', message: 'invalid JSON' })
      return
    }
    if (typeof payload.content !== 'string' || typeof payload.expectedHash !== 'string') {
      json(res, 400, { ok: false, reason: 'io', message: 'content and expectedHash are required' })
      return
    }
    const result = await writeMemoryPanelFile(home, id, payload.content, payload.expectedHash)
    json(res, result.ok ? 200 : result.reason === 'conflict' ? 409 : 400, result)
    return
  }
  json(res, 404, { ok: false, message: 'not found' })
}

/** Register the prefix route while a web server is composed. */
export function registerMemoryPanelHttp(ctx: Context, home: string): void {
  ctx.inject(['webServer'], (sctx) => {
    const dispose = sctx.webServer.register({
      kind: 'prefix',
      path: MEMORY_PANEL_API_PREFIX,
      handler: (req, res) => {
        void handleMemoryPanelRequest(home, req, res).catch((error: unknown) => {
          if (!res.headersSent) {
            json(res, 500, {
              ok: false,
              reason: 'io',
              message: error instanceof Error ? error.message : String(error),
            })
          }
        })
      },
    })
    sctx.effect(() => dispose, 'dsh-file-memory: panel http')
  })
}
