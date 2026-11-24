#!/usr/bin/env node
/**
 * Motion eval — the browser half of the v0.14.0 release gate (PRD §9.2).
 *
 * Runs the real reader bundle inside the visual-eval harness (same fixtures,
 * same local proxy server, same puppeteer + local Chrome), but deliberately
 * does NOT load the `animation: none !important` stylesheet that `eval/visual.mjs`
 * injects: this eval needs the real animations the product ships.
 *
 * Every assertion reads the live Web Animations objects via
 * `document.getAnimations()` (`effect.getKeyframes()`, `effect.getComputedTiming()`)
 * instead of guessing with sleeps. The only sleeps used are "let the DOM settle"
 * waits after an observed animation/an element appears.
 *
 * Output: eval/motion-report.json · exit code 0 when every check passes.
 */

import { createServer, request as httpRequest } from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import puppeteer from 'puppeteer-core'
import { docFingerprint } from '../lib/fingerprint.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const DSH = (process.env.DSH_WEB_URL || 'http://127.0.0.1:60592').replace(/\/$/, '')
const DSH_PORT = Number(new URL(DSH).port) || 80
const SESSION = process.env.DSH_SESSION_ID || ''
if (!SESSION) {
  console.error('eval:motion needs DSH_SESSION_ID (run it from a DSH session or export one)')
  process.exit(1)
}
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const DEMOS = ['示例-分布式系统阅读.md', '示例-Markdown语法.md', '示例-分布式系统.epub', '示例-分布式系统.pdf']

// Hard product budget from PRD §7.5: the gate must stay usable on every release.
const RUN_BUDGET_MS = 90 * 1000

const results = []
function record(name, pass, detail, data) {
  const entry = { name, pass: Boolean(pass), detail: detail || '' }
  if (data !== undefined) entry.data = data
  results.push(entry)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(36)} ${entry.detail}`)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function dshJson(url) {
  const response = await fetch(DSH + url)
  if (!response.ok) throw new Error(`DSH ${url} -> ${response.status}`)
  return response.json()
}

// ---------------------------------------------------------------------------
// Fixtures — identical shape to eval/visual.mjs so both evals exercise the
// same store, guide and chat data. Kept as a copy (not an import) because
// eval/visual.mjs is a script with top-level side effects.
// ---------------------------------------------------------------------------
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
            note: '动效测试夹具',
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

// The ONLY deliberate difference from eval/visual.mjs: no blanket
// `animation:none!important;transition:none!important` rule. Everything else
// (design tokens, caret handling) stays the same so both evals see one host.
const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>reader motion</title>
<style>
  :root{
    --dsw-alias-bg-base:#ffffff;--dsw-alias-bg-layer-1:#f7f8fa;--dsw-alias-bg-layer-2:#eef1f5;
    --dsw-alias-bg-overlay:#ffffff;--dsw-alias-border-l1:#e3e6eb;--dsw-alias-border-l2:#c9ced6;
    --dsw-alias-brand-primary:#3b82f6;--dsw-alias-label-primary:#1f2329;
    --dsw-alias-label-secondary:#5b6472;--dsw-alias-state-error-primary:#d14343;
  }
  html,body,#root{height:100%;margin:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;background:#fff;color:#1f2329}
  *{caret-color:transparent!important}
</style></head>
<body><div id="root"></div><script src="/harness.js"></script></body></html>`

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
    if (url.pathname === '/favicon.ico') return send(204, 'text/plain', '')
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

// ---------------------------------------------------------------------------
// In-page animation recorder. Runs a rAF loop so even short (90ms) or
// fill:none (drawer) animations are captured with their real keyframes and
// computed timing before the browser drops them.
// ---------------------------------------------------------------------------
function installMotionProbe() {
  if (window.__motionProbe) return true
  const SKIP = new Set(['offset', 'computedOffset', 'easing', 'composite'])
  const seen = new Set()
  const records = []
  let running = false
  let handle = 0

  const describeTarget = (target) => {
    if (!target || !target.tagName) return { tag: '', cls: '', motion: '', nodeId: '', ring: '' }
    let cls = ''
    if (typeof target.className === 'string') cls = target.className
    else if (target.getAttribute) cls = target.getAttribute('class') || ''
    const dataset = target.dataset || {}
    return {
      tag: target.tagName.toLowerCase(),
      cls: String(cls),
      motion: dataset.motion || '',
      nodeId: dataset.nodeId || '',
      ring: dataset.jumpRing !== undefined ? '1' : '',
    }
  }

  const describe = (animation) => {
    const effect = animation.effect
    const target = effect && effect.target
    let frames = []
    let timing = null
    try {
      frames = effect.getKeyframes()
    } catch (error) {
      frames = []
    }
    try {
      timing = effect.getComputedTiming()
    } catch (error) {
      timing = null
    }
    const props = []
    const cleanFrames = frames.map((frame) => {
      const copy = {}
      for (const [key, value] of Object.entries(frame)) {
        if (SKIP.has(key)) continue
        props.push(key)
        copy[key] = typeof value === 'string' ? value : String(value)
      }
      return copy
    })
    return {
      kind: animation.constructor.name,
      name: animation.animationName || animation.transitionProperty || '',
      target: describeTarget(target),
      props: [...new Set(props)],
      frames: cleanFrames,
      delay: timing ? timing.delay : null,
      duration: timing ? timing.duration : null,
      endTime: timing ? timing.endTime : null,
      fill: timing ? timing.fill : null,
      playState: animation.playState,
    }
  }

  const tick = () => {
    for (const animation of document.getAnimations()) {
      if (seen.has(animation)) continue
      seen.add(animation)
      try {
        records.push(describe(animation))
      } catch (error) {
        /* a target may disappear mid-describe; keep probing */
      }
    }
    if (running) handle = requestAnimationFrame(tick)
  }

  window.__motionProbe = {
    start() {
      for (const animation of document.getAnimations()) seen.add(animation)
      records.length = 0
      running = true
      cancelAnimationFrame(handle)
      handle = requestAnimationFrame(tick)
    },
    stop() {
      running = false
      cancelAnimationFrame(handle)
      return records.slice()
    },
    snapshot() {
      return records.slice()
    },
    /** Read the animations currently attached to matching elements (deduped).
     *  Fallback for the rare frame where the rAF recorder misses a short CSS
     *  animation; fill-mode animations stay inspectable after they finish. */
    describeCurrent(selector) {
      const out = []
      const elements = selector ? document.querySelectorAll(selector) : []
      for (const element of elements) {
        for (const animation of element.getAnimations()) {
          try {
            out.push(describe(animation))
          } catch (error) {
            /* keep describing the rest */
          }
        }
      }
      return out
    },
  }
  return true
}

// ---------------------------------------------------------------------------
// Small helpers shared by the checks.
// ---------------------------------------------------------------------------
const propsOf = (record) => ((record && record.props) || []).map((prop) => String(prop).toLowerCase())
const classListOf = (record) => String((record && record.target && record.target.cls) || '').split(/\s+/).filter(Boolean)
const hasClass = (record, name) => classListOf(record).includes(name)
const onlyOpacityTransform = (record) => {
  const props = propsOf(record)
  return props.length > 0 && props.every((prop) => prop === 'opacity' || prop === 'transform')
}
const frameNumber = (frame, prop) => {
  if (!frame) return NaN
  const value = frame[prop]
  if (value === undefined || value === null) return NaN
  const match = String(value).match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : NaN
}
const translateYOf = (record) => {
  const frame = (record.frames || [])[0]
  if (!frame || !frame.transform) return NaN
  const match = String(frame.transform).match(/translateY\((-?\d+(?:\.\d+)?)px\)/)
  return match ? Number(match[1]) : NaN
}
const durationOf = (record) => Number(record && record.duration)
const describeRecords = (records) =>
  records
    .map((item) => `${item.name || item.kind}@${(item.target && item.target.cls) || (item.target && item.target.tag) || '?'} ${Math.round(durationOf(item))}ms${item.delay ? `+${item.delay}` : ''}`)
    .join('; ')

async function main() {
  const startedAt = Date.now()
  // The gate itself must never hang a release: hard-stop after 150s, well above
  // the 90s product budget but below the CI patience limit.
  const guard = setTimeout(() => {
    console.error('motion eval watchdog: run exceeded 150s, aborting')
    process.exit(1)
  }, 150000)
  const fixtures = await buildFixtures()
  const harnessCode = await makeHarness()
  const server = await startServer(fixtures, harnessCode)
  const port = server.address().port
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    protocolTimeout: 30000,
    args: [
      '--no-sandbox',
      '--disable-lcd-text',
      '--force-device-scale-factor=1',
      '--font-render-hinting=none',
      '--lang=zh-CN',
      '--accept-lang=zh-CN',
    ],
  })
  const page = await browser.newPage()
  const consoleErrors = []
  const isIgnoredConsoleError = (text) => /favicon\.ico|net::ERR_ABORTED|ERR_ABORTED/i.test(text)
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text().slice(0, 400)
    if (!isIgnoredConsoleError(text)) consoleErrors.push(text)
  })
  page.on('pageerror', (error) => {
    const text = `pageerror: ${error && error.message ? error.message : String(error)}`
    if (!isIgnoredConsoleError(text)) consoleErrors.push(text)
  })
  await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 })

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

  const nextFrames = (count = 2) =>
    page.evaluate(
      (frames) =>
        new Promise((resolve) => {
          let left = frames
          const step = () => {
            left -= 1
            if (left <= 0) resolve(true)
            else requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        }),
      count,
    )

  /** Put the first occurrence of `needle` at a fraction of the reading viewport, then select it. */
  const selectNeedle = async (needle, fraction = 0.55) => {
    const positioned = await page.evaluate(
      ({ needle, fraction }) => {
        const prose = document.querySelector('.rd-prose')
        const main = document.querySelector('.rd-main')
        const rdRoot = document.querySelector('.rd-root')
        if (!prose || !main || !rdRoot) return 'no reader'
        const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT)
        let node = null
        while (walker.nextNode()) {
          const value = walker.currentNode.nodeValue || ''
          const index = value.indexOf(needle)
          if (index >= 0) {
            node = { current: walker.currentNode, index, length: needle.length }
            break
          }
        }
        if (!node) return 'needle missing'
        const rects = document.createRange()
        rects.setStart(node.current, node.index)
        rects.setEnd(node.current, node.index + node.length)
        const rect = rects.getBoundingClientRect()
        const rootRect = rdRoot.getBoundingClientRect()
        const desired = rootRect.top + rootRect.height * fraction
        main.scrollTop += rect.top - desired
        return true
      },
      { needle, fraction },
    )
    if (positioned !== true) return positioned
    await nextFrames(2)
    const selected = await page.evaluate((needle) => {
      const prose = document.querySelector('.rd-prose')
      if (!prose) return false
      const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const current = walker.currentNode
        const value = current.nodeValue || ''
        const index = value.indexOf(needle)
        if (index < 0) continue
        const range = document.createRange()
        range.setStart(current, index)
        range.setEnd(current, index + needle.length)
        const selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
        current.parentElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
        return true
      }
      return false
    }, needle)
    return selected === true ? true : 'selection failed'
  }

  /** Union the recorder records with the live animation list of `selector`.
   *  Only adds live records when the recorder captured nothing, so the timing
   *  assertions still come from a real Web Animation object. */
  const completeRecords = async (records, selector, predicate) => {
    if ((records || []).some(predicate)) return records || []
    const extra = await page.evaluate(
      (targetSelector) => (window.__motionProbe && window.__motionProbe.describeCurrent ? window.__motionProbe.describeCurrent(targetSelector) : []),
      selector,
    )
    return (records || []).concat(extra)
  }
  const startProbe = () => page.evaluate(() => window.__motionProbe.start())
  const stopProbe = () => page.evaluate(() => window.__motionProbe.stop())
  const waitForRecords = (timeout = 2000) =>
    page.waitForFunction(() => window.__motionProbe.snapshot().length > 0, { timeout }).catch(() => false)

  const closeDrawer = async () => {
    await page.evaluate(() => {
      const button = document.querySelector('.rd-drawer-head button')
      if (button) button.click()
    })
    await page.waitForFunction(() => !document.querySelector('.rd-drawer'), { timeout: 5000 }).catch(() => {})
  }

  const openBook = async () => {
    await page.evaluate(() => {
      const row = [...document.querySelectorAll('.rd-entry')].find((node) =>
        node.textContent.includes('示例-分布式系统阅读.md'),
      )
      if (row) row.click()
    })
    await page.waitForSelector('.rd-prose', { timeout: 20000 })
    await page.waitForFunction(() => document.querySelectorAll('.rd-prose .rd-term').length > 0, { timeout: 15000 })
  }

  /**
   * Select a word in the prose so the toolbar mounts above the selection and
   * capture the entrance animation. Retries with a different vertical position
   * if the app chose the "below" layout.
   */
  async function openToolbar(needle) {
    const fractions = [0.55, 0.65, 0.45, 0.72]
    for (const fraction of fractions) {
      await page.keyboard.press('Escape').catch(() => {})
      await page.mouse.move(4, 4)
      await sleep(120)
      await startProbe()
      const selected = await selectNeedle(needle, fraction)
      if (selected !== true) {
        await stopProbe()
        continue
      }
      await page.waitForSelector('.rd-mini', { timeout: 5000 }).catch(() => {})
      await waitForRecords(1500)
      await sleep(80)
      const records = await stopProbe()
      const side = await page.evaluate(() => document.querySelector('.rd-mini')?.dataset.side || '')
      if (side === 'above') return { ok: true, records, side }
      await sleep(120)
    }
    return { ok: false, records: [], side: '' }
  }

  async function runCheck(name, fn) {
    try {
      const outcome = await Promise.race([
        fn(),
        new Promise((resolve) => setTimeout(() => resolve({ pass: false, detail: 'check watchdog: no result within 25s' }), 25000)),
      ])
      if (!outcome) {
        record(name, false, 'check returned nothing')
        return
      }
      record(name, outcome.pass, outcome.detail, outcome.data)
    } catch (error) {
      record(name, false, `error: ${error && error.message ? error.message : String(error)}`)
    }
  }

  try {
    // ---------------------------------------------------------------- boot
    await page.goto(`http://127.0.0.1:${port}/?session=${encodeURIComponent(SESSION)}`, {
      waitUntil: 'networkidle2',
      timeout: 45000,
    })
    await page.waitForFunction('window.__visualReady === true || window.__bootError', { timeout: 30000 })
    const bootError = await page.evaluate(() => window.__bootError || null)
    if (bootError) throw new Error(`harness boot failed: ${bootError}`)
    await page.waitForSelector('.rd-library', { timeout: 15000 })
    await openBook()
    // Deterministic layout: the smooth-scroll CSS would otherwise make jump
    // targets and ring positions depend on frame timing. Both evals treat this
    // as a test-harness concern, not a product assertion.
    await page.evaluate(() => {
      const main = document.querySelector('.rd-main')
      if (main) main.style.scrollBehavior = 'auto'
    })
    await page.evaluate(installMotionProbe)

    // ------------------------------------------------------------ #1/#2 M-01
    let toolbarRecords = []
    let toolbarSide = ''
    await runCheck('#1 toolbar entrance (M-01)', async () => {
      const opened = await openToolbar('线性一致性')
      toolbarRecords = opened.records
      toolbarSide = opened.side
      const toolbarAll = await completeRecords(toolbarRecords, '.rd-mini', (item) => hasClass(item, 'rd-mini') && onlyOpacityTransform(item))
      const animations = toolbarAll.filter((item) => hasClass(item, 'rd-mini') && onlyOpacityTransform(item))
      if (!opened.ok || animations.length === 0) {
        return { pass: false, detail: `no toolbar animation · side=${opened.side} · records=${describeRecords(toolbarRecords) || 'none'}`, data: { side: opened.side } }
      }
      const animation = animations[animations.length - 1]
      const duration = durationOf(animation)
      const elements = await page.evaluate(() => {
        const mini = document.querySelector('.rd-mini')
        if (!mini) return null
        return {
          pointerEvents: getComputedStyle(mini).pointerEvents,
          left: mini.getBoundingClientRect().left,
          right: mini.getBoundingClientRect().right,
        }
      })
      const pass =
        duration >= 120 &&
        duration <= 180 &&
        onlyOpacityTransform(animation) &&
        Boolean(elements) &&
        elements.pointerEvents !== 'none' &&
        elements.left >= -1
      return {
        pass,
        detail: `${Math.round(duration)}ms props=[${propsOf(animation).join(',')}] pointer=${elements ? elements.pointerEvents : 'n/a'} side=${toolbarSide}`,
        data: { duration, props: propsOf(animation), side: toolbarSide },
      }
    })

    await runCheck('#2 toolbar origin (M-01)', async () => {
      const info = await page.evaluate(() => {
        const mini = document.querySelector('.rd-mini')
        if (!mini) return null
        const style = getComputedStyle(mini)
        const origin = style.transformOrigin.split(/\s+/).map((value) => parseFloat(value))
        return {
          side: mini.dataset.side || '',
          originX: origin[0],
          originY: origin[1],
          width: mini.offsetWidth,
          height: mini.offsetHeight,
          inlineX: mini.style.getPropertyValue('--rd-origin-x').trim(),
          inlineY: mini.style.getPropertyValue('--rd-origin-y').trim(),
        }
      })
      if (!info || !info.width || !info.height) return { pass: false, detail: 'toolbar not mounted', data: { side: toolbarSide } }
      const ratioX = info.originX / info.width
      const ratioY = info.originY / info.height
      const inlineX = parseFloat(info.inlineX)
      const inlineY = parseFloat(info.inlineY)
      const inlineOk =
        info.inlineY === '100%' && Number.isFinite(inlineX) && inlineX >= 15 && inlineX <= 85 && Number.isFinite(inlineY)
      const pass = info.side === 'above' && inlineOk && ratioY >= 0.99 && ratioX >= 0.14 && ratioX <= 0.86
      return {
        pass,
        detail: `side=${info.side} origin=(${info.inlineX || ratioX.toFixed(2)},${info.inlineY || ratioY.toFixed(2)}) y-ratio=${ratioY.toFixed(3)} x-ratio=${ratioX.toFixed(3)}`,
        data: { side: info.side, ratioX, ratioY, inlineX: info.inlineX, inlineY: info.inlineY },
      }
    })

    // -------------------------------------------------------------- #3 M-02
    await runCheck('#3 concept card entrance (M-02)', async () => {
      await startProbe()
      const clicked = await clickAny('.rd-mini button', ['解释', 'Explain'])
      if (!clicked) {
        await stopProbe()
        return { pass: false, detail: 'explain action missing from toolbar' }
      }
      await page.waitForSelector('.rd-card', { timeout: 8000 })
      await page.waitForSelector('.rd-card .rd-def', { timeout: 8000 }).catch(() => {})
      await waitForRecords(2000)
      await sleep(260)
      const records = await completeRecords(await stopProbe(), '.rd-card', (item) => hasClass(item, 'rd-card') && onlyOpacityTransform(item))
      const animations = records.filter((item) => hasClass(item, 'rd-card') && onlyOpacityTransform(item))
      if (animations.length === 0) {
        return { pass: false, detail: `no card animation · records=${describeRecords(records) || 'none'}` }
      }
      const animation = animations[animations.length - 1]
      const duration = durationOf(animation)
      const shift = translateYOf(animation)
      const info = await page.evaluate(() => {
        const card = document.querySelector('.rd-card')
        if (!card) return null
        const style = getComputedStyle(card)
        const origin = style.transformOrigin.split(/\s+/).map((value) => parseFloat(value))
        return {
          side: card.dataset.side || '',
          motion: card.dataset.motion || '',
          originX: origin[0],
          originY: origin[1],
          width: card.offsetWidth,
          height: card.offsetHeight,
          inlineX: card.style.getPropertyValue('--rd-origin-x').trim(),
          inlineY: card.style.getPropertyValue('--rd-origin-y').trim(),
        }
      })
      if (!info || !info.width || !info.height) return { pass: false, detail: 'card not mounted' }
      const ratioX = info.originX / info.width
      const ratioY = info.originY / info.height
      const inlineX = parseFloat(info.inlineX)
      const inlineY = parseFloat(info.inlineY)
      const inlineOk =
        Number.isFinite(inlineX) &&
        Number.isFinite(inlineY) &&
        inlineX >= 15 &&
        inlineX <= 85 &&
        inlineY >= 15 &&
        inlineY <= 85
      const directionOk = info.side === 'below' ? shift < 0 : shift > 0
      const pass =
        duration >= 160 &&
        duration <= 220 &&
        onlyOpacityTransform(animation) &&
        Number.isFinite(shift) &&
        Math.abs(shift) <= 10 &&
        Math.abs(shift) >= 4 &&
        ratioX >= 0.14 &&
        ratioX <= 0.86 &&
        ratioY >= 0.14 &&
        ratioY <= 0.86 &&
        inlineOk &&
        directionOk
      return {
        pass,
        detail: `${Math.round(duration)}ms shift=${shift}px origin=(${info.inlineX || ratioX.toFixed(2)},${info.inlineY || ratioY.toFixed(2)}) side=${info.side} props=[${propsOf(animation).join(',')}]`,
        data: { duration, shift, ratioX, ratioY, side: info.side, inlineX: info.inlineX, inlineY: info.inlineY },
      }
    })

    // -------------------------------------------------------------- #4 M-03
    await runCheck('#4 card stacking (M-03)', async () => {
      const selection = await page.evaluate(() => {
        const def = document.querySelector('.rd-card .rd-def')
        if (!def) return false
        const range = document.createRange()
        range.selectNodeContents(def)
        const answer = window.getSelection()
        answer.removeAllRanges()
        answer.addRange(range)
        document.querySelector('.rd-card').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
        return true
      })
      if (!selection) return { pass: false, detail: 'card definition missing' }
      await page.waitForSelector('.rd-child-menu', { timeout: 8000 })
      await startProbe()
      const clicked = await clickAny('.rd-child-menu button', ['再解释', 'Explain again'])
      if (!clicked) {
        await stopProbe()
        return { pass: false, detail: 'child explain action missing' }
      }
      await page.waitForFunction(() => document.querySelectorAll('.rd-card').length >= 2, { timeout: 8000 })
      // Wait for the stacking animation to settle; measuring mid-flight used to
      // read a partial -4.5px shift and made this check flaky under load.
      await page
        .waitForFunction(
          () => {
            const cards = [...document.querySelectorAll('.rd-card')]
            return (
              cards.length >= 2 &&
              cards.every((card) => card.getAnimations().every((animation) => animation.playState === 'finished'))
            )
          },
          { timeout: 5000 },
        )
        .catch(() => {})
      await sleep(120)
      const records = await completeRecords(await stopProbe(), '.rd-card', (item) => hasClass(item, 'rd-card') && onlyOpacityTransform(item))
      const cardAnimations = records.filter((item) => hasClass(item, 'rd-card') && onlyOpacityTransform(item))
      const state = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.rd-card')]
        const stacks = [...document.querySelectorAll('.rd-card-stack')]
        const matrixOf = (element) => {
          const transform = getComputedStyle(element).transform
          const match = transform.match(/matrix\(([^)]+)\)/)
          if (!match) return { x: 0, y: 0 }
          const parts = match[1].split(',').map((value) => parseFloat(value))
          return { x: parts[4], y: parts[5] }
        }
        const rects = cards.map((card) => {
          const rect = card.getBoundingClientRect()
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            pointer: getComputedStyle(card).pointerEvents,
          }
        })
        if (rects.length < 2) return { cards: rects.length, rects, stacks: stacks.map(matrixOf) }
        const parent = rects[0]
        const child = rects[1]
        const parentPoint = { x: parent.left + 8, y: parent.bottom - 8 }
        const childPoint = { x: child.left + child.width / 2, y: child.top + child.height / 2 }
        const parentHit = document.elementFromPoint(parentPoint.x, parentPoint.y)
        const childHit = document.elementFromPoint(childPoint.x, childPoint.y)
        const indexOf = (node) => {
          if (!node || !node.closest) return -1
          const found = node.closest('.rd-card')
          return found ? cards.indexOf(found) : -1
        }
        return {
          cards: cards.length,
          rects,
          stacks: stacks.map(matrixOf),
          opacities: stacks.map((element) => getComputedStyle(element).opacity),
          parentHit: indexOf(parentHit),
          childHit: indexOf(childHit),
          parentPointInsideChild: childPoint.x >= parent.left && childPoint.x <= parent.right && parentPoint.y >= child.top,
        }
      })
      if (state.cards < 2 || state.stacks.length < 2) {
        return { pass: false, detail: `expected 2 stacked cards, got ${state.cards}` }
      }
      const parentShift = state.stacks[0]
      const childEntrance = cardAnimations.length > 0
      const duration = childEntrance ? durationOf(cardAnimations[cardAnimations.length - 1]) : 0
      const hitOk = state.parentHit === 0 && state.childHit === 1
      const pointerOk = state.rects.every((rect) => rect.pointer === 'auto')
      const pass =
        Math.abs(Math.abs(parentShift.x) - 12) <= 1.5 &&
        Math.abs(Math.abs(parentShift.y) - 12) <= 1.5 &&
        childEntrance &&
        duration >= 160 &&
        duration <= 220 &&
        hitOk &&
        pointerOk &&
        Math.abs(Number(state.opacities[0]) - 0.96) <= 0.01
      return {
        pass,
        detail: `parentShift=(${parentShift.x.toFixed(1)},${parentShift.y.toFixed(1)}) child=${Math.round(duration)}ms hits=${state.parentHit}/${state.childHit} opacity=${state.opacities[0]} pointer=${pointerOk}`,
        data: { parentShift, childDuration: duration, hits: [state.parentHit, state.childHit], opacities: state.opacities },
      }
    })

    // Reset card/menu state before the drawer checks.
    await page.keyboard.press('Escape').catch(() => {})
    await page.mouse.move(4, 4)
    await page.waitForFunction(() => !document.querySelector('.rd-card'), { timeout: 5000 }).catch(() => {})

    // -------------------------------------------------------------- #5 M-04
    await runCheck('#5 drawer open (M-04)', async () => {
      await page.waitForFunction(() => !document.querySelector('.rd-drawer'), { timeout: 4000 }).catch(() => {})
      const closedWidth = await page.evaluate(() => document.querySelector('.rd-main').getBoundingClientRect().width)
      await startProbe()
      const samples = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const main = document.querySelector('.rd-main')
            const button = [...document.querySelectorAll('.rd-toolbar button')].find((node) =>
              /导读|Guide/.test(`${node.textContent || ''} ${node.getAttribute('aria-label') || ''}`),
            )
            if (!button || !main) {
              resolve(null)
              return
            }
            button.click()
            const widths = []
            let frames = 0
            const step = () => {
              widths.push(main.getBoundingClientRect().width)
              frames += 1
              if (frames < 14) requestAnimationFrame(step)
              else resolve(widths)
            }
            requestAnimationFrame(step)
          }),
      )
      await page.waitForSelector('.rd-drawer', { timeout: 8000 })
      await page.waitForSelector('.rd-guide-synopsis', { timeout: 8000 }).catch(() => {})
      await waitForRecords(2000)
      await sleep(220)
      const records = await completeRecords(
        await stopProbe(),
        '.rd-drawer, .rd-drawer-pane',
        (item) => hasClass(item, 'rd-drawer') || hasClass(item, 'rd-drawer-pane'),
      )
      const final = await page.evaluate(() => {
        const drawer = document.querySelector('.rd-drawer')
        if (!drawer) return null
        const main = document.querySelector('.rd-main')
        return {
          width: drawer.getBoundingClientRect().width,
          inlineWidth: parseFloat(drawer.style.width),
          mainWidth: main.getBoundingClientRect().width,
          dataMotion: drawer.dataset.motion || '',
          pane: Boolean(drawer.querySelector('.rd-drawer-pane')),
        }
      })
      const drawerAnimation = records.find(
        (item) => hasClass(item, 'rd-drawer') && propsOf(item).some((prop) => ['width', 'maxwidth', 'flexbasis'].includes(prop)),
      )
      const paneAnimation = records.find((item) => hasClass(item, 'rd-drawer-pane') && onlyOpacityTransform(item))
      if (!drawerAnimation || !final) {
        return { pass: false, detail: `drawer animation missing · records=${describeRecords(records) || 'none'}` }
      }
      const widthProps = propsOf(drawerAnimation)
      const firstFrame = (drawerAnimation.frames || [])[0] || {}
      const zeroFrame = widthProps.some((prop) => {
        if (prop === 'width' || prop === 'maxwidth') return String(firstFrame.width || firstFrame.maxWidth || '').startsWith('0')
        if (prop === 'flexbasis') return String(firstFrame.flexBasis || '').startsWith('0')
        return false
      })
      const lastFrame = (drawerAnimation.frames || [])[(drawerAnimation.frames || []).length - 1] || {}
      const finalFrameWidth = frameNumber(lastFrame, 'width')
      const dur = durationOf(drawerAnimation)
      const paneDuration = paneAnimation ? durationOf(paneAnimation) : 0
      const paneDelay = paneAnimation ? Number(paneAnimation.delay) : NaN
      const widthSamples = Array.isArray(samples) ? samples.filter((value) => Number.isFinite(value)) : []
      const distinct = [...new Set(widthSamples.map((value) => Math.round(value)))]
      const animatedMain =
        widthSamples.length >= 6 &&
        widthSamples[0] - widthSamples[widthSamples.length - 1] > 40 &&
        distinct.length >= 4 &&
        widthSamples.every((value, index) => index === 0 || value <= widthSamples[index - 1] + 0.6)
      const expectedTarget = Number.isFinite(final.inlineWidth) ? final.inlineWidth : final.width
      const pass =
        dur >= 175 &&
        dur <= 185 &&
        widthProps.some((prop) => ['width', 'maxwidth', 'flexbasis'].includes(prop)) &&
        zeroFrame &&
        Math.abs(finalFrameWidth - expectedTarget) <= 2 &&
        Math.abs(final.width - expectedTarget) <= 2 &&
        Math.abs(final.mainWidth - (closedWidth - expectedTarget)) <= 2 &&
        animatedMain &&
        final.pane &&
        (paneAnimation ? paneDuration >= 135 && paneDuration <= 145 && paneDelay >= 35 && paneDelay <= 45 : false)
      return {
        pass,
        detail: `width=${Math.round(final.width)}px target=${Math.round(expectedTarget)}px dur=${Math.round(dur)}ms props=[${widthProps.join(',')}] pane=${Math.round(paneDuration)}ms+${paneDelay}ms mainSamples=${widthSamples.length ? `${Math.round(widthSamples[0])}→${Math.round(widthSamples[widthSamples.length - 1])} (${distinct.length} steps)` : 'none'}`,
        data: {
          duration: dur,
          targetWidth: expectedTarget,
          finalWidth: final.width,
          paneDuration,
          paneDelay,
          mainSamples: widthSamples.map((value) => Math.round(value)),
          dataMotion: final.dataMotion,
        },
      }
    })

    // -------------------------------------------------------------- #6 M-04
    await runCheck('#6 drawer tab switch (M-04)', async () => {
      const before = await page.evaluate(() => ({
        width: document.querySelector('.rd-drawer')?.getBoundingClientRect().width || 0,
        tab: document.querySelector('.rd-drawer-head')?.textContent || '',
      }))
      await startProbe()
      const switched = await clickAny('.rd-toolbar button', ['目录', 'Contents'])
      if (!switched) {
        await stopProbe()
        return { pass: false, detail: 'toc tab missing' }
      }
      await sleep(320)
      const records = await completeRecords(
        await stopProbe(),
        '.rd-drawer-pane',
        (item) => hasClass(item, 'rd-drawer-pane') && onlyOpacityTransform(item),
      )
      const widthAnimations = records.filter((item) =>
        propsOf(item).some((prop) => ['width', 'flexbasis', 'maxwidth'].includes(prop)),
      )
      const drawerAnimations = records.filter(
        (item) => hasClass(item, 'rd-drawer') && propsOf(item).some((prop) => ['width', 'maxwidth', 'flexbasis'].includes(prop)),
      )
      const paneAnimations = records.filter((item) => hasClass(item, 'rd-drawer-pane') && onlyOpacityTransform(item))
      const after = await page.evaluate(() => ({
        width: document.querySelector('.rd-drawer')?.getBoundingClientRect().width || 0,
        tab: document.querySelector('.rd-drawer-head')?.textContent || '',
        rows: document.querySelectorAll('.rd-drawer-body .rd-drawer-item').length,
      }))
      const paneAnimation = paneAnimations[paneAnimations.length - 1]
      const paneDuration = paneAnimation ? durationOf(paneAnimation) : 0
      const paneDelay = paneAnimation ? Number(paneAnimation.delay) : NaN
      const pass =
        widthAnimations.length === 0 &&
        drawerAnimations.length === 0 &&
        paneAnimations.length >= 1 &&
        paneDuration >= 135 &&
        paneDuration <= 145 &&
        paneDelay >= 35 &&
        paneDelay <= 45 &&
        Math.abs(after.width - before.width) <= 1 &&
        after.rows > 0
      return {
        pass,
        detail: `widthAnims=${widthAnimations.length} drawerAnims=${drawerAnimations.length} pane=${Math.round(paneDuration)}ms+${paneDelay}ms width ${Math.round(before.width)}→${Math.round(after.width)} rows=${after.rows}`,
        data: { widthAnimations: widthAnimations.length, paneDuration, paneDelay, widthBefore: before.width, widthAfter: after.width },
      }
    })

    // -------------------------------------------------------------- #7 M-04
    await runCheck('#7 drawer scroll memory (M-04)', async () => {
      await page.setViewport({ width: 1280, height: 300, deviceScaleFactor: 1 })
      await sleep(320)
      const readBody = () =>
        page.evaluate(() => {
          const body = document.querySelector('.rd-drawer-body')
          return body ? { scrollTop: body.scrollTop, scrollHeight: body.scrollHeight, clientHeight: body.clientHeight } : null
        })
      const setScroll = async (top) => {
        const value = await page.evaluate((target) => {
          const body = document.querySelector('.rd-drawer-body')
          if (!body) return null
          body.scrollTop = target
          return body.scrollTop
        }, top)
        await sleep(140)
        return value
      }
      // The drawer currently shows the table of contents (#6): switch to the
      // guide list, scroll it, and check that tab switches restore per-tab offsets.
      await clickAny('.rd-toolbar button', ['导读', 'Guide'])
      await sleep(380)
      const guideInfo = await readBody()
      const guideSaved = await setScroll(120)
      await clickAny('.rd-toolbar button', ['目录', 'Contents'])
      await sleep(380)
      const tocInfo = await readBody()
      const tocSaved = await setScroll(50)
      await clickAny('.rd-toolbar button', ['导读', 'Guide'])
      await sleep(380)
      const guideAfter = await readBody()
      await clickAny('.rd-toolbar button', ['目录', 'Contents'])
      await sleep(380)
      const tocAfter = await readBody()
      // Close and reopen: the drawer must come back at the remembered offset.
      await closeDrawer()
      await sleep(260)
      const reopenSeries = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const button = [...document.querySelectorAll('.rd-toolbar button')].find((node) =>
              /导读|Guide/.test(`${node.textContent || ''} ${node.getAttribute('aria-label') || ''}`),
            )
            if (!button) {
              resolve([])
              return
            }
            button.click()
            const samples = []
            const start = performance.now()
            const step = () => {
              const body = document.querySelector('.rd-drawer-body')
              const drawer = document.querySelector('.rd-drawer')
              samples.push({
                at: Math.round(performance.now() - start),
                scrollTop: body ? Math.round(body.scrollTop) : -1,
                scrollHeight: body ? body.scrollHeight : -1,
                clientHeight: body ? body.clientHeight : -1,
                width: drawer ? Math.round(drawer.getBoundingClientRect().width) : -1,
              })
              if (performance.now() - start < 340) requestAnimationFrame(step)
              else resolve(samples)
            }
            requestAnimationFrame(step)
          }),
      )
      await sleep(420)
      const guideReopened = await readBody()
      await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 })
      await sleep(280)
      const reopenTrace = (() => {
        const trace = []
        let previous = null
        for (const sample of reopenSeries) {
          const key = `${sample.scrollTop}/${sample.scrollHeight}@w${sample.width}`
          if (key === previous) continue
          previous = key
          trace.push(`${sample.at}ms:${key}`)
        }
        return trace.slice(0, 8).join(' ')
      })()
      const guideScrollable = Boolean(guideInfo && guideInfo.scrollHeight > guideInfo.clientHeight + 10)
      const tocScrollable = Boolean(tocInfo && tocInfo.scrollHeight > tocInfo.clientHeight + 10)
      const pass =
        guideScrollable &&
        Number.isFinite(guideSaved) &&
        guideSaved > 20 &&
        Math.abs((guideAfter && guideAfter.scrollTop) - guideSaved) <= 4 &&
        Math.abs((guideReopened && guideReopened.scrollTop) - guideSaved) <= 4 &&
        (!tocScrollable || Math.abs((tocAfter && tocAfter.scrollTop) - tocSaved) <= 4)
      return {
        pass,
        detail: `guide ${guideSaved}→${guideAfter && guideAfter.scrollTop} reopen=${guideReopened && guideReopened.scrollTop} toc ${tocSaved}→${tocAfter && tocAfter.scrollTop} scrollable=${guideScrollable}/${tocScrollable} reopenTrace=${reopenTrace}`,
        data: {
          guideSaved,
          guideAfter: guideAfter && guideAfter.scrollTop,
          guideReopened: guideReopened && guideReopened.scrollTop,
          tocSaved,
          tocAfter: tocAfter && tocAfter.scrollTop,
          guideScrollable,
          tocScrollable,
          reopenSeries,
        },
      }
    })

    // Close the guide drawer before opening the chat drawer.
    await closeDrawer()
    await page.waitForFunction(() => !document.querySelector('.rd-drawer'), { timeout: 4000 }).catch(() => {})

    // -------------------------------------------------------------- #8 M-05
    await runCheck('#8 chat new row (M-05)', async () => {
      const opened = await clickAny('.rd-toolbar button', ['对话', 'Chat'])
      if (!opened) return { pass: false, detail: 'chat tab missing' }
      await page.waitForSelector('.rd-chat', { timeout: 8000 })
      await sleep(360)
      const before = await page.evaluate(() => ({
        rows: document.querySelectorAll('.rd-chat-row').length,
        animated: document.querySelectorAll('.rd-chat-row[data-motion="in"]').length,
      }))
      await startProbe()
      await page.evaluate(() => window.__chatPush(1))
      await page.waitForFunction(
        () => document.querySelectorAll('.rd-chat-row[data-motion="in"]').length === 1,
        { timeout: 6000 },
      )
      await waitForRecords(2000)
      await sleep(220)
      const records = await completeRecords(
        await stopProbe(),
        '.rd-chat-row[data-motion="in"]',
        (item) => hasClass(item, 'rd-chat-row') && onlyOpacityTransform(item),
      )
      const rowAnimations = records.filter((item) => hasClass(item, 'rd-chat-row') && onlyOpacityTransform(item))
      const afterPush = await page.evaluate(() => ({
        rows: document.querySelectorAll('.rd-chat-row').length,
        animated: document.querySelectorAll('.rd-chat-row[data-motion="in"]').length,
        role: document.querySelector('.rd-chat-row[data-motion="in"]')?.dataset.role || '',
      }))
      if (rowAnimations.length === 0) {
        return { pass: false, detail: `no row animation (rows ${before.rows}→${afterPush.rows}) · records=${describeRecords(records) || 'none'}` }
      }
      const animation = rowAnimations[rowAnimations.length - 1]
      const duration = durationOf(animation)

      // Same-key re-render (the streaming-token shape): flip phase + process
      // detail, then verify the already-entered row neither remounts nor replays.
      const beforeToken = await page.evaluate(() => {
        const row = document.querySelector('.rd-chat-row[data-motion="in"]')
        window.__motionRow = row
        if (!row) return null
        return {
          animations: row.getAnimations().map((item) => ({ state: item.playState, startTime: item.startTime })),
        }
      })
      await startProbe()
      // Flip the composer phase: the panel re-renders with the exact same row
      // keys/rows (the streaming-token shape) without adding transcript rows.
      await page.evaluate(() => {
        if (typeof window.__setPhase === 'function') window.__setPhase('running')
      })
      await sleep(140)
      await page.evaluate(() => {
        if (typeof window.__setPhase === 'function') window.__setPhase('plain')
      })
      await sleep(180)
      const replayRecords = await stopProbe()
      const afterToken = await page.evaluate(() => {
        const row = window.__motionRow
        return {
          sameNode: Boolean(row && row.isConnected),
          animations: row ? row.getAnimations().map((item) => ({ state: item.playState, startTime: item.startTime })) : [],
          animated: document.querySelectorAll('.rd-chat-row[data-motion="in"]').length,
        }
      })
      const replays = replayRecords.filter((item) => hasClass(item, 'rd-chat-row') && onlyOpacityTransform(item)).length
      const startTimes = (beforeToken && beforeToken.animations) || []
      const stableStart = startTimes.length > 0 && afterToken.animations.length === startTimes.length && startTimes.every((item, index) => item.startTime === afterToken.animations[index].startTime)
      const pass =
        before.animated === 0 &&
        afterPush.rows === before.rows + 1 &&
        afterPush.animated === 1 &&
        duration >= 85 &&
        duration <= 95 &&
        onlyOpacityTransform(animation) &&
        replays === 0 &&
        afterToken.sameNode &&
        stableStart &&
        afterToken.animated === 1
      return {
        pass,
        detail: `newRow=${Math.round(duration)}ms rows ${before.rows}→${afterPush.rows} animated=${afterPush.animated} replays=${replays} sameNode=${afterToken.sameNode} startStable=${stableStart}`,
        data: {
          duration,
          rowsBefore: before.rows,
          rowsAfter: afterPush.rows,
          initialAnimated: before.animated,
          replays,
          sameNode: afterToken.sameNode,
          startTimes,
          animationsAfter: afterToken.animations,
        },
      }
    })

    await closeDrawer()
    await page.waitForFunction(() => !document.querySelector('.rd-drawer'), { timeout: 4000 }).catch(() => {})

    // --------------------------------------------------------- #9/#10 M-06
    let mapRecords = []
    await runCheck('#9 mindmap nodes (M-06)', async () => {
      await clickAny('.rd-toolbar button', ['导读', 'Guide'])
      await page.waitForSelector('.rd-guide-synopsis', { timeout: 8000 })
      await sleep(320)
      await startProbe()
      const opened = await clickAny('.rd-drawer button', ['导图', 'Mindmap'])
      if (!opened) {
        await stopProbe()
        return { pass: false, detail: 'mindmap button missing' }
      }
      await page.waitForSelector('.rdm-node-enter', { timeout: 8000 })
      await waitForRecords(2000)
      await sleep(480)
      mapRecords = await completeRecords(
        await stopProbe(),
        '.rdm-node-enter, .rdm-edge-enter',
        (item) => hasClass(item, 'rdm-node-enter'),
      )
      const nodeAnimations = mapRecords.filter((item) => hasClass(item, 'rdm-node-enter') && onlyOpacityTransform(item))
      const edgeAnimations = mapRecords.filter((item) => hasClass(item, 'rdm-edge-enter'))
      const nodeCount = await page.$$eval('.rdm-node-enter', (nodes) => nodes.length)
      if (nodeAnimations.length === 0) {
        return { pass: false, detail: `no node animation · records=${describeRecords(mapRecords) || 'none'}` }
      }
      const durations = nodeAnimations.map(durationOf)
      const delays = nodeAnimations.map((item) => Number(item.delay) || 0)
      const endTimes = nodeAnimations.map((item) => Number(item.endTime) || 0)
      const maxDelay = Math.max(...delays)
      const maxEnd = Math.max(...endTimes)
      const durationOk = durations.every((value) => value >= 160 && value <= 220)
      const propsOk = nodeAnimations.every(onlyOpacityTransform)
      const staggerOk = new Set(delays).size >= 2 && delays.every((value) => value >= 0)

      const measure = () =>
        page.evaluate(() => {
          const canvas = document.querySelector('.rd-map-canvas')
          const offsets = [...document.querySelectorAll('[data-node-id]')].map((node) => {
            const rect = node.getBoundingClientRect()
            return {
              id: node.getAttribute('data-node-id'),
              transform: node.getAttribute('transform') || '',
              x: canvas ? rect.left - canvas.getBoundingClientRect().left : rect.left,
              y: canvas ? rect.top - canvas.getBoundingClientRect().top : rect.top,
              width: rect.width,
              height: rect.height,
            }
          })
          return offsets
        })
      const beforeCancel = await measure()
      await page.evaluate(() => {
        for (const node of document.querySelectorAll('.rdm-node-enter')) {
          for (const animation of node.getAnimations()) {
            if (String(animation.animationName || '').startsWith('rdm-node')) animation.cancel()
          }
        }
      })
      await nextFrames(2)
      const afterCancel = await measure()
      const stable =
        beforeCancel.length >= 2 &&
        beforeCancel.length === afterCancel.length &&
        beforeCancel.every((item, index) => {
          const next = afterCancel[index]
          return (
            item.id === next.id &&
            Math.abs(item.x - next.x) <= 1 &&
            Math.abs(item.y - next.y) <= 1 &&
            Math.abs(item.width - next.width) <= 1 &&
            Math.abs(item.height - next.height) <= 1 &&
            item.transform === next.transform
          )
        })
      const transformsOk = beforeCancel.every((item) => /^translate\(\s*-?\d/.test(item.transform))
      const pass =
        nodeCount >= 2 &&
        nodeAnimations.length === nodeCount &&
        durationOk &&
        propsOk &&
        staggerOk &&
        maxDelay <= 140 &&
        maxEnd <= 320 &&
        stable &&
        transformsOk
      return {
        pass,
        detail: `nodes=${nodeCount} anim=${nodeAnimations.length} dur=${durations.map((value) => Math.round(value)).join('/')}ms delays=${delays.join('/')}ms maxEnd=${Math.round(maxEnd)}ms stable=${stable} transforms=${transformsOk}`,
        data: { nodeCount, durations, delays, maxDelay, maxEnd, stable, transformsOk, edgeAnimations: edgeAnimations.length },
      }
    })

    await runCheck('#10 mindmap edges (M-06)', async () => {
      const edgeAnimations = mapRecords.filter((item) => hasClass(item, 'rdm-edge-enter') && propsOf(item).includes('strokedashoffset'))
      const edgeCount = await page.$$eval('.rdm-edge-enter', (nodes) => nodes.length)
      const finalEdges = await page.evaluate(() => {
        return [...document.querySelectorAll('.rdm-edge-enter')].map((node) => ({
          dashoffset: getComputedStyle(node).strokeDashoffset,
          dasharray: getComputedStyle(node).strokeDasharray,
          pathLength: node.getAttribute('pathLength'),
        }))
      })
      if (edgeAnimations.length === 0) {
        return { pass: false, detail: `no edge animation · records=${describeRecords(mapRecords) || 'none'}` }
      }
      const durations = edgeAnimations.map(durationOf)
      const delays = edgeAnimations.map((item) => Number(item.delay) || 0)
      const endTimes = edgeAnimations.map((item) => Number(item.endTime) || 0)
      const maxEnd = Math.max(...endTimes)
      const framesOk = edgeAnimations.every((item) => {
        const props = propsOf(item)
        const frames = item.frames || []
        const last = frames[frames.length - 1] || {}
        return props.some((prop) => prop === 'strokedashoffset') && Math.abs(frameNumber(last, 'strokeDashoffset')) <= 0.01
      })
      const durationOk = durations.every((value) => value >= 235 && value <= 245)
      const delayOk = delays.every((value) => value <= 80)
      const finalOk = finalEdges.length >= 1 && finalEdges.every((edge) => Math.abs(parseFloat(edge.dashoffset) || 0) <= 0.5)
      const pass = edgeCount >= 1 && edgeAnimations.length === edgeCount && framesOk && durationOk && delayOk && maxEnd <= 320 && finalOk
      return {
        pass,
        detail: `edges=${edgeCount} anim=${edgeAnimations.length} dur=${durations.map((value) => Math.round(value)).join('/')}ms delays=${delays.join('/')}ms maxEnd=${Math.round(maxEnd)}ms finalDashoffset=${finalEdges.map((edge) => edge.dashoffset).join(',')}`,
        data: { edgeCount, durations, delays, maxEnd, finalEdges },
      }
    })

    // ------------------------------------------------- #16 fullscreen map
    // Regression guard: the drawer pane's entrance animation leaves a transform
    // behind, and a transformed ancestor becomes the containing block of
    // position:fixed descendants, which used to crush the fullscreen map into
    // the drawer. Fullscreen must render outside the drawer.
    await runCheck('#16 fullscreen mindmap escapes the drawer pane', async () => {
      const beforeOpen = await page.evaluate(() => {
        const stage = document.querySelector('.rd-map-stage')
        const drawer = document.querySelector('.rd-drawer')
        if (!stage || !drawer) return null
        const rect = stage.getBoundingClientRect()
        return {
          inDrawer: drawer.contains(stage),
          width: Math.round(rect.width),
          zoom: document.querySelector('.rd-map-zoom') ? document.querySelector('.rd-map-zoom').textContent.trim() : '',
        }
      })
      if (!beforeOpen) return { pass: false, detail: 'map stage or drawer missing' }
      const clicked = await clickAny('.rd-map-toolbar button', ['全屏', 'Fullscreen'])
      if (!clicked) return { pass: false, detail: 'fullscreen button missing' }
      await sleep(380)
      const fullscreen = await page.evaluate(() => {
        const stage = document.querySelector('.rd-map-stage')
        const drawer = document.querySelector('.rd-drawer')
        if (!stage) return null
        const rect = stage.getBoundingClientRect()
        let transformedAncestor = null
        let node = stage.parentElement
        while (node && node !== document.documentElement) {
          const style = getComputedStyle(node)
          if (style.transform !== 'none' || style.filter !== 'none' || style.perspective !== 'none') {
            transformedAncestor = String(node.className || '?').slice(0, 48)
            break
          }
          node = node.parentElement
        }
        const drawerText = drawer ? drawer.textContent || '' : ''
        return {
          covers:
            Math.round(rect.left) === 0 &&
            Math.round(rect.top) === 0 &&
            Math.round(rect.width) === window.innerWidth &&
            Math.round(rect.height) === window.innerHeight,
          rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) },
          viewport: { w: window.innerWidth, h: window.innerHeight },
          inDrawer: Boolean(drawer && drawer.contains(stage)),
          transformedAncestor,
          zoom: document.querySelector('.rd-map-zoom') ? document.querySelector('.rd-map-zoom').textContent.trim() : '',
          listFallback: /第[一二]部分/.test(drawerText),
        }
      })
      if (!fullscreen) return { pass: false, detail: 'stage disappeared in fullscreen' }
      await page.keyboard.press('Escape')
      await sleep(340)
      const exited = await page.evaluate(() => {
        const stage = document.querySelector('.rd-map-stage')
        const drawer = document.querySelector('.rd-drawer')
        if (!stage || !drawer) return null
        return {
          inDrawer: drawer.contains(stage),
          fullscreen: stage.classList.contains('rd-map-stage-fullscreen'),
          width: Math.round(stage.getBoundingClientRect().width),
        }
      })
      const pass =
        beforeOpen.inDrawer &&
        beforeOpen.width < fullscreen.viewport.w &&
        fullscreen.covers &&
        !fullscreen.inDrawer &&
        !fullscreen.transformedAncestor &&
        !fullscreen.listFallback &&
        Boolean(exited) &&
        exited.inDrawer &&
        !exited.fullscreen
      return {
        pass,
        detail: `covers=${fullscreen.covers} rect=${fullscreen.rect.w}x${fullscreen.rect.h}/${fullscreen.viewport.w}x${fullscreen.viewport.h} inDrawer=${fullscreen.inDrawer} badAncestor=${fullscreen.transformedAncestor || 'none'} zoom=${beforeOpen.zoom}->${fullscreen.zoom} escaped=${Boolean(exited) && exited.inDrawer && !exited.fullscreen}`,
        data: { beforeOpen, fullscreen, exited },
      }
    })

    await closeDrawer()
    await page.waitForFunction(() => !document.querySelector('.rd-drawer'), { timeout: 4000 }).catch(() => {})

    // ------------------------------------------------------------- #11 M-07
    await runCheck('#11 jump ring (M-07)', async () => {
      await page.evaluate(() => {
        const main = document.querySelector('.rd-main')
        if (main) main.style.scrollBehavior = 'auto'
      })
      await page.keyboard.down('Meta')
      await page.keyboard.press('f')
      await page.keyboard.up('Meta')
      await page.waitForSelector('.rd-search input', { timeout: 8000 })
      await page.type('.rd-search input', '一致性')
      await page.keyboard.press('Enter')
      await page.waitForFunction(() => document.querySelectorAll('.rd-search .rd-drawer-item').length > 0, { timeout: 8000 })

      const snapshotFor = (index) =>
        page.evaluate((itemIndex) => {
          const items = [...document.querySelectorAll('.rd-search .rd-drawer-item')]
          const item = items[itemIndex]
          if (!item) return { clicked: false }
          item.click()
          const rings = [...document.querySelectorAll('.rd-jump-ring')]
          const ring = rings[rings.length - 1]
          const prose = document.querySelector('.rd-prose')
          let expected = null
          if (prose) {
            const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT)
            const textNodes = []
            while (walker.nextNode()) textNodes.push(walker.currentNode)
            const full = textNodes.map((node) => node.nodeValue || '').join('')
            const index = full.indexOf('一致性')
            if (index >= 0) {
              let offset = 0
              for (const node of textNodes) {
                const length = (node.nodeValue || '').length
                if (index >= offset && index + 3 <= offset + length) {
                  const range = document.createRange()
                  range.setStart(node, index - offset)
                  range.setEnd(node, index - offset + 3)
                  const rect = range.getBoundingClientRect()
                  expected = { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
                  break
                }
                offset += length
              }
            }
          }
          if (!ring) return { clicked: true, count: rings.length, ring: null, expected }
          const style = getComputedStyle(ring)
          return {
            clicked: true,
            count: rings.length,
            expected,
            ring: {
              className: ring.className,
              pointerEvents: style.pointerEvents,
              animationName: style.animationName,
              animationDuration: style.animationDuration,
              zIndex: style.zIndex,
              borderWidth: style.borderTopWidth,
              style: {
                left: parseFloat(ring.style.left),
                top: parseFloat(ring.style.top),
                width: parseFloat(ring.style.width),
                height: parseFloat(ring.style.height),
              },
              animations: ring.getAnimations().map((animation) => {
                const timing = animation.effect && animation.effect.getComputedTiming ? animation.effect.getComputedTiming() : null
                return { name: animation.animationName || '', state: animation.playState, duration: timing ? timing.duration : null }
              }),
            },
          }
        }, index)

      const first = await snapshotFor(0)
      await sleep(80)
      const second = await snapshotFor(1)
      const third = await snapshotFor(0)
      const t0 = Date.now()
      await page.waitForFunction(() => !document.querySelector('.rd-jump-ring'), { timeout: 2000 }).catch(() => {})
      const removalMs = Date.now() - t0
      const final = third.ring
      if (!first.ring || !second.ring || !third.ring || !final) {
        return { pass: false, detail: `ring missing (counts ${first.count}/${second.count}/${third.count})` }
      }
      const positionOk =
        first.expected &&
        Math.abs(final.style.left - (first.expected.left - 4)) <= 2 &&
        Math.abs(final.style.top - (first.expected.top - 4)) <= 2 &&
        Math.abs(final.style.width - (first.expected.width + 8)) <= 2 &&
        Math.abs(final.style.height - (first.expected.height + 8)) <= 2
      const animation = final.animations.find((item) => item.name === 'rd-ring-out')
      const pass =
        first.count === 1 &&
        second.count === 1 &&
        third.count === 1 &&
        final.pointerEvents === 'none' &&
        final.animationName === 'rd-ring-out' &&
        final.animationDuration === '0.7s' &&
        final.borderWidth === '2px' &&
        Boolean(animation) &&
        Math.round(animation.duration) === 700 &&
        positionOk &&
        removalMs <= 900
      const ringLeft = await page.evaluate(() => document.querySelectorAll('.rd-jump-ring').length)
      return {
        pass: pass && ringLeft === 0,
        detail: `counts=1/1/1 posErr=${positionOk ? '<2px' : 'bad'} pe=${final.pointerEvents} anim=${final.animationName} ${final.animationDuration} removed=${removalMs}ms z=${final.zIndex}`,
        data: { expected: first.expected, style: final.style, removalMs, animation, css: { animationName: final.animationName, animationDuration: final.animationDuration, borderWidth: final.borderWidth, pointerEvents: final.pointerEvents } },
      }
    })

    await page.keyboard.press('Escape').catch(() => {})
    await sleep(150)

    // ------------------------------------------------------------- #14 M-08
    await runCheck('#14 press feedback (M-08)', async () => {
      const target = await page.evaluate(() => {
        const button = [...document.querySelectorAll('.rd-toolbar .rd-btn')].find((node) =>
          /导读|Guide/.test(`${node.textContent || ''} ${node.getAttribute('aria-label') || ''}`),
        )
        if (!button) return null
        const rect = button.getBoundingClientRect()
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
          layout: {
            offsetWidth: button.offsetWidth,
            offsetHeight: button.offsetHeight,
            offsetLeft: button.offsetLeft,
            offsetTop: button.offsetTop,
          },
          transitionDuration: getComputedStyle(button).transitionDuration,
          transitionProperty: getComputedStyle(button).transitionProperty,
          siblings: [...document.querySelectorAll('.rd-toolbar .rd-btn')].map((node) => {
            const siblingRect = node.getBoundingClientRect()
            return { left: siblingRect.left, top: siblingRect.top, width: siblingRect.width }
          }),
        }
      })
      if (!target) return { pass: false, detail: 'toolbar button missing' }
      await page.mouse.move(target.x, target.y)
      await page.mouse.down()
      await sleep(150)
      const pressed = await page.evaluate(() => {
        const button = [...document.querySelectorAll('.rd-toolbar .rd-btn')].find((node) =>
          /导读|Guide/.test(`${node.textContent || ''} ${node.getAttribute('aria-label') || ''}`),
        )
        if (!button) return null
        const transform = getComputedStyle(button).transform
        const matrix = transform.match(/matrix\(([^)]+)\)/)
        const parts = matrix ? matrix[1].split(',').map((value) => parseFloat(value)) : []
        return {
          scaleX: parts[0],
          scaleY: parts[3],
          transform,
          layout: {
            offsetWidth: button.offsetWidth,
            offsetHeight: button.offsetHeight,
            offsetLeft: button.offsetLeft,
            offsetTop: button.offsetTop,
          },
          transitionDuration: getComputedStyle(button).transitionDuration,
          siblings: [...document.querySelectorAll('.rd-toolbar .rd-btn')].map((node) => {
            const siblingRect = node.getBoundingClientRect()
            return { left: siblingRect.left, top: siblingRect.top, width: siblingRect.width }
          }),
        }
      })
      await page.mouse.move(4, 4)
      await page.mouse.up()
      await sleep(120)
      if (!pressed) return { pass: false, detail: 'toolbar button vanished' }
      const layoutSame =
        pressed.layout.offsetWidth === target.layout.offsetWidth &&
        pressed.layout.offsetHeight === target.layout.offsetHeight &&
        pressed.layout.offsetLeft === target.layout.offsetLeft &&
        pressed.layout.offsetTop === target.layout.offsetTop
      const siblingSame = pressed.siblings.length === target.siblings.length &&
        pressed.siblings.every((item, index) => {
          const beforeSibling = target.siblings[index]
          return Math.abs(item.left - beforeSibling.left) <= 1 && Math.abs(item.top - beforeSibling.top) <= 1 && Math.abs(item.width - beforeSibling.width) <= 1
        })
      const transitionOk = target.transitionDuration.split(',').every((value) => value.trim() === '0.09s') && /transform/.test(target.transitionProperty)
      const pass =
        Math.abs(pressed.scaleX - 0.98) <= 0.005 &&
        Math.abs(pressed.scaleY - 0.98) <= 0.005 &&
        layoutSame &&
        siblingSame &&
        transitionOk
      return {
        pass,
        detail: `scale=${pressed.scaleX} layoutSame=${layoutSame} siblingsSame=${siblingSame} transition=${target.transitionDuration}`,
        data: { scale: pressed.scaleX, layoutSame, siblingSame, transitionDuration: target.transitionDuration },
      }
    })

    // ------------------------------------------- #12/#13 reduced motion
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.reload({ waitUntil: 'networkidle2', timeout: 45000 })
    await page.waitForFunction('window.__visualReady === true || window.__bootError', { timeout: 30000 })
    const reducedBootError = await page.evaluate(() => window.__bootError || null)
    if (reducedBootError) throw new Error(`harness boot failed under reduced motion: ${reducedBootError}`)
    await page.mouse.move(4, 4)
    await sleep(900)
    const reducedHasProse = await page.$('.rd-prose')
    if (!reducedHasProse) {
      await page.waitForSelector('.rd-library', { timeout: 15000 })
      await openBook()
    }
    await page.evaluate(() => {
      const main = document.querySelector('.rd-main')
      if (main) main.style.scrollBehavior = 'auto'
    })

    await runCheck('#12 reduced motion (M-12/P0)', async () => {
      // The restored saved view may reopen a drawer; start from the reading
      // surface so the menu → card → drawer path is exercised deterministically.
      if (await page.$('.rd-drawer')) await closeDrawer()
      const selected = await selectNeedle('线性一致性', 0.55)
      if (selected !== true) return { pass: false, detail: `selection failed (${selected})` }
      await page.waitForSelector('.rd-mini', { timeout: 5000 })
      await clickAny('.rd-mini button', ['解释', 'Explain'])
      await page.waitForSelector('.rd-card', { timeout: 8000 })
      await page.waitForSelector('.rd-card .rd-def', { timeout: 8000 }).catch(() => {})
      await page.keyboard.press('Escape')
      await sleep(200)
      await clickAny('.rd-toolbar button', ['导读', 'Guide'])
      await page.waitForSelector('.rd-drawer', { timeout: 5000 })
      // The saved view may restore straight into the map tab; accept either
      // guide surface, then make sure the map is exercised if it is not open.
      await page
        .waitForFunction(
          () => Boolean(document.querySelector('.rd-guide-synopsis') || document.querySelector('.rd-map-scroll')),
          { timeout: 6000 },
        )
        .catch(() => {})
      const diagnostics = await page.evaluate(() => ({
        drawer: Boolean(document.querySelector('.rd-drawer')),
        synopsis: Boolean(document.querySelector('.rd-guide-synopsis')),
        map: Boolean(document.querySelector('.rd-map-scroll')),
        guideBody: (document.querySelector('.rd-drawer-body')?.textContent || '').slice(0, 60),
      }))
      if (!diagnostics.map) await clickAny('.rd-drawer button', ['导图', 'Mindmap'])
      await page
        .waitForFunction(
          () => document.querySelectorAll('.rdm-node-enter').length > 0 || document.querySelectorAll('[data-node-id]').length > 0,
          { timeout: 6000 },
        )
        .catch(() => {})
      await sleep(320)
      const audit = await page.evaluate(() => {
        const root = document.querySelector('.rd-root')
        const animations = document.getAnimations().filter((animation) => {
          const target = animation.effect && animation.effect.target
          return Boolean(target && root && (target === root || root.contains(target)))
        })
        const describeTarget = (target) => {
          if (!target || !target.tagName) return ''
          const cls = typeof target.className === 'string' ? target.className : target.getAttribute && target.getAttribute('class')
          return `${target.tagName.toLowerCase()}.${String(cls || '').split(/\s+/).filter(Boolean).join('.')}`
        }
        const button = document.querySelector('.rd-btn') || document.querySelector('.rd-drawer button')
        return {
          animations: animations.map((animation) => {
            const timing = animation.effect && animation.effect.getComputedTiming ? animation.effect.getComputedTiming() : null
            return {
              name: animation.animationName || animation.transitionProperty || '',
              state: animation.playState,
              target: describeTarget(animation.effect && animation.effect.target),
              duration: timing ? timing.duration : null,
            }
          }),
          transitionDuration: button ? getComputedStyle(button).transitionDuration : 'n/a',
          animatedMarks: document.querySelectorAll('[data-motion]').length,
          nodes: document.querySelectorAll('.rdm-node-enter').length,
          cardClosed: !document.querySelector('.rd-card'),
          menuClosed: !document.querySelector('.rd-mini'),
          mapOpen: Boolean(document.querySelector('.rd-map-scroll')),
        }
      })
      const transitionsZero =
        audit.transitionDuration === 'n/a' ||
        audit.transitionDuration.split(',').every((value) => value.trim() === '0s')
      const pass = audit.animations.length === 0 && transitionsZero && diagnostics.drawer
      return {
        pass,
        detail: `animations=${audit.animations.length} transitionDuration=${audit.transitionDuration} dataMotion=${audit.animatedMarks} mapNodes=${audit.nodes} surfaces=${[diagnostics.synopsis && 'synopsis', audit.mapOpen && 'map', audit.cardClosed && 'card-closed'].filter(Boolean).join('+')}`,
        data: { ...audit, diagnostics },
      }
    })

    await runCheck('#13 reduced jump ring (M-07)', async () => {
      await closeDrawer()
      await page.waitForFunction(() => !document.querySelector('.rd-drawer'), { timeout: 5000 }).catch(() => {})
      const searchOpen = await page.evaluate(() => Boolean(document.querySelector('.rd-search')))
      if (searchOpen) await page.keyboard.press('Escape')
      await page.keyboard.down('Meta')
      await page.keyboard.press('f')
      await page.keyboard.up('Meta')
      await page.waitForSelector('.rd-search input', { timeout: 8000 })
      await page.type('.rd-search input', '一致性')
      await page.keyboard.press('Enter')
      await page.waitForFunction(() => document.querySelectorAll('.rd-search .rd-drawer-item').length > 0, { timeout: 8000 })
      const snapshot = await page.evaluate(() => {
        const item = document.querySelector('.rd-search .rd-drawer-item')
        if (!item) return { clicked: false }
        const t0 = performance.now()
        item.click()
        const ring = document.querySelector('.rd-jump-ring')
        if (!ring) return { clicked: true, present: false }
        const style = getComputedStyle(ring)
        return {
          clicked: true,
          present: true,
          className: ring.className,
          animationName: style.animationName,
          borderWidth: style.borderTopWidth,
          borderStyle: style.borderTopStyle,
          pointerEvents: style.pointerEvents,
          animationCount: ring.getAnimations().length,
          at: t0,
        }
      })
      if (!snapshot.present) return { pass: false, detail: 'static jump ring did not appear' }
      const removalStart = Date.now()
      await page.waitForFunction(() => !document.querySelector('.rd-jump-ring'), { timeout: 1500 }).catch(() => {})
      const removalMs = Date.now() - removalStart
      const pass =
        /rd-jump-ring/.test(snapshot.className) &&
        /rd-jump-ring-static/.test(snapshot.className) &&
        snapshot.animationName === 'none' &&
        snapshot.animationCount === 0 &&
        snapshot.borderWidth === '2px' &&
        snapshot.pointerEvents === 'none' &&
        removalMs >= 250 &&
        removalMs <= 900
      return {
        pass,
        detail: `static=${/rd-jump-ring-static/.test(snapshot.className)} animations=${snapshot.animationCount} border=${snapshot.borderWidth} removed=${removalMs}ms`,
        data: { snapshot, removalMs },
      }
    })

    // ------------------------------------------------------------- #15
    await runCheck('#15 no side effects', async () => {
      const audit = await page.evaluate(() => {
        const texts = []
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            for (const rule of Array.from(sheet.cssRules || [])) texts.push(rule.cssText)
          } catch (error) {
            /* cross-origin sheet: irrelevant for the plugin bundle */
          }
        }
        for (const node of Array.from(document.querySelectorAll('style'))) texts.push(node.textContent || '')
        const joined = texts.join('\n')
        const matches = joined.match(/transition\s*:\s*all\b[^;}]*/gi) || []
        return { sheetCount: texts.length, cssLength: joined.length, matches }
      })
      const errors = consoleErrors.slice()
      const pass = audit.matches.length === 0 && errors.length === 0
      return {
        pass,
        detail: `transitionAll=${audit.matches.length} consoleErrors=${errors.length} cssSheets=${audit.sheetCount}`,
        data: { transitionAll: audit.matches, consoleErrors: errors },
      }
    })
  } catch (error) {
    record('motion run', false, `error: ${error && error.message ? error.message : String(error)}`)
  } finally {
    clearTimeout(guard)
    await browser.close().catch(() => {})
    server.closeAllConnections?.()
    await new Promise((resolve) => server.close(resolve))
  }

  const failed = results.filter((item) => !item.pass)
  const durationMs = Date.now() - startedAt
  const checkNumber = (item) => {
    const match = String(item.name).match(/#(\d+)/)
    return match ? Number(match[1]) : 99
  }
  const ordered = results.slice().sort((left, right) => checkNumber(left) - checkNumber(right))
  const report = {
    at: new Date().toISOString(),
    pipeline: 'motion pipeline (PRD v0.14 §9.2)',
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    durationMs,
    budgetMs: RUN_BUDGET_MS,
    withinBudget: durationMs <= RUN_BUDGET_MS,
    checks: ordered,
  }
  await fs.writeFile(path.join(root, 'eval', 'motion-report.json'), JSON.stringify(report, null, 2))
  console.log(`\n${report.passed}/${report.total} motion checks passed in ${(durationMs / 1000).toFixed(1)}s`)
  if (durationMs > RUN_BUDGET_MS) console.log(`FAIL  run exceeded the ${RUN_BUDGET_MS / 1000}s budget (${Math.round(durationMs / 1000)}s)`)
  process.exit(failed.length === 0 && report.withinBudget ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
