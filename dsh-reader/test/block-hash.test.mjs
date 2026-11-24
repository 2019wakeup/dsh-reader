import test from 'node:test'
import assert from 'node:assert/strict'
import { blockHash as hostHash, normalizeBlockText as hostNormalize } from '../lib/block-hash.js'
import { blockHash as clientHash, normalizeBlockText as clientNormalize } from '../src/client/translate.js'

test('Host and client share the translation cache key', () => {
  for (const text of ['你好 世界', '  a\n b ', 'x'.repeat(1000), '']) {
    assert.equal(hostNormalize(text), clientNormalize(text))
    assert.equal(hostHash(text), clientHash(text))
  }
  assert.match(hostHash('你好'), /^[0-9a-f]{8}-[0-9a-f]+$/)
})
