#!/usr/bin/env node
/**
 * Word pipeline probe (PRD v0.15 §9.2).
 *
 * Runs the real mammoth bundle through `docxOpen` in a DOM, then asserts the
 * chapter/outline/table/sanitizer contract that the reader relies on. It is the
 * release gate's 13th check; the browser-level fixture lives in eval/visual.mjs.
 */
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>')
globalThis.document = dom.window.document
globalThis.DOMParser = dom.window.DOMParser
globalThis.window = globalThis
vm.runInThisContext(fs.readFileSync(path.join(root, 'assets', 'mammoth.browser.min.js'), 'utf8'))
const mammoth = globalThis.mammoth
const { docxOpen, parseStyleOutline, splitDocxChapters, sanitizeDocxHtml } = await import(
  path.join(root, 'src', 'client', 'docx.js')
)

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
const STYLES =
  '<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="2"><w:name w:val="标题 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="3"><w:name w:val="heading 2"/></w:style></w:styles>'
const DOC =
  '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
  '<w:p><w:pPr><w:pStyle w:val="2"/></w:pPr><w:r><w:t>第一章 技术报告</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t>技术报告正文。</w:t></w:r></w:p>' +
  '<w:p><w:pPr><w:pStyle w:val="3"/></w:pPr><w:r><w:t>1.1 数据</w:t></w:r></w:p>' +
  '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>指标</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>数值</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
  '<w:p><w:r><w:t>1 引言............3</w:t></w:r></w:p>' +
  '<w:p><w:pPr><w:pStyle w:val="2"/></w:pPr><w:r><w:t>第二章 结论</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t>结论正文。</w:t></w:r></w:p>' +
  '</w:body></w:document>'

const checks = []
function check(name, fn) {
  try {
    const detail = fn()
    checks.push({ name, pass: true, detail })
    console.log(`PASS  ${name.padEnd(34)} ${detail}`)
  } catch (error) {
    checks.push({ name, pass: false, detail: String(error && error.message ? error.message : error) })
    console.log(`FAIL  ${name.padEnd(34)} ${error && error.message ? error.message : error}`)
  }
}

const docx = zipBytes([
  ['[Content_Types].xml', CONTENT_TYPES],
  ['_rels/.rels', RELS],
  ['word/document.xml', DOC],
  ['word/styles.xml', STYLES],
])
const result = await docxOpen(docx, { mammoth })

check('chapter split', () => {
  if (result.chapters.length !== 2) throw new Error(`chapters=${result.chapters.length}`)
  return `${result.chapters.map((chapter) => chapter.label).join(' | ')}`
})
check('outline levels', () => {
  const levels = result.outline.map((item) => item.level).join(',')
  if (levels !== '1,2,1') throw new Error(`levels=${levels}`)
  return levels
})
check('outlineLvl heading', () => {
  if (!result.chapters[0].html.includes('<h1>第一章 技术报告</h1>')) throw new Error(result.chapters[0].html.slice(0, 80))
  return 'h1'
})
check('table wrapper', () => {
  if (!result.chapters[0].html.includes('rd-table-wrap')) throw new Error('missing wrapper')
  return 'wrapped'
})
check('toc leaders removed', () => {
  if (result.chapters[0].html.includes('............')) throw new Error('dot leaders survived')
  return 'clean'
})
check('sanitizer strips scripts', () => {
  const clean = sanitizeDocxHtml('<p onclick="x()">a<script>b</script><a href="javascript:1">c</a></p>')
  if (/script|onclick|javascript:/.test(clean)) throw new Error(clean)
  return 'clean'
})
check('style outline parser', () => {
  const styles = parseStyleOutline(STYLES)
  if (styles.length !== 2 || styles[0].level !== 1) throw new Error(JSON.stringify(styles))
  return `${styles.length} styles`
})
check('chapter text', () => {
  if (!result.chapters[1].text.includes('结论正文')) throw new Error(result.chapters[1].text)
  return 'ok'
})
let guard = ''
try {
  await docxOpen(zipBytes([['word/styles.xml', STYLES]]), { mammoth })
  guard = 'opened without document.xml'
} catch (error) {
  guard = /document\.xml/.test(String(error && error.message)) ? 'rejected' : `wrong error: ${error && error.message}`
}
check('zip guard', () => {
  if (guard !== 'rejected') throw new Error(guard)
  return guard
})

const failed = checks.filter((item) => !item.pass)
await fs.promises.writeFile(
  path.join(here, 'docx-report.json'),
  JSON.stringify({ at: new Date().toISOString(), total: checks.length, failed: failed.length, checks }, null, 2),
)
console.log(`\n${checks.length - failed.length}/${checks.length} docx checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
