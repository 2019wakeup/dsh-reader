import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  MAX_READ_CHARS,
  MAX_READING_SESSIONS,
  MAX_WINDOW_CHARS,
  buildReaderContextPayload,
  buildReaderReadPayload,
  buildReadingReport,
  describeReaderContext,
  normalizeReaderPosition,
  pickReaderTarget,
  readReaderWindow,
  readReadingContext,
  readingContextPath,
  writeReadingSession,
} from '../lib/reader-context.js'
import { emptyStore, readStore, writeStore } from '../lib/store.js'
import { defaultPrefs } from '../lib/prefs.js'

async function tmpWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'reader-context-'))
}

async function seedStore(cwd, value) {
  await fs.mkdir(path.join(cwd, '.dsh-reader'), { recursive: true })
  await fs.writeFile(path.join(cwd, '.dsh-reader', 'store.json'), JSON.stringify(value))
}

const POSITION = {
  path: 'books/a.md',
  name: '示例书',
  ext: '.md',
  chapter: 2,
  chapterTitle: '第三章',
  page: 12,
  total: 120,
  percent: 42,
}

function sampleEntry(extra = {}) {
  return {
    ...POSITION,
    window: { title: '示例书 · 第三章', text: '这是当前页的正文。' },
    updatedAt: 1_700_000_000_000,
    ...extra,
  }
}

test('readingContextPath points at .dsh-reader/context.json', () => {
  assert.equal(readingContextPath('/tmp/ws'), path.join('/tmp/ws', '.dsh-reader', 'context.json'))
})

test('readReadingContext returns an empty structure when the file is missing', async () => {
  const cwd = await tmpWorkspace()
  assert.deepEqual(await readReadingContext(cwd), { version: 1, sessions: {} })
})

test('readReadingContext tolerates a corrupted file', async () => {
  const cwd = await tmpWorkspace()
  await fs.mkdir(path.join(cwd, '.dsh-reader'), { recursive: true })
  await fs.writeFile(readingContextPath(cwd), '{not json')
  assert.deepEqual(await readReadingContext(cwd), { version: 1, sessions: {} })
})

test('writeReadingSession writes atomically and keeps position and window', async () => {
  const cwd = await tmpWorkspace()
  await writeReadingSession(cwd, 'session-1', sampleEntry())
  assert.deepEqual(await fs.readdir(path.join(cwd, '.dsh-reader')), ['context.json'])
  const context = await readReadingContext(cwd)
  assert.equal(context.version, 1)
  const stored = context.sessions['session-1']
  assert.equal(stored.path, 'books/a.md')
  assert.equal(stored.name, '示例书')
  assert.equal(stored.chapterTitle, '第三章')
  assert.equal(stored.page, 12)
  assert.equal(stored.window.title, '示例书 · 第三章')
  assert.equal(stored.window.text, '这是当前页的正文。')
  assert.equal(stored.updatedAt, 1_700_000_000_000)
})

test('writeReadingSession truncates the window text to the character cap', async () => {
  const cwd = await tmpWorkspace()
  await writeReadingSession(cwd, 's1', sampleEntry({ window: { title: 'T', text: 'x'.repeat(MAX_WINDOW_CHARS + 5000) } }))
  const context = await readReadingContext(cwd)
  assert.equal(context.sessions.s1.window.text.length, MAX_WINDOW_CHARS)
})

test('writeReadingSession evicts the oldest sessions beyond the cap', async () => {
  const cwd = await tmpWorkspace()
  for (let index = 1; index <= MAX_READING_SESSIONS + 2; index += 1) {
    await writeReadingSession(cwd, `s${index}`, sampleEntry({ updatedAt: index * 1000 }))
  }
  const context = await readReadingContext(cwd)
  const sessions = Object.keys(context.sessions)
  assert.equal(sessions.length, MAX_READING_SESSIONS)
  assert.equal(context.sessions.s1, undefined)
  assert.equal(context.sessions.s2, undefined)
  assert.ok(context.sessions[`s${MAX_READING_SESSIONS + 2}`])
})

test('writeReadingSession keeps the newest entry when eviction has ties', async () => {
  const cwd = await tmpWorkspace()
  for (let index = 1; index <= MAX_READING_SESSIONS + 1; index += 1) {
    await writeReadingSession(cwd, `s${index}`, sampleEntry({ updatedAt: 1 }))
  }
  const context = await readReadingContext(cwd)
  assert.equal(Object.keys(context.sessions).length, MAX_READING_SESSIONS)
  assert.ok(context.sessions[`s${MAX_READING_SESSIONS + 1}`], 'the just-written session survives the cap')
})

test('pickReaderTarget matches exactly and across the session- prefix', () => {
  const context = { version: 1, sessions: { 'session-abc': sampleEntry() } }
  assert.equal(pickReaderTarget(context, 'session-abc').path, 'books/a.md')
  assert.equal(pickReaderTarget(context, 'abc').path, 'books/a.md')
  assert.equal(pickReaderTarget(context, 'missing'), undefined)
  assert.equal(pickReaderTarget({}, 'session-abc'), undefined)
})

test('buildReadingReport normalizes malformed position fields and strips the window from the store entry', () => {
  const report = buildReadingReport({
    sessionId: 'session-abc',
    position: { path: 42, name: '书', ext: '.md', chapter: 'x', chapterTitle: 12, page: -3, total: 'many', percent: 250 },
    window: { title: '窗口', text: '正文' },
    now: 1_700_000_000_000,
  })
  assert.equal(report.entry.path, '')
  assert.equal(report.entry.name, '书')
  assert.equal(report.entry.chapter, 0)
  assert.equal(report.entry.chapterTitle, '')
  assert.equal(report.entry.page, 0)
  assert.equal(report.entry.total, 0)
  assert.equal(report.entry.percent, 100)
  assert.equal(report.entry.window.text, '正文')
  assert.equal(report.storeEntry.path, '')
  assert.equal(report.storeEntry.updatedAt, 1_700_000_000_000)
  assert.equal('window' in report.storeEntry, false)
})

test('buildReadingReport returns null without a session id', () => {
  assert.equal(buildReadingReport({ sessionId: '', position: POSITION, window: null }), null)
  assert.equal(buildReadingReport({ position: POSITION }), null)
})

test('normalizeReaderPosition keeps valid values and drops unknown fields', () => {
  const position = normalizeReaderPosition({ ...POSITION, junk: true, ext: 'MD' })
  assert.deepEqual(position, POSITION)
})

test('store adds an empty reading map when the field is absent', async () => {
  assert.deepEqual(emptyStore().reading, {})
  const cwd = await tmpWorkspace()
  await seedStore(cwd, { version: 2, prefs: {}, concepts: {}, docs: {} })
  assert.deepEqual((await readStore(cwd)).reading, {})
})

test('store drops malformed reading entries and normalizes the rest', async () => {
  const cwd = await tmpWorkspace()
  await seedStore(cwd, {
    version: 2,
    prefs: {},
    concepts: {},
    docs: {},
    reading: {
      'session-a': { path: 'a.md', chapter: 'bad', page: '9', total: 10, percent: 999, updatedAt: 5, junk: 1 },
      'session-b': 'junk',
      'session-c': { path: 'c.md', updatedAt: 7 },
    },
  })
  const store = await readStore(cwd)
  assert.equal(store.reading['session-a'].path, 'a.md')
  assert.equal(store.reading['session-a'].chapter, 0)
  assert.equal(store.reading['session-a'].page, 0)
  assert.equal(store.reading['session-a'].total, 10)
  assert.equal(store.reading['session-a'].percent, 100)
  assert.equal('junk' in store.reading['session-a'], false)
  assert.equal(store.reading['session-b'], undefined)
  assert.equal(store.reading['session-c'].path, 'c.md')
  assert.equal(store.reading['session-c'].updatedAt, 7)
})

test('store caps persisted reading entries at the session limit', async () => {
  const cwd = await tmpWorkspace()
  const reading = {}
  for (let index = 0; index < MAX_READING_SESSIONS + 3; index += 1) {
    reading[`s${index}`] = { path: `book-${index}.md`, updatedAt: index }
  }
  await seedStore(cwd, { version: 2, prefs: {}, concepts: {}, docs: {}, reading })
  const store = await readStore(cwd)
  assert.equal(Object.keys(store.reading).length, MAX_READING_SESSIONS)
  assert.equal(store.reading.s0, undefined)
  assert.ok(store.reading[`s${MAX_READING_SESSIONS + 2}`])
})

test('prefs default chatWidth to 420 and clamp it to 320-720', async () => {
  assert.equal(defaultPrefs().chatWidth, 420)
  const cwd = await tmpWorkspace()
  for (const [value, expected] of [[5, 320], [9999, 720], [500, 500]]) {
    await writeStore(cwd, { ...emptyStore(), prefs: { chatWidth: value } })
    assert.equal((await readStore(cwd)).prefs.chatWidth, expected)
  }
  await writeStore(cwd, { ...emptyStore(), prefs: {} })
  assert.equal((await readStore(cwd)).prefs.chatWidth, 420)
})

test('describeReaderContext names the book, chapter and page', () => {
  const text = describeReaderContext(sampleEntry())
  assert.match(text, /示例书/u)
  assert.match(text, /第三章/u)
  assert.match(text, /12/u)
  assert.match(text, /120/u)
  assert.match(text, /42%/u)
})

test('describeReaderContext returns guidance when no position was reported', () => {
  assert.match(describeReaderContext(undefined), /尚未上报/u)
  assert.match(describeReaderContext({ path: '' }), /尚未上报/u)
})

test('buildReaderContextPayload returns a structured found payload', () => {
  const payload = buildReaderContextPayload(sampleEntry())
  assert.equal(payload.found, true)
  assert.equal(payload.book, '示例书')
  assert.equal(payload.path, 'books/a.md')
  assert.equal(payload.chapterTitle, '第三章')
  assert.equal(payload.page, 12)
  assert.equal(payload.total, 120)
  assert.equal(payload.percent, 42)
  assert.equal(payload.hasWindow, true)
  assert.equal(payload.windowTitle, '示例书 · 第三章')
  assert.match(payload.summary, /示例书/u)
})

test('buildReaderContextPayload returns a readable hint without a position', () => {
  const payload = buildReaderContextPayload(undefined)
  assert.equal(payload.found, false)
  assert.equal(payload.book, '')
  assert.equal(payload.page, 0)
  assert.equal(payload.hasWindow, false)
  assert.match(payload.summary, /尚未上报/u)
})

test('readReaderWindow around defaults to the 8000 character cap', () => {
  const text = 'a'.repeat(MAX_READ_CHARS + 4000)
  const result = readReaderWindow(sampleEntry({ window: { title: 'T', text } }), { mode: 'around' })
  assert.equal(result.text.length, MAX_READ_CHARS)
  assert.equal(result.truncated, true)
  assert.equal(result.mode, 'around')
})

test('readReaderWindow around honors a smaller limit', () => {
  const text = 'a'.repeat(1000)
  const result = readReaderWindow(sampleEntry({ window: { title: 'T', text } }), { mode: 'around', limit: 100 })
  assert.equal(result.text.length, 100)
  assert.equal(result.truncated, true)
})

test('readReaderWindow keeps short windows untruncated', () => {
  const result = readReaderWindow(sampleEntry(), { mode: 'around' })
  assert.equal(result.text, '这是当前页的正文。')
  assert.equal(result.truncated, false)
})

test('readReaderWindow clamps an oversized limit to the hard cap', () => {
  const text = 'a'.repeat(MAX_READ_CHARS + 100)
  const result = readReaderWindow(sampleEntry({ window: { title: 'T', text } }), { mode: 'around', limit: 10_000_000 })
  assert.equal(result.text.length, MAX_READ_CHARS)
})

test('buildReaderReadPayload toc returns the chapter title list', () => {
  const payload = buildReaderReadPayload(sampleEntry(), { mode: 'toc' })
  assert.equal(payload.found, true)
  assert.deepEqual(payload.chapters, ['第 3 章 第三章'])
  assert.match(payload.text, /第三章/u)
  assert.equal(payload.truncated, false)
})

test('buildReaderReadPayload search reports an empty result without noise', () => {
  const payload = buildReaderReadPayload(sampleEntry(), { mode: 'search', query: '不存在的词' })
  assert.equal(payload.found, true)
  assert.deepEqual(payload.matches, [])
  assert.match(payload.text, /没有找到/u)
})

test('buildReaderReadPayload search returns matching snippets', () => {
  const payload = buildReaderReadPayload(
    sampleEntry({ window: { title: 'T', text: '第一段无关。这里提到关键概念。第三段也无关。' } }),
    { mode: 'search', query: '关键' },
  )
  assert.ok(payload.matches.length >= 1)
  assert.ok(payload.matches[0].includes('关键'))
  assert.match(payload.text, /关键/u)
})

test('buildReaderReadPayload chapter mode includes the chapter heading', () => {
  const payload = buildReaderReadPayload(sampleEntry(), { mode: 'chapter' })
  assert.equal(payload.found, true)
  assert.match(payload.text, /第三章/u)
  assert.match(payload.text, /这是当前页的正文/u)
})

test('reader_read explains that no window was reported', () => {
  const entry = sampleEntry({ window: null })
  const result = readReaderWindow(entry, { mode: 'around' })
  assert.equal(result.truncated, false)
  assert.match(result.text, /尚未上报当前阅读窗口/u)
  const payload = buildReaderReadPayload(undefined, { mode: 'around' })
  assert.equal(payload.found, false)
  assert.match(payload.text, /尚未上报阅读位置/u)
})

test('buildReadingReport 拒绝缺失 sessionId，非法字段被归一化', async () => {
  const { buildReadingReport } = await import('../lib/reader-context.js')
  assert.equal(buildReadingReport({}), null)
  assert.equal(buildReadingReport({ sessionId: '   ' }), null)
  const report = buildReadingReport({
    sessionId: 's1',
    now: 1234,
    position: { path: 'a.md', name: 'a.md', ext: 'MD', chapter: -3, page: 'x', percent: 250, extra: 'drop me' },
    window: { title: '章节', text: '正文' },
  })
  assert.equal(report.storeEntry.updatedAt, 1234)
  assert.equal(report.storeEntry.chapter, 0)
  assert.equal(report.storeEntry.page, 0)
  assert.equal(report.storeEntry.percent, 100)
  assert.equal(report.storeEntry.ext, '.md')
  assert.equal('extra' in report.storeEntry, false)
  assert.equal(report.entry.window.title, '章节')
})

test('buildReadingReport 丢弃没有正文的窗口', async () => {
  const { buildReadingReport } = await import('../lib/reader-context.js')
  const report = buildReadingReport({ sessionId: 's2', position: { path: 'b.md' }, window: { title: '空', text: '   ' } })
  assert.equal(report.entry.window, null)
})
