import { readFile } from 'node:fs/promises'

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

const required = [
  'window.__ModuleLoader__.load({ id: "dsh-file-memory"',
  'settings.plugin.item',
  'key: "memory"',
  '/api/plugins/dsh-file-memory',
  'reminderEnabled',
  'semanticEnabled',
  'consolidationEnabled',
  'consolidationMode',
  'settingsScope',
  'IDENTITY',
  'AGENTS',
  'MEMORY',
  'locale.register',
  'role: "switch"',
  'role: "tablist"',
  'aria-selected',
  'aria-expanded',
]

for (const marker of required) {
  if (!client.includes(marker)) {
    throw new Error(`client bundle is missing ${JSON.stringify(marker)}`)
  }
}

if (!client.includes('return module.exports; } });')) {
  throw new Error('client bundle is not the ModuleLoader factory artifact')
}

const forbidden = ['HEARTBEAT.md', '--dsw-openclaw', 'openclaw']
for (const marker of forbidden) {
  if (client.toLowerCase().includes(marker.toLowerCase())) {
    throw new Error(`client bundle must not mention ${marker}`)
  }
}

const inject = manifest.dsh?.client?.inject
if (!Array.isArray(inject)
  || !inject.includes('@deepseek-ai/dsh-client-ui-settings')
  || !inject.includes('@deepseek-ai/dsh-client-locale')
  || !inject.includes('@deepseek-ai/dsh-client-connection')
  || !inject.includes('@deepseek-ai/dsh-api-remotes')) {
  throw new Error('package.json dsh.client.inject must include settings + connection + remotes')
}

if (manifest.dsh?.client?.platform !== 'web' || manifest.exports?.['./client'] !== './lib/client.js') {
  throw new Error('package must declare dsh.client.platform=web and export ./client')
}

console.log('dsh-file-memory client factory, memory slot, and settings knobs are present')
