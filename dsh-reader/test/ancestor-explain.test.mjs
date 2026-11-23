import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import React from 'react'

const here = path.dirname(fileURLToPath(import.meta.url))
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'http://localhost' })
const win = dom.window

globalThis.window = win
globalThis.document = win.document
Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true })
globalThis.HTMLElement = win.HTMLElement
globalThis.Node = win.Node
globalThis.NodeFilter = win.NodeFilter
globalThis.MutationObserver = win.MutationObserver
globalThis.getComputedStyle = win.getComputedStyle
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
globalThis.DOMParser = win.DOMParser
if (win.Range) {
  win.Range.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 })
  win.Range.prototype.getClientRects = () => []
}

const tick = (ms = 25) => new Promise((resolve) => setTimeout(resolve, ms))

function json(value) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => value,
    arrayBuffer: async () => new TextEncoder().encode('').buffer,
    headers: { get: () => null },
  })
}

const parentConcept = {
  id: 'parent',
  term: '线性一致性',
  definition: '所有节点看到同一份历史。',
  depth: 'full',
  source: 'agent',
  status: 'ready',
  createdAt: 1,
  updatedAt: 1,
  occurrences: [],
}

let store
let lastExplainBody = null

function resetStore() {
  store = {
    version: 2,
    prefs: {},
    concepts: { parent: { ...parentConcept } },
    docs: { fp1: { path: 'book.md', size: 0, mtime: 0, positions: {}, annotations: [] } },
  }
  lastExplainBody = null
}

globalThis.fetch = async (url, init = {}) => {
  const target = String(url)
  if (target.includes('/api/list')) {
    return json({ cwd: '/w', dir: '.', entries: [{ name: 'book.md', type: 'file', path: 'book.md' }] })
  }
  if (target.includes('/api/models')) {
    return json({ current: { provider: 'p', model: 'm' }, providers: [] })
  }
  if (target.includes('/api/explain')) {
    lastExplainBody = JSON.parse(init.body)
    // What the route returns when the requested term is already one of the cards
    // the reader came from: the stored card, flagged as a step back up.
    return json({
      concept: store.concepts.parent,
      reused: true,
      ancestor: true,
      route: 'ancestor',
      chain: [{ id: 'parent', term: '线性一致性' }],
    })
  }
  if (target.includes('/api/store') && !target.includes('/api/mutate')) {
    return json({ store })
  }
  if (target.includes('/api/file')) {
    const bytes = new TextEncoder()
      .encode('# Title\n\n线性一致性是最强的一致性模型之一，这一段落足够长以便选中其中的词条。\n')
      .buffer
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      arrayBuffer: async () => bytes,
      headers: { get: (name) => (name === 'x-doc-fingerprint' ? 'fp1' : null) },
    }
  }
  if (target.includes('/api/mutate')) {
    return json({ store })
  }
  return json({})
}

function loadBundle() {
  const code = fs.readFileSync(path.join(here, '..', 'client.js'), 'utf8')
  let entry = null
  win.__ModuleLoader__ = {
    load(registration) {
      entry = registration
    },
  }
  new Function('window', code)(win)
  const mod = entry.factory((name) => {
    if (name === 'react') return React
    throw new Error('unexpected module ' + name)
  })
  let component = null
  mod.apply({
    slots: {
      inject(_key, callback) {
        callback()
      },
      register(_options, registered) {
        component = registered
        return () => {}
      },
    },
  })
  return component
}

class Boundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return React.createElement('pre', { id: 'err' }, String(this.state.error.stack || this.state.error))
    }
    return this.props.children
  }
}

async function mountReader(t) {
  resetStore()
  Object.defineProperty(win.navigator, 'language', { value: 'zh-CN', configurable: true })
  Object.defineProperty(win.navigator, 'languages', { value: ['zh-CN'], configurable: true })
  const component = loadBundle()
  const { createRoot } = await import('react-dom/client')
  const container = document.getElementById('app')
  const root = createRoot(container)
  t.after(() => {
    try {
      root.unmount()
    } catch {
      /* already unmounted */
    }
  })
  root.render(React.createElement(Boundary, null, React.createElement(component, { sessionId: 's1' })))
  await tick(200)
  const entry = container.querySelector('.rd-entry')
  assert.ok(entry, 'library row rendered: ' + (container.querySelector('#err')?.textContent || '').slice(0, 600))
  entry.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick(80)
  assert.ok(container.querySelector('.rd-prose'), 'document body rendered')
  return container
}

function selectInProse(container, needle) {
  const walker = document.createTreeWalker(container.querySelector('.rd-prose'), 4)
  let node
  while ((node = walker.nextNode())) {
    const at = (node.nodeValue || '').indexOf(needle)
    if (at >= 0) {
      const range = document.createRange()
      range.setStart(node, at)
      range.setEnd(node, at + needle.length)
      const selection = win.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      node.parentElement.dispatchEvent(new win.MouseEvent('mouseup', { bubbles: true }))
      return true
    }
  }
  return false
}

test('asking about a term that raised the current card reuses it with a visible reason', async (t) => {
  const container = await mountReader(t)
  assert.ok(selectInProse(container, '线性一致性'), 'selected the term in the prose')
  await tick(60)

  const menu = container.querySelector('.rd-mini')
  assert.ok(menu, 'selection menu opened')
  const explain = Array.from(menu.querySelectorAll('button')).find((button) =>
    ['解释', 'Explain'].includes(button.textContent),
  )
  assert.ok(explain, 'explain button present')
  explain.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick(80)

  assert.ok(lastExplainBody, 'the reader asked the route')
  assert.equal(lastExplainBody.term, '线性一致性')
  const card = container.querySelector('.rd-card')
  assert.ok(card, 'a card is shown for the reused concept')
  assert.equal(container.querySelector('.rd-skeleton'), null, 'the reused concept is not left pending')
  assert.match(
    card.textContent,
    /上层已有解释|already explained one level up/,
    'the card says why it is the one from further up instead of pretending to be new',
  )
  assert.match(card.textContent, /所有节点看到同一份历史/, 'the original explanation is what the reader sees')
})
