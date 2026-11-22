import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHTML } from 'linkedom'

const { conceptMatcher, markTerms, conceptSignature, annotationSignature, conceptsForDoc } = await import('../src/client/concepts.js')

function prepare(html) {
  const { document } = parseHTML(`<html><body>${html}</body></html>`)
  globalThis.document = document
  globalThis.NodeFilter = { SHOW_TEXT: 4 }
  return document
}

test('does not match a latin term inside a longer word', () => {
  const document = prepare('<div id="r"><p>EMAIL SYSTEM</p></div>')
  const root = document.getElementById('r')
  markTerms(root, [{ id: 'c', term: 'AI' }])
  assert.equal(root.querySelectorAll('.rd-term').length, 0)
})

test('matches latin terms at word boundaries', () => {
  const document = prepare('<div id="a"><p>AI 系统</p></div><div id="b"><p>GPT-4 发布</p></div>')
  const a = document.getElementById('a')
  const b = document.getElementById('b')
  markTerms(a, [{ id: 'c1', term: 'AI' }])
  markTerms(b, [{ id: 'c2', term: 'GPT' }])
  assert.equal(a.querySelectorAll('.rd-term').length, 1)
  assert.equal(b.querySelectorAll('.rd-term').length, 1)
})

test('matches CJK terms without boundaries', () => {
  const document = prepare('<div id="r"><p>线性一致性要求实时</p></div>')
  const root = document.getElementById('r')
  markTerms(root, [{ id: 'c', term: '线性一致性' }])
  assert.equal(root.querySelector('.rd-term').textContent, '线性一致性')
})

test('ignores single-letter latin terms', () => {
  assert.equal(conceptMatcher([{ id: 'c', term: 'A' }]), null)
})

test('includes aliases and prefers the longer term', () => {
  const document = prepare('<div id="r"><p>LC 与线性一致性</p></div>')
  const root = document.getElementById('r')
  markTerms(root, [{ id: 'c', term: '线性一致性', aliases: ['LC'] }])
  const marks = Array.from(root.querySelectorAll('.rd-term')).map((node) => node.textContent)
  assert.deepEqual(marks, ['LC', '线性一致性'])
})
