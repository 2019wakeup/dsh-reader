import { createServer } from 'node:http'
import { request as httpRequest } from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import puppeteer from 'puppeteer-core'
import { PNG } from 'pngjs'
import { docFingerprint } from '../lib/fingerprint.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const workspace = path.resolve(root, '..')
const DSH = (process.env.DSH_WEB_URL || 'http://127.0.0.1:60592').replace(/\/$/, '')
const DSH_PORT = Number(new URL(DSH).port) || 80
const SESSION = process.env.DSH_SESSION_ID || ''
if (!SESSION) {
  console.error('eval:visual needs DSH_SESSION_ID (run it from a DSH session or export one)')
  process.exit(1)
}
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASELINE = path.join(here, 'visual', 'baseline')

const UPDATE = process.env.VISUAL_UPDATE === '1'
const DEMOS = ['示例-分布式系统阅读.md', '示例-Markdown语法.md', '示例-分布式系统.epub', '示例-分布式系统.pdf', '示例-Word文档.docx']
const DOCX_DEMO = '示例-Word文档.docx'

function docxZip(entries) {
  const enc = new TextEncoder()
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, text] of entries) {
    const nameBytes = enc.encode(name)
    const data = enc.encode(text)
    const local = new Uint8Array(30 + nameBytes.length + data.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    local.set(data, 30 + nameBytes.length)
    locals.push(local)
    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    central.set(nameBytes, 46)
    centrals.push(central)
    offset += local.length
  }
  const cdOffset = offset
  const cdSize = centrals.reduce((sum, part) => sum + part.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, cdOffset, true)
  const out = new Uint8Array(offset + cdSize + eocd.length)
  let at = 0
  for (const part of locals) { out.set(part, at); at += part.length }
  for (const part of centrals) { out.set(part, at); at += part.length }
  out.set(eocd, at)
  return out
}

async function ensureDocxDemo() {
  const target = path.join(workspace, DOCX_DEMO)
  try {
    await fs.access(target)
    return
  } catch {
    /* generate below */
  }
  const contentTypes =
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
  const rels =
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
  const styles =
    '<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style></w:styles>'
  const body =
    '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>第一章 技术报告</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>技术报告正文，用来说明 Word 阅读与划词。</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>1.1 数据表</w:t></w:r></w:p>' +
    '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>指标</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>数值</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>吞吐</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>1200</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
    '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>第二章 结论</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>结论正文。</w:t></w:r></w:p>'
  const document = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
  await fs.writeFile(
    target,
    docxZip([
      ['[Content_Types].xml', contentTypes],
      ['_rels/.rels', rels],
      ['word/document.xml', document],
      ['word/styles.xml', styles],
    ]),
  )
}

const results = []
function record(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(30)} ${detail || ''}`)
}

async function dshJson(url) {
  const response = await fetch(DSH + url)
  if (!response.ok) throw new Error(`DSH ${url} -> ${response.status}`)
  return response.json()
}

async function buildFixtures() {
  const list = await dshJson(`/dsh-reader-live/api/list?sessionId=${encodeURIComponent(SESSION)}&dir=.`)
  const entries = list.entries.filter((entry) => DEMOS.includes(entry.name))
  const fingerprints = {}
  const sizes = {}
  for (const entry of entries) {
    const response = await fetch(
      `${DSH}/dsh-reader-live/api/file?sessionId=${encodeURIComponent(SESSION)}&path=${encodeURIComponent(entry.path)}`,
    )
    const bytes = new Uint8Array(await response.arrayBuffer())
    fingerprints[entry.name] = response.headers.get('x-doc-fingerprint') || docFingerprint(bytes)
    sizes[entry.name] = bytes.length
  }
  const mdKey = fingerprints['示例-分布式系统阅读.md']
  const pdfKey = fingerprints['示例-分布式系统.pdf']
  const epubKey = fingerprints['示例-分布式系统.epub']
  const guide = {
    generatedAt: 1,
    synopsis: '这本书用分布式系统的例子，示范如何边读边把不懂的概念变成可复用的卡片。',
    questions: ['线性一致性和最终一致性差别在哪？', 'CAP 定理在工程上怎么取舍？'],
    parts: [
      { id: 'part1', title: '第一部分 · 一致性与 CAP', summary: '从强一致性出发，讨论 CAP 的取舍。', sectionIds: ['s1', 's2'] },
      { id: 'part2', title: '第二部分 · 直觉', summary: '用日常直觉理解一致性窗口。', sectionIds: ['s3'] },
    ],
    sections: [
      {
        id: 's1',
        title: '一致性模型',
        level: 2,
        hash: 'h1',
        summary: '线性一致性要求系统像单副本一样按实时顺序生效，是强一致性模型。',
        keyPoints: ['线性一致性', '实时顺序'],
      },
      {
        id: 's2',
        title: 'CAP 定理',
        level: 2,
        hash: 'h2',
        summary: '一致性、可用性、分区容忍三者不可兼得。',
        keyPoints: ['CAP', '取舍'],
      },
      {
        id: 's3',
        title: '一个直觉',
        level: 2,
        hash: 'h3',
        summary: '用日常直觉理解一致性窗口。',
        keyPoints: ['直觉'],
      },
    ],
  }
  const store = {
    version: 2,
    revision: 3,
    prefs: {
      fontSize: 18,
      lineHeight: 1.85,
      theme: 'system',
      hoverDelay: 150,
      cardTrigger: 'hover',
      pdfSpread: false,
      pageKeys: 'arrows',
    },
    concepts: {
      c1: {
        id: 'c1',
        term: '线性一致性',
        definition: '所有副本在同一时刻看到同一份历史，像系统只有一个副本。',
        intuition: '写下即被所有人看到，没有中间窗口。',
        context: '本书用它作为最强的一致性参考点。',
        examples: ['单副本数据库'],
        related: ['CAP 定理'],
        aliases: ['linearizability'],
        occurrences: [{ docKey: mdKey, chapter: 0, quote: '线性一致性', occurrence: 0 }],
        qa: [{ q: '它和最终一致性有什么差别？', a: '线性一致性要求实时顺序，最终一致性只保证收敛。', at: 1 }],
        status: 'ready',
        source: 'agent',
        createdAt: 1,
        updatedAt: 1,
        evidence: { docKey: mdKey, quote: '线性一致性', sentence: '线性一致性是最强的一致性模型之一。' },
      },
      pdfOnly: {
        id: 'pdfOnly',
        term: 'PDF 专属概念',
        definition: '只出现在 PDF 里的概念。',
        occurrences: [{ docKey: pdfKey, page: 1, quote: 'PDF 专属概念' }],
        qa: [],
        createdAt: 3,
        updatedAt: 3,
      },
      c2: {
        id: 'c2',
        term: 'CAP 定理',
        definition: '一致性、可用性、分区容忍三者不可兼得。',
        related: ['线性一致性'],
        aliases: [],
        occurrences: [{ docKey: mdKey, chapter: 0, quote: 'CAP 定理', occurrence: 0 }],
        qa: [],
        status: 'ready',
        source: 'agent',
        createdAt: 2,
        updatedAt: 2,
      },
    },
    docs: {
      [mdKey]: {
        path: '示例-分布式系统阅读.md',
        size: sizes['示例-分布式系统阅读.md'],
        mtime: 1,
        annotations: [
          {
            id: 'a1',
            kind: 'text',
            chapter: 0,
            quote: '线性一致性',
            occurrence: 0,
            color: '#f2c94c',
            note: '视觉测试夹具',
            createdAt: 1,
          },
        ],
        positions: { chapter: 0 },
        guide,
      },
      [pdfKey]: {
        path: '示例-分布式系统.pdf',
        size: sizes['示例-分布式系统.pdf'],
        mtime: 1,
        annotations: [],
        positions: { page: 1 },
      },
      [epubKey]: {
        path: '示例-分布式系统.epub',
        size: sizes['示例-分布式系统.epub'],
        mtime: 1,
        annotations: [],
        positions: { chapter: 1 },
      },
    },
    debug: {
      lastSent: [
        { at: 1, kind: 'guide', preview: '示例-分布式系统阅读.md', chars: 1200 },
        { at: 2, kind: 'explain', preview: '线性一致性', chars: 300 },
      ],
    },
  }
  return {
    entries,
    store,
    guide,
    concept: { ...store.concepts.c1, occurrences: [] },
  }
}

async function makeHarness() {
  const built = await build({
    entryPoints: [path.join(here, 'visual', 'harness.jsx')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'chrome120',
    jsx: 'transform',
    logLevel: 'silent',
  })
  return built.outputFiles[0].text
}

async function startServer(fixtures, harnessCode) {
  const clientCode = await fs.readFile(path.join(root, 'client.js'))
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const send = (status, type, body) => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
      res.end(body)
    }
    if (url.pathname === '/') return send(200, 'text/html; charset=utf-8', HTML)
    if (url.pathname === '/harness.js') return send(200, 'text/javascript', harnessCode)
    if (url.pathname === '/reader-client.js') return send(200, 'text/javascript', clientCode)
    if (url.pathname === '/fixtures.json') return send(200, 'application/json', JSON.stringify(fixtures))
    if (url.pathname.startsWith('/real/') || url.pathname.startsWith('/dsh-reader-live/')) {
      const targetPath = url.pathname.startsWith('/real/')
        ? url.pathname.slice('/real'.length)
        : url.pathname
      const upstream = httpRequest(
        {
          host: '127.0.0.1',
          port: DSH_PORT,
          path: targetPath + url.search,
          method: req.method,
          headers: (() => {
            const headers = { ...req.headers, host: `127.0.0.1:${DSH_PORT}` }
            delete headers['accept-encoding']
            return headers
          })(),
        },
        (upstreamRes) => {
          const headers = { ...upstreamRes.headers }
          delete headers['content-encoding']
          res.writeHead(upstreamRes.statusCode || 502, headers)
          upstreamRes.pipe(res)
        },
      )
      upstream.on('error', () => send(502, 'text/plain', 'proxy error'))
      req.pipe(upstream)
      return
    }
    send(404, 'text/plain', 'not found')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return server
}

const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>reader visual</title>
<style>
  :root{
    --dsw-alias-bg-base:#ffffff;--dsw-alias-bg-layer-1:#f7f8fa;--dsw-alias-bg-layer-2:#eef1f5;
    --dsw-alias-bg-overlay:#ffffff;--dsw-alias-border-l1:#e3e6eb;--dsw-alias-border-l2:#c9ced6;
    --dsw-alias-brand-primary:#3b82f6;--dsw-alias-label-primary:#1f2329;
    --dsw-alias-label-secondary:#5b6472;--dsw-alias-state-error-primary:#d14343;
  }
  html,body,#root{height:100%;margin:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;background:#fff;color:#1f2329}
  *{animation:none!important;transition:none!important;caret-color:transparent!important}
</style></head>
<body><div id="root"></div><script src="/harness.js"></script></body></html>`

function pngStats(buffer) {
  const png = PNG.sync.read(buffer)
  const colors = new Set()
  let sum = 0
  let sumSq = 0
  const pixels = png.width * png.height
  for (let index = 0; index < png.data.length; index += 4) {
    const r = png.data[index]
    const g = png.data[index + 1]
    const b = png.data[index + 2]
    colors.add((r << 16) | (g << 8) | b)
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b
    sum += luminance
    sumSq += luminance * luminance
  }
  const mean = sum / pixels
  const variance = sumSq / pixels - mean * mean
  return { width: png.width, height: png.height, colors: colors.size, stddev: Math.sqrt(Math.max(0, variance)), png }
}

function compareBaseline(name, buffer) {
  const stats = pngStats(buffer)
  if (stats.colors < 24 || stats.stddev < 6) {
    return { pass: false, detail: `blank-ish (colors=${stats.colors}, stddev=${stats.stddev.toFixed(1)})` }
  }
  const file = path.join(BASELINE, `${name}.png`)
  if (UPDATE || !fileExists(file)) {
    return { pass: true, detail: `baseline ${UPDATE ? 'updated' : 'created'}`, stats, buffer, write: file }
  }
  const baseline = pngStats(requireSync(file)).png
  if (baseline.width !== stats.png.width || baseline.height !== stats.png.height) {
    return { pass: false, detail: `size ${baseline.width}x${baseline.height} -> ${stats.png.width}x${stats.png.height}` }
  }
  let diff = 0
  for (let index = 0; index < baseline.data.length; index += 4) {
    const dr = Math.abs(baseline.data[index] - stats.png.data[index])
    const dg = Math.abs(baseline.data[index + 1] - stats.png.data[index + 1])
    const db = Math.abs(baseline.data[index + 2] - stats.png.data[index + 2])
    if (dr + dg + db > 24) diff += 1
  }
  const ratio = diff / (baseline.width * baseline.height)
  return {
    pass: ratio <= 0.003,
    detail: `diff ${(ratio * 100).toFixed(2)}%`,
    stats,
  }
}

import { readFileSync } from 'node:fs'
function fileExists(file) {
  try {
    readFileSync(file)
    return true
  } catch {
    return false
  }
}
function requireSync(file) {
  return readFileSync(file)
}

async function main() {
  await fs.mkdir(BASELINE, { recursive: true })
  await ensureDocxDemo()
  const fixtures = await buildFixtures()
  const harnessCode = await makeHarness()
  const server = await startServer(fixtures, harnessCode)
  const port = server.address().port
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-lcd-text', '--force-device-scale-factor=1', '--font-render-hinting=none', '--lang=zh-CN', '--accept-lang=zh-CN'],
  })
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
    console.log('PAGE ERROR:', error.message)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') console.log('PAGE CONSOLE:', message.text().slice(0, 200))
  })
  await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 })
  const failures = []

  async function shot(name) {
    const buffer = await page.screenshot({ type: 'png' })
    const verdict = compareBaseline(name, buffer)
    if (verdict.write) await fs.writeFile(verdict.write, buffer)
    record(`shot ${name}`, verdict.pass, verdict.detail)
    if (!verdict.pass) failures.push(name)
  }

  const clickAny = (selector, texts) =>
    page.evaluate(
      ({ selector, texts }) => {
        const element = [...document.querySelectorAll(selector)].find((node) => {
          const haystack = `${node.textContent || ''} ${node.getAttribute('aria-label') || ''} ${node.title || ''}`
          return texts.some((text) => haystack.includes(text))
        })
        if (!element) return false
        element.click()
        return true
      },
      { selector, texts },
    )
  const clickText = (selector, text) => clickAny(selector, [text])

  try {
    await page.goto(`http://127.0.0.1:${port}/?session=${encodeURIComponent(SESSION)}`, {
      waitUntil: 'networkidle2',
      timeout: 45000,
    })
    await page.waitForFunction('window.__visualReady === true || window.__bootError', { timeout: 20000 })
    const bootError = await page.evaluate(() => window.__bootError || null)
    record('boot harness', !bootError, bootError || 'ready')
    if (bootError) throw new Error(bootError)

    await page.waitForSelector('.rd-library', { timeout: 15000 })
    const entries = await page.$$eval('.rd-entry .rd-name', (nodes) => nodes.map((node) => node.textContent))
    record('library renders three demos', entries.length >= 3, entries.join(' | '))
    await shot('01-library')

    await page.evaluate(() => {
      const entry = [...document.querySelectorAll('.rd-entry')].find((node) =>
        node.textContent.includes('示例-分布式系统阅读.md'),
      )
      entry.focus()
    })
    await page.keyboard.press('Enter')
    await page.waitForSelector('.rd-prose', { timeout: 15000 })
    const opened = true
    record('keyboard opens a book', opened, 'Enter on a focused library row')
    await page.waitForFunction(
      () => document.querySelectorAll('.rd-prose .rd-term').length > 0,
      { timeout: 10000 },
    )
    const markdown = await page.evaluate(() => ({
      text: document.querySelector('.rd-prose').textContent.slice(0, 80),
      terms: document.querySelectorAll('.rd-prose .rd-term').length,
      marks: document.querySelectorAll('.rd-prose mark.rd-hl').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))
    record('markdown opens', opened && markdown.text.includes('分布式系统'), markdown.text)
    record('concept terms marked', markdown.terms >= 1, `${markdown.terms} terms`)
    record('highlight restored', markdown.marks >= 1, `${markdown.marks} marks`)
    record('no horizontal overflow', markdown.overflow <= 2, `overflow ${markdown.overflow}px`)
    const longSelection = await page.evaluate(() => {
      const prose = document.querySelector('.rd-prose')
      if (!prose) return 0
      const range = document.createRange()
      range.selectNodeContents(prose)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      const target = document.querySelector('.rd-prose')
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      return selection.toString().trim().length
    })
    await new Promise((resolve) => setTimeout(resolve, 300))
    const longSelectionMenu = await page.$('.rd-mini')
    record('long selections still open the toolbar', longSelection > 160 && Boolean(longSelectionMenu), `${longSelection} chars`)
    await page.keyboard.press('Escape')
    await page.evaluate(() => window.getSelection()?.removeAllRanges())
    await new Promise((resolve) => setTimeout(resolve, 200))
    await clickAny('.rd-toolbar button', ['翻译', 'Translate'])
    await page.waitForSelector('.rd-translate-bar', { timeout: 15000 })
    // The fixture is Chinese and the default target is Chinese, so the reader
    // must start by telling the user there is nothing to translate.
    const skippedNotice = await page.evaluate(() => {
      const notice = document.querySelector('.rd-lang-notice')
      return { present: Boolean(notice), text: notice?.textContent || '' }
    })
    record('a page already in the target language is not translated', skippedNotice.present, skippedNotice.text.slice(0, 40))
    await page.click('.rd-lang-notice .rd-btn')
    await page.waitForFunction(() => document.querySelectorAll('.rd-prose .rd-trans').length > 0, { timeout: 15000 })
    const translated = await page.$$eval('.rd-prose .rd-trans', (nodes) => nodes.length)
    record('forcing the translation renders paragraphs inline', translated >= 3, `${translated} blocks`)
    const languageBar = await page.evaluate(() => {
      const selects = [...document.querySelectorAll('.rd-translate-bar select')]
      return {
        visible: Boolean(document.querySelector('.rd-translate-bar')),
        values: selects.map((select) => select.value),
      }
    })
    record(
      'translation bar defaults to auto-detect into Chinese',
      languageBar.visible && languageBar.values[0] === 'auto' && languageBar.values[1] === 'zh',
      JSON.stringify(languageBar.values),
    )
    await page.evaluate(() => {
      const select = [...document.querySelectorAll('.rd-translate-bar select')][1]
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
      setter.call(select, 'ja')
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await new Promise((resolve) => setTimeout(resolve, 500))
    const changedTarget = await page.evaluate(() => [...document.querySelectorAll('.rd-translate-bar select')].map((select) => select.value))
    record('translation target can be changed', changedTarget[1] === 'ja', changedTarget.join(' → '))
    await page.evaluate(() => {
      const select = [...document.querySelectorAll('.rd-translate-bar select')][1]
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
      setter.call(select, 'zh')
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await new Promise((resolve) => setTimeout(resolve, 500))
    const translationStatus = await page.evaluate(() => document.querySelector('.rd-translate-status')?.textContent || '')
    record(
      'translation status reports translated and pending counts',
      /已翻译\s*\d+/.test(translationStatus) && /待翻译/.test(translationStatus),
      translationStatus,
    )
    await shot('02b-translation')
    await clickAny('.rd-toolbar button', ['翻译', 'Translate'])
    await page.waitForFunction(
      () => (document.querySelector('.rd-prose p')?.textContent || '').startsWith('译文：'),
      { timeout: 15000 },
    )
    const onlyText = await page.evaluate(() => document.querySelector('.rd-prose p').textContent.slice(0, 40))
    record('translation-only mode replaces paragraphs', onlyText.startsWith('译文：'), onlyText)
    await shot('02c-translation-only')
    await clickAny('.rd-toolbar button', ['翻译', 'Translate'])
    await page.waitForFunction(
      () => {
        const first = document.querySelector('.rd-prose p')?.textContent || ''
        return !first.startsWith('译文：') && document.querySelectorAll('.rd-prose .rd-trans').length === 0
      },
      { timeout: 8000 },
    )
    record('translation toggles off', true, '')
    const toolbarIcons = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.rd-toolbar .rd-icon-btn')]
      return {
        count: buttons.length,
        min: Math.min(...buttons.map((button) => button.querySelector('svg')?.getBoundingClientRect().width || 0)),
        sizes: buttons.map((button) => Math.round(button.querySelector('svg')?.getBoundingClientRect().width || 0)),
        attrs: buttons.map((button) => button.querySelector('svg')?.getAttribute('width')),
        css: buttons.map((button) => getComputedStyle(button.querySelector('svg')).width),
        buttonWidths: buttons.map((button) => Math.round(button.getBoundingClientRect().width)),
        html: buttons[0]?.outerHTML.slice(0, 260),
        labels: buttons.map((button) => button.getAttribute('aria-label')),
      }
    })
    record('toolbar has undo/redo/search/settings icons', toolbarIcons.count >= 4, toolbarIcons.labels.join(','))
    record('toolbar icons are readable', toolbarIcons.min >= 16, `min ${Math.round(toolbarIcons.min)}px sizes ${toolbarIcons.sizes.join(',')} attrs ${toolbarIcons.attrs.join(',')} css ${toolbarIcons.css.join(',')} btn ${toolbarIcons.buttonWidths.join(',')} html ${toolbarIcons.html}`)
    await shot('02-markdown')

    await page.setViewport({ width: 1280, height: 420, deviceScaleFactor: 1 })
    await new Promise((resolve) => setTimeout(resolve, 400))
    await page.evaluate(() => {
      document.querySelector('.rd-main').scrollTop = 0
    })
    await page.keyboard.press('ArrowDown')
    await new Promise((resolve) => setTimeout(resolve, 300))
    const scrolled = await page.evaluate(() => ({
      top: document.querySelector('.rd-main').scrollTop,
      width: document.querySelector('.rd-progress-bar')?.style.width || '',
    }))
    record('arrow scrolls the document', scrolled.top > 80, `${scrolled.top}px`)
    record('progress bar follows scrolling', parseFloat(scrolled.width) > 0, scrolled.width)
    await page.keyboard.press('End')
    await new Promise((resolve) => setTimeout(resolve, 700))
    const atEnd = await page.evaluate(() => {
      const main = document.querySelector('.rd-main')
      return main.scrollHeight - main.clientHeight - main.scrollTop
    })
    record('End reaches the document bottom', atEnd <= 6, `${Math.max(0, Math.round(atEnd))}px from end`)
    await page.keyboard.press('Home')
    await new Promise((resolve) => setTimeout(resolve, 700))
    const backTop = await page.evaluate(() => document.querySelector('.rd-main').scrollTop)
    record('Home returns to the top', backTop === 0, `${backTop}px`)
    await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 })
    await new Promise((resolve) => setTimeout(resolve, 500))

    await page.hover('.rd-prose .rd-term')
    await page.waitForSelector('.rd-card', { timeout: 8000 })
    await new Promise((resolve) => setTimeout(resolve, 300))
    const card = await page.evaluate(() => {
      const node = document.querySelector('.rd-card')
      const rect = node.getBoundingClientRect()
      return {
        text: node.textContent.slice(0, 120),
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: window.innerWidth,
        height: window.innerHeight,
      }
    })
    const inside =
      card.left >= 0 && card.top >= 0 && card.right <= card.width + 1 && card.bottom <= card.height + 1
    record('concept card visible', card.text.includes('线性一致性'), card.text.slice(0, 40))
    record('concept card inside viewport', inside, `box ${Math.round(card.left)},${Math.round(card.top)}`)
    record('web toggle present in card', Boolean(await page.$('.rd-web-toggle input')), '')
    const quickBadge = await page.evaluate(() => document.querySelector('.rd-card .rd-badge')?.textContent || '')
    record('quick explanation badge present', quickBadge.length > 0, quickBadge)
    const deepen = await page.evaluate(() =>
      [...document.querySelectorAll('.rd-card button')].some((button) =>
        ['深入解释', 'Explain fully'].includes(button.textContent.trim()),
      ),
    )
    record('deepen action present', deepen, '')
    const cardButtons = await page.evaluate(() => [...document.querySelectorAll('.rd-card button')].map((button) => button.textContent.trim()))
    record('card actions avoid duplicate pin buttons', !cardButtons.includes('固定') && !cardButtons.includes('解除固定'), cardButtons.join('|'))
    record('concept library action remains available', cardButtons.includes('概念库'), cardButtons.join('|'))
    const cardChrome = await page.evaluate(() => {
      const card = document.querySelector('.rd-card')
      const header = card.querySelector('h3')
      return {
        scrollbarWidth: getComputedStyle(card).scrollbarWidth,
        headerPosition: getComputedStyle(header).position,
        maxHeight: getComputedStyle(card).maxHeight,
      }
    })
    record('long card uses a thin scrollbar and sticky header', cardChrome.scrollbarWidth === 'thin' && cardChrome.headerPosition === 'sticky', JSON.stringify(cardChrome))
    await shot('03-concept-card')
    const pinClicked = await page.evaluate(() => {
      const pin = document.querySelector('.rd-card-pin')
      if (!pin) return false
      pin.click()
      return true
    })
    await new Promise((resolve) => setTimeout(resolve, 200))
    const pinState = await page.evaluate(() => document.querySelector('.rd-card-pin')?.getAttribute('aria-pressed') || '')
    record('pin icon toggles from the card header', pinClicked && pinState === 'true', pinState)
    await page.evaluate(() => document.querySelector('.rd-card-pin')?.click())
    await new Promise((resolve) => setTimeout(resolve, 200))

    const cardCenter = await page.$eval('.rd-card', (node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })
    await page.mouse.move(cardCenter.x, cardCenter.y, { steps: 12 })
    await new Promise((resolve) => setTimeout(resolve, 950))
    record('card survives moving onto it', Boolean(await page.$('.rd-card')), '')
    await shot('03b-card-hover')

    await page.evaluate(() => document.querySelector('.rd-card-pin')?.click())
    await new Promise((resolve) => setTimeout(resolve, 200))
    const cardBeforeDrag = await page.$eval('.rd-card', (node) => {
      const rect = node.getBoundingClientRect()
      return { left: rect.left, top: rect.top }
    })
    const headerPoint = await page.$eval('.rd-card h3', (node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + 12 }
    })
    await page.mouse.move(headerPoint.x, headerPoint.y)
    await page.mouse.down()
    await page.mouse.move(headerPoint.x + 90, headerPoint.y + 40, { steps: 8 })
    await page.mouse.up()
    await new Promise((resolve) => setTimeout(resolve, 250))
    const cardAfterDrag = await page.$eval('.rd-card', (node) => {
      const rect = node.getBoundingClientRect()
      return { left: rect.left, top: rect.top }
    })
    record(
      'concept card can be dragged by its header',
      Math.abs(cardAfterDrag.left - cardBeforeDrag.left) > 30 && Math.abs(cardAfterDrag.top - cardBeforeDrag.top) > 10,
      `${Math.round(cardBeforeDrag.left)},${Math.round(cardBeforeDrag.top)} -> ${Math.round(cardAfterDrag.left)},${Math.round(cardAfterDrag.top)}`,
    )
    const readerBounds = await page.$eval('.rd-root', (node) => {
      const rect = node.getBoundingClientRect()
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    })
    const headerPoint2 = await page.$eval('.rd-card h3', (node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + 12 }
    })
    await page.mouse.move(headerPoint2.x, headerPoint2.y)
    await page.mouse.down()
    await page.mouse.move(readerBounds.right - 8, readerBounds.bottom - 8, { steps: 8 })
    await page.mouse.up()
    await new Promise((resolve) => setTimeout(resolve, 250))
    const clampedCard = await page.$eval('.rd-card', (node) => {
      const rect = node.getBoundingClientRect()
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    })
    record(
      'dragged card can reach the lower half and stays inside the reader',
      clampedCard.left >= readerBounds.left &&
        clampedCard.right <= readerBounds.right + 1 &&
        clampedCard.bottom <= readerBounds.bottom + 1 &&
        clampedCard.top >= readerBounds.top + 40 &&
        (clampedCard.top + clampedCard.bottom) / 2 > readerBounds.top + (readerBounds.bottom - readerBounds.top) / 2,
      `${Math.round(clampedCard.left)},${Math.round(clampedCard.top)}-${Math.round(clampedCard.right)},${Math.round(clampedCard.bottom)}`,
    )
    const childMenuSelection = await page.evaluate(() => {
      const def = document.querySelector('.rd-card .rd-def')
      if (!def || !def.firstChild) return 0
      const range = document.createRange()
      range.selectNodeContents(def)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      document.querySelector('.rd-card').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      return selection.toString().trim().length
    })
    await new Promise((resolve) => setTimeout(resolve, 300))
    const childMenu = await page.evaluate(() => ({
      text: document.querySelector('.rd-child-menu')?.textContent || '',
      card: Boolean(document.querySelector('.rd-card')),
      mini: document.querySelectorAll('.rd-mini').length,
    }))
    record('selecting text inside a card shows the child explain action', childMenuSelection > 0 && childMenu.text.includes('再解释'), `sel=${childMenuSelection} menu=${JSON.stringify(childMenu)}`)
    await new Promise((resolve) => setTimeout(resolve, 4300))
    const childMenuGone = await page.evaluate(() => !document.querySelector('.rd-child-menu'))
    const childMenuLeft = await page.evaluate(() => document.querySelector('.rd-child-menu')?.textContent || '')
    record('child explain action dismisses itself', childMenuGone, childMenuLeft)

    await page.evaluate(() => {
      const def = document.querySelector('.rd-card .rd-def')
      const range = document.createRange()
      range.selectNodeContents(def)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      document.querySelector('.rd-card').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
    await new Promise((resolve) => setTimeout(resolve, 300))
    await clickAny('.rd-child-menu button', ['再解释', 'Explain again'])
    await new Promise((resolve) => setTimeout(resolve, 700))
    const stack = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.rd-card')]
      const rects = cards.map((card) => {
        const rect = card.getBoundingClientRect()
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, pointer: getComputedStyle(card).pointerEvents }
      })
      const parent = rects[0]
      const top = rects[rects.length - 1]
      const hit = document.elementFromPoint(parent.left + 6, parent.top + 6)
      const hitTop = document.elementFromPoint(top.left + 10, top.top + 10)
      return {
        count: cards.length,
        rects,
        pointer: rects.map((rect) => rect.pointer),
        hitIndex: hit && hit.closest ? cards.indexOf(hit.closest('.rd-card')) : -1,
        hitTopIndex: hitTop && hitTop.closest ? cards.indexOf(hitTop.closest('.rd-card')) : -1,
      }
    })
    record('child explanation opens a stacked card', stack.count === 2, `${stack.count} cards`)
    record('both stacked cards receive pointer events', stack.pointer.every((value) => value === 'auto'), stack.pointer.join(','))
    record('overlapping cards do not leak clicks to the parent', stack.hitIndex === 0, `hit card ${stack.hitIndex}`)
    record('the visible top card receives its own clicks', stack.hitTopIndex === 1, `hit card ${stack.hitTopIndex}`)
    const stackBefore = await page.evaluate(() => [...document.querySelectorAll('.rd-card')].map((card) => {
      const rect = card.getBoundingClientRect()
      return { left: rect.left, top: rect.top }
    }))
    const childHeader = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.rd-card')]
      const header = cards[cards.length - 1].querySelector('h3')
      const rect = header.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + 12 }
    })
    await page.mouse.move(childHeader.x, childHeader.y)
    await page.mouse.down()
    await page.mouse.move(childHeader.x + 80, childHeader.y + 50, { steps: 8 })
    await page.mouse.up()
    await new Promise((resolve) => setTimeout(resolve, 300))
    const stackAfter = await page.evaluate(() => [...document.querySelectorAll('.rd-card')].map((card) => {
      const rect = card.getBoundingClientRect()
      return { left: rect.left, top: rect.top }
    }))
    record(
      'stacked cards move independently',
      Math.abs(stackAfter[0].left - stackBefore[0].left) <= 1 &&
        Math.abs(stackAfter[0].top - stackBefore[0].top) <= 1 &&
        Math.hypot(stackAfter[1].left - stackBefore[1].left, stackAfter[1].top - stackBefore[1].top) > 20,
      `${JSON.stringify(stackBefore)} -> ${JSON.stringify(stackAfter)}`,
    )
    await page.evaluate(() => {
      const zones = [...document.querySelectorAll('.rd-hover-zone')]
      const card = zones[zones.length - 1].querySelector('.rd-card')
      const buttons = [...card.querySelectorAll('h3 button')]
      buttons[buttons.length - 1]?.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 300))
    await page.evaluate(() => {
      window.getSelection()?.removeAllRanges()
      document.querySelector('.rd-card-pin')?.click()
    })
    await page.mouse.move(4, 4)
    await new Promise((resolve) => setTimeout(resolve, 950))
    record('card closes after leaving', (await page.$('.rd-card')) === null, '')

    // The Enter that commits an IME candidate (Chinese pinyin input) must not
    // submit the ask question.
    await page.hover('.rd-prose .rd-term')
    await page.waitForSelector('.rd-card', { timeout: 8000 })
    const askSelector = '.rd-card .rd-actions > input.rd-input'
    const readAsk = () =>
      page.evaluate((selector) => {
        const input = document.querySelector(selector)
        return {
          posts: (window.__askPosts || []).length,
          value: input ? input.value : null,
        }
      }, askSelector)
    await page.click(askSelector)
    await page.keyboard.type('ni')
    // Chrome delivers the Enter that confirms a pinyin candidate as a normal
    // looking keydown that carries isComposing:true (verified once with a CDP
    // Input.imeSetComposition + dispatchKeyEvent probe). Replay that event shape
    // here: driving the real IME queue tears down the page context in headless
    // Chrome, so the parked regression asserts the handler contract instead.
    await page.evaluate(() => {
      const input = document.querySelector('.rd-card .rd-actions > input.rd-input')
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          bubbles: true,
          cancelable: true,
          isComposing: true,
        }),
      )
    })
    await new Promise((resolve) => setTimeout(resolve, 300))
    const afterIme = await readAsk()
    record(
      'IME enter does not send the question',
      afterIme.posts === 0 && afterIme.value === 'ni',
      `posts=${afterIme.posts} value=${JSON.stringify(afterIme.value)}`,
    )
    await page.keyboard.press('Enter')
    await new Promise((resolve) => setTimeout(resolve, 400))
    const afterPlain = await readAsk()
    record('a plain enter still asks the question', afterPlain.posts === 1, `posts=${afterPlain.posts}`)
    await page.keyboard.press('Escape')
    await page.mouse.move(4, 4)
    // The ask raises a four second toast; wait it out so the following shots
    // record the card states and not a transient banner.
    await page.waitForFunction(() => !document.querySelector('.rd-toast'), { timeout: 8000 }).catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, 500))


    const rectOf = (selector) =>
      page.$eval(selector, (node) => {
        const rect = node.getBoundingClientRect()
        const parent = node.closest('.rd-card') || node.closest('.rd-note-box')
        const parentRect = parent ? parent.getBoundingClientRect() : null
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          scrollWidth: node.scrollWidth,
          clientWidth: node.clientWidth,
          parentRight: parentRect ? parentRect.right : null,
          parentBottom: parentRect ? parentRect.bottom : null,
        }
      })
    const fitsViewport = (rect) =>
      rect.left >= -1 && rect.top >= -1 && rect.right <= rect.viewportWidth + 1 && rect.bottom <= rect.viewportHeight + 1

    await page.hover('.rd-prose .rd-term')
    await page.waitForSelector('.rd-card', { timeout: 8000 })
    await clickAny('.rd-card button', ['编辑', 'Edit'])
    await page.waitForSelector('.rd-card .rd-editor', { timeout: 8000 })
    const conceptForm = await rectOf('.rd-card .rd-editor')
    record('concept edit card fits viewport', fitsViewport(conceptForm), `box ${Math.round(conceptForm.left)},${Math.round(conceptForm.top)}`)
    record('concept edit card no overflow', conceptForm.scrollWidth <= conceptForm.clientWidth + 1, `${conceptForm.scrollWidth}/${conceptForm.clientWidth}`)
    const stickyActions = await page.evaluate(() => {
      const card = document.querySelector('.rd-card')
      const save = [...card.querySelectorAll('button')].find((button) => ['保存', 'Save'].includes(button.textContent.trim()))
      if (!save) return null
      const saveRect = save.getBoundingClientRect()
      const cardRect = card.getBoundingClientRect()
      return {
        visible: saveRect.top >= cardRect.top - 1 && saveRect.bottom <= cardRect.bottom + 1,
        saveBottom: saveRect.bottom,
        cardBottom: cardRect.bottom,
      }
    })
    record(
      'concept edit actions visible',
      Boolean(stickyActions && stickyActions.visible),
      stickyActions ? `${Math.round(stickyActions.saveBottom)} <= ${Math.round(stickyActions.cardBottom)}` : 'save missing',
    )
    // Upstream's baseline for this shot caught a transient "已收下" toast; wait it
    // out so the frame records the editor instead of a banner.
    await page.waitForFunction(() => !document.querySelector('.rd-toast'), { timeout: 8000 }).catch(() => {})
    await shot('03c-concept-edit')
    await clickAny('.rd-card button', ['取消', 'Cancel'])
    await page.mouse.move(4, 4)
    await new Promise((resolve) => setTimeout(resolve, 700))

    await page.evaluate(() => {
      const mark = document.querySelector('.rd-prose mark.rd-hl')
      mark.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await page.waitForSelector('.rd-editor', { timeout: 8000 })
    const annotationEditor = await rectOf('.rd-editor')
    const annotationTextarea = await rectOf('.rd-editor textarea')
    record('annotation editor fits viewport', fitsViewport(annotationEditor), `box ${Math.round(annotationEditor.left)},${Math.round(annotationEditor.top)}`)
    record('annotation editor no overflow', annotationEditor.scrollWidth <= annotationEditor.clientWidth + 1, `${annotationEditor.scrollWidth}/${annotationEditor.clientWidth}`)
    record(
      'annotation textarea fits card',
      annotationTextarea.right <= annotationEditor.parentRight + 1,
      `${Math.round(annotationTextarea.right)} <= ${Math.round(annotationEditor.parentRight)}`,
    )
    const quoteVisible = await page.$eval('.rd-editor .rd-quote', (node) => node.textContent.trim().length > 0).catch(() => false)
    record('annotation editor shows the quote', quoteVisible, '')

    // The "已收下" toast lives four seconds; wait it out so these shots record the
    // editor and the note box instead of whatever transient banner a previous
    // step raised.
    await page.waitForFunction(() => !document.querySelector('.rd-toast'), { timeout: 8000 })
    await shot('03d-annotation-editor')
    // A long note scrolls inside its own field. That scroll must not be read as
    // the page moving under the anchor, or the editor closes and the note is lost.
    await page.click('.rd-annotation-editor textarea')
    for (let line = 0; line < 8; line += 1) {
      await page.keyboard.type(`line ${line + 1}`)
      await page.keyboard.press('Enter')
    }
    const noteScroll = await page.evaluate(async () => {
      const field = document.querySelector('.rd-annotation-editor textarea')
      if (!field) return null
      const scrollable = field.scrollHeight > field.clientHeight
      field.scrollTop = field.scrollHeight
      await new Promise((resolve) => setTimeout(resolve, 250))
      return { scrollable, kept: Boolean(document.querySelector('.rd-annotation-editor')), scrollTop: field.scrollTop }
    })
    record('annotation note field scrolls on its own', noteScroll?.scrollable === true, noteScroll ? `scrollTop ${Math.round(noteScroll.scrollTop)}` : 'field missing')
    record('scrolling inside the note keeps the editor open', noteScroll?.kept === true, noteScroll ? '' : 'field missing')
    const dismissedByPageScroll = await page.evaluate(async () => {
      const main = document.querySelector('.rd-main')
      if (!main) return null
      const before = main.scrollTop
      // Jump instantly: the panes use smooth scrolling, and an animated restore
      // would leave the rest of the walkthrough on a half-scrolled page.
      const previousBehavior = main.style.scrollBehavior
      main.style.scrollBehavior = 'auto'
      main.scrollTop = before + 40
      await new Promise((resolve) => setTimeout(resolve, 250))
      const closed = !document.querySelector('.rd-annotation-editor')
      // Put the reading surface back where the rest of the walkthrough expects it.
      main.scrollTop = before
      main.style.scrollBehavior = previousBehavior
      await new Promise((resolve) => setTimeout(resolve, 250))
      return closed
    })
    record('scrolling the page still closes the annotation editor', dismissedByPageScroll === true, '')
    await page.keyboard.press('Escape')
    await new Promise((resolve) => setTimeout(resolve, 300))

    const selected = await page.evaluate(() => {
      const root = document.querySelector('.rd-prose')
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let node
      while ((node = walker.nextNode())) {
        const text = node.nodeValue || ''
        const index = text.indexOf('一致性')
        if (index >= 0) {
          const range = document.createRange()
          range.setStart(node, index)
          range.setEnd(node, index + 3)
          const selection = getSelection()
          selection.removeAllRanges()
          selection.addRange(range)
          node.parentElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
          return true
        }
      }
      return false
    })
    await page.waitForSelector('.rd-mini', { timeout: 8000 })
    await clickAny('.rd-mini button', ['笔记', 'Note'])
    await page.waitForSelector('.rd-note-box', { timeout: 8000 })
    const noteBox = await rectOf('.rd-note-box')
    const noteTextarea = await rectOf('.rd-note-box textarea')
    record('note box fits viewport', selected && fitsViewport(noteBox), `box ${Math.round(noteBox.left)},${Math.round(noteBox.top)}`)
    record('note box no overflow', noteBox.scrollWidth <= noteBox.clientWidth + 1, `${noteBox.scrollWidth}/${noteBox.clientWidth}`)
    record('note textarea fits box', noteTextarea.right <= noteBox.parentRight + 1, `${Math.round(noteTextarea.right)} <= ${Math.round(noteBox.parentRight)}`)

    // The "已收下" toast lives four seconds; wait it out so these shots record the
    // editor and the note box instead of whatever transient banner a previous
    // step raised.
    await page.waitForFunction(() => !document.querySelector('.rd-toast'), { timeout: 8000 })
    await shot('03e-note-box')
    await clickAny('.rd-note-box button', ['取消', 'Cancel'])
    await new Promise((resolve) => setTimeout(resolve, 300))

    await page.evaluate(() => {
      const root = document.querySelector('.rd-prose')
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let node
      while ((node = walker.nextNode())) {
        const text = node.nodeValue || ''
        const index = text.indexOf('分布式系统')
        if (index >= 0) {
          const range = document.createRange()
          range.setStart(node, index)
          range.setEnd(node, index + 5)
          const selection = getSelection()
          selection.removeAllRanges()
          selection.addRange(range)
          node.parentElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
          return
        }
      }
    })
    await page.waitForSelector('.rd-mini', { timeout: 8000 })
    await clickAny('.rd-mini button', ['翻译', 'Translate'])
    await page.waitForSelector('.rd-trans-card', { timeout: 15000 })
    const selectionSkipped = await page.evaluate(() => {
      const card = document.querySelector('.rd-trans-card')
      return { text: card?.textContent || '', force: Boolean(card?.querySelector('[data-action="force-selection-translation"]')) }
    })
    record('selection translation reports an already-target passage', selectionSkipped.force, selectionSkipped.text.slice(0, 40))
    await page.click('[data-action="force-selection-translation"]')
    await page.waitForFunction(
      () => (document.querySelector('.rd-trans-card')?.textContent || '').includes('译文：'),
      { timeout: 15000 },
    )
    const selectionTranslation = await page.evaluate(() => document.querySelector('.rd-trans-card').textContent.slice(0, 80))
    record('selection translation renders after forcing', selectionTranslation.includes('译文：'), selectionTranslation.slice(0, 40))
    await shot('03f-selection-translation')
    await page.keyboard.press('Escape')
    await page.mouse.move(4, 4)

    const guideClicked = await clickAny('.rd-toolbar button', ['导读', 'Guide'])
    record('guide tab opens', guideClicked, '')
    await page.waitForSelector('.rd-guide-synopsis', { timeout: 8000 })
    const guideText = await page.evaluate(() => document.querySelector('.rd-drawer-body').textContent)
    record('guide synopsis renders', guideText.includes('分布式系统'), guideText.slice(0, 40))
    const partRows = await page.evaluate(() => ({
      parts: document.querySelectorAll('.rd-part').length,
      singleTitleCount: (document.querySelector('.rd-drawer-body').textContent.match(/第二部分 · 直觉/g) || []).length,
    }))
    record('single-section parts are not duplicated', partRows.parts === 1 && partRows.singleTitleCount === 1, JSON.stringify(partRows))
    await shot('04-guide')
    const resizerBefore = await page.$eval('.rd-drawer', (node) => node.getBoundingClientRect().width)
    const resizerPoint = await page.$eval('.rd-drawer-resizer', (node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })
    await page.mouse.move(resizerPoint.x, resizerPoint.y)
    await page.mouse.down()
    await page.mouse.move(resizerPoint.x - 80, resizerPoint.y, { steps: 8 })
    await page.mouse.up()
    await new Promise((resolve) => setTimeout(resolve, 300))
    const resizerAfter = await page.$eval('.rd-drawer', (node) => node.getBoundingClientRect().width)
    record('guide sidebar width can be resized', resizerAfter > resizerBefore + 40, `${Math.round(resizerBefore)} -> ${Math.round(resizerAfter)}`)

    await page.setViewport({ width: 1280, height: 300, deviceScaleFactor: 1 })
    await new Promise((resolve) => setTimeout(resolve, 400))
    const independent = await page.evaluate(() => {
      const drawer = document.querySelector('.rd-drawer-body')
      const main = document.querySelector('.rd-main')
      const mainBefore = main.scrollTop
      drawer.scrollTop = 80
      return {
        drawerScrollable: drawer.scrollHeight > drawer.clientHeight,
        drawer: drawer.scrollTop,
        mainBefore,
        mainAfter: main.scrollTop,
      }
    })
    record(
      'sidebar scrolls independently of the text',
      independent.drawerScrollable && independent.drawer > 0 && independent.mainBefore === independent.mainAfter,
      `drawer=${independent.drawer} main=${independent.mainAfter}`,
    )
    const crossScroll = await page.evaluate(() => {
      const drawer = document.querySelector('.rd-drawer-body')
      const main = document.querySelector('.rd-main')
      const drawerBefore = drawer.scrollTop
      main.scrollTo({ top: 120, behavior: 'instant' })
      return { drawerBefore, drawerAfter: drawer.scrollTop, main: main.scrollTop }
    })
    record(
      'text scroll does not move the sidebar',
      crossScroll.main > 0 && crossScroll.drawerBefore === crossScroll.drawerAfter,
      `drawer ${crossScroll.drawerBefore} -> ${crossScroll.drawerAfter}`,
    )
    await page.evaluate(() => {
      document.querySelector('.rd-main').scrollTop = 0
      document.querySelector('.rd-drawer-body').scrollTop = 60
    })
    await new Promise((resolve) => setTimeout(resolve, 200))
    await clickAny('.rd-toolbar button', ['目录', 'Contents'])
    await new Promise((resolve) => setTimeout(resolve, 250))
    await clickAny('.rd-toolbar button', ['导读', 'Guide'])
    await new Promise((resolve) => setTimeout(resolve, 350))
    const restoredDrawer = await page.evaluate(() => document.querySelector('.rd-drawer-body').scrollTop)
    record('each sidebar tab remembers its own scroll position', Math.abs(restoredDrawer - 60) <= 4, `${restoredDrawer}px`)
    const beforeKeyboard = await page.evaluate(() => {
      const drawer = document.querySelector('.rd-drawer-body')
      drawer.scrollTop = 40
      const item = document.querySelector('.rd-drawer-body [data-activate]')
      if (item) item.focus()
      return { drawer: drawer.scrollTop, main: document.querySelector('.rd-main').scrollTop }
    })
    await page.keyboard.press('ArrowDown')
    await new Promise((resolve) => setTimeout(resolve, 300))
    const afterKeyboard = await page.evaluate(() => ({
      drawer: document.querySelector('.rd-drawer-body').scrollTop,
      main: document.querySelector('.rd-main').scrollTop,
      active: document.activeElement && document.activeElement.closest('.rd-drawer-body') ? 'drawer' : 'outside',
    }))
    record(
      'arrow keys scroll the sidebar, not the text',
      afterKeyboard.active === 'drawer' && afterKeyboard.drawer >= beforeKeyboard.drawer && afterKeyboard.main === beforeKeyboard.main,
      `drawer ${beforeKeyboard.drawer} -> ${afterKeyboard.drawer}, main ${afterKeyboard.main}`,
    )
    await page.evaluate(() => {
      document.querySelector('.rd-drawer-body').scrollTop = 60
    })
    await new Promise((resolve) => setTimeout(resolve, 200))
    await clickAny('.rd-drawer button', ['导图', 'Mindmap'])
    await page.waitForSelector('.rd-map-scroll svg .rdm-label', { timeout: 8000 })
    const mapEntry = await page.evaluate(() => ({
      width: document.querySelector('.rd-drawer').getBoundingClientRect().width,
      bodyTop: document.querySelector('.rd-drawer-body').scrollTop,
    }))
    record('map view uses its own width and starts at the top', Math.abs(mapEntry.width - 760) <= 2 && mapEntry.bodyTop === 0, `${Math.round(mapEntry.width)}px top=${mapEntry.bodyTop}`)
    await clickAny('.rd-drawer button', ['列表', 'List'])
    await new Promise((resolve) => setTimeout(resolve, 350))
    const listReturn = await page.evaluate(() => ({
      width: document.querySelector('.rd-drawer').getBoundingClientRect().width,
      bodyTop: document.querySelector('.rd-drawer-body').scrollTop,
    }))
    record('returning to the guide list restores its width and scroll', Math.abs(listReturn.width - 400) <= 2 && Math.abs(listReturn.bodyTop - 60) <= 4, `${Math.round(listReturn.width)}px top=${listReturn.bodyTop}`)
    await page.$eval('.rd-drawer-resizer', (node) => node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    await new Promise((resolve) => setTimeout(resolve, 300))
    const resizerReset = await page.$eval('.rd-drawer', (node) => node.getBoundingClientRect().width)
    record('double-click resets the guide sidebar width', Math.abs(resizerReset - 320) <= 2, `${Math.round(resizerReset)}px`)
    await page.evaluate(() => {
      document.querySelector('.rd-drawer-body').scrollTop = 0
    })
    await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 })
    await new Promise((resolve) => setTimeout(resolve, 400))

    const mapClicked = await clickAny('.rd-drawer button', ['导图', 'Mindmap'])
    await page.waitForSelector('.rd-map-scroll svg .rdm-label', { timeout: 8000 })
    const mapResizerBefore = await page.$eval('.rd-drawer', (node) => node.getBoundingClientRect().width)
    const mapResizerPoint = await page.$eval('.rd-drawer-resizer', (node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })
    await page.mouse.move(mapResizerPoint.x, mapResizerPoint.y)
    await page.mouse.down()
    await page.mouse.move(mapResizerPoint.x - 60, mapResizerPoint.y, { steps: 6 })
    await page.mouse.up()
    await new Promise((resolve) => setTimeout(resolve, 300))
    const mapResizerAfter = await page.$eval('.rd-drawer', (node) => node.getBoundingClientRect().width)
    record('mindmap sidebar has its own resizable width', mapResizerAfter > mapResizerBefore + 30, `${Math.round(mapResizerBefore)} -> ${Math.round(mapResizerAfter)}`)
    await page.$eval('.rd-drawer-resizer', (node) => node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    await new Promise((resolve) => setTimeout(resolve, 300))
    const mapResizerReset = await page.$eval('.rd-drawer', (node) => node.getBoundingClientRect().width)
    record('double-click resets the mindmap sidebar width', Math.abs(mapResizerReset - 760) <= 2, `${Math.round(mapResizerReset)}px`)
    await page.mouse.move(4, 4)
    await new Promise((resolve) => setTimeout(resolve, 200))
    const mapDefault = await page.evaluate(() => ({
      nodes: document.querySelectorAll('.rdm-node').length,
      labels: document.querySelectorAll('.rdm-label').length,
      details: document.querySelectorAll('.rd-map-detail').length,
    }))
    record('mindmap opens as a collapsed chapter outline', mapClicked && mapDefault.nodes === 3 && mapDefault.details === 0, `${mapDefault.nodes} nodes, ${mapDefault.labels} labels`)
    const edgeBefore = await page.evaluate(() => {
      const viewport = document.querySelector('.rd-map-scroll')
      const rect = viewport.getBoundingClientRect()
      return {
        x: rect.left + 8,
        y: rect.top + rect.height / 2,
        pan: Number(viewport.getAttribute('data-pan-x')),
        drawer: document.querySelector('.rd-drawer').getBoundingClientRect().width,
      }
    })
    await page.mouse.move(edgeBefore.x, edgeBefore.y)
    await page.mouse.down()
    await page.mouse.move(edgeBefore.x + 50, edgeBefore.y, { steps: 6 })
    await page.mouse.up()
    await new Promise((resolve) => setTimeout(resolve, 200))
    const edgeAfter = await page.evaluate(() => ({
      pan: Number(document.querySelector('.rd-map-scroll').getAttribute('data-pan-x')),
      drawer: document.querySelector('.rd-drawer').getBoundingClientRect().width,
    }))
    record(
      'dragging near the map edge pans the canvas without resizing the sidebar',
      edgeAfter.pan !== edgeBefore.pan && Math.abs(edgeAfter.drawer - edgeBefore.drawer) <= 1,
      `pan ${edgeBefore.pan} -> ${edgeAfter.pan}; drawer ${Math.round(edgeBefore.drawer)} -> ${Math.round(edgeAfter.drawer)}`,
    )
    await page.$$eval('.rd-map-toolbar button', (nodes) => {
      const button = nodes.find((node) => node.getAttribute('title') === '回到画布中心' || node.getAttribute('title') === 'Recenter canvas')
      if (button) button.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 250))
    await shot('05-mindmap')
    const fitPan = await page.$eval('.rd-map-scroll', (node) => ({
      x: Number(node.getAttribute('data-pan-x')),
      y: Number(node.getAttribute('data-pan-y')),
      rect: node.getBoundingClientRect().toJSON(),
      drawer: document.querySelector('.rd-drawer').getBoundingClientRect().width,
    }))
    await page.mouse.move(fitPan.rect.left + fitPan.rect.width / 2, fitPan.rect.top + fitPan.rect.height / 2)
    await page.mouse.down()
    await page.mouse.move(fitPan.rect.left + fitPan.rect.width / 2 - 70, fitPan.rect.top + fitPan.rect.height / 2 + 30, { steps: 8 })
    await page.mouse.up()
    await new Promise((resolve) => setTimeout(resolve, 250))
    const fitPanAfter = await page.$eval('.rd-map-scroll', (node) => ({
      x: Number(node.getAttribute('data-pan-x')),
      y: Number(node.getAttribute('data-pan-y')),
      drawer: document.querySelector('.rd-drawer').getBoundingClientRect().width,
    }))
    record(
      'a fully visible mindmap still drags like a canvas',
      fitPanAfter.x !== fitPan.x && fitPanAfter.y !== fitPan.y && Math.abs(fitPanAfter.drawer - fitPan.drawer) <= 1,
      `${fitPan.x},${fitPan.y} -> ${fitPanAfter.x},${fitPanAfter.y}`,
    )
    await page.$$eval('.rd-map-toolbar button', (nodes) => {
      const button = nodes.find((node) => node.getAttribute('title') === '回到画布中心' || node.getAttribute('title') === 'Recenter canvas')
      if (button) button.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 250))
    const centeredPan = await page.$eval('.rd-map-scroll', (node) => ({
      x: Number(node.getAttribute('data-pan-x')),
      y: Number(node.getAttribute('data-pan-y')),
    }))
    record('mindmap can recenter after panning', Math.abs(centeredPan.x - fitPan.x) <= 2 && Math.abs(centeredPan.y - fitPan.y) <= 2, `${centeredPan.x},${centeredPan.y}`)
    const fullscreenClicked = await clickAny('.rd-drawer button', ['全屏', 'Fullscreen'])
    await new Promise((resolve) => setTimeout(resolve, 350))
    const fullscreen = await page.evaluate(() => {
      const stage = document.querySelector('.rd-map-stage-fullscreen')
      if (!stage) return null
      const rect = stage.getBoundingClientRect()
      const map = document.querySelector('.rd-map-scroll')
      return {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top,
        mapWidth: map?.clientWidth || 0,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }
    })
    record(
      'mindmap opens fullscreen',
      fullscreenClicked && fullscreen && fullscreen.width >= fullscreen.viewportWidth - 1 && fullscreen.height >= fullscreen.viewportHeight - 1 && fullscreen.left <= 1 && fullscreen.top <= 1,
      JSON.stringify(fullscreen),
    )
    const exitFullscreenClicked = await clickAny('.rd-map-toolbar button', ['退出全屏', 'Exit fullscreen'])
    await new Promise((resolve) => setTimeout(resolve, 300))
    const fullscreenClosedByButton = await page.evaluate(() => !document.querySelector('.rd-map-stage-fullscreen'))
    record('fullscreen button exits mindmap fullscreen', exitFullscreenClicked && fullscreenClosedByButton, '')
    await clickAny('.rd-map-toolbar button', ['全屏', 'Fullscreen'])
    await new Promise((resolve) => setTimeout(resolve, 350))
    await page.keyboard.press('Escape')
    await new Promise((resolve) => setTimeout(resolve, 300))
    const fullscreenClosed = await page.evaluate(() => !document.querySelector('.rd-map-stage-fullscreen'))
    record('Escape exits mindmap fullscreen', fullscreenClosed, '')
    await clickAny('.rd-drawer button', ['展开全部', 'Expand all'])
    await new Promise((resolve) => setTimeout(resolve, 400))
    const expandedAll = await page.$$eval('.rdm-node', (nodes) => nodes.length)
    record('expand all reveals every map node', expandedAll > mapDefault.nodes, `${mapDefault.nodes} -> ${expandedAll}`)
    const chunkLabels = await page.$$eval('.rdm-label', (nodes) => nodes.map((node) => node.textContent.trim()))
    record(
      'map nodes show section titles instead of chunk numbers',
      chunkLabels.length > 0 && chunkLabels.every((label) => !/^分片/.test(label)),
      chunkLabels.slice(0, 6).join(' | '),
    )
    await clickAny('.rd-drawer button', ['收起全部', 'Collapse all'])
    await new Promise((resolve) => setTimeout(resolve, 400))
    const collapsedAll = await page.$$eval('.rdm-node', (nodes) => nodes.length)
    record('collapse all returns to chapter level', collapsedAll === mapDefault.nodes, `${expandedAll} -> ${collapsedAll}`)
    const partRect = await page.$eval('[data-node-id="part1"] rect', (node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })
    await page.mouse.click(partRect.x, partRect.y)
    await new Promise((resolve) => setTimeout(resolve, 300))
    const mapExpanded = await page.evaluate(() => ({
      nodes: document.querySelectorAll('.rdm-node').length,
      detail: document.querySelector('.rd-map-detail-title')?.textContent || '',
      summary: document.querySelector('.rd-map-detail-summary')?.textContent || '',
      visible: (() => {
        const detail = document.querySelector('.rd-map-detail')
        if (!detail) return false
        const rect = detail.getBoundingClientRect()
        const drawer = document.querySelector('.rd-drawer').getBoundingClientRect()
        return rect.top >= drawer.top && rect.bottom <= drawer.bottom
      })(),
    }))
    record('clicking a chapter expands its sections', mapExpanded.nodes > mapDefault.nodes, `${mapDefault.nodes} -> ${mapExpanded.nodes}`)
    record('selected node shows its summary above the map', mapExpanded.detail.includes('第一部分') && mapExpanded.summary.length > 5 && mapExpanded.visible, `${mapExpanded.detail}: ${mapExpanded.summary.slice(0, 24)}`)
    const childRect = await page.$eval('[data-node-id="s1"] rect', (node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })
    const mainBeforeClick = await page.evaluate(() => document.querySelector('.rd-main').scrollTop)
    await page.mouse.click(childRect.x, childRect.y)
    await new Promise((resolve) => setTimeout(resolve, 1300))
    const childDetail = await page.evaluate(() => ({
      title: document.querySelector('.rd-map-detail-title')?.textContent || '',
      open: Boolean(document.querySelector('.rd-drawer')),
      nodeSelected: Boolean(document.querySelector('.rdm-node-selected')),
      main: document.querySelector('.rd-main').scrollTop,
    }))
    record(
      'clicking a section keeps the detail card open without flashing',
      childDetail.open && childDetail.title.includes('一致性模型') && childDetail.nodeSelected && Math.abs(childDetail.main - mainBeforeClick) <= 2,
      `${childDetail.title} main ${mainBeforeClick} -> ${childDetail.main}`,
    )
    const chevronRect = await page.$$eval('[data-node-id="part1"] rect', (nodes) => {
      const node = nodes[nodes.length - 1]
      const rect = node.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })
    await page.mouse.click(chevronRect.x, chevronRect.y)
    await new Promise((resolve) => setTimeout(resolve, 300))
    const collapsedAgain = await page.$$eval('.rdm-node', (nodes) => nodes.length)
    record('chevron toggles the chapter', collapsedAgain === mapDefault.nodes, `${mapExpanded.nodes} -> ${collapsedAgain}`)
    const partRectAgain = await page.$eval('[data-node-id="part1"] rect', (node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })
    await page.mouse.click(partRectAgain.x, partRectAgain.y)
    await new Promise((resolve) => setTimeout(resolve, 300))
    const reExpanded = await page.$$eval('.rdm-node', (nodes) => nodes.length)
    record('chapter can be expanded again', reExpanded > mapDefault.nodes, `${collapsedAgain} -> ${reExpanded}`)
    await page.evaluate(() => {
      const reset = [...document.querySelectorAll('.rd-drawer button')].find((button) => button.textContent.trim() === '1:1')
      reset.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 250))
    const baseMapWidth = await page.$eval('.rd-map-scroll svg', (node) => Number(node.getAttribute('width')))
    await page.evaluate(() => {
      const plus = [...document.querySelectorAll('.rd-map-toolbar button')].find((button) => button.textContent.trim() === '+')
      for (let index = 0; index < 5; index += 1) plus.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 300))
    const zoomedMap = await page.evaluate(() => {
      const svg = document.querySelector('.rd-map-scroll svg')
      const viewport = document.querySelector('.rd-map-scroll')
      const canvas = document.querySelector('.rd-map-canvas')
      const rect = svg.getBoundingClientRect()
      return {
        width: Number(svg.getAttribute('width')),
        rectWidth: Math.round(rect.width),
        viewportWidth: viewport.clientWidth,
        canvasWidth: canvas.getBoundingClientRect().width,
      }
    })
    record(
      'mindmap zoom grows the canvas beyond its viewport',
      zoomedMap.width > baseMapWidth && zoomedMap.rectWidth > zoomedMap.viewportWidth,
      `${baseMapWidth} -> ${zoomedMap.width} canvas=${Math.round(zoomedMap.rectWidth)} viewport=${zoomedMap.viewportWidth}`,
    )
    const mapBox = await page.$eval('.rd-map-scroll', (node) => {
      const rect = node.getBoundingClientRect()
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        panX: Number(node.getAttribute('data-pan-x')),
        panY: Number(node.getAttribute('data-pan-y')),
      }
    })
    await page.mouse.move(mapBox.left + mapBox.width / 2, mapBox.top + mapBox.height - 30)
    await page.mouse.down()
    await page.mouse.move(mapBox.left + mapBox.width / 2 - 80, mapBox.top + mapBox.height - 30, { steps: 5 })
    await page.mouse.up()
    await new Promise((resolve) => setTimeout(resolve, 200))
    const dragged = await page.$eval('.rd-map-scroll', (node) => Number(node.getAttribute('data-pan-x')))
    record(
      'mindmap can be dragged horizontally even without scrollbars',
      dragged !== mapBox.panX,
      `${mapBox.panX} -> ${dragged} box=${Math.round(mapBox.width)}x${Math.round(mapBox.height)}`,
    )
    const nodePoint = await page.evaluate(() => {
      const map = document.querySelector('.rd-map-scroll')
      const mapRect = map.getBoundingClientRect()
      const node = [...document.querySelectorAll('.rdm-node')].find((candidate) => {
        const rect = candidate.getBoundingClientRect()
        return (
          rect.left >= mapRect.left + 20 &&
          rect.right <= mapRect.right - 20 &&
          rect.top >= mapRect.top + 20 &&
          rect.bottom <= mapRect.bottom - 20
        )
      })
      if (!node) return null
      const rect = node.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })
    if (!nodePoint) throw new Error('no visible mindmap node to drag')
    const panBeforeNode = await page.$eval('.rd-map-scroll', (node) => Number(node.getAttribute('data-pan-x')))
    await page.mouse.move(nodePoint.x, nodePoint.y)
    await page.mouse.down()
    await page.mouse.move(nodePoint.x - 100, nodePoint.y - 20, { steps: 8 })
    await page.mouse.up()
    await new Promise((resolve) => setTimeout(resolve, 300))
    const panAfterNode = await page.$eval('.rd-map-scroll', (node) => Number(node.getAttribute('data-pan-x')))
    record('mindmap can be dragged from a node as well', panAfterNode !== panBeforeNode, `${panBeforeNode} -> ${panAfterNode}`)
    await page.evaluate(() => document.querySelector('.rd-map-scroll').focus())
    const panBeforeKeyboard = await page.$eval('.rd-map-scroll', (node) => Number(node.getAttribute('data-pan-x')))
    await page.keyboard.press('ArrowRight')
    await new Promise((resolve) => setTimeout(resolve, 200))
    const panAfterKeyboard = await page.$eval('.rd-map-scroll', (node) => Number(node.getAttribute('data-pan-x')))
    record('mindmap can be panned with the keyboard', panAfterKeyboard !== panBeforeKeyboard, `${panBeforeKeyboard} -> ${panAfterKeyboard}`)
    await page.evaluate(() => {
      const reset = [...document.querySelectorAll('.rd-drawer button')].find((button) => button.textContent.trim() === '1:1')
      reset.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 250))
    const resetMapWidth = await page.$eval('.rd-map-scroll svg', (node) => Number(node.getAttribute('width')))
    record('mindmap zoom resets to 1:1', resetMapWidth === baseMapWidth, `${resetMapWidth}px`)

    await page.setViewport({ width: 800, height: 860, deviceScaleFactor: 1 })
    await new Promise((resolve) => setTimeout(resolve, 400))
    const narrowResizerBefore = await page.$eval('.rd-drawer', (node) => node.getBoundingClientRect().width)
    const narrowResizerPoint = await page.$eval('.rd-drawer-resizer', (node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })
    await page.mouse.move(narrowResizerPoint.x, narrowResizerPoint.y)
    await page.mouse.down()
    await page.mouse.move(narrowResizerPoint.x + 60, narrowResizerPoint.y, { steps: 6 })
    await page.mouse.up()
    await new Promise((resolve) => setTimeout(resolve, 300))
    const narrowResizerAfter = await page.$eval('.rd-drawer', (node) => node.getBoundingClientRect().width)
    record(
      'map sidebar can be resized in a narrow host',
      Math.abs(narrowResizerAfter - narrowResizerBefore) > 20,
      `${Math.round(narrowResizerBefore)} -> ${Math.round(narrowResizerAfter)}`,
    )
    await page.$eval('.rd-drawer-resizer', (node) => node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    await new Promise((resolve) => setTimeout(resolve, 300))
    await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 })
    await new Promise((resolve) => setTimeout(resolve, 400))

    await clickAny('.rd-toolbar button', ['概念', 'Concepts'])
    await page.waitForSelector('[data-scope="doc"]', { timeout: 8000 })
    const scope = await page.evaluate(() => ({
      doc: document.querySelector('[data-scope="doc"]').getAttribute('aria-pressed'),
      rows: document.querySelectorAll('[data-concept-id]').length,
      docCount: document.querySelector('[data-scope="doc"]').textContent,
      allCount: document.querySelector('[data-scope="all"]').textContent,
    }))
    record('concept scope defaults to the current book', scope.doc === 'true', `${scope.rows} rows`)
    record('current-book concepts are filtered', scope.rows === 2 && scope.allCount.includes('3'), `${scope.docCount} / ${scope.allCount}`)
    const conceptsResizer = await page.$('.rd-drawer-resizer')
    const conceptsWidthBefore = await page.$eval('.rd-drawer', (node) => node.getBoundingClientRect().width)
    const conceptsResizerPoint = await page.$eval('.rd-drawer-resizer', (node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })
    await page.mouse.move(conceptsResizerPoint.x, conceptsResizerPoint.y)
    await page.mouse.down()
    await page.mouse.move(conceptsResizerPoint.x - 60, conceptsResizerPoint.y, { steps: 6 })
    await page.mouse.up()
    await new Promise((resolve) => setTimeout(resolve, 300))
    const conceptsWidthAfter = await page.$eval('.rd-drawer', (node) => node.getBoundingClientRect().width)
    record('concept list shares the sidebar resize behavior', Boolean(conceptsResizer) && conceptsWidthAfter > conceptsWidthBefore + 30, `${Math.round(conceptsWidthBefore)} -> ${Math.round(conceptsWidthAfter)}`)
    await page.$eval('.rd-drawer-resizer', (node) => node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    await new Promise((resolve) => setTimeout(resolve, 300))
    const conceptDrawerWidth = await page.$eval('.rd-drawer', (node) => node.getBoundingClientRect().width)
    record('concept sidebar returns to the shared default width', Math.abs(conceptDrawerWidth - 320) <= 2, `${Math.round(conceptDrawerWidth)}px`)
    await page.mouse.move(4, 4)
    await shot('05b-concepts-scope')

    await page.evaluate(() => document.querySelector('[data-concept-id] .rd-row-delete').click())
    await page.waitForSelector('.rd-drawer-confirm', { timeout: 8000 })
    const deletePrompt = await page.evaluate(() => {
      const panel = document.querySelector('.rd-drawer-confirm')
      return {
        open: Boolean(panel),
        danger: Boolean(panel && panel.querySelector('[data-action="confirm-delete-concept"]')),
        cancel: Boolean(panel && panel.querySelector('[data-action="cancel-delete-concept"]')),
        card: Boolean(document.querySelector('.rd-card')),
        rows: document.querySelectorAll('[data-concept-id]').length,
      }
    })
    record(
      'a concept can be removed from the drawer row itself',
      deletePrompt.open && deletePrompt.danger && deletePrompt.cancel && !deletePrompt.card && deletePrompt.rows > 0,
      `${deletePrompt.rows} rows open=${deletePrompt.open} danger=${deletePrompt.danger} cancel=${deletePrompt.cancel} card=${deletePrompt.card}`,
    )
    await page.evaluate(() => document.querySelector('[data-action="cancel-delete-concept"]').click())
    await page.waitForFunction(() => !document.querySelector('.rd-drawer-confirm'), { timeout: 8000 })
    const afterCancel = await page.evaluate(() => ({
      open: Boolean(document.querySelector('.rd-drawer-confirm')),
      rows: document.querySelectorAll('[data-concept-id]').length,
    }))
    record(
      'cancelling the drawer confirmation keeps the concept',
      !afterCancel.open && afterCancel.rows === deletePrompt.rows,
      `${afterCancel.rows} rows`,
    )

    const settingsClicked = await clickAny('.rd-toolbar button', ['设置', 'Settings'])
    await page.waitForSelector('.rd-drawer select', { timeout: 8000 })
    const modelPicker = await page.evaluate(() =>
      [...document.querySelectorAll('.rd-drawer select')].some((select) =>
        [...select.options].some((option) => option.value.includes('\u0000')),
      ),
    )
    record('explanation model picker present', modelPicker, '')
    const guideDepth = await page.evaluate(() =>
      [...document.querySelectorAll('.rd-drawer select')].some((select) =>
        [...select.options].some((option) => option.value === 'quick'),
      ),
    )
    record('guide depth setting present', guideDepth, '')
    await page.evaluate(() => {
      const select = [...document.querySelectorAll('.rd-drawer select')].find((node) =>
        [...node.options].some((option) => option.value === 'dark'),
      )
      if (!select) return false
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
      setter.call(select, 'dark')
      select.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })
    await new Promise((resolve) => setTimeout(resolve, 300))
    const theme = await page.evaluate(() => document.querySelector('.rd-root').className)
    record('theme applies', settingsClicked && theme.includes('rd-theme-dark'), theme)
    await shot('06-settings-dark')

    await page.keyboard.down('Meta')
    await page.keyboard.press('f')
    await page.keyboard.up('Meta')
    await page.waitForSelector('.rd-search', { timeout: 8000 })
    await page.type('.rd-search input', '一致性')
    await page.keyboard.press('Enter')
    await page.waitForFunction(
      () => document.querySelectorAll('.rd-search .rd-drawer-item').length > 0,
      { timeout: 8000 },
    )
    const hits = await page.$$eval('.rd-search .rd-drawer-item', (items) => items.length)
    record('search finds matches', hits >= 1, `${hits} hits`)
    await shot('07-search')
    await page.keyboard.press('Escape')

    await clickAny('.rd-toolbar button', ['←'])
    await page.waitForSelector('.rd-library', { timeout: 8000 })
    await clickAny('.rd-entry', ['示例-分布式系统.pdf'])
    await page.waitForSelector('.rd-pdf-page canvas', { timeout: 20000 })
    await page.waitForFunction(
      () => {
        const canvas = document.querySelector('.rd-pdf-page canvas')
        return canvas && canvas.width > 0 && document.querySelectorAll('.rd-text-layer span').length > 0
      },
      { timeout: 30000 },
    )
    const pdf = await page.evaluate(() => {
      const canvas = document.querySelector('.rd-pdf-page canvas')
      return {
        width: canvas.width,
        textItems: document.querySelectorAll('.rd-text-layer span').length,
        canvasBlank: (() => {
          const context = canvas.getContext('2d')
          const data = context.getImageData(0, 0, Math.min(40, canvas.width), Math.min(40, canvas.height)).data
          return data.every((value, index) => index % 4 === 3 || value === 255)
        })(),
      }
    })
    const pageInput = Boolean(await page.$('.rd-page-input'))
    record('pdf page number is editable', pageInput, '')
    await page.evaluate(() => {
      const input = document.querySelector('.rd-page-input')
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, '1')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    record('pdf canvas rendered', pdf.width > 100, `${pdf.width}px wide`)
    record('pdf text layer extracted', pdf.textItems > 20, `${pdf.textItems} spans`)
    record('pdf canvas not blank', !pdf.canvasBlank, '')
    await shot('08-pdf')

    // Selecting text on a PDF page used to throw before the explain request:
    // app.js called pdfPageFromRange, and that helper did not exist.
    await page.evaluate(() => {
      const span = [...document.querySelectorAll('.rd-text-layer span')].find(
        (node) => (node.textContent || '').trim().length >= 2,
      )
      const range = document.createRange()
      range.selectNodeContents(span)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      span.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
    const pdfMenu = await page.waitForSelector('.rd-mini', { timeout: 8000 }).then(() => true).catch(() => false)
    const pdfExplain = pdfMenu ? await clickAny('.rd-mini button', ['解释']) : false
    const pdfCard = await page
      .waitForFunction(
        () => {
          const card = document.querySelector('.rd-card')
          if (!card || card.querySelector('.rd-skeleton')) return null
          return card.textContent || ''
        },
        { timeout: 10000 },
      )
      .then((handle) => handle.jsonValue())
      .catch(() => '')
    record(
      'pdf selection explain opens a card',
      Boolean(pdfExplain) && pdfCard.includes('所有副本在同一时刻'),
      String(pdfCard).slice(0, 60),
    )
    const pdfExplainPosts = await page.evaluate(() => window.__explainPosts || [])
    const pdfPost = pdfExplainPosts[pdfExplainPosts.length - 1] || null
    record(
      'pdf selection explain carries the page number',
      Boolean(pdfPost) && pdfPost.page === 1,
      pdfPost ? `page=${String(pdfPost.page)} term=${String(pdfPost.term || '')}` : 'no request',
    )
    record(
      'pdf selection explain raises no page error',
      pageErrors.every((message) => !/pdfPageFromRange|is not defined/.test(message)),
      pageErrors.join(' | ').slice(0, 80),
    )
    // Close the card and let the "已收下" toast expire, otherwise both leak into
    // the later screenshots (epub / narrow / markdown-tables).
    await page.evaluate(() => {
      const card = document.querySelector('.rd-card')
      const closer = card && [...card.querySelectorAll('h3 button')].find((node) => (node.textContent || '').trim() === '×')
      if (closer) closer.click()
    })
    await page.waitForFunction(() => !document.querySelector('.rd-card'), { timeout: 8000 }).catch(() => {})
    await page.waitForFunction(() => !document.querySelector('.rd-toast'), { timeout: 8000 }).catch(() => {})

    await clickAny('.rd-toolbar button', ['←'])
    await page.waitForSelector('.rd-library', { timeout: 8000 })
    await clickAny('.rd-entry', ['示例-分布式系统.epub'])
    await page.waitForSelector('.rd-prose', { timeout: 20000 })
    const epub = await page.evaluate(() => document.querySelector('.rd-prose').textContent.slice(0, 120))
    record('epub opens', epub.includes('一致性模型'), epub.slice(0, 40))
    await shot('09-epub')

    await page.setViewport({ width: 420, height: 800, deviceScaleFactor: 1 })
    await new Promise((resolve) => setTimeout(resolve, 300))
    const narrow = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      toolbarHeight: document.querySelector('.rd-toolbar')?.getBoundingClientRect().height || 0,
    }))
    record('narrow viewport has no page overflow', narrow.overflow <= 2, `overflow ${narrow.overflow}px`)
    const narrowCard = await (async () => {
      const term = await page.$('.rd-prose .rd-term')
      if (!term) return null
      await term.hover()
      await page.waitForSelector('.rd-card', { timeout: 8000 })
      return page.evaluate(() => {
        const card = document.querySelector('.rd-card').getBoundingClientRect()
        const root = document.querySelector('.rd-root').getBoundingClientRect()
        return {
          inside: card.left >= root.left - 1 && card.top >= root.top - 1 && card.right <= root.right + 1 && card.bottom <= root.bottom + 1,
          card: `${Math.round(card.left)},${Math.round(card.top)}-${Math.round(card.right)},${Math.round(card.bottom)}`,
          root: `${Math.round(root.left)},${Math.round(root.top)}-${Math.round(root.right)},${Math.round(root.bottom)}`,
        }
      })
    })()
    record('narrow card stays inside the reader', Boolean(narrowCard && narrowCard.inside), narrowCard ? `${narrowCard.card} in ${narrowCard.root}` : 'no term')
    await shot('10-narrow')

    await page.mouse.move(4, 4)
    await new Promise((resolve) => setTimeout(resolve, 400))
    await page.evaluate(() => {
      const main = document.querySelector('.rd-main')
      main.scrollTop = main.scrollHeight
    })
    const beforeChapter = await page.evaluate(() => [...document.querySelectorAll('.rd-toolbar .rd-muted')].map((node) => node.textContent).join('|'))
    await page.keyboard.press('ArrowDown')
    await new Promise((resolve) => setTimeout(resolve, 500))
    const nextChapter = await page.evaluate(() => ({
      text: document.querySelector('.rd-prose')?.textContent.slice(0, 80) || '',
      indicator: [...document.querySelectorAll('.rd-toolbar .rd-muted')].map((node) => node.textContent).join('|'),
    }))
    record(
      'epub arrow at chapter end advances a chapter',
      nextChapter.indicator !== beforeChapter || !nextChapter.text.includes('一致性模型'),
      `${beforeChapter} -> ${nextChapter.indicator}`,
    )

    await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 })
    await new Promise((resolve) => setTimeout(resolve, 300))
    await clickAny('.rd-toolbar button', ['←'])
    await page.waitForSelector('.rd-library', { timeout: 8000 })
    await clickAny('.rd-entry', ['示例-Markdown语法.md'])
    await page.waitForSelector('.rd-prose table', { timeout: 15000 })
    const markdownRich = await page.evaluate(() => ({
      tables: document.querySelectorAll('.rd-prose .rd-table-wrap table').length,
      headers: [...document.querySelectorAll('.rd-prose thead th')].map((node) => node.textContent),
      rows: document.querySelectorAll('.rd-prose tbody tr').length,
      boxes: document.querySelectorAll('.rd-prose .rd-task input[type=checkbox]').length,
      checked: document.querySelectorAll('.rd-prose .rd-task input[type=checkbox]:checked').length,
      nested: document.querySelectorAll('.rd-prose li ul li').length,
      codeLangs: [...document.querySelectorAll('.rd-prose pre code')].map((node) => node.getAttribute('class')),
      align: document.querySelector('.rd-prose th[style]')?.getAttribute('style') || '',
    }))
    record('markdown tables render with header and rows', markdownRich.tables === 2 && markdownRich.rows === 6, `${markdownRich.tables} tables, ${markdownRich.rows} rows, ${markdownRich.align}`)
    record('markdown table alignment is kept', markdownRich.align.includes('text-align:center'), markdownRich.align)
    record('markdown task lists render checkboxes', markdownRich.boxes === 3 && markdownRich.checked === 2, `${markdownRich.checked}/${markdownRich.boxes} checked`)
    record('markdown nested lists render', markdownRich.nested >= 2, `${markdownRich.nested} nested li`)
    record('markdown fenced code keeps its language', markdownRich.codeLangs.some((value) => value === 'language-js'), markdownRich.codeLangs.join(','))
    await shot('15-markdown-tables')
    await page.evaluate(() => {
      document.querySelector('.rd-prose img[alt="阅读流程示意"]')?.scrollIntoView({ block: 'center' })
    })
    await new Promise((resolve) => setTimeout(resolve, 600))
    const markdownImage = await page.evaluate(() => {
      const image = document.querySelector('.rd-prose img[alt="阅读流程示意"]')
      return image ? { width: image.naturalWidth, complete: image.complete, src: image.getAttribute('src') || '' } : null
    })
    record(
      'markdown relative images load through the file route',
      Boolean(markdownImage && markdownImage.width > 0 && markdownImage.src.includes('/api/file')),
      markdownImage ? `${markdownImage.width}px ${markdownImage.src.slice(0, 80)}` : 'missing',
    )
    await page.evaluate(() => {
      document.querySelector('.rd-main').scrollTo({ top: 0, behavior: 'instant' })
    })
    await clickAny('.rd-toolbar button', ['翻译', 'Translate'])
    await page.waitForSelector('.rd-translate-bar', { timeout: 15000 })
    await page.click('.rd-lang-notice .rd-btn')
    await page.waitForFunction(() => document.querySelectorAll('.rd-prose .rd-trans').length > 0, { timeout: 15000 })
    await new Promise((resolve) => setTimeout(resolve, 600))
    const lazyTranslation = await page.evaluate(() => ({
      translated: document.querySelectorAll('.rd-prose .rd-trans').length,
      total: document.querySelectorAll('.rd-prose p, .rd-prose li, .rd-prose h2, .rd-prose h3, .rd-prose td').length,
      codeTranslations: document.querySelectorAll('.rd-prose pre .rd-trans').length,
      bar: Boolean(document.querySelector('.rd-translate-bar')),
    }))
    record(
      'long markdown translates visible blocks',
      lazyTranslation.bar && lazyTranslation.translated > 0 && lazyTranslation.translated <= lazyTranslation.total,
      `${lazyTranslation.translated}/${lazyTranslation.total} blocks`,
    )
    await page.evaluate(() => {
      document.querySelector('.rd-main').scrollTo({ top: 1600, behavior: 'instant' })
    })
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const afterScrollTranslation = await page.evaluate(() => document.querySelectorAll('.rd-prose .rd-trans').length)
    record(
      'scrolling keeps translations stable',
      afterScrollTranslation >= lazyTranslation.translated,
      `${lazyTranslation.translated} -> ${afterScrollTranslation}`,
    )
    await page.evaluate(() => {
      const close = [...document.querySelectorAll('.rd-translate-bar > button')].at(-1)
      if (close) close.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 300))
    const translationBarClosed = await page.evaluate(() => !document.querySelector('.rd-translate-bar'))
    record('translation bar closes with its close button', translationBarClosed, '')
    record('code blocks are left untranslated', lazyTranslation.codeTranslations === 0, `${lazyTranslation.codeTranslations} code translations`)

    const enBrowser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--disable-lcd-text', '--force-device-scale-factor=1', '--font-render-hinting=none', '--lang=en-US', '--accept-lang=en-US'],
    })
    const enPage = await enBrowser.newPage()
    await enPage.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 })
    await enPage.goto(`http://127.0.0.1:${port}/?session=${encodeURIComponent(SESSION)}`, { waitUntil: 'networkidle2', timeout: 45000 })
    await enPage.waitForSelector('.rd-library', { timeout: 15000 })
    const enTitle = await enPage.$eval('.rd-library h2', (node) => node.textContent.trim())
    record('english UI: library', /library/i.test(enTitle), enTitle)
    await enPage.evaluate(() => {
      const row = [...document.querySelectorAll('.rd-entry')].find((entry) =>
        entry.textContent.includes('示例-分布式系统阅读.md'),
      )
      row.click()
    })
    await enPage.waitForSelector('.rd-prose', { timeout: 15000 })
    const enToolbar = await enPage.$$eval('.rd-toolbar button', (nodes) =>
      nodes.map((node) => node.textContent.trim()).filter(Boolean),
    )
    record('english UI: toolbar labels', enToolbar.includes('Contents') && enToolbar.includes('Guide'), enToolbar.join('|'))
    const chineseButtons = enToolbar.filter((label) => /[\u4e00-\u9fff]/.test(label))
    record('english UI: no Chinese toolbar labels', chineseButtons.length === 0, chineseButtons.join('|'))
    await enPage.evaluate(() => {
      const settings = [...document.querySelectorAll('.rd-toolbar button')].find(
        (button) => button.getAttribute('aria-label') === 'Settings',
      )
      settings.click()
    })
    await enPage.waitForSelector('.rd-drawer', { timeout: 10000 })
    const enSettings = await enPage.$eval('.rd-drawer', (node) => node.textContent)
    record(
      'english UI: settings labels',
      /Reading theme/.test(enSettings) && /Guide depth/.test(enSettings),
      enSettings.slice(0, 80),
    )
    const enBuffer = await enPage.screenshot({ type: 'png' })
    const enVerdict = compareBaseline('14-en-reader', enBuffer)
    if (enVerdict.write) await fs.writeFile(enVerdict.write, enBuffer)
    record('shot 14-en-reader', enVerdict.pass, enVerdict.detail)
    await enBrowser.close()

    // State survives the reader view unmounting when the user visits the DSH
    // conversation and comes back: same session restores the book, drawer and
    // reading position from localStorage.
    await page.evaluate(() => {
      const guide = [...document.querySelectorAll('.rd-toolbar button')].find((button) => button.textContent.includes('导读'))
      if (guide) guide.click()
    })
    await page.waitForSelector('.rd-drawer', { timeout: 8000 }).catch(() => {})
    await page.evaluate(() => {
      const main = document.querySelector('.rd-main')
      if (main) main.scrollTop = 160
    })
    await new Promise((resolve) => setTimeout(resolve, 1100))
    const beforeReload = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem(`dsh-reader:view:${new URLSearchParams(location.search).get('session') || ''}`) || 'null')
      return {
        path: document.querySelector('.rd-title')?.textContent || '',
        drawer: Boolean(document.querySelector('.rd-drawer')),
        scroll: document.querySelector('.rd-main')?.scrollTop || 0,
        savedScroll: saved ? saved.scrollTop : null,
        savedDrawer: saved ? saved.drawer : null,
        mains: [...document.querySelectorAll('.rd-main')].map((node) => ({
          scroll: node.scrollTop,
          height: node.scrollHeight,
          client: node.clientHeight,
          text: (node.textContent || '').slice(0, 18),
        })),
      }
    })
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('.rd-prose', { timeout: 15000 })
    await new Promise((resolve) => setTimeout(resolve, 800))
    const afterReload = await page.evaluate(() => ({
      path: document.querySelector('.rd-title')?.textContent || '',
      drawer: Boolean(document.querySelector('.rd-drawer')),
      scroll: document.querySelector('.rd-main')?.scrollTop || 0,
    }))
    record(
      'returning to a session restores the open book and drawer',
      Boolean(beforeReload.path) && afterReload.path === beforeReload.path && afterReload.drawer,
      `${beforeReload.path} -> ${afterReload.path}, drawer ${afterReload.drawer}`,
    )
    record(
      'returning to a session restores the reading position',
      afterReload.scroll > 100 && Math.abs(afterReload.scroll - beforeReload.scroll) < 80,
      `${beforeReload.scroll} -> ${afterReload.scroll} saved=${beforeReload.savedScroll} mains=${JSON.stringify(beforeReload.mains)}`,
    )

    // Reading-position reporting (spec §6.1): the client posts the position and
    // a context window on open/chapter/page changes, throttled to 1.5s.
    await new Promise((resolve) => setTimeout(resolve, 1800))
    const contextPosts = await page.evaluate(() => (window.__contextPosts || []).slice())
    record(
      'reading position is reported to the host',
      contextPosts.length > 0 &&
        Boolean(contextPosts[0].position) &&
        contextPosts[0].sessionId === SESSION,
      JSON.stringify(contextPosts[0] || null).slice(0, 140),
    )

    // In-reader conversation panel (spec 2026-11-23 §5). The harness fakes the
    // standard conversation.view props: useChat / useInput / useSession /
    // inputActions / openView, plus window.__chatPush for live messages.
    const chatOpened = await clickAny('.rd-toolbar button', ['对话', 'Chat'])
    const chatPanelReady = await page
      .waitForSelector('.rd-chat', { timeout: 8000 })
      .then(() => true)
      .catch(() => false)
    record('chat panel opens from toolbar', Boolean(chatOpened && chatPanelReady), '')
    const chatRows = await page.$$('[data-chat-row]')
    record('chat panel renders transcript rows', chatRows.length >= 2, `${chatRows.length} rows`)
    const chatShape = await page.evaluate(() => ({
      roles: Array.from(document.querySelectorAll('.rd-chat-role')).map((node) => node.textContent),
      process: Boolean(document.querySelector('.rd-chat-process')),
      toolRows: document.querySelectorAll('.rd-chat-tool').length,
    }))
    record(
      'chat rows name the asking and answering sides',
      chatShape.roles.includes('你') && chatShape.roles.includes('助手'),
      chatShape.roles.slice(0, 4).join('/'),
    )
    const chatBubbleStyle = await page.evaluate(() => {
      const bubble = document.querySelector('.rd-chat-bubble-user')
      if (!bubble) return null
      const style = getComputedStyle(bubble)
      return {
        border: style.borderTopWidth + ' ' + style.borderLeftWidth,
        borderStyle: style.borderTopStyle,
        shadow: style.boxShadow,
        outline: style.outlineStyle,
      }
    })
    record(
      'user bubble paints as a fill with no outline',
      Boolean(chatBubbleStyle) &&
        chatBubbleStyle.border === '0px 0px' &&
        (chatBubbleStyle.shadow === 'none' || chatBubbleStyle.shadow === '') &&
        chatBubbleStyle.outline === 'none',
      JSON.stringify(chatBubbleStyle),
    )
    record(
      'chat folds reasoning and tool calls by default',
      chatShape.process && chatShape.toolRows === 0,
      `process=${chatShape.process} tools=${chatShape.toolRows}`,
    )
    const aggregated = await page.evaluate(() => ({
      assistantRows: document.querySelectorAll('[data-role="assistant"]').length,
      userRows: document.querySelectorAll('[data-role="user"]').length,
      roles: Array.from(document.querySelectorAll('[data-role="assistant"] .rd-chat-role')).length,
    }))
    record(
      'one assistant row per turn despite multi-step tool loops',
      aggregated.assistantRows === 1 && aggregated.roles === 1 && aggregated.userRows === 1,
      JSON.stringify(aggregated),
    )
    const processFold = await page.evaluate(() => {
      const process = document.querySelector('.rd-chat-process')
      if (!process) return null
      process.querySelector('summary').click()
      const reasoning = process.querySelector('details[data-chat-reasoning]')
      return {
        open: process.hasAttribute('open'),
        reasoningOpen: reasoning ? reasoning.hasAttribute('open') : null,
        chips: Array.from(process.querySelectorAll('.rd-chat-chip')).map((node) => node.textContent),
      }
    })
    record(
      'process expands without dumping the reasoning chain',
      Boolean(processFold) && processFold.open && processFold.reasoningOpen === false,
      JSON.stringify(processFold),
    )
    await shot('16-chat-panel')

    const jumpClicked = await page.evaluate(() => {
      const button = document.querySelector('[data-chat-action="open-view"]')
      if (!button) return false
      button.click()
      return true
    })
    await new Promise((resolve) => setTimeout(resolve, 200))
    const openedView = await page.evaluate(() => window.__openedView)
    record(
      'open chat page delegates to openView',
      jumpClicked && Boolean(openedView) && openedView.view === 'chat' && openedView.focus === '',
      JSON.stringify(openedView),
    )

    const chatWidthBefore = await page.$eval('.rd-drawer', (node) => Math.round(node.getBoundingClientRect().width))
    const chatResizer = await page.$eval('.rd-drawer-resizer', (node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })
    await page.mouse.move(chatResizer.x, chatResizer.y)
    await page.mouse.down()
    await page.mouse.move(chatResizer.x - 70, chatResizer.y, { steps: 8 })
    await page.mouse.up()
    await new Promise((resolve) => setTimeout(resolve, 300))
    const chatWidthResized = await page.$eval('.rd-drawer', (node) => Math.round(node.getBoundingClientRect().width))
    record(
      'chat sidebar has its own resizable width',
      chatWidthResized > chatWidthBefore + 30,
      `${chatWidthBefore} -> ${chatWidthResized}`,
    )
    await page.$eval('.rd-drawer-resizer', (node) => node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    await new Promise((resolve) => setTimeout(resolve, 300))
    const chatWidthReset = await page.$eval('.rd-drawer', (node) => Math.round(node.getBoundingClientRect().width))
    record('double-click resets the chat sidebar width', Math.abs(chatWidthReset - 420) <= 2, `${chatWidthReset}px`)

    const streamingText = await page.evaluate(async () => {
      window.__chatPushUser('请用三句话总结一致性模型')
      window.__chatStream({ text: '这是流式生成中的前半段答案，先给结论：一致性分三层。', tools: ['read_image'] })
      await new Promise((resolve) => setTimeout(resolve, 400))
      const bubbles = [...document.querySelectorAll('.rd-chat-bubble-assistant')]
      const bubble = bubbles[bubbles.length - 1]
      return {
        text: bubble ? bubble.textContent : '',
        live: Boolean(document.querySelector('.rd-chat-live')),
        busy: Boolean(document.querySelector('.rd-chat-busy')),
      }
    })
    record(
      'streaming answer shows streamed text in the bubble',
      /流式生成中的前半段答案/.test(streamingText.text) && streamingText.live === false && streamingText.busy === false,
      JSON.stringify({ live: streamingText.live, busy: streamingText.busy }),
    )
    const streamingAction = await page.evaluate(async () => {
      window.__chatStream({ tools: ['read_image'] })
      await new Promise((resolve) => setTimeout(resolve, 400))
      const live = document.querySelector('.rd-chat-live')
      const bubbles = [...document.querySelectorAll('.rd-chat-bubble-assistant')]
      const bubble = bubbles[bubbles.length - 1]
      return {
        live: live ? live.textContent : '',
        bubble: bubble ? bubble.textContent : '',
        process: Boolean(bubble && bubble.querySelector('.rd-chat-process')),
      }
    })
    record(
      'streaming without text shows the current action',
      /正在读取文件|Reading a file/.test(streamingAction.live) && streamingAction.process === true,
      JSON.stringify({ live: streamingAction.live.slice(0, 40) }),
    )
    const streamSettled = await page.evaluate(async () => {
      window.__chatStreamSettle('流式回答完成，结论如上。')
      await new Promise((resolve) => setTimeout(resolve, 400))
      const live = Boolean(document.querySelector('.rd-chat-live'))
      const bubbles = [...document.querySelectorAll('.rd-chat-bubble-assistant')]
      const bubble = bubbles[bubbles.length - 1]
      return { live, text: bubble ? bubble.textContent : '' }
    })
    record(
      'settled stream replaces the live line with the answer',
      streamSettled.live === false && /流式回答完成/.test(streamSettled.text),
      JSON.stringify({ live: streamSettled.live }),
    )

    await clickAny('.rd-toolbar button', ['对话', 'Chat'])
    await page.waitForFunction(() => !document.querySelector('.rd-chat'), { timeout: 8000 })
    await page.evaluate(() => window.__chatPush(1))
    await new Promise((resolve) => setTimeout(resolve, 400))
    const unreadDot = await page.evaluate(() => Boolean(document.querySelector('.rd-chat-unread')))
    record('chat unread dot appears when closed', unreadDot, unreadDot ? '' : 'no dot')

    await page.evaluate(() => window.__chatClear())
    await clickAny('.rd-toolbar button', ['对话', 'Chat'])
    await page.waitForSelector('.rd-chat', { timeout: 8000 })
    await new Promise((resolve) => setTimeout(resolve, 300))
    const chatEmpty = await page.evaluate(() => Boolean(document.querySelector('.rd-chat-empty')))
    record('chat empty state guides the reader', chatEmpty, '')
    await shot('17-chat-empty')
    await page.evaluate(() => {
      window.__chatPushUser([
        {
          type: 'image',
          attachment: { attachmentId: 'sha256:' + '3'.repeat(64), mediaType: 'image/png', bytes: 3426, width: 480, height: 300, name: '截图.png' },
        },
        { type: 'file', attachment: { attachmentId: 'sha256:' + '4'.repeat(64), name: '周期研究.pdf', bytes: 204800 } },
        { type: 'text', text: '看这张截图和这份附件' },
      ])
      window.__chatPush(2)
    })
    await new Promise((resolve) => setTimeout(resolve, 900))
    const chatAttachments = await page.evaluate(() => {
      const img = document.querySelector('.rd-chat-image img')
      const file = document.querySelector('.rd-chat-file')
      return {
        image: Boolean(img) && (img.naturalWidth || 0) > 0,
        width: img ? img.naturalWidth : 0,
        file: Boolean(file) && /周期研究\.pdf/.test(file.textContent || ''),
        failed: document.querySelectorAll('.rd-chat-image-failed').length,
      }
    })
    record(
      'chat renders message images and file attachments',
      chatAttachments.image && chatAttachments.file && chatAttachments.failed === 0,
      JSON.stringify(chatAttachments),
    )

    // Quote a book passage into the native composer (spec §4). The harness
    // records insertQuote / insertText calls instead of a real composer.
    const selectPassage = () =>
      page.evaluate(() => {
        const root = document.querySelector('.rd-prose')
        if (!root) return ''
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        let node
        while ((node = walker.nextNode())) {
          const text = (node.nodeValue || '').trim()
          if (text.length < 20) continue
          const snippet = text.slice(0, 10)
          const index = node.nodeValue.indexOf(snippet)
          if (index < 0) continue
          const range = document.createRange()
          range.setStart(node, index)
          range.setEnd(node, index + snippet.length)
          const selection = window.getSelection()
          selection.removeAllRanges()
          selection.addRange(range)
          node.parentElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
          return snippet
        }
        return ''
      })
    const selectedText = await selectPassage()
    await page.waitForSelector('.rd-mini', { timeout: 8000 }).catch(() => {})
    const askedChat = await page.evaluate(() => {
      const button = [...document.querySelectorAll('.rd-mini button')].find(
        (node) => node.textContent.trim() === '问 AI',
      )
      if (!button) return false
      button.click()
      return true
    })
    await new Promise((resolve) => setTimeout(resolve, 400))
    const quotes = await page.evaluate(() => window.__quotes.slice())
    const quoteDoc = await page.$eval('.rd-title', (node) => node.textContent.trim()).catch(() => '')
    record(
      'quote inserts passage with location',
      askedChat &&
        Boolean(selectedText) &&
        quotes.length > 0 &&
        quotes[0].includes(`《${quoteDoc}》`) &&
        quotes[0].split('\n')[1] === selectedText,
      (quotes[0] || 'no quote').slice(0, 90),
    )

    await selectPassage()
    await page.waitForSelector('.rd-mini select', { timeout: 8000 }).catch(() => {})
    const quickAsked = await page.evaluate(() => {
      const select = document.querySelector('.rd-mini .rd-quick-ask')
      if (!select) return false
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
      setter.call(select, 'explain')
      select.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })
    await new Promise((resolve) => setTimeout(resolve, 400))
    const inserted = await page.evaluate(() => window.__inserted.slice())
    record(
      'quick ask inserts question after quote',
      quickAsked && inserted.length > 0 && inserted[0].text === '解释这段' && Boolean(inserted[0].span),
      inserted.length ? inserted[0].text : 'nothing inserted',
    )
    const selectionAssets = await page.evaluate(async () => {
      const prose = document.querySelector('.rd-prose')
      if (!prose) return { ok: false, reason: 'no prose' }
      prose.insertAdjacentHTML(
        'beforeend',
        `<figure class="visual-asset-probe"><img src="${window.__fixtureImageDataUrl}" alt="探针图"><figcaption>探针图</figcaption></figure>`,
      )
      const figure = prose.querySelector('.visual-asset-probe')
      const paragraph = prose.querySelector('p')
      const range = document.createRange()
      range.setStart(paragraph.firstChild, 0)
      range.setEndAfter(figure)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      figure.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 80))
      const ask = Array.from(document.querySelectorAll('.rd-mini button')).find((button) =>
        /问 AI|Ask AI/.test(String(button.textContent || '')),
      )
      if (!ask) return { ok: false, reason: 'no ask button' }
      ask.click()
      await new Promise((resolve) => setTimeout(resolve, 1200))
      const quote = (window.__quotes || []).slice(-1)[0] || ''
      return {
        ok: true,
        files: window.__readerAttachments || [],
        ids: window.__readerAttachmentIds || [],
        quote,
      }
    })
    record(
      'selection carries figures into the composer',
      selectionAssets.ok === true &&
        selectionAssets.files.length === 1 &&
        selectionAssets.files[0].type === 'image/png' &&
        selectionAssets.ids.length === 1 &&
        /选区内图形/.test(selectionAssets.quote),
      JSON.stringify({
        files: selectionAssets.files,
        ids: selectionAssets.ids,
        quote: String(selectionAssets.quote || '').slice(0, 60),
        reason: selectionAssets.reason,
      }),
    )
    // Chat rich text: formulas and fenced code must survive the markdown pipeline.
    await page.evaluate(() => window.__chatClear())
    const chatOpenNow = await page.evaluate(() => Boolean(document.querySelector('.rd-chat')))
    if (!chatOpenNow) await clickAny('.rd-toolbar button', ['对话', 'Chat'])
    await page.waitForSelector('.rd-chat', { timeout: 8000 })
    await page.evaluate(() =>
      window.__chatPushUser('公式 $E=mc^2$ 与块公式 $$\\frac{a}{b}$$\n\n```js\nconst a = 1\n```'),
    )
    const rich = await page
      .waitForFunction(
        () => {
          const root = document.querySelector('.rd-chat-md')
          return root && root.querySelector('.katex') && root.querySelector('pre code')
        },
        { timeout: 20000 },
      )
      .then(() => true)
      .catch(() => false)
    const richShape = await page.evaluate(() => ({
      inline: document.querySelectorAll('.rd-chat-md .katex').length,
      blocks: document.querySelectorAll('.rd-chat-md pre code').length,
    }))
    record('chat renders formulas and code blocks', rich, JSON.stringify(richShape))

    // Word: open the generated fixture and assert the prose/TOC pipeline.
    await clickAny('.rd-toolbar button', ['←'])
    await page.waitForSelector('.rd-library', { timeout: 8000 })
    await clickAny('.rd-entry', [DOCX_DEMO])
    await page.waitForSelector('.rd-prose h1', { timeout: 20000 })
    const docx = await page.evaluate(() => ({
      text: document.querySelector('.rd-prose')?.textContent || '',
      h1: document.querySelectorAll('.rd-prose h1').length,
      tables: document.querySelectorAll('.rd-prose .rd-table-wrap table').length,
    }))
    record('docx opens', docx.text.includes('技术报告正文') && docx.h1 >= 1, `h1=${docx.h1}`)
    record('docx table wraps', docx.tables >= 1, `${docx.tables} tables`)
    await clickAny('.rd-toolbar button', ['目录', 'Contents'])
    await page.waitForSelector('.rd-drawer-item', { timeout: 8000 })
    const docxToc = await page.$$eval('.rd-drawer-item', (nodes) => nodes.map((node) => node.textContent.trim()))
    record(
      'docx toc lists chapters',
      docxToc.some((label) => label.includes('第一章')) && docxToc.some((label) => label.includes('第二章')),
      docxToc.join(' | ').slice(0, 80),
    )
    await page.keyboard.press('Escape')

    await page.evaluate(() => {
      const paragraph = document.querySelector('.rd-prose p')
      const range = document.createRange()
      range.selectNodeContents(paragraph)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      paragraph.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
    const docxMenu = await page.waitForSelector('.rd-mini', { timeout: 8000 }).then(() => true).catch(() => false)
    record('docx selection opens the toolbar', docxMenu, '')
    if (docxMenu) {
      const actions = await page.$$eval('.rd-mini button', (nodes) =>
        nodes.map((node) => `${node.textContent || ''} ${node.getAttribute('aria-label') || ''}`),
      )
      record(
        'docx selection exposes explain/highlight/note',
        actions.some((text) => text.includes('解释')) &&
          actions.some((text) => text.includes('高亮')) &&
          actions.some((text) => text.includes('笔记')),
        actions.join('|').slice(0, 80),
      )
      await page.keyboard.press('Escape')
    }

    await page.keyboard.down('Meta')
    await page.keyboard.press('f')
    await page.keyboard.up('Meta')
    await page.waitForSelector('.rd-search input', { timeout: 8000 })
    await page.type('.rd-search input', '结论')
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.querySelectorAll('.rd-search .rd-drawer-item').length > 0, { timeout: 8000 })
    const docxHits = await page.$$eval('.rd-search .rd-drawer-item', (nodes) => nodes.map((node) => node.textContent))
    record('docx search hits a later chapter', docxHits.some((text) => text.includes('结论')), docxHits.join(' | ').slice(0, 80))
    await clickAny('.rd-search .rd-drawer-item', ['结论'])
    await page.waitForFunction(() => (document.querySelector('.rd-prose')?.textContent || '').includes('结论正文'), { timeout: 8000 }).catch(() => {})
    const chapterTwo = await page.evaluate(() => document.querySelector('.rd-prose')?.textContent || '')
    record('docx search jumps across chapters', chapterTwo.includes('结论正文'), chapterTwo.slice(0, 30))
    await page.keyboard.press('Escape')
  } catch (error) {
    try {
      const dump = await page.evaluate(() => ({
        text: document.body.innerText.slice(0, 500),
        error: document.querySelector('.rd-error')?.textContent || '',
      }))
      console.log('PAGE DUMP:', JSON.stringify(dump))
    } catch {
      /* page gone */
    }
    record('visual run', false, String(error && error.message))
  } finally {
    await browser.close()
    await new Promise((resolve) => server.close(resolve))
  }

  const failed = results.filter((item) => !item.pass)
  await fs.writeFile(
    path.join(root, 'eval', 'visual-report.json'),
    JSON.stringify({ at: new Date().toISOString(), total: results.length, failed: failed.length, results }, null, 2),
  )
  console.log(`\n${results.length - failed.length}/${results.length} visual checks passed`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
