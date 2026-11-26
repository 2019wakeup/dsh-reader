import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTranslationReply } from '../lib/translate.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const dir = path.join(here, '..', 'eval', 'translate', 'fixtures', 'mock-replies')

async function reply(name) {
  return JSON.parse(await fs.readFile(path.join(dir, `${name}.json`), 'utf8')).reply
}

test('offline mock replies cover complete, fenced, partial and malformed', async () => {
  assert.deepEqual(parseTranslationReply(await reply('complete'), ['a', 'b']), { a: '甲', b: '乙' })
  assert.deepEqual(parseTranslationReply(await reply('fenced'), ['a']), { a: '甲' })
  assert.deepEqual(parseTranslationReply(await reply('missing'), ['a', 'b']), { a: '甲' })
  assert.deepEqual(parseTranslationReply(await reply('bad'), ['a']), {})
})
