import assert from 'node:assert/strict'
import {
  inspectManagedRegion,
  managedRegionCodePoints,
  MANAGED_REGION_END,
  MANAGED_REGION_START,
  rewriteManagedRegion,
} from '../src/managed-region.ts'

assert.deepEqual(inspectManagedRegion('manual text only'), { valid: true, entries: [] })
assert.equal(rewriteManagedRegion('manual text only', []), 'manual text only')

for (const malformed of [
  MANAGED_REGION_START,
  MANAGED_REGION_END,
  `${MANAGED_REGION_END}\n${MANAGED_REGION_START}`,
  `${MANAGED_REGION_START}\n${MANAGED_REGION_START}\n${MANAGED_REGION_END}`,
  `${MANAGED_REGION_START}\n${MANAGED_REGION_END}\n${MANAGED_REGION_END}`,
  `${MANAGED_REGION_START}\nnot a bullet\n${MANAGED_REGION_END}`,
  `${MANAGED_REGION_START}\n- \n${MANAGED_REGION_END}`,
]) {
  assert.equal(inspectManagedRegion(malformed).valid, false)
  assert.throws(() => rewriteManagedRegion(malformed, ['safe']))
}

const manual = 'Manual heading  \r\n\r\n'
const appended = rewriteManagedRegion(manual, ['one', 'two'])
assert.ok(appended.startsWith(manual), 'first insertion must preserve every existing manual byte')
assert.deepEqual(inspectManagedRegion(appended), { valid: true, entries: ['one', 'two'] })
assert.ok(appended.includes('\n- one\n- two\n'))

const prefix = 'Before region  \r\n'
const suffix = '\r\nAfter region  \r\n'
const existing = `${prefix}${MANAGED_REGION_START}\r\n- old\r\n${MANAGED_REGION_END}${suffix}`
const replaced = rewriteManagedRegion(existing, ['new'])
assert.ok(replaced.startsWith(prefix), 'bytes before an existing region must remain exact')
assert.ok(replaced.endsWith(suffix), 'bytes after an existing region must remain exact')
assert.deepEqual(inspectManagedRegion(replaced).entries, ['new'])

assert.ok(managedRegionCodePoints(['one']) > Array.from('one').length)
assert.equal(managedRegionCodePoints([]), 0)

console.log('managed-region parsing, malformed-marker rejection, and manual-byte preservation pass')
