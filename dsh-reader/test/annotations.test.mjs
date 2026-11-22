import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.NodeFilter = dom.window.NodeFilter

const { applyHighlights, hitAnnotationAtPoint } = await import('../src/client/annotations.js')

function mount(html) {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

function annotation(quote, occurrence = 0) {
  return { id: 'a1', kind: 'text', chapter: 0, quote, occurrence, color: '#f2c94c' }
}

test('wraps a quote that spans strong and plain text', () => {
  const root = mount('<p><strong>hello</strong> world</p>')
  const lost = applyHighlights(root, [annotation('hello world')], 0)
  assert.deepEqual(lost, [])
  assert.equal(root.textContent, 'hello world')
  assert.ok(root.querySelectorAll('[data-anno="a1"]').length >= 1, 'at least one marked segment')
})

test('wraps a quote that spans inline code', () => {
  const root = mount('<p>see <code>npm install</code> now</p>')
  const lost = applyHighlights(root, [annotation('see npm install')], 0)
  assert.deepEqual(lost, [])
  assert.equal(root.textContent, 'see npm install now')
  assert.ok(root.querySelectorAll('[data-anno="a1"]').length >= 1)
})

test('returns the unresolved ids when the quote is gone', () => {
  const root = mount('<p>nothing here</p>')
  const lost = applyHighlights(root, [annotation('missing')], 0)
  assert.deepEqual(lost, ['a1'])
})

test('keeps text intact when the quote starts mid-node', () => {
  const root = mount('<p>前缀 hello 后缀</p>')
  applyHighlights(root, [annotation('hello')], 0)
  assert.equal(root.textContent, '前缀 hello 后缀')
  assert.equal(root.querySelector('[data-anno="a1"]').textContent, 'hello')
})

test('hit-tests PDF annotation rects', () => {
  const annotations = [
    { id: 'p1', kind: 'pdf', page: 2, rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.05 }] },
    { id: 'p2', kind: 'pdf', page: 3, rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.05 }] },
  ]
  assert.equal(hitAnnotationAtPoint(annotations, 2, 0.2, 0.22).id, 'p1')
  assert.equal(hitAnnotationAtPoint(annotations, 3, 0.2, 0.22).id, 'p2')
  assert.equal(hitAnnotationAtPoint(annotations, 2, 0.8, 0.8), null)
})

test('marks the requested occurrence', () => {
  const root = mount('<p>hello x hello y hello</p>')
  applyHighlights(root, [annotation('hello', 1)], 0)
  assert.equal(root.textContent, 'hello x hello y hello')
  assert.equal(root.querySelectorAll('[data-anno="a1"]').length, 1)
})
