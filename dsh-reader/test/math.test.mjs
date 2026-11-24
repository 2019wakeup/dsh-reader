import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>')
globalThis.document = dom.window.document

const { hasMath, renderMathInHtml } = await import('../src/client/math.js')
const { READER_CSS } = await import('../src/client/styles.js')

const katex = {
  renderToString(tex, options) {
    return `<span class="katex" data-tex="${tex}" data-display="${options.displayMode}">${tex}</span>`
  },
}

test('detects inline, block and bracket formulas', () => {
  assert.equal(hasMath('质能方程 $E=mc^2$'), true)
  assert.equal(hasMath('块公式 $$\\frac{a}{b}$$'), true)
  assert.equal(hasMath('括号公式 \\(a+b\\)'), true)
  assert.equal(hasMath('普通文本，$5 和 $6'), false)
})

test('renders inline and block math but leaves code alone', () => {
  const output = renderMathInHtml(
    '<p>行内 $a+b$ 和块 <span>$$x^2$$</span></p><pre>$keep$</pre><p><code>$code$</code></p>',
    katex,
  )
  assert.match(output, /rd-math-inline/)
  assert.match(output, /rd-math-block/)
  assert.match(output, /data-display="true"/)
  assert.match(output, /<pre>\$keep\$<\/pre>/)
  assert.match(output, /<code>\$code\$<\/code>/)
})

test('PDF selection uses an explicit blue instead of the theme accent', () => {
  assert.match(READER_CSS, /\.rd-text-layer span::selection\{background:rgba\(47,111,237,\.42\)/)
})
