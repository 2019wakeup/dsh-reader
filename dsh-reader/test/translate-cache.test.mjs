import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TRANSLATE_PROMPT_VERSION,
  translateCacheKey,
  translationMeta,
  evictTranslationCache,
} from '../lib/translation-cache.js'

test('cache key changes with every contract input', () => {
  const base = { target: 'zh', from: 'en', promptVersion: 2, glossaryHash: 'g1', contentHash: 'h1' }
  assert.equal(translateCacheKey(base), 'v2:zh:en:2:g1:h1')
  assert.notEqual(translateCacheKey(base), translateCacheKey({ ...base, target: 'ja' }))
  assert.notEqual(translateCacheKey(base), translateCacheKey({ ...base, from: 'auto' }))
  assert.notEqual(translateCacheKey(base), translateCacheKey({ ...base, promptVersion: 3 }))
  assert.notEqual(translateCacheKey(base), translateCacheKey({ ...base, glossaryHash: 'g2' }))
  assert.notEqual(translateCacheKey(base), translateCacheKey({ ...base, contentHash: 'h2' }))
  assert.equal(TRANSLATE_PROMPT_VERSION, 2)
})

test('metadata records the producing contract', () => {
  const meta = translationMeta({ from: 'en', model: 'p/m', promptVersion: 2, glossaryHash: 'g1', chars: 12 })
  assert.equal(meta.from, 'en')
  assert.equal(meta.prompt, 2)
  assert.equal(meta.glossary, 'g1')
  assert.equal(meta.chars, 12)
  assert.ok(meta.at > 0)
})

test('eviction drops the oldest entries per language and per document', () => {
  const doc = {
    translations: { zh: { a: 'A', b: 'B', c: 'C' }, en: { d: 'D', e: 'E' } },
    translationMeta: {
      zh: { a: { at: 1 }, b: { at: 3 }, c: { at: 2 } },
      en: { d: { at: 4 }, e: { at: 5 } },
    },
  }
  evictTranslationCache(doc, { maxPerLanguage: 2, maxPerDoc: 4 })
  assert.deepEqual(Object.keys(doc.translations.zh).sort(), ['b', 'c'])
  assert.equal(doc.translationMeta.zh.a, undefined)
  assert.equal(Object.keys(doc.translations.zh).length + Object.keys(doc.translations.en).length, 4)
})
