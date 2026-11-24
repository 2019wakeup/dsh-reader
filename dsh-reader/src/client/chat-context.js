/**
 * Reading-context helpers for the in-reader conversation panel.
 *
 * Pure functions only: they turn the reader's own state into the small payload
 * the host needs for quotes and for the `reader_context` / `reader_read` tools.
 * See docs/superpowers/specs/2026-11-23-reader-chat-panel-design.md §4 and §6.
 */

function toPercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return undefined
  return Math.round(Math.min(100, Math.max(0, number)))
}

/**
 * Normalize the current reading position for the current document.
 *
 * PDF documents report the page and the total; text documents report the
 * chapter (0-based), its title when known, and a percentage.
 *
 * @param {object|null} doc
 * @param {{chapter?: number, chapterTitle?: string, page?: number, percent?: number}} [state]
 * @returns {{path: string, name: string, ext: string, chapter: number, chapterTitle: string,
 *            page: number, total: number, percent?: number} | null}
 */
export function currentPosition(doc, state = {}) {
  if (!doc) return null
  const known = state && typeof state === 'object' ? state : {}
  const ext = String(doc.ext || '')
  const name = String(doc.name || '')
  const path = String(doc.path || '')
  const chapters =
    (doc.docx && Array.isArray(doc.docx.chapters) && doc.docx.chapters) ||
    (doc.epub && Array.isArray(doc.epub.chapters) ? doc.epub.chapters : null)
  const isPdf = ext === '.pdf' || /\.pdf$/i.test(name)
  if (isPdf) {
    const totalPages = doc.pdf ? Number(doc.pdf.numPages) : NaN
    const total = Number.isFinite(totalPages) && totalPages > 0 ? Math.floor(totalPages) : 0
    const requestedPage = Number(known.page)
    const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1
    const percent = total > 1 ? Math.round(((page - 1) / (total - 1)) * 100) : 0
    return { path, name, ext, chapter: 0, chapterTitle: '', page, total, percent }
  }
  const requestedChapter = Number(known.chapter)
  const chapter = Number.isFinite(requestedChapter) && requestedChapter > 0 ? Math.floor(requestedChapter) : 0
  const chapterTitle = String(
    known.chapterTitle || (chapters && chapters[chapter] ? chapters[chapter].label : '') || '',
  )
  let percent = toPercent(known.percent)
  if (percent === undefined && chapters && chapters.length > 0) {
    percent = Math.round((chapter / chapters.length) * 100)
  }
  return { path, name, ext, chapter, chapterTitle, page: 0, total: 0, percent }
}

import { pdfPageBlocks } from './pdf.js'

/** Upper bound for the text window the host caches for `reader_read` (§6.1). */
const CONTEXT_LIMIT = 24000
const CONTEXT_PAGE_RADIUS = 1

function decodeBytes(bytes) {
  try {
    return new TextDecoder('utf-8').decode(bytes || new ArrayBuffer(0))
  } catch {
    return ''
  }
}

/** Plain text for HTML-bearing documents (EPUB chapters, HTML files). */
function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Slice the markdown source at the heading that matches the reader's section. */
/**
 * Window around one absolute offset, so a long text book reports the passage
 * near the reader's scroll position instead of the chapter start.
 * @param {string} source full text
 * @param {number} offset absolute character offset
 * @returns {string}
 */
function windowAround(source, offset) {
  const text = String(source || '')
  if (text.length <= CONTEXT_LIMIT) return text
  const safeOffset = Math.min(text.length, Math.max(0, Math.round(offset)))
  const start = Math.max(0, Math.min(text.length - CONTEXT_LIMIT, safeOffset - Math.floor(CONTEXT_LIMIT / 3)))
  return text.slice(start, start + CONTEXT_LIMIT)
}

function chapterSlice(source, chapterTitle) {
  const title = String(chapterTitle || '').trim()
  const text = String(source || '')
  if (!title) return text
  const lines = text.split('\n')
  const heading = new RegExp(`^(#{1,6})\\s+${escapeRegExp(title)}\\s*$`)
  let start = -1
  let level = 0
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+/.exec(lines[index])
    if (!match) continue
    if (heading.test(lines[index])) {
      start = index
      level = match[1].length
      break
    }
  }
  if (start < 0) return text
  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+/.exec(lines[index])
    if (match && match[1].length <= level) {
      end = index
      break
    }
  }
  return lines.slice(start, end).join('\n')
}

/**
 * Text window around the reading position, uploaded with the position so the
 * host can answer "what does this passage mean" without re-reading the file.
 * Capped at 24000 characters. Returns null when the document body is unknown.
 *
 * @param {object|null} doc
 * @param {{chapter?: number, chapterTitle?: string, page?: number}} [state]
 * @returns {Promise<{title: string, text: string} | null>}
 */
export async function buildContextWindow(doc, state = {}) {
  if (!doc) return null
  const known = state && typeof state === 'object' ? state : {}
  const ext = String(doc.ext || '')
  const name = String(doc.name || doc.path || '')
  const isPdf = ext === '.pdf' || /\.pdf$/i.test(name)
  let title = name
  let text = ''
  if (isPdf) {
    const pdf = doc.pdf
    if (!pdf || !pdf.doc) return null
    const total = Number(pdf.numPages) > 0 ? Math.floor(Number(pdf.numPages)) : 0
    const requestedPage = Number(known.page)
    const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1
    const pages = []
    for (let number = page - CONTEXT_PAGE_RADIUS; number <= page + CONTEXT_PAGE_RADIUS; number += 1) {
      if (number < 1 || (total > 0 && number > total)) continue
      pages.push(number)
    }
    const parts = []
    for (const number of pages) {
      try {
        const blocks = await pdfPageBlocks(pdf, number)
        const pageText = (blocks || [])
          .map((block) => String((block && block.text) || '').trim())
          .filter(Boolean)
          .join('\n')
        if (pageText) parts.push(pageText)
      } catch {
        return null
      }
    }
    if (pages.length === 0) return null
    text = parts.join('\n\n')
    title = `${name} · 第 ${pages[0] === pages[pages.length - 1] ? pages[0] : `${pages[0]}-${pages[pages.length - 1]}`} 页`
  } else if (ext === '.epub' || ext === '.docx') {
    const chapters =
    (doc.docx && Array.isArray(doc.docx.chapters) && doc.docx.chapters) ||
    (doc.epub && Array.isArray(doc.epub.chapters) ? doc.epub.chapters : null)
    if (!chapters) return null
    const requestedChapter = Number(known.chapter)
    const index = Number.isFinite(requestedChapter) && requestedChapter > 0 ? Math.floor(requestedChapter) : 0
    const chapter = chapters[index]
    if (!chapter) return null
    text = stripHtml(chapter.html || chapter.text || '')
    if (chapter.label) title = `${name} · ${chapter.label}`
  } else {
    const source = typeof doc.text === 'string' ? doc.text : decodeBytes(doc.bytes)
    if (!source) return null
    const chapterTitle = String(known.chapterTitle || '')
    const percent = Number(known.percent)
    if (Number.isFinite(percent) && percent > 0 && percent <= 100) {
      text = windowAround(source, (percent / 100) * source.length)
    } else {
      text = chapterSlice(source, chapterTitle)
    }
    if (chapterTitle) title = `${name} · ${chapterTitle}`
  }
  if (!text) return null
  return { title, text: text.slice(0, CONTEXT_LIMIT) }
}

/**
 * Throttled reading-position reporter.
 *
 * `report` keeps only the newest position and sends at most one request per
 * `throttleMs`; `flush` sends the pending position right away; `dispose` flushes
 * once and ignores later reports. Network failures are swallowed: reporting is
 * best effort and must never disturb reading.
 *
 * @param {{api?: {context?: Function}, sessionId?: string, throttleMs?: number}} [options]
 * @returns {{report: (position: object, window?: object) => void, flush: () => void, dispose: () => void}}
 */
export function createPositionReporter(options = {}) {
  const api = options.api || null
  const sessionId = String(options.sessionId || '')
  const throttleMs = Number.isFinite(options.throttleMs) && options.throttleMs >= 0 ? Number(options.throttleMs) : 1500
  let timer = null
  let latest = null
  let disposed = false
  const send = () => {
    timer = null
    if (!latest) return
    const payload = latest
    latest = null
    if (!api || typeof api.context !== 'function') return
    try {
      const result = api.context(sessionId, payload)
      if (result && typeof result.catch === 'function') result.catch(() => {})
    } catch {
      /* the position is a hint for the host; losing it must not surface */
    }
  }
  return {
    report(position, contextWindow) {
      if (disposed || !position) return
      latest = contextWindow ? { position, window: contextWindow } : { position }
      if (timer === null) timer = setTimeout(send, throttleMs)
    },
    flush() {
      if (disposed) return
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      send()
    },
    dispose() {
      if (disposed) return
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      send()
      disposed = true
    },
  }
}
