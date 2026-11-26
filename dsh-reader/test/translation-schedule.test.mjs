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

test('a partial translation keeps successes and retries the rest', async () => {
  const { partitionTranslationBatch } = await import('../src/client/translation-schedule.js')
  const segments = [
    { id: 'a', text: 'one' },
    { id: 'b', text: 'two' },
    { id: 'c', text: 'three' },
  ]
  const { done, failed } = partitionTranslationBatch(segments, {
    translations: { a: '一', b: '   ', d: 'ignored' },
    failed: [{ id: 'c', code: 'missing' }],
  })
  assert.deepEqual(done.map((item) => item.id), ['a'])
  assert.deepEqual(failed.map((item) => item.id), ['b', 'c'])
})

test('an empty or malformed reply fails the whole batch', async () => {
  const { partitionTranslationBatch } = await import('../src/client/translation-schedule.js')
  const segments = [{ id: 'a', text: 'one' }]
  assert.deepEqual(partitionTranslationBatch(segments, null).failed.map((item) => item.id), ['a'])
  assert.deepEqual(partitionTranslationBatch(segments, { translations: {} }).failed.map((item) => item.id), ['a'])
})

test('PDF batching keeps dense formula pages in smaller units', async () => {
  const { partitionPdfUnits } = await import('../src/client/translation-schedule.js')
  const units = Array.from({ length: 10 }, (_, index) => ({ hash: `h${index}`, text: 'x'.repeat(300) }))
  const batches = partitionPdfUnits(units, { maxSegments: 4, maxChars: 1200 })
  assert.ok(batches.length >= 3)
  assert.ok(batches.every((batch) => batch.length <= 4))
  assert.ok(batches.every((batch) => batch.reduce((sum, unit) => sum + unit.text.length, 0) <= 1200))
  assert.equal(batches.flat().length, 10)
})
