import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const srcDir = fileURLToPath(new URL('../src/', import.meta.url))
const files = (await readdir(srcDir)).filter(name => name.endsWith('.ts'))
const sources = await Promise.all(files.map(async name => ({
  name,
  text: await readFile(join(srcDir, name), 'utf8'),
})))

// Community safety invariant: durable state must not ride custom session event types. Official
// DeepSeek Harness builds refuse logs containing catalog-unknown, non-ignorable event types, so
// no dsh-memory source file may append a custom `memory/*` or `persona/*` session event.
const appendCall = /\.append\(\s*(['"`])([A-Za-z0-9._/-]*\/[A-Za-z0-9._/-]+)\1/gu
const offenders = []
for (const { name, text } of sources) {
  for (const match of text.matchAll(appendCall)) {
    offenders.push(`${name}: .append('${match[2]}')`)
  }
}
if (offenders.length > 0) {
  throw new Error(`custom session event appends remain:\n${offenders.join('\n')}`)
}

// The legacy event type names must still exist for migration reads of v1.0.x logs.
const all = sources.map(source => source.text).join('\n')
for (const legacyType of [
  'memory/consolidation-result',
  'memory/consolidation-request',
  'memory/bootstrap',
  'persona/bootstrap',
]) {
  if (!all.includes(legacyType)) {
    throw new Error(`legacy event type ${legacyType} disappeared from the migration vocabulary`)
  }
}

console.log('no custom session event appends remain; legacy event vocabulary is retained for migration reads')
