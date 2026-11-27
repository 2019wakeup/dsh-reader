import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { pdfPageFromRange } from '../src/client/pdf.js'

// A PDF page is rendered as `.rd-pdf-page[data-page]` wrapping `.rd-text-layer`,
// and every text item is a span inside that layer. The helper only needs the
// ancestor chain, so a plain jsdom document is enough — no pdf.js involved.
function withDom(html) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`)
  return dom.window.document
}

function rangeInside(node) {
  const document = node.ownerDocument
  const range = document.createRange()
  range.selectNodeContents(node)
  return range
}

test('a selection inside a page text layer reports that page number', () => {
  const document = withDom(
    '<div class="rd-pdf-page" data-page="7"><div class="rd-text-layer"><span>选中的文字</span></div></div>',
  )
  const span = document.querySelector('.rd-text-layer span')
  assert.equal(pdfPageFromRange(rangeInside(span)), 7)
})

test('a collapsed selection at the very start of a span still resolves the page', () => {
  const document = withDom(
    '<div class="rd-pdf-page" data-page="12"><div class="rd-text-layer"><span>abc</span></div></div>',
  )
  const text = document.querySelector('.rd-text-layer span').firstChild
  const range = document.createRange()
  range.setStart(text, 1)
  range.collapse(true)
  assert.equal(pdfPageFromRange(range), 12)
})

test('a selection whose start node is the page element resolves too', () => {
  const document = withDom('<div class="rd-pdf-page" data-page="3"><p>page text</p></div>')
  const page = document.querySelector('.rd-pdf-page')
  const range = document.createRange()
  range.setStart(page, 0)
  assert.equal(pdfPageFromRange(range), 3)
})

test('a selection outside every page container has no page', () => {
  const document = withDom('<div class="rd-toolbar"><span>toolbar text</span></div>')
  const span = document.querySelector('.rd-toolbar span')
  assert.equal(pdfPageFromRange(rangeInside(span)), undefined)
})

test('a page container with a broken data-page value has no page', () => {
  for (const value of ['', 'abc', '0', '-2']) {
    const document = withDom(`<div class="rd-pdf-page" data-page="${value}"><span>x</span></div>`)
    const span = document.querySelector('.rd-pdf-page span')
    assert.equal(pdfPageFromRange(rangeInside(span)), undefined, `data-page="${value}"`)
  }
})

test('a missing range or start node has no page', () => {
  assert.equal(pdfPageFromRange(null), undefined)
  assert.equal(pdfPageFromRange(undefined), undefined)
  assert.equal(pdfPageFromRange({}), undefined)
  assert.equal(pdfPageFromRange({ startContainer: null }), undefined)
})
