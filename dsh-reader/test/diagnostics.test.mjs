import test from 'node:test'
import assert from 'node:assert/strict'
import { diagnosticsText } from '../src/client/diagnostics.js'

test('collects version, document, action, error and stack', () => {
  const text = diagnosticsText({
    version: '0.4.4',
    docName: 'book.md',
    action: 'delete annotation',
    message: 'boom',
    stack: 'at foo',
  })
  assert.match(text, /version: 0\.4\.4/)
  assert.match(text, /document: book\.md/)
  assert.match(text, /action: delete annotation/)
  assert.match(text, /error: boom/)
  assert.match(text, /at foo/)
})

test('omits an empty stack and unknown fields', () => {
  const text = diagnosticsText({ version: '1', message: 'x' })
  assert.doesNotMatch(text, /stack/)
  assert.match(text, /document: -/)
})
