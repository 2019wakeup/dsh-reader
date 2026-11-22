import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveInWorkspace } from '../lib/paths.js'

test('accepts a nested relative path', () => {
  const r = resolveInWorkspace('/w', 'book/ch1.md')
  assert.equal(r.ok, true)
  assert.equal(r.abs, '/w/book/ch1.md')
})

test('rejects parent traversal', () => {
  const r = resolveInWorkspace('/w', '../secret.txt')
  assert.equal(r.ok, false)
  assert.equal(r.code, 'ESCAPE')
})

test('rejects traversal hidden mid-path', () => {
  const r = resolveInWorkspace('/w', 'book/../../secret.txt')
  assert.equal(r.ok, false)
  assert.equal(r.code, 'ESCAPE')
})

test('rejects absolute paths', () => {
  const r = resolveInWorkspace('/w', '/etc/passwd')
  assert.equal(r.ok, false)
  assert.equal(r.code, 'ABSOLUTE')
})

test('rejects a sibling directory sharing the prefix', () => {
  const r = resolveInWorkspace('/w', '../w2/x.md')
  assert.equal(r.ok, false)
  assert.equal(r.code, 'ESCAPE')
})

test('accepts the workspace root itself', () => {
  const r = resolveInWorkspace('/w', '.')
  assert.equal(r.ok, true)
  assert.equal(r.abs, '/w')
})
