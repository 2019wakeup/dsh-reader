import test from 'node:test'
import assert from 'node:assert/strict'
import { parseExplanation, buildExplainPrompt, buildContextPrompt, parseContextNote, buildAskPrompt, buildQuickExplainPrompt } from '../lib/explain.js'

test('parses a fenced json block', () => {
  const text = '```json\n{"definition":"一句话","intuition":"类比","context":"语境","examples":["例"]}\n```'
  const r = parseExplanation(text)
  assert.equal(r.definition, '一句话')
  assert.equal(r.intuition, '类比')
  assert.deepEqual(r.examples, ['例'])
})

test('parses bare json with surrounding prose', () => {
  const text = '好的：{"definition":"定义","intuition":"直觉","context":"上下文","examples":[]} 完毕'
  const r = parseExplanation(text)
  assert.equal(r.definition, '定义')
  assert.deepEqual(r.examples, [])
})

test('falls back to plain text when json is absent', () => {
  const r = parseExplanation('线性一致性就是所有节点看到同一份历史。')
  assert.equal(r.definition, '线性一致性就是所有节点看到同一份历史。')
  assert.equal(r.intuition, '')
})

test('context prompt is bounded and asks for JSON', () => {
  const { system, user } = buildContextPrompt({ term: 'T', sentence: 'S'.repeat(500), docTitle: '书' })
  assert.match(system, /JSON/)
  assert.match(user, /T/)
  assert.ok(user.length < 600)
})

test('parses a context note from json or plain text', () => {
  assert.equal(parseContextNote('{"note":"本书偏工程"}').note, '本书偏工程')
  assert.equal(parseContextNote('本书用法说明').note, '本书用法说明')
})

test('ask prompt allows general knowledge but forbids invented citations', () => {
  const { system, user } = buildAskPrompt({
    concept: { term: '线性一致性', definition: 'D', evidence: { sentence: '原文句子' } },
    question: '它和最终一致性的区别？',
    related: [{ term: 'CAP', definition: 'C' }],
  })
  assert.match(system, /通用知识/)
  assert.match(system, /不要编造/)
  assert.match(user, /原文句子/)
  assert.match(user, /相关概念/)
  assert.match(user, /问题：它和最终一致性的区别/)
})

test('ask prompt includes web results and cites them when available', () => {
  const { user } = buildAskPrompt({
    concept: { term: 'T' },
    question: 'q',
    web: {
      used: true,
      content: '网络摘要',
      sources: [{ title: '示例来源', url: 'https://example.com' }],
    },
  })
  assert.match(user, /联网结果/)
  assert.match(user, /网络摘要/)
  assert.match(user, /\[1\] 示例来源 https:\/\/example\.com/)
})

test('ask prompt tells the model not to cite the web when search failed', () => {
  const { user } = buildAskPrompt({
    concept: { term: 'T' },
    question: 'q',
    web: { used: false, error: 'unavailable' },
  })
  assert.match(user, /不要引用任何网络来源/)
})

test('quick explanation prompt is compact and json-only', () => {
  const { system, user } = buildQuickExplainPrompt({ term: 'CAP', sentence: 'CAP 定理指出…', docTitle: '书' })
  assert.match(system, /JSON/)
  assert.match(system, /60 字以内/)
  assert.ok(user.length < 400)
})

test('prompt carries the term, sentence and a bounded paragraph', () => {
  const long = '前'.repeat(2000)
  const { system, user } = buildExplainPrompt({
    term: '线性一致性',
    sentence: '线性一致性要求所有副本实时一致。',
    paragraph: long,
    docTitle: '分布式系统',
  })
  assert.match(system, /JSON/)
  assert.match(user, /线性一致性/)
  assert.match(user, /分布式系统/)
  assert.ok(user.length < 1200)
})
