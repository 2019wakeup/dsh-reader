import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
globalThis.window = dom.window
globalThis.document = dom.window.document

const { pdfPageFromRange } = await import('../src/client/pdf.js')

function mount(html) {
  document.body.innerHTML = ''
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

function rangeAround(node) {
  const range = document.createRange()
  range.selectNodeContents(node)
  return range
}

test('reads the page number from a text selection inside a PDF page', () => {
  const root = mount(
    '<div class="rd-pdf-page" data-page="3"><div class="rd-text-layer"><span>VastGS</span></div></div>',
  )
  const text = root.querySelector('span').firstChild
  const range = document.createRange()
  range.setStart(text, 0)
  range.setEnd(text, 4)
  assert.equal(pdfPageFromRange(range), 3)
})

test('reads the page number when the range starts on the page element', () => {
  const root = mount(
    '<div class="rd-pdf-page" data-page="7"><div class="rd-text-layer"><span>hello</span></div></div>',
  )
  assert.equal(pdfPageFromRange(rangeAround(root.querySelector('.rd-pdf-page'))), 7)
})

test('uses the page the selection starts on in a two-page spread', () => {
  const root = mount(
    '<div class="rd-pdf"><div class="rd-pdf-page" data-page="4"><div class="rd-text-layer"><span>left</span></div></div>' +
      '<div class="rd-pdf-page" data-page="5"><div class="rd-text-layer"><span>right</span></div></div></div>',
  )
  const text = root.querySelectorAll('span')[1].firstChild
  const range = document.createRange()
  range.setStart(text, 0)
  range.setEnd(text, 2)
  assert.equal(pdfPageFromRange(range), 5)
})

test('returns undefined outside a PDF page', () => {
  const root = mount('<div class="rd-prose"><p>markdown text</p></div>')
  assert.equal(pdfPageFromRange(rangeAround(root.querySelector('p'))), undefined)
})

test('returns undefined for a page without a data-page number', () => {
  const root = mount('<div class="rd-pdf-page"><div class="rd-text-layer"><span>x</span></div></div>')
  assert.equal(pdfPageFromRange(rangeAround(root.querySelector('span'))), undefined)
})

test('returns undefined for a missing, empty or detached range', () => {
  assert.equal(pdfPageFromRange(null), undefined)
  assert.equal(pdfPageFromRange(undefined), undefined)
  assert.equal(pdfPageFromRange({}), undefined)
  const detached = document.createTextNode('detached')
  const range = document.createRange()
  range.setStart(detached, 0)
  range.setEnd(detached, 8)
  assert.equal(pdfPageFromRange(range), undefined)
})
