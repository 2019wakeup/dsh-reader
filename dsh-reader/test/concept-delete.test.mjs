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

let store
let mutations = []

function resetStore() {
  store = {
    version: 2,
    prefs: {},
    concepts: {
      a: {
        id: 'a',
        term: '甲',
        definition: '甲的说明',
        depth: 'full',
        source: 'agent',
        status: 'ready',
        createdAt: 1,
        updatedAt: 1,
        occurrences: [],
      },
      b: {
        id: 'b',
        term: '乙',
        definition: '乙说的是甲',
        parentId: 'a',
        depth: 'full',
        source: 'agent',
        status: 'ready',
        createdAt: 2,
        updatedAt: 2,
        occurrences: [],
      },
    },
    docs: { fp1: { path: 'book.md', size: 0, mtime: 0, positions: {}, annotations: [] } },
  }
  mutations = []
}

let revision = 0

function snapshot() {
  // The client keeps the object it received, so re-rendering only happens when
  // the mutation response is a new object with a newer revision.
  revision += 1
  return JSON.parse(JSON.stringify({ ...store, revision }))
}

function applyOp(op) {
  mutations.push(op)
  if (op.op === 'concept/delete') {
    const removed = store.concepts[op.id]
    delete store.concepts[op.id]
    if (removed) {
      for (const concept of Object.values(store.concepts)) {
        if (concept.parentId === op.id) concept.parentId = removed.parentId || null
      }
    }
  } else if (op.op === 'prefs/set') {
    store.prefs = { ...store.prefs, ...op.prefs }
  }
}

globalThis.fetch = async (url, init = {}) => {
  const target = String(url)
  if (target.includes('/api/list')) {
    return json({ cwd: '/w', dir: '.', entries: [{ name: 'book.md', type: 'file', path: 'book.md' }] })
  }
  if (target.includes('/api/models')) {
    return json({ current: { provider: 'p', model: 'm' }, providers: [] })
  }
  if (target.includes('/api/store') && !target.includes('/api/mutate')) {
    revision += 1
    return json({ store: JSON.parse(JSON.stringify({ ...store, revision })) })
  }
  if (target.includes('/api/file')) {
    const bytes = new TextEncoder().encode('# Title\n\n正文里提到了甲和乙。\n').buffer
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      arrayBuffer: async () => bytes,
      headers: { get: (name) => (name === 'x-doc-fingerprint' ? 'fp1' : null) },
    }
  }
  if (target.includes('/api/mutate')) {
    applyOp(JSON.parse(init.body))
    return json({ store: snapshot() })
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

async function openConceptsDrawer(t) {
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
  const tab = Array.from(container.querySelectorAll('.rd-toolbar button')).find((button) =>
    ['概念', 'Concepts'].includes(button.textContent),
  )
  assert.ok(tab, 'concepts tab present')
  tab.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick(60)
  const row = container.querySelector('[data-concept-id="a"]')
  assert.ok(row, 'concept row rendered')
  return { container, row }
}

test('a concept can be deleted straight from the concepts drawer', async (t) => {
  const { container, row } = await openConceptsDrawer(t)
  const remove = row.querySelector('.rd-row-delete')
  assert.ok(remove, 'each row carries a delete control')
  remove.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick(40)

  // Deleting is a two-step action: the row asks first, and does not open the card.
  assert.equal(container.querySelector('.rd-card'), null, 'pressing delete does not open the card')
  const confirm = container.querySelector('[data-action="confirm-delete-concept"]')
  assert.ok(confirm, 'row asks for confirmation')
  confirm.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick(60)

  const deletes = mutations.filter((op) => op.op === 'concept/delete')
  assert.equal(deletes.length, 1, 'exactly one delete was posted')
  assert.equal(deletes[0].id, 'a')
  assert.equal(container.querySelector('[data-concept-id="a"]'), null, 'the row disappears')
  assert.ok(container.querySelector('[data-concept-id="b"]'), 'other concepts stay')
  assert.equal(container.querySelector('[data-action="confirm-delete-concept"]'), null, 'confirmation closes')
})

test('cancelling the confirmation keeps the concept', async (t) => {
  const { container, row } = await openConceptsDrawer(t)
  row.querySelector('.rd-row-delete').dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick(40)
  const cancel = container.querySelector('[data-action="cancel-delete-concept"]')
  assert.ok(cancel, 'cancel control present')
  cancel.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick(40)
  assert.equal(mutations.filter((op) => op.op === 'concept/delete').length, 0, 'nothing was deleted')
  assert.ok(container.querySelector('[data-concept-id="a"]'), 'the concept stays')
})


test('opening a concept row dismisses the delete confirmation', async (t) => {
  const { container, row } = await openConceptsDrawer(t)
  row.querySelector('.rd-row-delete').dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick(40)
  assert.ok(container.querySelector('.rd-drawer-confirm'), 'confirmation is open')
  row.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick(60)
  assert.equal(container.querySelector('.rd-drawer-confirm'), null, 'opening the row closes the confirmation')
  assert.ok(container.querySelector('.rd-card'), 'the concept card opens')
})
