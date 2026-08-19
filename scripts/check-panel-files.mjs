import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/panel-files.ts', import.meta.url), 'utf8')
const panel = await readFile(new URL('../src/panel.ts', import.meta.url), 'utf8')
const http = await readFile(new URL('../src/panel-http.ts', import.meta.url), 'utf8')
const facade = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8')
const client = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')
const card = await readFile(new URL('../src/client/MemoryCard.tsx', import.meta.url), 'utf8')

for (const token of [
  'inspectManagedRegion',
  'withFileLock',
  'writeFileAtomic',
  'expectedHash',
  'malformed-region',
  'conflict',
]) {
  if (!source.includes(token)) {
    throw new Error(`panel-files must keep guarded save (${token})`)
  }
}
if (!panel.includes("settingsNamespace('memory')") || !panel.includes('installSettingsSection')) {
  throw new Error('panel must register the memory settings namespace')
}
if (!facade.includes('applyMemoryPanel(ctx, Config, config)')) {
  throw new Error('facade must mount the settings panel host half')
}
if (!http.includes('/api/plugins/dsh-file-memory') || !panel.includes('registerMemoryPanelHttp')) {
  throw new Error('panel must expose loopback file HTTP routes')
}
if (!client.includes("namespace: 'memory'") || !client.includes('settingsScope.bind')) {
  throw new Error('client must bind the memory settings scope')
}
if (!card.includes('reminderEnabled') || !card.includes('consolidationMode') || !card.includes('expectedHash')) {
  throw new Error('card must expose common knobs and guarded file save')
}
if (source.includes("id: 'agents'") || source.includes('HEARTBEAT.md') || source.includes('AGENTS.md')) {
  throw new Error('panel must not expose OpenClaw-only core files')
}

console.log('panel-files keep managed-region + hash lock; settings namespace is memory; no OpenClaw file set')
