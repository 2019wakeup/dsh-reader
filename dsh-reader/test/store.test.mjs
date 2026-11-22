import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readStore, writeStore, emptyStore, upsertDoc, storePath } from '../lib/store.js'

async function tmpWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'reader-store-'))
}

test('returns an empty store when no file exists', async () => {
  const cwd = await tmpWorkspace()
  const store = await readStore(cwd)
  assert.deepEqual(store, emptyStore())
})

test('round-trips a concept', async () => {
  const cwd = await tmpWorkspace()
  const store = await readStore(cwd)
  store.concepts.c1 = { id: 'c1', term: '线性一致性', definition: '所有节点看到同一份历史' }
  await writeStore(cwd, store)
  const again = await readStore(cwd)
  assert.equal(again.concepts.c1.term, '线性一致性')
})

test('recovers from a corrupted store file', async () => {
  const cwd = await tmpWorkspace()
  await fs.mkdir(path.join(cwd, '.dsh-reader'), { recursive: true })
  await fs.writeFile(path.join(cwd, '.dsh-reader', 'store.json'), '{not json')
  const store = await readStore(cwd)
  assert.deepEqual(store, emptyStore())
})

test('normalizes malformed v2 data on read', async () => {
  const cwd = await tmpWorkspace()
  await fs.mkdir(path.join(cwd, '.dsh-reader'), { recursive: true })
  await fs.writeFile(
    path.join(cwd, '.dsh-reader', 'store.json'),
    JSON.stringify({
      version: 2,
      prefs: { fontSize: 'big', cardTrigger: 'bogus' },
      concepts: { c1: { id: 'c1', term: 'T' } },
      docs: { fp: { path: 'a.md', annotations: { bad: 1 }, positions: 'nope', guide: { sections: 'no' } } },
    }),
  )
  const store = await readStore(cwd)
  assert.equal(store.docs.fp.path, 'a.md')
  assert.deepEqual(store.docs.fp.annotations, [])
  assert.deepEqual(store.docs.fp.positions, {})
  assert.equal(store.prefs.fontSize, 18)
  assert.equal(store.prefs.cardTrigger, 'hover')
})

test('recovers a corrupt store from the newest backup', async () => {
  const cwd = await tmpWorkspace()
  const first = emptyStore()
  first.concepts.a = { id: 'a', term: 'A' }
  await writeStore(cwd, first)
  const second = emptyStore()
  second.concepts.b = { id: 'b', term: 'B' }
  await writeStore(cwd, second)
  await fs.writeFile(storePath(cwd), '{broken')
  const recovered = await readStore(cwd)
  assert.ok(recovered.concepts.a, 'newest readable backup is used')
})

test('keeps pdfSpread a boolean and defaults it off', async () => {
  const cwd = await tmpWorkspace()
  await writeStore(cwd, { ...emptyStore(), prefs: { pdfSpread: true } })
  assert.equal((await readStore(cwd)).prefs.pdfSpread, true)
  await writeStore(cwd, { ...emptyStore(), prefs: { pdfSpread: 'yes' } })
  assert.equal((await readStore(cwd)).prefs.pdfSpread, false)
})

test('writes atomically and leaves no temp file', async () => {
  const cwd = await tmpWorkspace()
  const store = await readStore(cwd)
  upsertDoc(store, { docKey: 'fp', path: 'a.md' })
  store.docs.fp.positions = { page: 42 }
  await writeStore(cwd, store)
  const entries = await fs.readdir(path.join(cwd, '.dsh-reader'))
  assert.deepEqual(entries.sort(), ['store.json'])
})
