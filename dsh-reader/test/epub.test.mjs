import test from 'node:test'
import assert from 'node:assert/strict'
import { DOMParser as LDOMParser } from 'linkedom'

// linkedom's XML parser matches the browser's application/xml behavior,
// including self-closing elements, which an HTML parser would nest.
globalThis.DOMParser = LDOMParser

// The bundle shares one scope; in a direct ESM import the sanitizer is a
// free identifier, so expose it the same way.
const { sanitizeHtml } = await import('../src/client/sanitize.js')
globalThis.sanitizeHtml = sanitizeHtml

const { epubOpen } = await import('../src/client/epub.js')

function zipBytes(entries) {
  const enc = new TextEncoder()
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, text] of entries) {
    const nameBytes = enc.encode(name)
    const data = enc.encode(text)
    const local = new Uint8Array(30 + nameBytes.length + data.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    local.set(data, 30 + nameBytes.length)
    locals.push(local)

    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    central.set(nameBytes, 46)
    centrals.push(central)
    offset += local.length
  }
  const cdOffset = offset
  const cdSize = centrals.reduce((sum, part) => sum + part.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, cdOffset, true)
  const total = offset + cdSize + eocd.length
  const out = new Uint8Array(total)
  let at = 0
  for (const part of locals) {
    out.set(part, at)
    at += part.length
  }
  for (const part of centrals) {
    out.set(part, at)
    at += part.length
  }
  out.set(eocd, at)
  return out
}

const EPUB = zipBytes([
  ['META-INF/container.xml', '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'],
  ['OEBPS/content.opf', '<?xml version="1.0"?><package version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>测试书</dc:title><meta property="rendition:layout">pre-paginated</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="ch1"/></spine></package>'],
  ['OEBPS/nav.xhtml', '<html><body><nav epub:type="toc"><ol><li><a href="ch1.xhtml">第一章 一致性</a></li></ol></nav></body></html>'],
  ['OEBPS/ch1.xhtml', '<html><body><h1>第一章</h1><p>线性一致性是强一致性模型。</p><script>alert(1)</script><img src="img/x.png"/></body></html>'],
])

test('opens an EPUB and renders its spine', async () => {
  const book = await epubOpen(EPUB)
  assert.equal(book.title, '测试书')
  assert.equal(book.chapters.length, 1)
  assert.equal(book.chapters[0].label, '第一章 一致性')
  assert.match(book.chapters[0].html, /线性一致性是强一致性模型/)
  assert.doesNotMatch(book.chapters[0].html, /script/i)
  assert.equal(book.fixedLayout, true, 'fixed-layout EPUB is flagged')
})
