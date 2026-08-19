/**
 * Read/write helpers for the settings-card file panel.
 * USER/MEMORY keep the consolidator managed region valid.
 * IDENTITY/SOUL are whole-file human owned under $DSH_HOME.
 * AGENTS maps the DSH source tree (本体), not the runtime home.
 * AGENTS.md is the repo-root workspace instruction file DSH already injects.
 * No OpenClaw-style tools cheat-sheet tab: DSH does not inject one.
 */
import { createHash } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { inspectManagedRegion } from './managed-region.ts'

/** Stable ids shown as chips on the settings card. */
export type MemoryPanelFileId = 'identity' | 'soul' | 'user' | 'memory' | 'agents'

/** One catalog row for the file chip list. */
export interface MemoryPanelFileInfo {
  id: MemoryPanelFileId
  name: string
  path: string
  exists: boolean
  bytes: number
  chars: number
  managed: 'none' | 'valid' | 'malformed'
}

/** Full file payload for the editor. */
export interface MemoryPanelFileContent extends MemoryPanelFileInfo {
  content: string
  contentHash: string
}

/** Result of a guarded save. */
export interface MemoryPanelWriteResult {
  ok: boolean
  reason?: 'conflict' | 'malformed-region' | 'not-found' | 'io'
  message?: string
  file?: MemoryPanelFileContent
}

type FileRoot = 'home' | 'source'

const FILES: readonly { id: MemoryPanelFileId, name: string, managed: boolean, root: FileRoot }[] = [
  { id: 'agents', name: 'AGENTS.md', managed: false, root: 'source' },
  { id: 'soul', name: 'SOUL.md', managed: false, root: 'home' },
  { id: 'identity', name: 'IDENTITY.md', managed: false, root: 'home' },
  { id: 'user', name: 'USER.md', managed: true, root: 'home' },
  { id: 'memory', name: 'MEMORY.md', managed: true, root: 'home' },
]

function looksLikeDshSourceRoot(dir: string): boolean {
  return existsSync(join(dir, 'AGENTS.md'))
    && existsSync(join(dir, 'packages'))
    && existsSync(join(dir, '.git'))
}

/** Walk from cwd / host packages to the DSH source checkout. */
export function resolveDshSourceRoot(): string | undefined {
  const starts = [process.cwd()]
  try {
    starts.push(dirname(createRequire(import.meta.url).resolve('@deepseek-ai/dsh-agent-instructions/package.json')))
  } catch {
    // packaged community installs may not resolve the host package from here
  }
  for (const start of starts) {
    let dir = start
    for (let i = 0; i < 16; i++) {
      if (looksLikeDshSourceRoot(dir)) return dir
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }
  return undefined
}

/** SHA-256 of exact UTF-8 file bytes, matching consolidator commitFile. */
export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

function managedState(id: MemoryPanelFileId, content: string): MemoryPanelFileInfo['managed'] {
  const spec = FILES.find(file => file.id === id)
  if (spec === undefined || !spec.managed) return 'none'
  return inspectManagedRegion(content).valid ? 'valid' : 'malformed'
}

function toInfo(
  id: MemoryPanelFileId,
  name: string,
  path: string,
  content: string | undefined,
): MemoryPanelFileInfo {
  if (content === undefined) {
    return { id, name, path, exists: false, bytes: 0, chars: 0, managed: id === 'user' || id === 'memory' ? 'valid' : 'none' }
  }
  return {
    id,
    name,
    path,
    exists: true,
    bytes: Buffer.byteLength(content, 'utf8'),
    chars: Array.from(content).length,
    managed: managedState(id, content),
  }
}

async function readExisting(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === 'ENOENT') return undefined
    throw error
  }
}

/** Resolve one catalog id. Home files stay under $DSH_HOME; AGENTS uses the DSH source tree. */
export function memoryPanelFilePath(home: string, id: MemoryPanelFileId): string {
  const spec = FILES.find(file => file.id === id)
  if (spec === undefined) throw new Error(`unknown memory panel file: ${id}`)
  if (spec.root === 'source') {
    const source = resolveDshSourceRoot()
    if (source !== undefined) return join(source, spec.name)
  }
  return join(home, spec.name)
}

/** List catalog files without reading huge bodies twice. */
export async function listMemoryPanelFiles(home: string): Promise<MemoryPanelFileInfo[]> {
  const rows: MemoryPanelFileInfo[] = []
  for (const spec of FILES) {
    const path = memoryPanelFilePath(home, spec.id)
    if (!existsSync(path)) {
      rows.push(toInfo(spec.id, spec.name, path, undefined))
      continue
    }
    // Size first so a missing file after the exists check still degrades cleanly.
    try {
      statSync(path)
    } catch {
      rows.push(toInfo(spec.id, spec.name, path, undefined))
      continue
    }
    const content = await readExisting(path)
    rows.push(toInfo(spec.id, spec.name, path, content))
  }
  return rows
}

/** Read one file for the editor, including the hash used on save. */
export async function readMemoryPanelFile(
  home: string,
  id: MemoryPanelFileId,
): Promise<MemoryPanelFileContent> {
  const spec = FILES.find(file => file.id === id)
  if (spec === undefined) throw new Error(`unknown memory panel file: ${id}`)
  const path = memoryPanelFilePath(home, id)
  const content = await readExisting(path)
  const info = toInfo(spec.id, spec.name, path, content)
  const text = content ?? ''
  return { ...info, content: text, contentHash: hashContent(text) }
}

/**
 * Save one file. USER/MEMORY must keep a valid managed region (or none).
 * A stale expectedHash becomes a conflict, same as consolidator commitFile.
 */
export async function writeMemoryPanelFile(
  home: string,
  id: MemoryPanelFileId,
  content: string,
  expectedHash: string,
): Promise<MemoryPanelWriteResult> {
  const spec = FILES.find(file => file.id === id)
  if (spec === undefined) return { ok: false, reason: 'not-found', message: `unknown file ${id}` }
  const path = memoryPanelFilePath(home, id)
  if (spec.managed && !inspectManagedRegion(content).valid) {
    return {
      ok: false,
      reason: 'malformed-region',
      message: 'managed region markers are missing, duplicated, or not a `- ` list; consolidator will refuse this file',
    }
  }
  try {
    return await withFileLock(path, async () => {
      const current = await readExisting(path)
      const currentText = current ?? ''
      if (hashContent(currentText) !== expectedHash) {
        return {
          ok: false,
          reason: 'conflict' as const,
          message: 'file changed after it was opened; reload and merge before saving',
          file: {
            ...toInfo(spec.id, spec.name, path, current),
            content: currentText,
            contentHash: hashContent(currentText),
          },
        }
      }
      await writeFileAtomic(path, content, { mode: 0o600, dirMode: 0o700 })
      return { ok: true, file: await readMemoryPanelFile(home, id) }
    })
  } catch (error) {
    return {
      ok: false,
      reason: 'io',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
