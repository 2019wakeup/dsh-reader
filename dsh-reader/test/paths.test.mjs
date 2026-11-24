import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { resolveInWorkspace, toPosix } from '../lib/paths.js'

const root = path.join(os.tmpdir(), 'reader-ws')

test('accepts a nested relative path', () => {
  const r = resolveInWorkspace(root, 'book/ch1.md')
  assert.equal(r.ok, true)
  assert.equal(r.abs, path.join(root, 'book', 'ch1.md'))
})

test('rejects parent traversal', () => {
  const r = resolveInWorkspace(root, '../secret.txt')
  assert.equal(r.ok, false)
  assert.equal(r.code, 'ESCAPE')
})

test('rejects traversal hidden mid-path', () => {
  const r = resolveInWorkspace(root, 'book/../../secret.txt')
  assert.equal(r.ok, false)
  assert.equal(r.code, 'ESCAPE')
})

test('rejects absolute paths', () => {
  const r = resolveInWorkspace(root, path.resolve(root, '..', 'etc', 'passwd'))
  assert.equal(r.ok, false)
  assert.equal(r.code, 'ABSOLUTE')
})

test('rejects a sibling directory sharing the prefix', () => {
  const r = resolveInWorkspace(root, '../reader-ws2/x.md')
  assert.equal(r.ok, false)
  assert.equal(r.code, 'ESCAPE')
})

test('accepts the workspace root itself', () => {
  const r = resolveInWorkspace(root, '.')
  assert.equal(r.ok, true)
  assert.equal(r.abs, root)
})

test('normalizes win32 separators for the wire format', () => {
  assert.equal(toPosix('sub\\book.md'), 'sub/book.md')
  assert.equal(toPosix('sub/book.md'), 'sub/book.md')
  assert.equal(toPosix(''), '')
})
