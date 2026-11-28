import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import React from 'react'
import { isImeComposing } from '../src/client/util.js'

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
const waitFor = async (read, timeoutMs = 3000) => {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const value = read()
    if (value) return value
    await tick(25)
  }
  return read()
}

function json(value) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => value,
    arrayBuffer: async () => new TextEncoder().encode('').buffer,
    headers: { get: () => null },
  })
}

const DOC = '# Title\n\n线性一致性是最强的一致性模型之一，这一段落足够长以便选中其中的词条。\n'
const concept = {
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
let askPosts

function resetStore() {
  store = {
    version: 2,
    prefs: {},
    concepts: { parent: { ...concept } },
    docs: { fp1: { path: 'book.md', size: 0, mtime: 0, positions: {}, annotations: [] } },
  }
  askPosts = []
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
    return json({ concept: store.concepts.parent, store })
  }
  if (target.includes('/api/concept/ask')) {
    askPosts.push(JSON.parse(init.body || '{}'))
    return json({ answer: '示例回答', store })
  }
  if (target.includes('/api/file')) {
    const bytes = new TextEncoder().encode(DOC).buffer
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
  if (target.includes('/api/store')) {
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
  const entry = await waitFor(() => container.querySelector('.rd-entry'))
  assert.ok(entry, 'library row rendered: ' + (container.querySelector('#err')?.textContent || '').slice(0, 600))
  entry.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick(80)
  assert.ok(container.querySelector('.rd-prose'), 'document body rendered')
  return container
}

function typeInto(input, value) {
  const setValue = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set
  setValue.call(input, value)
  input.dispatchEvent(new win.Event('input', { bubbles: true }))
}

function pressEnter(input, options = {}) {
  const event = new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options })
  input.dispatchEvent(event)
  return event
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

test('an IME composition key event is never treated as a submit', () => {
  assert.equal(isImeComposing({ isComposing: true }), true)
  assert.equal(isImeComposing({ isComposing: false, keyCode: 229 }), true)
  assert.equal(isImeComposing({ isComposing: false, keyCode: 13 }), false)
  assert.equal(isImeComposing(null), false)
  assert.equal(isImeComposing(undefined), false)
})

test('react synthetic events are read through their native event', () => {
  // React does not put isComposing on its synthetic keydown event.
  assert.equal(isImeComposing({ isComposing: undefined, keyCode: 0, nativeEvent: { isComposing: true } }), true)
  assert.equal(isImeComposing({ nativeEvent: { isComposing: false, keyCode: 229 } }), true)
  assert.equal(isImeComposing({ keyCode: 0, nativeEvent: { isComposing: false, keyCode: 13 } }), false)
})

test('the Enter that commits an IME candidate does not send the ask question', async (t) => {
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

  const card = await waitFor(() => container.querySelector('.rd-card'))
  assert.ok(card, 'concept card rendered')
  const askInput = await waitFor(() => card.querySelector('input.rd-input'))
  assert.ok(askInput, 'ask input rendered')

  // Pinyin candidate confirmation: keydown Enter arrives with isComposing true.
  typeInto(askInput, 'ni')
  await tick(20)
  pressEnter(askInput, { isComposing: true })
  await tick(80)
  assert.equal(askPosts.length, 0, 'composing Enter must not post the question')
  assert.equal(askInput.value, 'ni', 'the typed pinyin stays in the field')

  // A real Enter still submits, with the committed text as the question.
  const plain = pressEnter(askInput)
  assert.equal(plain.defaultPrevented, false)
  await tick(80)
  assert.equal(askPosts.length, 1, 'plain Enter posts the question')
  assert.equal(askPosts[0].question, 'ni')
  assert.equal(askPosts[0].conceptId, 'parent')
})

test('the Enter that commits an IME candidate does not run the search', async (t) => {
  const container = await mountReader(t)
  const searchButton = await waitFor(() =>
    Array.from(container.querySelectorAll('.rd-toolbar button')).find((button) =>
      ['搜索', 'Search'].includes(button.getAttribute('title') || ''),
    ),
  )
  assert.ok(searchButton, 'toolbar search button present')
  searchButton.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  const searchInput = await waitFor(() => container.querySelector('.rd-search input'))
  assert.ok(searchInput, 'search input rendered')

  typeInto(searchInput, '线性')
  await tick(20)
  pressEnter(searchInput, { isComposing: true })
  await tick(80)
  assert.equal(container.querySelectorAll('.rd-search .rd-drawer-item').length, 0, 'composing Enter must not search')

  pressEnter(searchInput)
  const hits = await waitFor(() => {
    const items = container.querySelectorAll('.rd-search .rd-drawer-item')
    return items.length > 0 ? items : null
  })
  assert.ok(hits, 'plain Enter runs the search')
})
