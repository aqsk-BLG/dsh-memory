import { readFile } from 'node:fs/promises'

const bundle = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8')
const required = [
  'IDENTITY.md',
  'MEMORY SCOPE',
  'session_search',
  'semantic ranking output contains unsupported block type',
  'memory/consolidation-request',
  'must each be exactly {"add":[],"remove":[]}',
  'selected model route advertises no default output limit',
  'dsh-memory-consolidator:start',
  'automatic deletion guard blocked removal',
  'safe additions while retaining guarded entries',
  'managed region repair is required',
  'semantic ranking tournament made no progress',
]

for (const marker of required) {
  if (!bundle.includes(marker)) {
    throw new Error(`built bundle is missing ${JSON.stringify(marker)}`)
  }
}

if (bundle.includes('semantic ranking output must contain text only')) {
  throw new Error('built bundle still rejects valid reasoning-capable ranker responses')
}
if (bundle.includes('DEFAULT_MAX_TOKENS = 8192')
  || bundle.includes("DEFAULT_REASONING_EFFORT = 'off'")) {
  throw new Error('built bundle still imposes fixed background-review generation controls')
}

const forbiddenInternalImports = [
  '@deepseek-ai/dsh-persona-files',
  '@deepseek-ai/dsh-memory-bootstrap',
  '@deepseek-ai/dsh-memory-consolidator',
  '@deepseek-ai/dsh-memory-flush',
  '@deepseek-ai/dsh-tool-session-search',
]

for (const specifier of forbiddenInternalImports) {
  if (bundle.includes(specifier)) {
    throw new Error(`built bundle still depends on monorepo-only package ${specifier}`)
  }
}

console.log('dsh-memory bundle contains all five capabilities and no monorepo-only runtime imports')
