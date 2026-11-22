import test from 'node:test'
import assert from 'node:assert/strict'
import {
  sectionHash,
  buildSectionPrompt,
  buildOverviewPrompt,
  extractJson,
  parseSectionReply,
  parseOverviewReply,
} from '../lib/guide.js'

test('section hash is stable and content sensitive', () => {
  assert.equal(sectionHash('abc'), sectionHash('abc'))
  assert.notEqual(sectionHash('abc'), sectionHash('abd'))
})

test('section prompt carries a bounded slice of the text', () => {
  const { system, user } = buildSectionPrompt({ title: '第一章', text: '正'.repeat(9000) })
  assert.match(system, /JSON/)
  assert.match(user, /第一章/)
  assert.ok(user.length < 6500)
})

test('overview prompt stays bounded', () => {
  const sections = Array.from({ length: 50 }, (_, i) => ({ title: `章${i}`, summary: '摘'.repeat(500) }))
  const { user } = buildOverviewPrompt(sections)
  assert.ok(user.length <= 12000)
})

test('extracts json from fences and prose', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 })
  assert.deepEqual(extractJson('好的：{"a":2} 完'), { a: 2 })
  assert.equal(extractJson('not json'), null)
})

test('parses section and overview replies with caps', () => {
  const section = parseSectionReply('{"summary":"S","keyPoints":["a","b","c","d"]}')
  assert.equal(section.summary, 'S')
  assert.equal(section.keyPoints.length, 3)
  const overview = parseOverviewReply('{"synopsis":"X","questions":["q1","q2","q3","q4"]}')
  assert.equal(overview.synopsis, 'X')
  assert.equal(overview.questions.length, 3)
})
