import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
globalThis.document = dom.window.document
globalThis.Node = dom.window.Node

const { extractUnits, renderUnitFragment, buildTranslatedOnlyHtml, unitFromText, unitsFromPdfBlocks } = await import('../src/client/translation/units.js')

function mount(html) {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}

test('extracts leaf blocks, headings and protected inline nodes', () => {
  const host = mount(`
    <h1 id="title">标题 <code>npm</code></h1>
    <p>段落 <a href="/docs">链接</a> 与 <math><mi>x</mi></math></p>
    <ul><li><p>嵌套段落</p></li></ul>
  `)
  const units = extractUnits(host)
  const h1 = units.find((unit) => unit.node.tagName === 'H1')
  const p = units.find((unit) => unit.node.tagName === 'P' && !unit.node.closest('li'))
  const nested = units.find((unit) => unit.node.textContent === '嵌套段落')
  assert.ok(h1 && p && nested, JSON.stringify(units.map((unit) => unit.text)))
  assert.equal(h1.role, 'heading')
  assert.match(h1.text, /\{\{RD:0\}\}/)
  assert.equal(p.protected.length, 2)
  assert.doesNotMatch(p.text, /链接/)
  assert.equal((p.text.match(/\{\{RD:\d+\}\}/g) || []).length, 2)
  assert.equal(units.filter((unit) => unit.node.tagName === 'LI').length, 0)
  host.remove()
})

test('builds translation-only html without losing heading ids, code, links or math', () => {
  const host = mount(`
    <h1 id="title">标题 <code>npm</code></h1>
    <p>段落 <a href="/docs">链接</a> 与 <math><mi>x</mi></math></p>
  `)
  const units = extractUnits(host)
  const h1 = units.find((unit) => unit.role === 'heading')
  const p = units.find((unit) => unit.role === 'body')
  const translations = {
    [h1.hash]: '标题译文 {{RD:0}}',
    [p.hash]: '段落译文 {{RD:0}} 与 {{RD:1}}',
  }
  const html = buildTranslatedOnlyHtml(host.innerHTML, (hash) => translations[hash] || '')
  const output = mount(html)
  assert.equal(output.querySelector('h1').id, 'title')
  assert.match(output.querySelector('h1').textContent, /标题译文/)
  assert.equal(output.querySelector('h1 code').textContent, 'npm')
  assert.equal(output.querySelector('a').getAttribute('href'), '/docs')
  assert.match(output.querySelector('p').textContent, /段落译文/)
  assert.ok(output.querySelector('math'))
  output.remove()
  host.remove()
})

test('a missing placeholder leaves the source block intact', () => {
  const host = mount('<p>段落 <code>npm</code></p>')
  const unit = extractUnits(host)[0]
  assert.equal(renderUnitFragment(unit, '丢了占位符'), null)
  const html = buildTranslatedOnlyHtml(host.innerHTML, () => '丢了占位符')
  const output = mount(html)
  assert.match(output.querySelector('p').textContent, /段落/)
  assert.equal(output.querySelector('code').textContent, 'npm')
  output.remove()
  host.remove()
})


test('duplicate paragraphs share a hash but keep distinct DOM keys', () => {
  const host = mount('<p>重复段落</p><p>重复段落</p>')
  const units = extractUnits(host)
  assert.equal(units.length, 2)
  assert.equal(units[0].hash, units[1].hash)
  assert.notEqual(units[0].key, units[1].key)
  host.remove()
})

test('selection and PDF adapters produce the same unit shape', () => {
  const selection = unitFromText('  一段  选中文本 ')
  assert.equal(selection.role, 'selection')
  assert.equal(selection.text, '一段 选中文本')
  assert.ok(selection.hash)
  const pdf = unitsFromPdfBlocks([{ text: '第一段' }, { text: '第二段' }])
  assert.equal(pdf.length, 2)
  assert.equal(pdf[0].role, 'body')
  assert.notEqual(pdf[0].key, pdf[1].key)
})

test('model output is never interpreted as HTML', () => {
  const host = mount('<p>原文</p>')
  const unit = extractUnits(host)[0]
  const html = buildTranslatedOnlyHtml(host.innerHTML, () => '<script>alert(1)</script>')
  const output = mount(html)
  assert.equal(output.querySelector('script'), null)
  assert.match(output.querySelector('p').textContent, /<script>/)
  output.remove()
  host.remove()
})
