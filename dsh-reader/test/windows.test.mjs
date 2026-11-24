import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { toPosix } from '../lib/paths.js'
import { emptyStore, readStore, upsertDoc } from '../lib/store.js'
import { normalizeRelPath, basename, dirname } from '../src/client/util.js'
import { staleDocFor } from '../src/client/relink.js'

test('Host and client normalize win32 separators', () => {
  assert.equal(toPosix('sub\\book.md'), 'sub/book.md')
  assert.equal(normalizeRelPath('sub\\book.md'), 'sub/book.md')
  assert.equal(normalizeRelPath('C:\\ws\\book.md'), 'C:/ws/book.md')
  assert.equal(normalizeRelPath('./a\\b/../c.md'), './a/b/../c.md')
  assert.equal(normalizeRelPath(''), '')
})

test('basename and dirname accept backslashes', () => {
  assert.equal(basename('sub\\book.md'), 'book.md')
  assert.equal(dirname('sub\\book.md'), 'sub')
  assert.equal(dirname('book.md'), '.')
  assert.equal(basename('sub/deeper\\book.md'), 'book.md')
})

test('upsertDoc stores a POSIX path', () => {
  const store = emptyStore()
  upsertDoc(store, { docKey: 'fp', path: 'sub\\book.md' })
  assert.equal(store.docs.fp.path, 'sub/book.md')
})

test('reading a legacy store normalizes windows separators', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reader-paths-'))
  try {
    const store = emptyStore()
    store.docs.k = { path: 'sub\\book.md', annotations: [], positions: {} }
    await fs.mkdir(path.join(dir, '.dsh-reader'), { recursive: true })
    await fs.writeFile(path.join(dir, '.dsh-reader', 'store.json'), JSON.stringify(store))
    const read = await readStore(dir)
    assert.equal(read.docs.k.path, 'sub/book.md')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('relink matches both spellings of the same path', () => {
  const docs = { old: { path: 'sub\\book.md', annotations: [{ id: '1' }] } }
  assert.deepEqual(staleDocFor(docs, 'sub/book.md', 'new'), { fromKey: 'old', count: 1 })
})
