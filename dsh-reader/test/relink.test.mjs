import test from 'node:test'
import assert from 'node:assert/strict'
import { staleDocFor } from '../src/client/relink.js'

test('finds a stale entry with annotations on the same path', () => {
  const result = staleDocFor(
    { old: { path: 'a.md', annotations: [{ id: '1' }, { id: '2' }] }, new: { path: 'a.md', annotations: [] } },
    'a.md',
    'new',
  )
  assert.deepEqual(result, { fromKey: 'old', count: 2 })
})

test('ignores the current key, other paths and empty entries', () => {
  assert.equal(staleDocFor({ new: { path: 'a.md', annotations: [{ id: '1' }] } }, 'a.md', 'new'), null)
  assert.equal(staleDocFor({ old: { path: 'b.md', annotations: [{ id: '1' }] } }, 'a.md', 'new'), null)
  assert.equal(staleDocFor({ old: { path: 'a.md', annotations: [] } }, 'a.md', 'new'), null)
})
