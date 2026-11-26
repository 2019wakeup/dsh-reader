import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { buildTranslatedOnlyHtml, extractUnits } from '../src/client/translation/units.js'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
globalThis.document = dom.window.document
globalThis.Node = dom.window.Node

function mount(html) {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}

function translate(html, text = '译文') {
  return buildTranslatedOnlyHtml(html, () => `${text} {{RD:0}}`)
}

test('preserves heading anchor and list structure', () => {
  const out = mount(translate('<h2 id="sec-1">标题 <a href="#x">链接</a></h2><ul><li>第一项</li><li>第二项</li></ul>'))
  assert.equal(out.querySelector('h2').id, 'sec-1')
  assert.equal(out.querySelector('a').getAttribute('href'), '#x')
  assert.equal(out.querySelectorAll('li').length, 2)
  out.remove()
})

test('preserves table structure and spans in only mode', () => {
  const out = mount(buildTranslatedOnlyHtml('<table><tr><td colspan="2">单元格</td></tr></table>', () => '译文'))
  assert.equal(out.querySelector('table').tagName, 'TABLE')
  assert.equal(out.querySelector('td').getAttribute('colspan'), '2')
  assert.match(out.querySelector('td').textContent, /译文/)
  out.remove()
})

test('preserves code blocks and inline code', () => {
  const out = mount(translate('<pre><code>const a = 1</code></pre><p>运行 <code>npm test</code></p>'))
  assert.equal(out.querySelector('pre code').textContent, 'const a = 1')
  assert.equal(out.querySelector('p code').textContent, 'npm test')
  out.remove()
})

test('preserves KaTeX / MathML formulas', () => {
  const out = mount(translate('<p>公式 <span class="katex"><span class="katex-mathml">x^2</span></span></p>'))
  assert.ok(out.querySelector('.katex'))
  assert.equal(out.querySelector('.katex').textContent, 'x^2')
  out.remove()
})

test('preserves links and image alt/src', () => {
  const host = mount('<p>图示 <a href="/paper">论文</a> <img src="/fig.png" alt="架构图"></p>')
  const units = extractUnits(host)
  assert.equal(units[0].protected.length, 2)
  const out = mount(buildTranslatedOnlyHtml(host.innerHTML, () => '图示译文 {{RD:0}} {{RD:1}}'))
  assert.equal(out.querySelector('a').getAttribute('href'), '/paper')
  assert.equal(out.querySelector('img').getAttribute('alt'), '架构图')
  assert.equal(out.querySelector('img').getAttribute('src'), '/fig.png')
  out.remove()
  host.remove()
})
