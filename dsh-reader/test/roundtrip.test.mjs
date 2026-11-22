import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readStore, writeStore, emptyStore, upsertDoc } from '../lib/store.js'

async function workspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'reader-roundtrip-'))
}

test('a store survives export and import without loss', async () => {
  const source = await workspace()
  const store = emptyStore()
  upsertDoc(store, { docKey: 'fp1', path: 'a.md' })
  store.docs.fp1.annotations = [
    { id: 'a1', kind: 'text', chapter: 0, quote: 'hello', occurrence: 0, color: '#f2c94c', note: 'n' },
  ]
  store.docs.fp1.positions = { chapter: 1, page: 2 }
  store.concepts.c1 = {
    id: 'c1',
    term: '线性一致性',
    definition: 'D',
    occurrences: [{ docKey: 'fp1', chapter: 0, quote: '线性一致性', occurrence: 0 }],
    qa: [{ q: 'q', a: 'a', at: 1 }],
  }
  await writeStore(source, store)

  const exported = JSON.parse(JSON.stringify({ version: 2, store: await readStore(source) }))
  const target = await workspace()
  await writeStore(target, exported.store)
  const imported = await readStore(target)

  assert.deepEqual(imported, JSON.parse(JSON.stringify(store)))
})
