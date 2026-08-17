import { readFile } from 'node:fs/promises'

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8')
const [patch, facade, bootstrap, persona, consolidator, readme, readmeZh] = await Promise.all([
  read('cordis.patch.yml'),
  read('src/index.ts'),
  read('src/bootstrap.ts'),
  read('src/persona.ts'),
  read('src/consolidator.ts'),
  read('README.md'),
  read('README.zh.md'),
])

if (/^\s*dshHome\s*:/mu.test(patch)) {
  throw new Error('profile bundle must not override the DSH instance home')
}
if (!facade.includes('dshHome?: string') || facade.includes('dshHome: z.string().required()')) {
  throw new Error('facade dshHome must remain optional')
}
for (const [name, source] of [['bootstrap', bootstrap], ['persona', persona], ['consolidator', consolidator]]) {
  if (!source.includes('resolveDshHome(config.dshHome)')) {
    throw new Error(`${name} no longer delegates omitted dshHome to the shared DSH resolver`)
  }
}
for (const [name, source] of [['README.md', readme], ['README.zh.md', readmeZh]]) {
  if (/^\s*dshHome:\s*~\s*$/mu.test(source)) {
    throw new Error(`${name} contains a split-root raw-composition example`)
  }
}

console.log('bundle and documented defaults follow the active DSH home without a second root')
