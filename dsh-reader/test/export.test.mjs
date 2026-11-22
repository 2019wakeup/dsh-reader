import test from 'node:test'
import assert from 'node:assert/strict'
import { annotationsMarkdown } from '../src/client/export.js'

const store = {
  version: 2,
  docs: {
    fp1: {
      path: 'book.md',
      annotations: [
        { id: 'a1', quote: 'hello', chapter: 0, note: '第一处笔记' },
        { id: 'a2', quote: 'world', page: 7 },
      ],
    },
  },
  concepts: {
    c1: { id: 'c1', term: '线性一致性', definition: 'D', aliases: ['LC'], occurrences: [{ docKey: 'fp1' }] },
  },
}

test('exports annotations grouped by document with notes and positions', () => {
  const text = annotationsMarkdown(store)
  assert.match(text, /## book\.md/)
  assert.match(text, /“hello”/)
  assert.match(text, /第一处笔记/)
  assert.match(text, /第 1 章/)
  assert.match(text, /第 7 页/)
})

test('exports the concept library with aliases and occurrence counts', () => {
  const text = annotationsMarkdown(store)
  assert.match(text, /## 概念库/)
  assert.match(text, /### 线性一致性/)
  assert.match(text, /别名：LC/)
  assert.match(text, /出现位置：1 处/)
})

test('handles an empty store', () => {
  const text = annotationsMarkdown({ version: 2, docs: {}, concepts: {} })
  assert.match(text, /没有标注/)
})
