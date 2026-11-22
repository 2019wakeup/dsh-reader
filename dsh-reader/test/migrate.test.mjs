import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readStore, backupStore, emptyStore, upsertDoc } from '../lib/store.js'
import { docFingerprint } from '../lib/fingerprint.js'

async function workspace() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'reader-migrate-'))
  await fs.writeFile(path.join(cwd, 'book.md'), '# Title\nhello')
  return cwd
}

async function seedV1(cwd, store) {
  await fs.mkdir(path.join(cwd, '.dsh-reader'), { recursive: true })
  await fs.writeFile(path.join(cwd, '.dsh-reader', 'store.json'), JSON.stringify(store))
}

test('migrates a v1 path key to a fingerprint key and keeps annotations', async () => {
  const cwd = await workspace()
  await seedV1(cwd, {
    version: 1,
    concepts: { c1: { id: 'c1', term: 'T' } },
    annotations: { 'book.md': [{ id: 'a1', quote: 'hello' }] },
    positions: { 'book.md': { page: 3 } },
  })
  const store = await readStore(cwd)
  const bytes = await fs.readFile(path.join(cwd, 'book.md'))
  const key = docFingerprint(bytes)
  assert.equal(store.version, 2)
  assert.equal(store.docs[key].path, 'book.md')
  assert.equal(store.docs[key].annotations[0].id, 'a1')
  assert.equal(store.docs[key].positions.page, 3)
  assert.ok(store.concepts.c1)
  assert.deepEqual(store.concepts.c1.occurrences, [])
})

test('keeps annotations for a missing file under missing:<path>', async () => {
  const cwd = await workspace()
  await seedV1(cwd, {
    version: 1,
    concepts: {},
    annotations: { 'gone.md': [{ id: 'a2' }] },
    positions: {},
  })
  const store = await readStore(cwd)
  assert.equal(store.docs['missing:gone.md'].annotations[0].id, 'a2')
})

test('migration is idempotent and backs up before writing', async () => {
  const cwd = await workspace()
  await seedV1(cwd, { version: 1, concepts: {}, annotations: {}, positions: {} })
  await readStore(cwd)
  const first = await fs.readdir(path.join(cwd, '.dsh-reader', 'backups'))
  await readStore(cwd)
  const second = await fs.readdir(path.join(cwd, '.dsh-reader', 'backups'))
  assert.equal(first.length, 1)
  assert.equal(second.length, 1)
})

test('backup rotation keeps the newest five', async () => {
  const cwd = await workspace()
  await seedV1(cwd, { version: 2, prefs: {}, concepts: {}, docs: {} })
  for (let i = 0; i < 7; i += 1) await backupStore(cwd)
  const entries = await fs.readdir(path.join(cwd, '.dsh-reader', 'backups'))
  assert.equal(entries.length, 5)
})

test('upsertDoc rebinds a renamed path on the same fingerprint', () => {
  const store = emptyStore()
  upsertDoc(store, { docKey: 'fp', path: 'a.md', size: 10, mtime: 1, annotations: [{ id: 'a1' }] })
  upsertDoc(store, { docKey: 'fp', path: 'b.md', size: 10, mtime: 2 })
  assert.equal(store.docs.fp.path, 'b.md')
  assert.equal(store.docs.fp.annotations[0].id, 'a1')
})
