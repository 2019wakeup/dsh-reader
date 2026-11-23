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
function resetStore() {
  store = {
    version: 2,
    prefs: {},
    concepts: {},
    docs: {
      fp1: {
        path: 'book.md',
        size: 0,
        mtime: 0,
        positions: {},
        annotations: [
          { id: 'a1', kind: 'text', chapter: 0, quote: 'hello', occurrence: 0, color: '#f2c94c', note: 'first line' },
        ],
      },
    },
  }
}

function docOf(key) {
  if (!store.docs[key]) store.docs[key] = { path: key, size: 0, mtime: 0, annotations: [], positions: {} }
  return store.docs[key]
}

function applyOp(op) {
  if (op.op === 'doc/upsert') {
    docOf(op.docKey).path = op.path || docOf(op.docKey).path
  } else if (op.op === 'annotation/update') {
    const doc = docOf(op.docKey)
    doc.annotations = doc.annotations.map((item) => (item.id === op.annotation.id ? { ...item, ...op.annotation } : item))
  } else if (op.op === 'annotation/remove') {
    const doc = docOf(op.docKey)
    doc.annotations = doc.annotations.filter((item) => item.id !== op.id)
  } else if (op.op === 'annotation/add') {
    const doc = docOf(op.docKey)
    doc.annotations = [...doc.annotations.filter((item) => item.id !== op.annotation.id), op.annotation]
  } else if (op.op === 'position/set') {
    docOf(op.docKey).positions = op.position
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
    return json({ store })
  }
  if (target.includes('/api/file')) {
    const bytes = new TextEncoder().encode('# Title\n\nhello world, this paragraph exists so the highlight can anchor.\n').buffer
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
    if (this.state.error) return React.createElement('pre', { id: 'err' }, String(this.state.error.stack || this.state.error))
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
  assert.ok(entry, 'library row rendered: ' + (container.querySelector('#err')?.textContent || container.textContent).slice(0, 900))
  entry.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick(60)
  assert.ok(container.querySelector('.rd-prose'), 'document body rendered: ' + (container.querySelector('.rd-error')?.textContent || '').slice(0, 400))
  return container
}

async function openEditor(container) {
  const mark = container.querySelector('mark.rd-hl[data-anno="a1"]')
  assert.ok(mark, 'annotation highlight rendered')
  mark.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick()
  const editor = container.querySelector('.rd-card.rd-editor')
  assert.ok(editor, 'editor opened')
  return editor
}

test('scrolling inside the annotation editor keeps it open', async (t) => {
  const container = await mountReader(t)
  const editor = await openEditor(container)

  const textarea = editor.querySelector('textarea')
  assert.ok(textarea, 'editor has a note field')
  const longNote = '第一行\n第二行\n第三行\n第四行\n第五行'
  const setValue = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, 'value').set
  setValue.call(textarea, longNote)
  textarea.dispatchEvent(new win.Event('input', { bubbles: true }))
  await tick()

  // A textarea scrolled by its own content is not the reading surface moving.
  textarea.dispatchEvent(new win.Event('scroll'))
  await tick()
  assert.ok(container.querySelector('.rd-card.rd-editor'), 'a scroll inside the note field keeps the editor open')
  assert.equal(container.querySelector('.rd-editor textarea').value, longNote, 'the note typed so far survives')

  // The same holds for any scroller that lives inside the floating panel.
  const quote = container.querySelector('.rd-quote')
  assert.ok(quote, 'editor shows the quoted text')
  quote.dispatchEvent(new win.Event('scroll'))
  await tick()
  assert.ok(container.querySelector('.rd-card.rd-editor'), 'scrolling the quote keeps the editor open')

  // Scrolling the page itself must still dismiss the panel, which is anchored to text.
  const main = container.querySelector('.rd-main')
  assert.ok(main, 'reading surface present')
  main.dispatchEvent(new win.Event('scroll'))
  await tick()
  assert.equal(container.querySelector('.rd-card.rd-editor'), null, 'scrolling the reading surface still closes the editor')
})
