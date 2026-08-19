import { readFile } from 'node:fs/promises'

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8')

const [hostVersion, facade, bootstrap, persona, bundle, packageJson, readme, readmeZh] =
  await Promise.all([
    read('src/host-version.ts'),
    read('src/index.ts'),
    read('src/bootstrap.ts'),
    read('src/persona.ts'),
    read('lib/index.js'),
    read('package.json'),
    read('README.md'),
    read('README.zh.md'),
  ])

// The supported host floor is a single source of truth and must stay at the tested release.
if (!hostVersion.includes("MIN_HOST_VERSION = '0.1.0-rc.7'")) {
  throw new Error('host-version.ts no longer pins MIN_HOST_VERSION to the tested 0.1.0-rc.7 release')
}
if (/MIN_HOST_VERSION\s*=\s*'0\.1\.0-rc\.[0-6]'/.test(hostVersion)) {
  throw new Error('host-version.ts lowered MIN_HOST_VERSION below the tested rc.7 floor')
}

// The facade must actually enforce the gate and expose the escape hatches.
if (!facade.includes('enforceHostVersionGate(ctx.logger, config.versionGate)')) {
  throw new Error('facade no longer enforces the host-version gate at apply time')
}
if (!facade.includes("z.union(['error', 'warn', 'off'] as const).default('error')")) {
  throw new Error('facade versionGate schema drifted from error/warn/off with error default')
}

// The built bundle must carry the loud-fail wording and the unknown-version warning path.
if (!bundle.includes('requires DeepSeek Harness >=')) {
  throw new Error('built bundle is missing the unsupported-host failure message')
}
if (!bundle.includes('the host version gate cannot verify compatibility')) {
  throw new Error('built bundle is missing the unknown-version warning path')
}

// First-run seeding must be exclusive-create templates, never overwriting existing files.
if (!bootstrap.includes('DEFAULT_USER') || !bootstrap.includes('DEFAULT_MEMORY')) {
  throw new Error('bootstrap no longer ships USER.md/MEMORY.md starter templates')
}
if (!bootstrap.includes('seedFile(userPath, DEFAULT_USER)')
  || !bootstrap.includes('seedFile(memoryPath, DEFAULT_MEMORY)')) {
  throw new Error('bootstrap no longer seeds missing USER.md/MEMORY.md')
}
if (!persona.includes("flag: 'wx'")) {
  throw new Error('persona seedFile lost its exclusive-create flag; existing files could be clobbered')
}

// Both readmes must document the supported range and the new knobs.
for (const [name, text] of [['README.md', readme], ['README.zh.md', readmeZh]]) {
  if (!text.includes('0.1.0-rc.7')) {
    throw new Error(`${name} does not document the supported host version range`)
  }
  if (!text.includes('versionGate') || !text.includes('seedMissingMemoryFiles')) {
    throw new Error(`${name} does not document the versionGate and seedMissingMemoryFiles knobs`)
  }
}

// The manifest version must stay in sync with the release being cut.
if (!packageJson.includes('"version": "1.3.1"')) {
  throw new Error('package.json version is not 1.3.1')
}

console.log('host version gate, first-run seeding, and version documentation are all in place')
