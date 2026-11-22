import test from 'node:test'
import assert from 'node:assert/strict'
import { docFingerprint } from '../lib/fingerprint.js'

test('same bytes give the same fingerprint', () => {
  const bytes = new TextEncoder().encode('hello')
  assert.equal(docFingerprint(bytes), docFingerprint(new TextEncoder().encode('hello')))
})

test('different content changes the fingerprint', () => {
  assert.notEqual(
    docFingerprint(new TextEncoder().encode('hello')),
    docFingerprint(new TextEncoder().encode('hello!')),
  )
})

test('a changed tail changes the fingerprint', () => {
  const head = new Uint8Array(5000).fill(1)
  const a = new Uint8Array([...head, 1, 2, 3])
  const b = new Uint8Array([...head, 4, 5, 6])
  assert.notEqual(docFingerprint(a), docFingerprint(b))
})
