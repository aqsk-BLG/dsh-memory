import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readBounded } from '../src/bounded-file.ts'

const directory = await mkdtemp(join(tmpdir(), 'dsh-memory-bounded-'))
try {
  const file = join(directory, 'MEMORY.md')
  await writeFile(file, '甲乙丙', 'utf8')
  assert.deepEqual(readBounded(file, 2), { text: '甲乙', truncated: true })
  assert.deepEqual(readBounded(join(directory, 'missing.md'), 2), {
    text: '',
    truncated: false,
  })
  assert.throws(() => readBounded(directory, 2))
} finally {
  await rm(directory, { recursive: true })
}

console.log('bounded memory reads distinguish missing files from real read errors')
