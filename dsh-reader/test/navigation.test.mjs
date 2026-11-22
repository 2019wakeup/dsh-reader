import test from 'node:test'
import assert from 'node:assert/strict'
import {
  readingStep,
  scrollStepTarget,
  scrollProgress,
  chapterProgress,
  parsePageInput,
} from '../src/client/navigation.js'

const view = { scrollTop: 0, scrollHeight: 2000, clientHeight: 800 }

test('reading step leaves a small overlap with the previous screen', () => {
  assert.equal(readingStep(800), 680)
  assert.ok(readingStep(0) >= 120)
})

test('next scrolls by one step and stops at the end', () => {
  assert.deepEqual(scrollStepTarget(view, 'next'), { kind: 'scroll', top: 680 })
  assert.deepEqual(scrollStepTarget({ ...view, scrollTop: 1200 }, 'next'), { kind: 'end' })
  assert.deepEqual(scrollStepTarget({ ...view, scrollTop: 680 }, 'prev'), { kind: 'scroll', top: 0 })
  assert.deepEqual(scrollStepTarget(view, 'prev'), { kind: 'start' })
})

test('progress and chapter progress are bounded', () => {
  assert.equal(scrollProgress(view), 0)
  assert.equal(scrollProgress({ ...view, scrollTop: 1200 }), 1)
  assert.equal(scrollProgress({ scrollTop: 100, scrollHeight: 300, clientHeight: 300 }), 0)
  assert.equal(chapterProgress(0, 0, 10), 0)
  assert.equal(chapterProgress(9, 1, 10), 1)
  assert.equal(chapterProgress(4, 0.5, 10), 0.45)
})

test('page input is clamped to the document', () => {
  assert.equal(parsePageInput('42', 523), 42)
  assert.equal(parsePageInput('9999', 523), 523)
  assert.equal(parsePageInput('0', 523), 1)
  assert.equal(parsePageInput('', 523), null)
  assert.equal(parsePageInput('abc', 523), null)
})
