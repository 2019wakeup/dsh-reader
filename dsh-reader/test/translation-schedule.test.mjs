import test from 'node:test'
import assert from 'node:assert/strict'
import { takeTranslationBatch, isNearViewport } from '../src/client/translation-schedule.js'

test('translation batches respect count and character limits', () => {
  const entries = [
    ['a', 'hello'],
    ['b', 'world'],
    ['c', 'again'],
  ]
  assert.deepEqual(takeTranslationBatch(entries, { maxSegments: 2 }).map((item) => item.id), ['a', 'b'])
  assert.deepEqual(takeTranslationBatch(entries, { maxChars: 7 }).map((item) => item.id), ['a'])
})

test('translation batches keep insertion order and skip nothing', () => {
  const entries = [['x', '1'], ['y', '2'], ['z', '3']]
  assert.deepEqual(takeTranslationBatch(entries), [
    { id: 'x', text: '1' },
    { id: 'y', text: '2' },
    { id: 'z', text: '3' },
  ])
  assert.deepEqual(takeTranslationBatch([]), [])
})

test('viewport check includes a prefetch margin', () => {
  const viewport = { top: 100, bottom: 500 }
  assert.equal(isNearViewport({ top: 480, bottom: 540 }, viewport, 200), true)
  assert.equal(isNearViewport({ top: 400, bottom: 450 }, viewport, 200), true)
  assert.equal(isNearViewport({ top: 1000, bottom: 1100 }, viewport, 200), false)
  assert.equal(isNearViewport(null, viewport), false)
})
