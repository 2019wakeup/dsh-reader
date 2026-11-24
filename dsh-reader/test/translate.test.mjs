import test from 'node:test'
import { JSDOM } from 'jsdom'
import assert from 'node:assert/strict'
const dom = new JSDOM('<!doctype html><html><body></body></html>')
globalThis.document = dom.window.document
import { blockHash, normalizeBlockText, buildTranslatedHtml } from '../src/client/translate.js'
import { buildTranslatePrompt, parseTranslationReply } from '../lib/translate.js'

test('block hashes ignore whitespace and differ by content', () => {
  assert.equal(blockHash('你好  世界'), blockHash('你好 世界'))
  assert.equal(normalizeBlockText('  a\n b '), 'a b')
  assert.notEqual(blockHash('你好'), blockHash('你们'))
})

test('builds a translation-only html keeping untranslated blocks', () => {
  const html = '<h2>标题</h2><p>你好<strong>世界</strong></p>'
  const output = buildTranslatedHtml(html, (text) => (text === '你好世界' ? 'HELLO <b>' : ''))
  assert.match(output, /HELLO &lt;b&gt;/)
  assert.doesNotMatch(output, /你好/)
  assert.match(output, /标题/)
})

test('keeps table cells untranslated', () => {
  const html = '<p>hello</p><table><tr><td>cell</td></tr></table>'
  const output = buildTranslatedHtml(html, () => '译文')
  assert.match(output, /<p>译文<\/p>/)
  assert.match(output, /<td>cell<\/td>/)
})

test('translate prompt asks for an id-keyed json map', () => {
  const { system, user } = buildTranslatePrompt({
    target: 'en',
    segments: [{ id: 's1', text: '你好' }, { id: 's2', text: '世界' }],
  })
  assert.match(system, /English/)
  assert.match(system, /源语言自动判断/)
  assert.match(system, /JSON/)
  assert.match(user, /\[s1\] 你好/)
})

test('translate prompt carries an explicit source language', () => {
  const { system } = buildTranslatePrompt({
    from: 'en',
    target: 'zh',
    segments: [{ id: 's1', text: 'hello' }],
  })
  assert.match(system, /源语言：English/)
  assert.match(system, /简体中文/)
})

test('parses translations and ignores unknown ids', () => {
  const parsed = parseTranslationReply('```json\n{"translations":{"s1":"Hello","s2":"World","x":"nope"}}\n```', ['s1', 's2'])
  assert.deepEqual(parsed, { s1: 'Hello', s2: 'World' })
  assert.deepEqual(parseTranslationReply('not json', ['s1']), {})
})
