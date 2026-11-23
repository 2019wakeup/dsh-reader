import { JSDOM } from 'jsdom'
import { parseHTML } from 'linkedom'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.NodeFilter = dom.window.NodeFilter
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Node = dom.window.Node
globalThis.MutationObserver = dom.window.MutationObserver
globalThis.getComputedStyle = dom.window.getComputedStyle
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
globalThis.DOMParser = dom.window.DOMParser
if (dom.window.Range) {
  dom.window.Range.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 })
  dom.window.Range.prototype.getClientRects = () => []
}

const { applyHighlights } = await import(path.join(root, 'src/client/annotations.js'))
const { markTerms } = await import(path.join(root, 'src/client/concepts.js'))
const { markdownRender } = await import(path.join(root, 'src/client/markdown.js'))
const { markdownSections } = await import(path.join(root, 'src/client/sections.js'))
const { docFingerprint } = await import(path.join(root, 'lib/fingerprint.js'))
const { readStore } = await import(path.join(root, 'lib/store.js'))
const { parseSectionReply, parseOverviewReply } = await import(path.join(root, 'lib/guide.js'))
const { buildTree, layoutTree, chunkNodeTitle } = await import(path.join(root, 'src/client/mindmap.js'))
const { clampCardPosition } = await import(path.join(root, 'src/client/card-drag.js'))
const { takeTranslationBatch, isNearViewport } = await import(path.join(root, 'src/client/translation-schedule.js'))
const { buildTranscript, formatLocation, buildQuoteText } = await import(path.join(root, 'src/client/chat-transcript.js'))
const { buildReadingReport, buildReaderContextPayload, buildReaderReadPayload } = await import(path.join(root, 'lib/reader-context.js'))

function mount(html) {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}

export const cases = [
  {
    name: 'anchor.spanning',
    async run() {
      const host = mount('<p><strong>hello</strong> world</p>')
      const lost = applyHighlights(host, [{ id: 'a1', kind: 'text', chapter: 0, quote: 'hello world', occurrence: 0 }], 0)
      host.remove()
      if (lost.length !== 0) throw new Error('quote reported as lost')
      return { marked: 1 }
    },
  },
  {
    name: 'anchor.unresolved',
    async run() {
      const host = mount('<p>nothing</p>')
      const lost = applyHighlights(host, [{ id: 'a1', kind: 'text', chapter: 0, quote: 'missing', occurrence: 0 }], 0)
      host.remove()
      if (lost[0] !== 'a1') throw new Error('lost anchor not reported')
      return { reported: lost.length }
    },
  },
  {
    name: 'concept.boundary',
    async run() {
      const { document: doc } = parseHTML('<html><body><div id="a"><p>EMAIL SYSTEM</p></div><div id="b"><p>AI 系统</p></div></body></html>')
      globalThis.document = doc
      globalThis.NodeFilter = { SHOW_TEXT: 4 }
      const a = doc.getElementById('a')
      const b = doc.getElementById('b')
      markTerms(a, [{ id: 'c', term: 'AI' }])
      markTerms(b, [{ id: 'c', term: 'AI' }])
      globalThis.document = dom.window.document
      globalThis.NodeFilter = dom.window.NodeFilter
      const falsePositives = a.querySelectorAll('.rd-term').length
      const realMatches = b.querySelectorAll('.rd-term').length
      if (falsePositives !== 0) throw new Error(`short latin term matched inside a word (${falsePositives})`)
      if (realMatches !== 1) throw new Error('real latin term not matched')
      return { falsePositives, realMatches }
    },
  },
  {
    name: 'markdown.perf',
    async run() {
      const block = '# 标题\n\n中文段落，含 **粗体**、`代码` 与 [链接](https://example.com)。\n\n- 一\n- 二\n\n> 引用\n\n'
      const text = block.repeat(2000)
      const started = performance.now()
      const html = markdownRender(text)
      const ms = performance.now() - started
      if (html.length === 0) throw new Error('empty output')
      if (ms > 150) throw new Error(`render too slow: ${ms.toFixed(1)}ms`)
      return { ms: Number(ms.toFixed(1)), bytes: text.length }
    },
  },
  {
    name: 'fingerprint.stability',
    async run() {
      const a = docFingerprint(new TextEncoder().encode('hello'))
      const b = docFingerprint(new TextEncoder().encode('hello'))
      const c = docFingerprint(new TextEncoder().encode('hello!'))
      if (a !== b || a === c) throw new Error('fingerprint is not stable or not sensitive')
      return { hex: 64 }
    },
  },
  {
    name: 'migration.v1',
    async run() {
      const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'reader-eval-'))
      await fs.writeFile(path.join(cwd, 'book.md'), '# T\nhello')
      await fs.mkdir(path.join(cwd, '.dsh-reader'), { recursive: true })
      await fs.writeFile(
        path.join(cwd, '.dsh-reader', 'store.json'),
        JSON.stringify({ version: 1, concepts: { c: { id: 'c', term: 'T' } }, annotations: { 'book.md': [{ id: 'a1' }] }, positions: {} }),
      )
      const store = await readStore(cwd)
      await fs.rm(cwd, { recursive: true, force: true })
      const docs = Object.values(store.docs)
      if (store.version !== 2 || docs.length !== 1 || docs[0].annotations[0].id !== 'a1') {
        throw new Error('migration lost data')
      }
      return { docs: docs.length, concepts: Object.keys(store.concepts).length }
    },
  },
  {
    name: 'guide.parse',
    async run() {
      const section = parseSectionReply('```json\n{"summary":"S","keyPoints":["a","b"]}\n```')
      const overview = parseOverviewReply('{"synopsis":"X","questions":["q1","q2","q3"]}')
      if (section.summary !== 'S' || section.keyPoints.length !== 2) throw new Error('section parse failed')
      if (overview.synopsis !== 'X' || overview.questions.length !== 3) throw new Error('overview parse failed')
      return { keyPoints: section.keyPoints.length }
    },
  },
  {
    name: 'sections.large',
    async run() {
      const text = '# 章\n\n' + '正文段落。\n\n'.repeat(20000)
      const started = performance.now()
      const sections = markdownSections(text)
      const ms = performance.now() - started
      if (sections.length === 0 || sections.length > 30) throw new Error('section count out of range')
      if (sections.some((section) => section.text.length > 6000)) throw new Error('section not bounded')
      if (ms > 150) throw new Error(`split too slow: ${ms.toFixed(1)}ms`)
      return { sections: sections.length, ms: Number(ms.toFixed(1)), bytes: text.length }
    },
  },
  {
    name: 'mindmap.layout',
    async run() {
      const layout = layoutTree(buildTree('书', [
        { id: 'a', title: 'A', level: 1 },
        { id: 'b', title: 'B', level: 2 },
        { id: 'c', title: 'C', level: 1 },
      ]))
      if (layout.nodes.length !== 4 || layout.edges.length !== 3) throw new Error('tree layout incomplete')
      if (layout.width <= 0 || layout.height <= 0) throw new Error('empty layout')
      return { nodes: layout.nodes.length, edges: layout.edges.length }
    },
  },
  {
    name: 'carddrag.bounds',
    async run() {
      const bounds = { left: 0, top: 0, right: 1280, bottom: 860 }
      const short = clampCardPosition({ left: 900, top: 700, width: 330, height: 300 }, bounds)
      const tall = clampCardPosition({ left: 900, top: 700, width: 330, height: 700 }, bounds)
      if (short.top !== 552) throw new Error('short card cannot reach the lower half')
      if (tall.top !== 152) throw new Error('tall card exceeded its height')
      return { short: short.top, tall: tall.top }
    },
  },
  {
    name: 'translate.schedule',
    async run() {
      const entries = [['a', 'hello'], ['b', 'world'], ['c', 'again']]
      const batch = takeTranslationBatch(entries, { maxChars: 7 })
      if (batch.length !== 1 || batch[0].id !== 'a') throw new Error('character limit not applied')
      const count = takeTranslationBatch(entries, { maxSegments: 2 })
      if (count.length !== 2) throw new Error('segment limit not applied')
      if (!isNearViewport({ top: 480, bottom: 540 }, { top: 100, bottom: 500 }, 200)) throw new Error('viewport margin missing')
      return { batch: batch.length, count: count.length }
    },
  },
  {
    name: 'mindmap.chunklabel',
    async run() {
      const label = chunkNodeTitle({ chunkIndex: 2, page: 11, title: '一致性模型（2）' })
      if (label !== '一致性模型') throw new Error('chunk title still shows the ordinal badge')
      return { label }
    },
  },
  {
    name: 'chat.transcript',
    async run() {
      const nodes = [
        { key: 'u1', kind: 'user', data: { turn: 1, content: [{ type: 'text', text: '问一' }] }, location: { kind: 'turn', turn: { turn: 1 } }, visibility: 'visible' },
        { key: 'a1', kind: 'assistant-step', data: { turn: 1, step: 1, status: 'settled', blocks: [{ kind: 'text', text: '答一' }] }, location: { kind: 'turn', turn: { turn: 1 } }, visibility: 'visible' },
      ]
      const map = new Map(nodes.map((node) => [node.key, node]))
      const rows = buildTranscript({
        order: nodes.map((node) => node.key),
        nodes: { get: (key) => map.get(key) },
        legacy: { nodes: [], turnTimings: new Map(), turnEnds: new Map(), partial: null, runningCalls: [] },
      })
      if (rows.length !== 2) throw new Error('transcript row count wrong')
      if (rows[0].kind !== 'user' || rows[1].kind !== 'assistant') throw new Error('transcript kinds wrong')
      return { rows: rows.length }
    },
  },
  {
    name: 'chat.quote',
    async run() {
      const location = formatLocation({ name: '书.md', ext: '.md' }, { chapter: 2, chapterTitle: '一致性模型', percent: 42 })
      if (location !== '《书.md》 第 3 章 · 一致性模型 · 42%') throw new Error('location format wrong')
      const quote = buildQuoteText(location, '  很多\n\n空白  ', 2000)
      if (!quote.startsWith('《书.md》 第 3 章')) throw new Error('quote lost its location line')
      if (!quote.endsWith('很多 空白')) throw new Error('quote did not normalize whitespace')
      return { location }
    },
  },
  {
    name: 'reader.context',
    async run() {
      const report = buildReadingReport({
        sessionId: 'session-eval',
        position: { path: '示例-分布式系统阅读.md', name: '示例-分布式系统阅读.md', ext: '.md', chapter: 1, chapterTitle: 'CAP 定理', page: 0, total: 0, percent: 35 },
        window: { title: 'CAP 定理', text: '一致性、可用性、分区容忍三者不可兼得。' },
      })
      const payload = buildReaderContextPayload(report.entry)
      if (!payload.found) throw new Error('reading context was not found')
      if (!payload.summary.includes('示例-分布式系统阅读.md')) throw new Error('context summary lost the book')
      if (!payload.hasWindow) throw new Error('context lost the pushed window')
      return { book: payload.book, hasWindow: payload.hasWindow }
    },
  },
  {
    name: 'reader.read',
    async run() {
      const report = buildReadingReport({
        sessionId: 'session-eval',
        position: { path: '书.md', name: '书.md', ext: '.md', chapter: 0, chapterTitle: '第一章', page: 0, total: 0, percent: 10 },
        window: { title: '第一章', text: '一致性模型要求系统像单副本一样按实时顺序生效。' },
      })
      const around = buildReaderReadPayload(report.entry, { mode: 'around', limit: 10 })
      if (!around.found || around.text.length > 10) throw new Error('around did not honor the limit')
      const search = buildReaderReadPayload(report.entry, { mode: 'search', query: '单副本' })
      if (search.matches.length !== 1) throw new Error('search did not find the passage')
      const toc = buildReaderReadPayload(report.entry, { mode: 'toc' })
      if (!toc.chapters.join('').includes('第一章')) throw new Error('toc lost the chapter title')
      return { around: around.text.length, matches: search.matches.length }
    },
  },
  {
    name: 'bundle.smoke',
    async run() {
      const code = await fs.readFile(path.join(root, 'client.js'), 'utf8')
      let entry = null
      const fakeWindow = { __ModuleLoader__: { load(registration) { entry = registration } } }
      new Function('window', code)(fakeWindow)
      if (!entry || entry.id !== 'dsh-reader') throw new Error('bundle does not register')
      let component = null
      const mod = entry.factory((name) => {
        if (name === 'react') return { createElement: () => null, useState: () => [], useRef: () => ({}), useEffect: () => {}, useMemo: () => ({}), Component: class {} }
        throw new Error('unexpected module ' + name)
      })
      mod.apply({ slots: { inject(_key, callback) { callback() }, register(_options, registered) { component = registered; return () => {} } } })
      if (typeof component !== 'function') throw new Error('view not registered')
      return { view: 'reader' }
    },
  },
]
