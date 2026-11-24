import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>')
globalThis.document = dom.window.document
globalThis.DOMParser = dom.window.DOMParser
globalThis.window = globalThis
vm.runInThisContext(fs.readFileSync(new URL('../assets/mammoth.browser.min.js', import.meta.url), 'utf8'))
const mammoth = globalThis.mammoth
const { docxOpen } = await import('../src/client/docx.js')

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

const CONTENT_TYPES =
  '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
const RELS =
  '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
const DOC =
  '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="2"/></w:pPr><w:r><w:t>第一章 引言</w:t></w:r></w:p><w:p><w:r><w:t>这是正文。</w:t></w:r></w:p></w:body></w:document>'
const STYLES =
  '<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="2"><w:name w:val="标题 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style></w:styles>'

test('converts a real docx through mammoth with outlineLvl headings', async () => {
  const docx = zipBytes([
    ['[Content_Types].xml', CONTENT_TYPES],
    ['_rels/.rels', RELS],
    ['word/document.xml', DOC],
    ['word/styles.xml', STYLES],
  ])
  const result = await docxOpen(docx, { mammoth })
  assert.equal(result.chapters.length, 1)
  assert.equal(result.chapters[0].label, '第一章 引言')
  assert.match(result.chapters[0].html, /<h1>第一章 引言<\/h1>/)
  assert.match(result.chapters[0].html, /这是正文。/)
})
