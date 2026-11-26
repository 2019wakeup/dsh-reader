import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = (await fs.readFile(path.join(here, '..', 'src', 'client', 'i18n.js'), 'utf8')).replace(/\r\n/g, '\n')

function block(name) {
  const start = source.indexOf(`const ${name} = {`)
  const end = source.indexOf('\n}\n', start)
  assert.ok(start >= 0 && end > start, `${name} block missing`)
  return source.slice(start, end)
}

function keysAndValues(text) {
  const map = new Map()
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*'([^']+)': '([^']*)',/)
    if (match) map.set(match[1], match[2])
  }
  return map
}

test('zh/en locales have identical key sets and no duplicate keys', () => {
  const zhText = block('ZH')
  const enText = block('EN')
  const zhKeys = [...zhText.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1])
  const enKeys = [...enText.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1])
  assert.equal(new Set(zhKeys).size, zhKeys.length, 'duplicate zh key')
  assert.equal(new Set(enKeys).size, enKeys.length, 'duplicate en key')
  assert.deepEqual([...new Set(zhKeys)].sort(), [...new Set(enKeys)].sort())
})

test('english locale has no Chinese strings outside language names', () => {
  for (const [key, value] of keysAndValues(block('EN'))) {
    if (key.startsWith('lang.')) continue
    assert.doesNotMatch(value, /[\u4e00-\u9fff]/, key)
  }
})
