import test from 'node:test'
import assert from 'node:assert/strict'
import { markdownRender } from '../src/client/markdown.js'

test('renders a heading', () => {
  assert.equal(markdownRender('# Title'), '<h1>Title</h1>')
})

test('renders bold and italic', () => {
  assert.equal(markdownRender('**bold**'), '<p><strong>bold</strong></p>')
  assert.equal(markdownRender('*italic*'), '<p><em>italic</em></p>')
})

test('renders inline code without interpreting the content', () => {
  assert.equal(markdownRender('`x<y`'), '<p><code>x&lt;y</code></p>')
})

test('renders an unordered list', () => {
  assert.match(markdownRender('- a\n- b'), /<ul><li>a<\/li><li>b<\/li><\/ul>/)
})

test('renders a blockquote', () => {
  assert.match(markdownRender('> quote'), /<blockquote>quote<\/blockquote>/)
})

test('escapes raw html', () => {
  assert.match(markdownRender('<script>alert(1)</script>'), /&lt;script&gt;/)
})

test('renders a fenced code block escaped', () => {
  assert.match(markdownRender('```js\nconst a = 1 < 2\n```'), /<pre><code[^>]*>const a = 1 &lt; 2/)
})

test('drops javascript links but keeps the label', () => {
  assert.equal(markdownRender('[x](javascript:alert(1))'), '<p>x</p>')
})

test('keeps an https link', () => {
  assert.match(markdownRender('[x](https://example.com)'), /<a href="https:\/\/example\.com"/)
})
