import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>')
globalThis.document = dom.window.document
globalThis.DOMParser = dom.window.DOMParser

const { parseStyleOutline, parseCodeStyles, styleMapFor, sanitizeDocxHtml, splitDocxChapters, docxOpen } = await import('../src/client/docx.js')

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
  const out = new Uint8Array(offset + cdSize + eocd.length)
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

const STYLES = `<?xml version="1.0"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="2"><w:name w:val="标题 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style>
  <w:style w:type="character" w:styleId="Strong"><w:name w:val="Strong"/></w:style>
</w:styles>`

test('reads heading levels from names and outlineLvl', () => {
  const styles = parseStyleOutline(STYLES)
  assert.deepEqual(styles, [
    { styleId: '2', name: '标题 1', level: 1 },
    { styleId: 'Heading2', name: 'heading 2', level: 2 },
  ])
  assert.deepEqual(styleMapFor(styles), ["p[style-name='标题 1'] => h1", "p[style-name='heading 2'] => h2"])
})

test('maps code styles to pre without touching headings', () => {
  const styles = `<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Code"><w:name w:val="HTML Preformatted"/></w:style></w:styles>`
  assert.deepEqual(parseCodeStyles(styles), ['HTML Preformatted'])
  assert.deepEqual(styleMapFor([], parseCodeStyles(styles)), ["p[style-name='HTML Preformatted'] => pre"])
})

test('sanitizes scripts and unsafe urls', () => {
  const clean = sanitizeDocxHtml(
    '<p onclick="x()">hi <a href="javascript:alert(1)">bad</a><script>alert(1)</script><a href="https://e.com">ok</a></p>',
  )
  assert.doesNotMatch(clean, /script|onclick|javascript:/)
  assert.match(clean, /https:\/\/e\.com/)
})

test('splits h1 chapters, wraps tables and drops TOC leaders', () => {
  const { chapters, outline } = splitDocxChapters(
    '<p>前言</p><h1>第一章</h1><p>a</p><p>1 引言............3</p><h2>1.1</h2><table><tr><td>x</td></tr></table><h1>第二章</h1><p>b</p>',
  )
  assert.equal(chapters.length, 3)
  assert.equal(chapters[0].label, '正文')
  assert.equal(chapters[1].label, '第一章')
  assert.match(chapters[1].html, /rd-table-wrap/)
  assert.doesNotMatch(chapters[1].html, /\.\.\./)
  assert.deepEqual(outline.map((item) => item.level), [1, 2, 1])
})

test('accepts an ArrayBuffer like the host fetch returns', async () => {
  const docx = zipBytes([
    ['word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>'],
    ['word/styles.xml', STYLES],
  ])
  const engine = { convertToHtml: async () => ({ value: '<h1>第一章</h1><p>正文</p>' }) }
  const result = await docxOpen(docx.buffer, { mammoth: engine })
  assert.equal(result.chapters.length, 1)
  assert.equal(result.chapters[0].label, '第一章')
})

test('rejects a zip without word/document.xml', async () => {
  const docx = zipBytes([['word/styles.xml', STYLES]])
  const engine = { convertToHtml: async () => ({ value: '<p>x</p>' }) }
  await assert.rejects(docxOpen(docx, { mammoth: engine }), /word\/document.xml/)
})

test('opens a docx through an injected mammoth engine', async () => {
  const docx = zipBytes([
    [
      'word/document.xml',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>hi</w:t></w:r></w:p></w:body></w:document>',
    ],
    ['word/styles.xml', STYLES],
  ])
  let received = null
  const engine = {
    convertToHtml: async ({ arrayBuffer }, options) => {
      received = options
      assert.ok(arrayBuffer.byteLength > 0)
      return { value: '<p>intro</p><h1>第一章</h1><p>正文</p>' }
    },
  }
  const result = await docxOpen(docx, { mammoth: engine })
  assert.equal(result.chapters.length, 2)
  assert.equal(result.chapters[1].label, '第一章')
  assert.equal(received.styleMap.length, 2)
})
