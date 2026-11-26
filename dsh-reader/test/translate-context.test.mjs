import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTranslationContext } from '../src/client/translation/context.js'

test('builds a chapter snapshot from guide and concept data without a model call', () => {
  const context = buildTranslationContext({
    doc: { name: 'a.md' },
    docKey: 'fp1',
    chapter: 0,
    store: {
      docs: { fp1: { guide: { sections: [{ title: '第一章', summary: '本章讲一致性。', keyPoints: ['线性一致性', 'CAP'] }] } } },
      concepts: {
        c1: { term: '线性一致性', occurrences: [{ docKey: 'fp1', quote: 'x' }] },
        c2: { term: '其他书', occurrences: [{ docKey: 'other', quote: 'y' }] },
      },
    },
  })
  assert.equal(context.title, 'a.md')
  assert.equal(context.chapter, '第一章')
  assert.match(context.chapterSnapshot, /一致性/)
  assert.match(context.chapterSnapshot, /线性一致性/)
  assert.doesNotMatch(context.chapterSnapshot, /其他书/)
})

test('falls back to book and chapter titles when there is no guide', () => {
  const context = buildTranslationContext({
    doc: { name: 'book.epub', epub: { chapters: [{ title: '第一章' }] } },
    docKey: 'fp2',
    chapter: 0,
    store: {},
  })
  assert.equal(context.chapter, '第一章')
  assert.equal(context.chapterSnapshot, '')
})
