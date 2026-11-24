import fs from 'node:fs/promises'
import path from 'node:path'
import { writeFileAtomic } from './atomic-write.js'

export const READING_DIR = '.dsh-reader'
export const CONTEXT_FILE = 'context.json'
export const MAX_WINDOW_CHARS = 24_000
export const MAX_READING_SESSIONS = 10
export const MAX_READ_CHARS = 8_000
export const MAX_SESSION_ID_CHARS = 200

const POSITION_MAX_CHARS = { path: 1000, name: 300, chapterTitle: 300 }
const WINDOW_TITLE_MAX_CHARS = 300
const STORE_FIELDS = ['path', 'name', 'ext', 'chapter', 'chapterTitle', 'page', 'total', 'percent']

export const NO_POSITION_HINT = '尚未上报阅读位置：当前会话还没有来自 dsh-reader 阅读器的位置上报。请用户先打开一本书。'
export const NO_WINDOW_HINT = '客户端尚未上报当前阅读窗口（可能仍在加载，或 PDF 文本抽取失败）。'

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function text(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function integer(value, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  const rounded = Math.trunc(value)
  if (rounded < min) return min
  if (rounded > max) return max
  return rounded
}

function percent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

function extension(value) {
  const raw = text(value, 16).trim().toLowerCase()
  if (!raw) return ''
  return raw.startsWith('.') ? raw : `.${raw}`
}

/**
 * Canonical reader position. Unknown fields are dropped; wrong value types fall
 * back to their neutral value so a malformed client report never reaches the
 * store or the tools.
 * @param {unknown} raw reported position
 */
export function normalizeReaderPosition(raw) {
  const source = isRecord(raw) ? raw : {}
  return {
    path: text(source.path, POSITION_MAX_CHARS.path).trim(),
    name: text(source.name, POSITION_MAX_CHARS.name).trim(),
    ext: extension(source.ext),
    chapter: integer(source.chapter, 0, Number.MAX_SAFE_INTEGER),
    chapterTitle: text(source.chapterTitle, POSITION_MAX_CHARS.chapterTitle).trim(),
    page: integer(source.page, 0, Number.MAX_SAFE_INTEGER),
    total: integer(source.total, 0, Number.MAX_SAFE_INTEGER),
    percent: percent(source.percent),
  }
}

/**
 * Canonical context window. A window without any text is treated as absent so
 * reader_read can say exactly what is missing.
 * @param {unknown} raw reported window
 */
export function normalizeReaderWindow(raw) {
  if (!isRecord(raw)) return null
  const title = text(raw.title, WINDOW_TITLE_MAX_CHARS).trim()
  const body = typeof raw.text === 'string' ? raw.text.slice(0, MAX_WINDOW_CHARS) : ''
  if (!body.trim()) return null
  return { title, text: body }
}

function normalizeUpdatedAt(raw, fallback) {
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : fallback
}

function normalizeReadingEntry(raw, fallbackUpdatedAt = 0) {
  if (!isRecord(raw)) return null
  return {
    ...normalizeReaderPosition(raw),
    window: normalizeReaderWindow(raw.window),
    updatedAt: normalizeUpdatedAt(raw.updatedAt, fallbackUpdatedAt),
  }
}

function sortEntriesNewestFirst(sessions, protectedSessionId) {
  return Object.keys(sessions).sort((left, right) => {
    if (left === protectedSessionId) return -1
    if (right === protectedSessionId) return 1
    return (sessions[right].updatedAt || 0) - (sessions[left].updatedAt || 0)
  })
}

function capSessions(sessions, protectedSessionId) {
  const keys = sortEntriesNewestFirst(sessions, protectedSessionId)
  const out = {}
  for (const key of keys.slice(0, MAX_READING_SESSIONS)) out[key] = sessions[key]
  return out
}

/** One private file no other reader version touches; a missing or corrupt file is empty. */
export function readingContextPath(cwd) {
  return path.join(cwd, READING_DIR, CONTEXT_FILE)
}

/**
 * @param {string} cwd workspace directory
 * @returns {Promise<{ version: 1, sessions: Record<string, object> }>}
 */
export async function readReadingContext(cwd) {
  const empty = { version: 1, sessions: {} }
  let raw
  try {
    raw = JSON.parse(await fs.readFile(readingContextPath(cwd), 'utf8'))
  } catch {
    // Missing, unreadable, or corrupt: the next report rewrites the file.
    return empty
  }
  if (!isRecord(raw) || !isRecord(raw.sessions)) return empty
  const sessions = {}
  for (const [sessionId, value] of Object.entries(raw.sessions)) {
    if (typeof sessionId !== 'string' || !sessionId || sessionId.length > MAX_SESSION_ID_CHARS) continue
    const entry = normalizeReadingEntry(value)
    if (entry) sessions[sessionId] = entry
  }
  return { version: 1, sessions: capSessions(sessions) }
}

let contextWriteQueue = Promise.resolve()

function enqueueContextWrite(cwd, task) {
  const run = contextWriteQueue.then(task, task)
  contextWriteQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function writeContextFile(cwd, context) {
  const dir = path.join(cwd, READING_DIR)
  await fs.mkdir(dir, { recursive: true })
  await writeFileAtomic(readingContextPath(cwd), JSON.stringify(context, null, 2))
}

/**
 * Persist one session's position and window. The newest MAX_READING_SESSIONS
 * sessions survive; stale or malformed entries are dropped on the next read.
 * @param {string} cwd workspace directory
 * @param {string} sessionId owning session
 * @param {object} entry position fields, optional window, optional updatedAt
 * @returns {Promise<object>} canonical entry written to disk
 */
export async function writeReadingSession(cwd, sessionId, entry) {
  const id = typeof sessionId === 'string' ? sessionId.trim().slice(0, MAX_SESSION_ID_CHARS) : ''
  if (!id) throw new TypeError('reader-context: sessionId required')
  const canonical = normalizeReadingEntry(entry, Date.now())
  if (!canonical) throw new TypeError('reader-context: invalid reading entry')
  return enqueueContextWrite(cwd, async () => {
    const context = await readReadingContext(cwd)
    context.sessions[id] = canonical
    context.sessions = capSessions(context.sessions, id)
    await writeContextFile(cwd, context)
    return canonical
  })
}

/**
 * Resolve the reported reading entry for one session. The session slot and the
 * persisted session id disagree about the `session-` prefix across DSH
 * versions, so both spellings are tried.
 * @param {unknown} context result of readReadingContext
 * @param {string} sessionId session or bare uuid
 */
export function pickReaderTarget(context, sessionId) {
  if (!isRecord(context) || !isRecord(context.sessions) || typeof sessionId !== 'string' || !sessionId) return undefined
  const candidates = [sessionId]
  candidates.push(sessionId.startsWith('session-') ? sessionId.slice(8) : `session-${sessionId}`)
  for (const candidate of candidates) {
    const entry = context.sessions[candidate]
    if (isRecord(entry)) return entry
  }
  return undefined
}

function hasPosition(entry) {
  return isRecord(entry) && Boolean(entry.path || (isRecord(entry.window) && (entry.window.title || entry.window.text)))
}

function bookTitle(entry) {
  if (!isRecord(entry)) return ''
  if (typeof entry.name === 'string' && entry.name) return entry.name
  if (typeof entry.path !== 'string' || !entry.path) return ''
  return path.basename(entry.path)
}

/** Human-readable one-line position for the model and for reader_context. */
export function describeReaderContext(entry) {
  if (!hasPosition(entry)) return NO_POSITION_HINT
  const parts = [`《${bookTitle(entry) || '未命名书籍'}》`]
  if (entry.chapterTitle) parts.push(`第 ${entry.chapter + 1} 章「${entry.chapterTitle}」`)
  else if (entry.chapter > 0) parts.push(`第 ${entry.chapter + 1} 章`)
  if (entry.page > 0) {
    parts.push(`第 ${entry.page}${entry.total > 0 ? `/${entry.total}` : ''} 页`)
  }
  if (entry.percent > 0) parts.push(`${entry.percent}%`)
  return parts.join(' · ')
}

/** Canonical value of the reader_context tool. */
export function buildReaderContextPayload(entry) {
  if (!hasPosition(entry)) {
    return {
      found: false,
      summary: NO_POSITION_HINT,
      book: '',
      path: '',
      chapterTitle: '',
      page: 0,
      total: 0,
      percent: 0,
      hasWindow: false,
      windowTitle: '',
    }
  }
  const window = isRecord(entry.window) ? entry.window : null
  return {
    found: true,
    summary: describeReaderContext(entry),
    book: bookTitle(entry),
    path: typeof entry.path === 'string' ? entry.path : '',
    chapterTitle: typeof entry.chapterTitle === 'string' ? entry.chapterTitle : '',
    page: typeof entry.page === 'number' ? entry.page : 0,
    total: typeof entry.total === 'number' ? entry.total : 0,
    percent: typeof entry.percent === 'number' ? entry.percent : 0,
    hasWindow: Boolean(window),
    windowTitle: window && typeof window.title === 'string' ? window.title : '',
  }
}

function readMode(value) {
  return ['around', 'chapter', 'toc', 'search'].includes(value) ? value : 'around'
}

function readLimit(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return MAX_READ_CHARS
  return Math.min(MAX_READ_CHARS, Math.max(1, Math.floor(value)))
}

function tocText(entry, title) {
  const chapters = entry.chapterTitle ? [`第 ${entry.chapter + 1} 章 ${entry.chapterTitle}`] : []
  return {
    title,
    mode: 'toc',
    text: chapters.length > 0 ? `当前章节：\n${chapters.map((chapter) => `- ${chapter}`).join('\n')}` : '客户端尚未上报章节目录信息。',
    truncated: false,
    chapters,
    matches: [],
  }
}

function searchText(entry, window, query, title, limit) {
  if (!query) {
    return { title, mode: 'search', text: 'search 模式需要提供要查找的关键词（query）。', truncated: false, chapters: [], matches: [] }
  }
  const haystack = window.text
  const needle = query.toLowerCase()
  const lower = haystack.toLowerCase()
  const matches = []
  let index = lower.indexOf(needle)
  while (index >= 0 && matches.length < 20) {
    const start = Math.max(0, index - 80)
    const end = Math.min(haystack.length, index + query.length + 120)
    matches.push(haystack.slice(start, end).replace(/\s+/g, ' ').trim())
    index = lower.indexOf(needle, index + Math.max(1, query.length))
  }
  if (matches.length === 0) {
    return { title, mode: 'search', text: `当前阅读窗口中没有找到“${query}”。`, truncated: false, chapters: [], matches: [] }
  }
  const full = `在当前阅读窗口中命中 ${matches.length} 处：\n\n${matches.map((match, at) => `${at + 1}. ${match}`).join('\n')}`
  return {
    title,
    mode: 'search',
    text: full.slice(0, limit),
    truncated: full.length > limit,
    chapters: [],
    matches,
  }
}

/**
 * Read one reported window. The Host cannot parse book files (PDF/EPUB parsing
 * lives in the reader client), so every mode is projected from the window the
 * client last uploaded.
 * @param {object|undefined} entry reading entry with a canonical position and window
 * @param {{ mode?: string, query?: string, limit?: number }} [args]
 */
export function readReaderWindow(entry, args) {
  const options = isRecord(args) ? args : {}
  const mode = readMode(options.mode)
  const limit = readLimit(options.limit)
  const window = isRecord(entry) && isRecord(entry.window) ? normalizeReaderWindow(entry.window) : null
  const title = bookTitle(entry) || (window ? window.title : '')
  if (mode === 'toc') return tocText(isRecord(entry) ? entry : {}, title)
  if (!window) {
    return { title, mode, text: NO_WINDOW_HINT, truncated: false, chapters: [], matches: [] }
  }
  if (mode === 'search') {
    const query = typeof options.query === 'string' ? options.query.trim() : ''
    return searchText(entry, window, query, title, limit)
  }
  const heading = mode === 'chapter' && entry.chapterTitle ? `第 ${entry.chapter + 1} 章 ${entry.chapterTitle}\n\n` : ''
  const full = `${heading}${window.text}`
  return {
    title,
    mode,
    text: full.slice(0, limit),
    truncated: full.length > limit,
    chapters: [],
    matches: [],
  }
}

/** Canonical value of the reader_read tool. */
export function buildReaderReadPayload(entry, args) {
  if (!hasPosition(entry)) {
    return {
      found: false,
      mode: readMode(isRecord(args) ? args.mode : undefined),
      title: '',
      text: NO_POSITION_HINT,
      truncated: false,
      chapters: [],
      matches: [],
    }
  }
  const window = readReaderWindow(entry, args)
  return {
    found: true,
    mode: window.mode,
    title: window.title,
    text: window.text,
    truncated: window.truncated,
    chapters: window.chapters,
    matches: window.matches,
  }
}

/**
 * Normalize one `POST /api/context` report for both persistence layers.
 * @param {{ sessionId?: string, position?: unknown, window?: unknown, now?: number }} report
 * @returns {{ entry: object, storeEntry: object } | null} null for a missing session id
 */
export function buildReadingReport(report) {
  const source = isRecord(report) ? report : {}
  const sessionId = typeof source.sessionId === 'string' ? source.sessionId.trim() : ''
  if (!sessionId) return null
  const updatedAt = typeof source.now === 'number' && Number.isFinite(source.now) ? source.now : Date.now()
  const position = normalizeReaderPosition(source.position)
  return {
    entry: { ...position, window: normalizeReaderWindow(source.window), updatedAt },
    storeEntry: { ...position, updatedAt },
  }
}

/** True when two canonical positions describe the same reading spot. */
export function sameReaderPosition(left, right) {
  if (!isRecord(left) || !isRecord(right)) return false
  return STORE_FIELDS.every((field) => left[field] === right[field])
}
