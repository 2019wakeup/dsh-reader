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

// jsdom has no layout; ranges need the geometry API the browser provides.
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
    concepts: {
      c1: { id: 'c1', term: '甲概念', definition: 'a', createdAt: 1 },
      c2: { id: 'c2', term: '乙概念', definition: 'b', createdAt: 2 },
      c3: { id: 'c3', term: 'hello', definition: 'greeting', createdAt: 3 },
    },
    docs: {
      fp1: {
        path: 'book.md',
        size: 0,
        mtime: 0,
        annotations: [
          { id: 'a1', kind: 'text', chapter: 0, quote: 'hello', occurrence: 0, color: '#f2c94c', note: 'note' },
        ],
        positions: {},
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
    const doc = docOf(op.docKey)
    doc.path = op.path || doc.path
  } else if (op.op === 'annotation/remove') {
    const doc = docOf(op.docKey)
    doc.annotations = doc.annotations.filter((item) => item.id !== op.id)
  } else if (op.op === 'annotation/add') {
    const doc = docOf(op.docKey)
    doc.annotations = [...doc.annotations.filter((item) => item.id !== op.annotation.id), op.annotation]
  } else if (op.op === 'annotation/update') {
    const doc = docOf(op.docKey)
    doc.annotations = doc.annotations.map((item) =>
      item.id === op.annotation.id ? { ...item, ...op.annotation } : item,
    )
  } else if (op.op === 'position/set') {
    docOf(op.docKey).positions = op.position
  } else if (op.op === 'prefs/set') {
    store.prefs = { ...store.prefs, ...op.prefs }
  } else if (op.op === 'concept/upsert') {
    store.concepts[op.concept.id] = op.concept
  } else if (op.op === 'concept/delete') {
    delete store.concepts[op.id]
  }
}

globalThis.fetch = async (url, init = {}) => {
  const target = String(url)
  if (target.includes('/api/list')) {
    return json({ cwd: '/w', dir: '.', entries: [{ name: 'book.md', type: 'file', path: 'book.md' }] })
  }
  if (target.includes('/api/models')) {
    return json({
      current: { provider: 'p', model: 'm' },
      providers: [
        { id: 'p', name: 'Provider P', models: [{ id: 'm', name: 'Model M' }] },
        { id: 'p2', name: 'Provider P2', models: [{ id: 'm2', name: 'Model M2' }] },
      ],
    })
  }
  if (target.includes('/api/store') && !target.includes('/api/mutate')) {
    return json({ store })
  }
  if (target.includes('/api/file')) {
    const bytes = new TextEncoder().encode('# Title\nhello world\n').buffer
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      arrayBuffer: async () => bytes,
      headers: { get: (name) => (name === 'x-doc-fingerprint' ? 'fp1' : null) },
    }
  }
  if (target.includes('/api/concept/ask')) {
    const payload = JSON.parse(init.body)
    const concept = store.concepts[payload.conceptId]
    concept.qa = [...(concept.qa || []), { q: payload.question, a: '回答内容', at: 1 }]
    return json({ answer: '回答内容', store })
  }
  if (target.includes('/api/guide')) {
    const payload = JSON.parse(init.body)
    const guide = {
      generatedAt: 1,
      synopsis: '全书主旨',
      questions: ['核心问题一'],
      sections: payload.sections.map((section) => ({
        id: section.id,
        title: section.title,
        level: section.level || 1,
        hash: 'h',
        summary: '章节摘要',
        keyPoints: ['要点'],
      })),
    }
    store.docs[payload.docKey].guide = guide
    return json({ guide, reused: 0, generated: guide.sections.length, store })
  }
  if (target.includes('/api/explain')) {
    const body = JSON.parse(init.body)
    const concept = {
      id: 'child-1',
      term: body.term,
      definition: 'child definition',
      parentId: body.parentId || null,
      createdAt: 4,
    }
    store.concepts[concept.id] = concept
    return json({ concept, store })
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

test('deleting a highlighted annotation keeps the reader mounted', async (t) => {
  resetStore()
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
    win.close()
  })
  root.render(React.createElement(Boundary, null, React.createElement(component, { sessionId: 's1' })))
  await tick()

  const entry = container.querySelector('.rd-entry')
  assert.ok(entry, 'library row rendered: ' + (container.querySelector('#err')?.textContent || container.textContent).slice(0, 900))
  entry.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick()

  const prose = container.querySelector('.rd-prose')
  assert.ok(prose, 'document body rendered: ' + (container.querySelector('.rd-error')?.textContent || container.textContent).slice(0, 400))

  const guideTab = Array.from(container.querySelectorAll('.rd-toolbar button')).find((button) =>
    ['导读', 'Guide'].includes(button.textContent),
  )
  assert.ok(guideTab, 'guide tab present')
  guideTab.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick()
  const generate = Array.from(container.querySelectorAll('.rd-drawer button')).find((button) =>
    ['生成导读', 'Generate guide'].includes(button.textContent),
  )
  assert.ok(generate, 'generate guide button present')
  generate.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick(80)
  assert.match(container.querySelector('.rd-drawer').textContent, /全书主旨/, 'guide synopsis rendered')
  assert.match(container.querySelector('.rd-drawer').textContent, /章节摘要/, 'section summary rendered')
  const mapButton = Array.from(container.querySelectorAll('.rd-drawer button')).find((button) =>
    ['导图', 'Mindmap'].includes(button.textContent),
  )
  assert.ok(mapButton, 'mindmap toggle present')
  mapButton.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick()
  assert.ok(container.querySelector('.rd-map-scroll svg'), 'mindmap renders an svg')
  assert.ok(container.querySelectorAll('.rdm-label').length > 1, 'mindmap has nodes')
  guideTab.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick()

  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true }))
  await tick()
  const searchPanel = container.querySelector('.rd-search')
  assert.ok(searchPanel, 'command-f opens search')
  const searchInput = searchPanel.querySelector('input')
  const setSearchValue = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set
  setSearchValue.call(searchInput, 'hello')
  searchInput.dispatchEvent(new win.Event('input', { bubbles: true }))
  const searchButton = Array.from(searchPanel.querySelectorAll('button')).find((button) =>
    ['搜索', 'Search'].includes(button.textContent),
  )
  searchButton.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick(60)
  assert.ok(container.querySelectorAll('.rd-search .rd-drawer-item').length > 0, 'search returns matches')
  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await tick()
  assert.equal(container.querySelector('.rd-search'), null, 'escape closes search')

  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: '?', bubbles: true }))
  await tick()
  assert.ok(container.querySelector('.rd-help-box'), 'question mark opens the shortcut panel')
  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await tick()
  assert.equal(container.querySelector('.rd-help-box'), null, 'escape closes the shortcut panel')

  const gear = Array.from(container.querySelectorAll('.rd-toolbar button')).find((button) =>
    ['设置', 'Settings'].includes(button.getAttribute('aria-label')),
  )
  assert.ok(gear, 'settings button present')
  gear.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick()
  const plus = Array.from(container.querySelectorAll('.rd-setting-row button')).find((button) => button.textContent === 'A+')
  assert.ok(plus, 'font size control present')
  const undoButton = Array.from(container.querySelectorAll('.rd-toolbar button')).find((button) =>
    ['撤销', 'Undo'].includes(button.getAttribute('aria-label')),
  )
  const redoButton = Array.from(container.querySelectorAll('.rd-toolbar button')).find((button) =>
    ['重做', 'Redo'].includes(button.getAttribute('aria-label')),
  )
  assert.ok(undoButton && redoButton, 'undo/redo toolbar buttons present')
  assert.ok(undoButton.querySelector('svg'), 'undo icon rendered as svg')
  const iconButtons = container.querySelectorAll('.rd-toolbar .rd-icon-btn svg')
  assert.ok(iconButtons.length >= 4, 'search, settings, undo, redo icons all use svg')
  plus.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick(50)
  assert.equal(store.prefs.fontSize, 19, 'font size preference persisted')
  const modelSelect = Array.from(container.querySelectorAll('.rd-drawer select')).find((select) =>
    [...select.options].some((option) => option.value.includes('\u0000')),
  )
  assert.ok(modelSelect, 'explanation model picker present')
  const setSelectValue = Object.getOwnPropertyDescriptor(win.HTMLSelectElement.prototype, 'value').set
  setSelectValue.call(modelSelect, 'p2\u0000m2')
  modelSelect.dispatchEvent(new win.Event('change', { bubbles: true }))
  await tick(60)
  assert.deepEqual(store.prefs.model, { provider: 'p2', model: 'm2' }, 'model preference persisted')
  gear.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick()

  const mark = container.querySelector('mark.rd-hl')
  assert.ok(mark, 'highlight rendered')
  mark.focus()
  mark.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  await tick()
  assert.ok(container.querySelector('.rd-editor'), 'enter on a focused highlight opens the editor')
  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await tick()
  mark.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick()

  let editor = container.querySelector('.rd-editor')
  assert.ok(editor, 'editor opened')

  document.body.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true }))
  await tick()
  assert.equal(container.querySelector('.rd-editor'), null, 'clicking outside closes the editor')

  mark.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick()
  editor = container.querySelector('.rd-editor')
  assert.ok(editor, 'editor reopens')

  win.dispatchEvent(new win.Event('scroll'))
  await tick()
  assert.equal(container.querySelector('.rd-editor'), null, 'scrolling closes the editor')

  mark.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick()
  editor = container.querySelector('.rd-editor')
  assert.ok(editor, 'editor reopens for delete')

  const remove = Array.from(editor.querySelectorAll('button')).find((button) => ['删除', 'Delete'].includes(button.textContent))
  assert.ok(remove, 'delete button present')
  remove.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick(60)

  assert.ok(
    container.querySelector('.rd-prose'),
    'reader body survives: ' + (container.querySelector('#err')?.textContent || '').slice(0, 1500),
  )
  assert.equal(container.querySelector('.rd-editor'), null, 'editor closes after delete')
  assert.equal((store.docs.fp1.annotations || []).length, 0, 'annotation removed from the store')

  const toast = container.querySelector('.rd-toast')
  assert.ok(toast, 'toast offers the undo action')
  const undo = Array.from(toast.querySelectorAll('button')).find((button) =>
    ['撤销', 'Undo'].includes(button.textContent),
  )
  assert.ok(undo, 'undo button present')
  undo.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick(80)

  assert.equal((store.docs.fp1.annotations || []).length, 1, 'undo restores the annotation in the store')
  assert.ok(container.querySelector('mark.rd-hl'), 'undo restores the highlight')

  const conceptsTab = Array.from(container.querySelectorAll('.rd-toolbar .rd-btn')).find((button) =>
    ['概念', 'Concepts'].includes(button.textContent),
  )
  assert.ok(conceptsTab, 'concepts tab present')
  conceptsTab.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick()
  assert.equal(container.querySelectorAll('[data-concept-id]').length, 3, 'all concepts are listed')

  const input = container.querySelector('.rd-drawer input')
  const setValue = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set
  setValue.call(input, '甲')
  input.dispatchEvent(new win.Event('input', { bubbles: true }))
  await tick()
  assert.equal(container.querySelectorAll('[data-concept-id]').length, 1, 'typing filters the list')

  const clear = container.querySelector('[data-action="clear-filter"]')
  assert.ok(clear, 'clear-filter button present')
  clear.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick()
  assert.equal(container.querySelectorAll('[data-concept-id]').length, 3, 'clearing the filter restores every concept')

  const drawerClose = container.querySelector('.rd-drawer-head button')
  drawerClose.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick()

  const term = container.querySelector('.rd-term')
  assert.ok(term, 'concept term is marked in the body')

  term.dispatchEvent(new win.MouseEvent('mouseover', { bubbles: true }))
  await tick(220)
  let card = container.querySelector('.rd-card')
  assert.ok(card, 'hovering a term opens its card')
  let zone = card.parentElement
  assert.equal(zone.className, 'rd-hover-zone', 'card sits inside an expanded hover zone')

  const askInput = card.querySelector('input.rd-input')
  const setInputValue = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set
  setInputValue.call(askInput, '为什么？')
  askInput.dispatchEvent(new win.Event('input', { bubbles: true }))
  const askButton = Array.from(card.querySelectorAll('button')).find((button) =>
    ['追问', 'Ask'].includes(button.textContent),
  )
  assert.ok(askButton, 'ask button present')
  askButton.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick(60)
  assert.equal(store.concepts.c3.qa.length, 1, 'follow-up stored')
  assert.match(container.textContent, /回答内容/, 'follow-up answer rendered')

  card.dispatchEvent(new win.MouseEvent('mouseout', { bubbles: true, relatedTarget: zone }))
  await tick(420)
  assert.ok(container.querySelector('.rd-card'), 'a move inside the hover zone keeps the card')

  zone.dispatchEvent(new win.MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
  await tick(720)
  assert.equal(container.querySelector('.rd-card'), null, 'leaving the hover zone closes a hover card')

  term.dispatchEvent(new win.MouseEvent('mouseover', { bubbles: true }))
  await tick(220)
  card = container.querySelector('.rd-card')
  assert.ok(card, 'hovering again reopens the card')

  const def = container.querySelector('.rd-def')
  const range = document.createRange()
  range.setStart(def.firstChild, 0)
  range.setEnd(def.firstChild, Math.min(3, def.firstChild.length))
  const selection = win.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  def.dispatchEvent(new win.MouseEvent('mouseup', { bubbles: true }))
  await tick(40)

  const childMenu = container.querySelector('.rd-hover-zone .rd-mini')
  assert.ok(childMenu, 'selecting inside the card offers the child explain menu')

  card.dispatchEvent(new win.MouseEvent('mouseout', { bubbles: true, relatedTarget: childMenu }))
  await tick(420)
  assert.ok(container.querySelector('.rd-card'), 'moving to the child menu keeps the parent card')

  const explainChild = Array.from(childMenu.querySelectorAll('button')).find((button) =>
    ['再解释', 'Explain this'].includes(button.textContent),
  )
  assert.ok(explainChild, 'child explain button present')
  explainChild.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick(80)

  assert.equal(store.concepts['child-1']?.parentId, 'c3', 'child concept is nested under the parent')
  assert.equal(container.querySelectorAll('.rd-card').length, 2, 'parent and child cards are both visible')

  const topCard = Array.from(container.querySelectorAll('.rd-card')).pop()
  const closeTop = Array.from(topCard.querySelectorAll('button')).find((button) => button.textContent === '×')
  assert.ok(closeTop, 'top card has a close control')
  closeTop.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await tick()
  assert.equal(container.querySelectorAll('.rd-card').length, 1, 'closing the child reveals the parent')

  document.body.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true }))
  await tick()
  assert.equal(container.querySelector('.rd-card'), null, 'an outside press closes the pinned parent card')
})
