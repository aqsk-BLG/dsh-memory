/**
 * Migration helper for session logs written by dsh-memory v1.0.x.
 *
 * v1.0.x appended the custom session events `memory/bootstrap`, `persona/bootstrap`,
 * `memory/consolidation-request`, and `memory/consolidation-result` without the `ignorable`
 * envelope marker (the append API cannot set it). Official DeepSeek Harness builds refuse to
 * interpret logs containing catalog-unknown, non-ignorable event types
 * (SessionFormatUnsupportedError), so those old logs cannot be resumed by a stock harness.
 *
 * Since 1.1.0 the plugin never writes these events; this script rewrites EXISTING stored logs so
 * they load again on pure official DSH. Two actions:
 *
 *   mark-ignorable (default): add `"ignorable": true` to each legacy event. Harnesses that know
 *                             the types still see the historical records; stock harnesses skip
 *                             them. Recommended.
 *   strip:                    remove the legacy event lines entirely.
 *
 * Only the targeted lines change; every other byte of the log is preserved. Plaintext
 * `session.jsonl` logs are handled natively. Zstandard `session.jsonl.zstd` logs need the harness
 * source tree (its pure-JS zstd codec is internal): pass `--harness-source <path>` pointing at the
 * deepseek-harness checkout.
 *
 * Stop DSH before running this. Dry-run is the default; pass `--apply` to write.
 *
 * Usage:
 *   node scripts/migrate-legacy-events.mjs "$DSH_HOME/sessions" --apply
 *   node scripts/migrate-legacy-events.mjs "$DSH_HOME/sessions" --apply \
 *     --harness-source /path/to/deepseek-harness
 */

import { mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const LEGACY_EVENT_TYPES = new Set([
  'memory/bootstrap',
  'persona/bootstrap',
  'memory/consolidation-request',
  'memory/consolidation-result',
])

function parseArgs(argv) {
  const args = { root: undefined, apply: false, harnessSource: undefined, action: 'mark-ignorable' }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--apply') args.apply = true
    else if (arg === '--action' || arg === '--strip') {
      args.action = arg === '--strip' ? 'strip' : argv[index + 1]
      if (arg === '--action') index += 1
    } else if (arg === '--harness-source') {
      args.harnessSource = argv[index + 1]
      index += 1
    } else if (!arg.startsWith('--') && args.root === undefined) {
      args.root = arg
    } else {
      throw new Error(`unknown argument ${JSON.stringify(arg)}`)
    }
  }
  if (args.action !== 'mark-ignorable' && args.action !== 'strip') {
    throw new Error('--action must be mark-ignorable or strip')
  }
  if (args.root === undefined) {
    args.root = process.env.DSH_HOME !== undefined
      ? join(process.env.DSH_HOME, 'sessions')
      : join(process.env.USERPROFILE ?? process.env.HOME ?? '.', '.dsh', 'sessions')
  }
  return args
}

/** Patch one JSONL body: apply the action to legacy event lines only. */
function patchJsonl(text, action) {
  let changed = 0
  const lines = text.split('\n')
  const output = lines.map(line => {
    if (line.length === 0) return line
    let event
    try {
      event = JSON.parse(line)
    } catch {
      return line
    }
    if (typeof event !== 'object' || event === null
      || typeof event.type !== 'string'
      || !LEGACY_EVENT_TYPES.has(event.type)) return line
    if (event.ignorable === true) return line
    if (action === 'strip') {
      changed += 1
      return null
    }
    changed += 1
    return `${line.slice(0, line.lastIndexOf('}'))},"ignorable":true}`
  }).filter(line => line !== null)
  return { text: output.join('\n'), changed }
}

async function collectLogs(root) {
  const logs = []
  const visit = async directory => {
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(path)
      } else if (entry.name === 'session.jsonl' || entry.name === 'session.jsonl.zstd') {
        logs.push(path)
      }
    }
  }
  await visit(root)
  return logs
}

async function loadZstdCodec(harnessSource) {
  if (harnessSource === undefined) return undefined
  const base = resolve(harnessSource, 'packages/session/session-persistence-jsonl/src')
  // Prefer the harness's compiled JS (its .ts uses features Node's type stripping rejects).
  for (const name of ['zstd.js', 'zstd.ts']) {
    const modulePath = join(base, name)
    try {
      const statResult = await stat(modulePath)
      if (!statResult.isFile()) continue
    } catch {
      continue
    }
    return await import(pathToFileURL(modulePath).href)
  }
  return undefined
}

async function patchZstdFile(path, codec, action) {
  const raw = await readFile(path)
  const { frames } = codec.scanZstdFrames(raw)
  if (frames.length === 0) throw new Error(`no zstd frames found in ${path}`)
  const decoder = codec.createZstdFrameDecoder()
  const plaintexts = []
  for (const plaintext of decoder.decode(raw, frames)) {
    plaintexts.push(Buffer.from(plaintext))
  }
  const patched = patchJsonl(Buffer.concat(plaintexts).toString('utf8'), action)
  // Preserve the harness's frame layout: frame one is exactly the header line, the rest rides
  // later frames.
  const headerEnd = patched.text.indexOf('\n')
  const headerFrame = await codec.compressZstdFrame(patched.text.slice(0, headerEnd + 1))
  const bodyFrame = await codec.compressZstdFrame(patched.text.slice(headerEnd + 1))
  return { data: Buffer.concat([headerFrame, bodyFrame]), changed: patched.changed }
}

async function writeAtomic(path, data) {
  const temporary = join(
    await mkdtemp(join(dirname(path), '.dsh-memory-migrate-')),
    'log',
  )
  try {
    await writeFile(temporary, data)
    await rename(temporary, path)
  } catch (error) {
    await rm(dirname(temporary), { recursive: true, force: true })
    throw error
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const root = resolve(args.root)
  const logs = await collectLogs(root)
  if (logs.length === 0) {
    console.log(`no session logs found under ${root}`)
    return 0
  }
  const codec = await loadZstdCodec(args.harnessSource)
  let patchedFiles = 0
  let patchedEvents = 0
  let skippedZstd = 0
  for (const path of logs) {
    const isZstd = path.endsWith('.zstd')
    let patched
    if (!isZstd) {
      const text = await readFile(path, 'utf8')
      patched = patchJsonl(text, args.action)
    } else if (codec !== undefined) {
      patched = await patchZstdFile(path, codec, args.action)
    } else {
      skippedZstd += 1
      console.log(`SKIP (zstd, needs --harness-source): ${path}`)
      continue
    }
    if (patched.changed === 0) continue
    console.log(`${args.apply ? 'PATCH' : 'SCAN '} ${path}: ${patched.changed} legacy event(s) ${args.action === 'strip' ? 'stripped' : 'marked ignorable'}`)
    if (args.apply) {
      const backup = `${path}.legacy-events.bak`
      let backedUp = false
      try {
        const backupInfo = await stat(backup)
        if (!backupInfo.isFile()) throw new Error('backup path is not a file')
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          await rename(path, backup)
          backedUp = true
        } else {
          throw error
        }
      }
      try {
        await writeAtomic(path, isZstd ? patched.data : patched.text)
      } catch (error) {
        if (backedUp) await rename(backup, path).catch(() => {})
        throw error
      }
    }
    patchedFiles += 1
    patchedEvents += patched.changed
  }
  if (args.apply) {
    console.log(`done: ${patchedEvents} legacy event(s) in ${patchedFiles} log(s) rewritten${skippedZstd > 0 ? `, ${skippedZstd} zstd log(s) skipped` : ''}`)
  } else {
    console.log(`dry-run: ${patchedEvents} legacy event(s) in ${patchedFiles} log(s) would be rewritten${skippedZstd > 0 ? `, ${skippedZstd} zstd log(s) skipped` : ''}; pass --apply to write`)
  }
  return skippedZstd > 0 ? 2 : 0
}

main().then(code => {
  process.exitCode = code
}).catch(error => {
  console.error(`migrate-legacy-events: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
