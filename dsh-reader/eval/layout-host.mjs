/**
 * Regression probe for the reader's height contract with the DSH host.
 *
 * DSH renders `conversation.view` slot content inside a content-sized
 * `.viewArea` (`flex: 1 0 auto; min-height: auto`) with the panel root clipping
 * (`overflow: hidden`). A slot entry that relies on `height: 100%` then collapses
 * to its content height, so nothing inside it can scroll. This page reproduces
 * that shape with the host's own class names and rules, mounts the real client
 * bundle in it, and asserts the reader fits the visible box and still scrolls.
 *
 * Run: node eval/layout-host.mjs
 */
import { createServer } from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import puppeteer from 'puppeteer-core'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const HOST_CSS = `
  :root{
    --dsw-alias-bg-base:#ffffff;--dsw-alias-bg-layer-1:#f7f8fa;--dsw-alias-bg-layer-2:#eef1f5;
    --dsw-alias-bg-overlay:#ffffff;--dsw-alias-border-l1:#e3e6eb;--dsw-alias-border-l2:#c9ced6;
    --dsw-alias-brand-primary:#3b82f6;--dsw-alias-label-primary:#1f2329;
    --dsw-alias-label-secondary:#5b6472;--dsw-alias-state-error-primary:#d14343;
  }
  html,body{margin:0;height:100%}
  body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
  #root{display:flex;flex-direction:column;height:100%}
  /* --- verbatim from @deepseek-ai/dsh-client-ui-conversation --- */
  .kiGsTW_root{display:flex;flex-direction:column;flex:1;min-height:0}
  .kiGsTW_root[data-phase=active]{overflow:hidden}
  .kiGsTW_scrollBody{scrollbar-gutter:stable;flex-direction:column;flex:1;min-height:0;margin-right:2px;display:flex;overflow-y:auto}
  .kiGsTW_viewArea{flex-direction:column;flex:1;min-height:0;display:flex}
  .kiGsTW_root[data-phase=active] .kiGsTW_viewArea{flex:1 0 auto;min-height:auto}
  .kiGsTW_composerSeat{flex:none;position:sticky;bottom:0;height:96px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l1)}
`

const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>reader host layout probe</title>
<style>${HOST_CSS}</style></head>
<body>
<div id="root">
  <div class="kiGsTW_root" data-phase="active">
    <div class="kiGsTW_scrollBody">
      <div data-slot="conversation.session">
        <div class="kiGsTW_viewArea">
          <div id="slot-wrapper"></div>
        </div>
      </div>
      <div class="kiGsTW_composerSeat" aria-label="composer"></div>
    </div>
  </div>
</div>
<script src="/host-page.js"></script>
</body></html>`

const results = []
const record = (name, pass, detail) => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(42)} ${detail}`)
}

async function main() {
  const bundle = await build({
    entryPoints: [path.join(here, 'layout', 'host-page.js')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'chrome120',
    logLevel: 'silent',
  })
  const pageCode = bundle.outputFiles[0].text
  const clientCode = await fs.readFile(path.join(root, 'client.js'))

  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const send = (status, type, body) => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
      res.end(body)
    }
    if (url.pathname === '/') return send(200, 'text/html; charset=utf-8', HTML)
    if (url.pathname === '/host-page.js') return send(200, 'text/javascript', pageCode)
    if (url.pathname === '/reader-client.js') return send(200, 'text/javascript', clientCode)
    send(404, 'text/plain', 'not found')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-lcd-text', '--force-device-scale-factor=1', '--font-render-hinting=none'],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' })
    await page.waitForFunction('window.__ready === true || window.__pageError', { timeout: 15000 })

    const bootError = await page.evaluate('window.__pageError || null')
    if (bootError) throw new Error('page boot failed: ' + bootError)

    const metrics = await page.evaluate(() => {
      const root = document.querySelector('.rd-root')
      if (!root) return { missing: true }
      const rect = root.getBoundingClientRect()
      const composer = document.querySelector('.kiGsTW_composerSeat')
      const composerHeight = composer ? composer.getBoundingClientRect().height : 0
      const visible = window.innerHeight - rect.top - composerHeight
      const main = document.querySelector('.rd-main')
      const out = {
        visible,
        rootHeight: rect.height,
        drift: Math.abs(rect.height - visible),
        mainClient: 0,
        mainScroll: 0,
        scrolled: 0,
        drawerClient: 0,
        drawerScroll: 0,
        drawerScrolled: 0,
      }
      if (main) {
        const filler = document.createElement('div')
        filler.style.height = '4000px'
        main.appendChild(filler)
        out.mainClient = main.clientHeight
        out.mainScroll = main.scrollHeight
        // the pane opts into smooth scrolling, which would defer the read
        main.style.scrollBehavior = 'auto'
        main.scrollTop = 1200
        out.scrolled = main.scrollTop
      }
      const body = document.querySelector('.rd-body')
      if (body) {
        const drawer = document.createElement('div')
        drawer.className = 'rd-drawer'
        const head = document.createElement('div')
        head.className = 'rd-drawer-head'
        const pane = document.createElement('div')
        pane.className = 'rd-drawer-body'
        const tall = document.createElement('div')
        tall.style.height = '3000px'
        pane.appendChild(tall)
        drawer.append(head, pane)
        body.appendChild(drawer)
        pane.scrollTop = 900
        out.drawerClient = pane.clientHeight
        out.drawerScroll = pane.scrollHeight
        out.drawerScrolled = pane.scrollTop
      }
      return out
    })
    if (metrics.missing) throw new Error('reader root not rendered')

    record(
      'reader root fills the visible host box',
      metrics.drift <= 2,
      `root=${metrics.rootHeight.toFixed(1)}px visible=${metrics.visible.toFixed(1)}px drift=${metrics.drift.toFixed(1)}px`,
    )
    const outer = await page.evaluate(() => {
      const scroller = document.querySelector('.kiGsTW_scrollBody')
      return { client: scroller.clientHeight, scroll: scroller.scrollHeight, scrollTop: scroller.scrollTop }
    })
    record(
      'outer host body does not add a third scrollbar',
      outer.scroll <= outer.client + 1 && outer.scrollTop === 0,
      `client=${outer.client} scroll=${outer.scroll} top=${outer.scrollTop}`,
    )

    record(
      'main pane becomes a scroll container',
      metrics.mainScroll > metrics.mainClient + 100,
      `client=${metrics.mainClient}px scroll=${metrics.mainScroll}px`,
    )
    record(
      'main pane actually scrolls',
      metrics.scrolled > 0,
      `scrollTop=${metrics.scrolled}px`,
    )
    record(
      'right sidebar becomes a scroll container',
      metrics.drawerScroll > metrics.drawerClient + 100 && metrics.drawerScrolled > 0,
      `client=${metrics.drawerClient}px scroll=${metrics.drawerScroll}px scrollTop=${metrics.drawerScrolled}px`,
    )
    record('no page errors while mounting', pageErrors.length === 0, pageErrors.join(' | ') || 'clean')
  } finally {
    await browser.close()
    server.close()
  }

  const failed = results.filter((result) => !result.pass)
  console.log(`\n${results.length - failed.length}/${results.length} layout probes passed`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('layout probe crashed:', error.message)
  process.exit(1)
})
