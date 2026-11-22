import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHTML } from 'linkedom'

// linkedom's DOM DOMParser returns a fragment document without a body, while
// the browser DOMParser wraps a fragment in <body>; wrap here to test the same path.
class TestDOMParser {
  parseFromString(html) {
    return parseHTML('<html><body>' + String(html) + '</body></html>').document
  }
}

globalThis.DOMParser = TestDOMParser

const { sanitizeHtml } = await import('../src/client/sanitize.js')

test('removes scripts and event handlers', () => {
  const html = sanitizeHtml('<p onclick="steal()">hi</p><script>alert(1)</script><img src="a.png" onerror="x()">')
  assert.doesNotMatch(html, /script/i)
  assert.doesNotMatch(html, /onclick|onerror/i)
})

test('removes javascript links but keeps the text', () => {
  const html = sanitizeHtml('<a href="javascript:alert(1)">click</a>')
  assert.doesNotMatch(html, /javascript:/i)
  assert.match(html, /click/)
})

test('resolves relative images through the resolver', () => {
  const html = sanitizeHtml('<img src="img/cover.png">', () => 'blob:reader-1')
  assert.match(html, /src="blob:reader-1"/)
})

test('drops an image the resolver cannot resolve', () => {
  const html = sanitizeHtml('<img src="missing.png">', () => null)
  assert.doesNotMatch(html, /src=/)
})

test('removes inline styles and classes', () => {
  const html = sanitizeHtml('<div style="position: fixed; top: 0" class="rd-root">x</div>')
  assert.doesNotMatch(html, /position/)
  assert.doesNotMatch(html, /class=/)
})

test('removes style elements that could restyle the page', () => {
  const html = sanitizeHtml('<style>.rd-root{display:none}</style><p>t</p>')
  assert.doesNotMatch(html, /style/i)
  assert.match(html, /<p>t<\/p>/)
})

test('removes svg style and script elements', () => {
  const html = sanitizeHtml('<svg><style>body{display:none}</style><script>alert(1)</script><text>hi</text></svg>')
  assert.doesNotMatch(html, /style|script/i)
  assert.match(html, /hi/)
})

test('removes control characters before the scheme check', () => {
  const html = sanitizeHtml('<a href="java\tscript:alert(1)">x</a>')
  assert.doesNotMatch(html, /javascript/i)
})

test('removes srcset and poster attributes', () => {
  const html = sanitizeHtml('<img src="a.png" srcset="b.png 2x"><video poster="c.png"></video>')
  assert.doesNotMatch(html, /srcset|poster/)
})

test('removes namespaced javascript links', () => {
  const html = sanitizeHtml('<svg><a xlink:href="javascript:alert(1)">x</a></svg>')
  assert.doesNotMatch(html, /javascript:/i)
})
