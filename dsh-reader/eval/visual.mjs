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
const DSH = 'http://127.0.0.1:60592'
const SESSION = process.env.DSH_SESSION_ID || ''
if (!SESSION) {
  console.error('eval:visual needs DSH_SESSION_ID (run it from a DSH session or export one)')
  process.exit(1)
}
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASELINE = path.join(here, 'visual', 'baseline')

const UPDATE = process.env.VISUAL_UPDATE === '1'
const DEMOS = ['示例-分布式系统阅读.md', '示例-分布式系统.epub', '示例-分布式系统.pdf']

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
          port: 60592,
          path: targetPath + url.search,
          method: req.method,
          headers: (() => {
            const headers = { ...req.headers, host: '127.0.0.1:60592' }
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
  page.on('pageerror', (error) => console.log('PAGE ERROR:', error.message))
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
    await clickAny('.rd-toolbar button', ['翻译', 'Translate'])
    await page.waitForFunction(() => document.querySelectorAll('.rd-prose .rd-trans').length > 0, { timeout: 15000 })
    const translated = await page.$$eval('.rd-prose .rd-trans', (nodes) => nodes.length)
    record('paragraph translations render inline', translated >= 3, `${translated} blocks`)
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
    await shot('03-concept-card')

    const cardCenter = await page.$eval('.rd-card', (node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })
    await page.mouse.move(cardCenter.x, cardCenter.y, { steps: 12 })
    await new Promise((resolve) => setTimeout(resolve, 950))
    record('card survives moving onto it', Boolean(await page.$('.rd-card')), '')
    await shot('03b-card-hover')

    await page.mouse.move(4, 4)
    await new Promise((resolve) => setTimeout(resolve, 950))
    record('card closes after leaving', (await page.$('.rd-card')) === null, '')


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
    await shot('03d-annotation-editor')
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
    await page.waitForFunction(
      () => (document.querySelector('.rd-trans-card')?.textContent || '').includes('译文：'),
      { timeout: 15000 },
    )
    const selectionTranslation = await page.evaluate(() => document.querySelector('.rd-trans-card').textContent.slice(0, 80))
    record('selection translation renders', selectionTranslation.includes('译文：'), selectionTranslation.slice(0, 40))
    await shot('03f-selection-translation')
    await page.keyboard.press('Escape')
    await page.mouse.move(4, 4)

    const guideClicked = await clickAny('.rd-toolbar button', ['导读', 'Guide'])
    record('guide tab opens', guideClicked, '')
    await page.waitForSelector('.rd-guide-synopsis', { timeout: 8000 })
    const guideText = await page.evaluate(() => document.querySelector('.rd-drawer-body').textContent)
    record('guide synopsis renders', guideText.includes('分布式系统'), guideText.slice(0, 40))
    await shot('04-guide')

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
      document.querySelector('.rd-drawer-body').scrollTop = 0
    })
    await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 })
    await new Promise((resolve) => setTimeout(resolve, 400))

    const mapClicked = await clickAny('.rd-drawer button', ['导图', 'Mindmap'])
    await page.waitForSelector('.rd-map-scroll svg .rdm-label', { timeout: 8000 })
    const nodes = await page.$$eval('.rdm-label', (items) => items.length)
    record('mindmap renders nodes', mapClicked && nodes >= 3, `${nodes} nodes`)
    await shot('05-mindmap')

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
    await shot('05b-concepts-scope')

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
