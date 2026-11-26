import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { emptyStore, readStore, writeStore } from '../lib/store.js'
import { TRANSLATE_LANGUAGES } from '../lib/translate.js'

async function tmpWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'reader-lang-'))
}

async function writeRawStore(cwd, raw) {
  await fs.mkdir(path.join(cwd, '.dsh-reader'), { recursive: true })
  await fs.writeFile(path.join(cwd, '.dsh-reader', 'store.json'), JSON.stringify(raw))
}

test('a legacy store that only carries the old default reads back as auto', async () => {
  const cwd = await tmpWorkspace()
  // Before 0.16 `translateFrom` was hard-coded to 'en' and never written by a
  // user choice, so a stored 'en' must not pin the direction.
  await writeRawStore(cwd, { version: 2, prefs: { translateFrom: 'en', translateTo: 'fr' }, concepts: {}, docs: {} })
  const store = await readStore(cwd)
  assert.equal(store.prefs.translateFrom, 'auto')
  assert.equal(store.prefs.translateFromExplicit, false)
  assert.equal(store.prefs.translateTo, 'fr')
})

test('an explicitly chosen source language survives the read', async () => {
  const cwd = await tmpWorkspace()
  await writeRawStore(cwd, {
    version: 2,
    prefs: { translateFrom: 'en', translateFromExplicit: true },
    concepts: {},
    docs: {},
  })
  const store = await readStore(cwd)
  assert.equal(store.prefs.translateFrom, 'en')
  assert.equal(store.prefs.translateFromExplicit, true)
})

test('a non-default source language counts as an explicit choice', async () => {
  const cwd = await tmpWorkspace()
  await writeRawStore(cwd, { version: 2, prefs: { translateFrom: 'ja' }, concepts: {}, docs: {} })
  const store = await readStore(cwd)
  assert.equal(store.prefs.translateFrom, 'ja')
  assert.equal(store.prefs.translateFromExplicit, true)
})

test('every target language survives a write and a read', async () => {
  const cwd = await tmpWorkspace()
  for (const language of TRANSLATE_LANGUAGES) {
    const store = await readStore(cwd)
    store.prefs.translateTo = language
    await writeStore(cwd, store)
    const again = await readStore(cwd)
    assert.equal(again.prefs.translateTo, language, language)
  }
})

test('unknown language values fall back instead of being persisted', async () => {
  const cwd = await tmpWorkspace()
  await writeRawStore(cwd, {
    version: 2,
    prefs: { translateFrom: 'xx', translateTo: 'yy' },
    concepts: {},
    docs: {},
  })
  const store = await readStore(cwd)
  assert.equal(store.prefs.translateFrom, 'auto')
  assert.equal(store.prefs.translateTo, 'zh')
})

test('translations in the six additional languages survive the read', async () => {
  const cwd = await tmpWorkspace()
  const translations = Object.fromEntries(
    TRANSLATE_LANGUAGES.map((language) => [language, { h1: `${language}:text` }]),
  )
  await writeRawStore(cwd, {
    version: 2,
    prefs: {},
    concepts: {},
    docs: { fp1: { path: 'a.md', translations } },
  })
  const store = await readStore(cwd)
  for (const language of TRANSLATE_LANGUAGES) {
    assert.equal(store.docs.fp1.translations[language].h1, `${language}:text`, language)
  }
})

test('a fresh store defaults to auto detection into Chinese', async () => {
  const cwd = await tmpWorkspace()
  const store = await readStore(cwd)
  assert.equal(store.prefs.translateFrom, 'auto')
  assert.equal(store.prefs.translateFromExplicit, false)
  assert.equal(store.prefs.translateTo, 'zh')
  assert.deepEqual(store, emptyStore())
})
