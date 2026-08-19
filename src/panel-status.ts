/**
 * Read-only status for the settings card: host version, home files, recall
 * index, and the newest consolidation state file if any.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  assessHostVersion,
  detectHostVersion,
  MIN_HOST_VERSION,
  readOwnVersion,
  type HostVersionAssessment,
  type HostVersionInfo,
} from './host-version.ts'
import { listMemoryPanelFiles, type MemoryPanelFileInfo } from './panel-files.ts'

/** One consolidation state file summarized for the panel. */
export interface ConsolidationSummary {
  sessionId: string
  updatedAt?: string
  status?: string
  throughSeq?: number
  path: string
}

/** Snapshot shown at the top of the settings card. */
export interface MemoryPanelStatus {
  pluginVersion: string
  minHostVersion: string
  host?: HostVersionInfo
  hostAssessment: HostVersionAssessment
  home: string
  files: MemoryPanelFileInfo[]
  sessionQuery: { exists: boolean, bytes: number, path: string }
  lastConsolidation?: ConsolidationSummary
}

function newestConsolidation(home: string): ConsolidationSummary | undefined {
  const dir = join(home, 'memory', 'consolidation')
  if (!existsSync(dir)) return undefined
  let best: { path: string, mtime: number, sessionId: string } | undefined
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue
    const path = join(dir, name)
    try {
      const st = statSync(path)
      if (best === undefined || st.mtimeMs > best.mtime) {
        best = { path, mtime: st.mtimeMs, sessionId: name.slice(0, -'.json'.length) }
      }
    } catch {
      // skip unreadable entries
    }
  }
  if (best === undefined) return undefined
  try {
    const raw = JSON.parse(readFileSync(best.path, 'utf8')) as {
      updatedAt?: unknown
      throughSeq?: unknown
      lastResult?: { status?: unknown }
    }
    return {
      sessionId: best.sessionId,
      path: best.path,
      ...(typeof raw.updatedAt === 'string' ? { updatedAt: raw.updatedAt } : {}),
      ...(typeof raw.throughSeq === 'number' ? { throughSeq: raw.throughSeq } : {}),
      ...(typeof raw.lastResult?.status === 'string' ? { status: raw.lastResult.status } : {}),
    }
  } catch {
    return { sessionId: best.sessionId, path: best.path }
  }
}

/** Build the card's status snapshot from disk. */
export async function readMemoryPanelStatus(home: string): Promise<MemoryPanelStatus> {
  const host = detectHostVersion()
  const indexPath = join(home, 'session-query.sqlite')
  let indexBytes = 0
  const indexExists = existsSync(indexPath)
  if (indexExists) {
    try {
      indexBytes = statSync(indexPath).size
    } catch {
      indexBytes = 0
    }
  }
  return {
    pluginVersion: readOwnVersion(),
    minHostVersion: MIN_HOST_VERSION,
    ...(host === undefined ? {} : { host }),
    hostAssessment: assessHostVersion(host),
    home,
    files: await listMemoryPanelFiles(home),
    sessionQuery: { exists: indexExists, bytes: indexBytes, path: indexPath },
    ...(newestConsolidation(home) === undefined ? {} : { lastConsolidation: newestConsolidation(home) }),
  }
}
