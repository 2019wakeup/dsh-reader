import test from 'node:test'
import assert from 'node:assert/strict'
import { errorText } from '../src/client/i18n.js'

test('maps known host errors to localized text', () => {
  assert.notEqual(errorText('no model configured'), 'no model configured')
  assert.notEqual(errorText('unknown docKey'), 'unknown docKey')
})

test('passes unknown errors through', () => {
  assert.equal(errorText('something odd'), 'something odd')
})
