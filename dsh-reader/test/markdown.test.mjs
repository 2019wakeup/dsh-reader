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
  assert.match(markdownRender('> quote'), /<blockquote><p>quote<\/p><\/blockquote>/)
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


test('renders a GFM table with alignment', () => {
  const html = markdownRender('| 名称 | 值 |\n| --- | :---: |\n| a | 1 |\n| b | 2 |')
  assert.match(html, /<table><thead><tr><th>名称<\/th><th style="text-align:center">值<\/th><\/tr><\/thead>/)
  assert.match(html, /<tbody><tr><td>a<\/td><td style="text-align:center">1<\/td><\/tr>/)
  assert.match(html, /<td>b<\/td>/)
})

test('table cells keep code and escaped pipes', () => {
  const html = markdownRender('| 列 |\n| --- |\n| `a|b` |\n| x \\| y |')
  assert.match(html, /<td><code>a\|b<\/code><\/td>/)
  assert.match(html, /<td>x \| y<\/td>/)
})

test('renders nested lists', () => {
  const html = markdownRender('- 一级\n  - 二级\n  - 二级二\n- 另一项')
  assert.match(html, /<ul><li>一级<ul><li>二级<\/li><li>二级二<\/li><\/ul><\/li><li>另一项<\/li><\/ul>/)
})

test('renders task lists', () => {
  const html = markdownRender('- [x] 完成\n- [ ] 待办')
  assert.match(html, /<li class="rd-task"><input type="checkbox" disabled checked> 完成<\/li>/)
  assert.match(html, /<li class="rd-task"><input type="checkbox" disabled> 待办<\/li>/)
})

test('renders strikethrough', () => {
  assert.equal(markdownRender('~~删掉~~'), '<p><del>删掉</del></p>')
})

test('renders a safe image and falls back for relative images without a resolver', () => {
  assert.match(markdownRender('![图](https://example.com/a.png)'), /<img src="https:\/\/example\.com\/a\.png" alt="图"/)
  assert.match(markdownRender('![图](local.png)'), /<span class="rd-img-alt">图<\/span>/)
  assert.match(
    markdownRender('![图](pic.png)', { resolveImage: (src) => `/files/${src}` }),
    /<img src="\/files\/pic\.png" alt="图"/,
  )
})

test('does not render javascript image urls', () => {
  assert.match(markdownRender('![x](javascript:alert(1))'), /rd-img-alt/)
})

test('renders setext headings', () => {
  assert.equal(markdownRender('标题\n==='), '<h1>标题</h1>')
  assert.equal(markdownRender('标题\n---'), '<h2>标题</h2>')
})

test('renders tilde fences with a language', () => {
  assert.match(markdownRender('~~~js\nconst a = 1\n~~~'), /<pre><code class="language-js">const a = 1<\/code><\/pre>/)
})

test('respects an ordered list start', () => {
  assert.match(markdownRender('3. c\n4. d'), /<ol start="3"><li>c<\/li><li>d<\/li><\/ol>/)
})

test('keeps soft line breaks and renders hard breaks', () => {
  assert.equal(markdownRender('a\nb'), '<p>a\nb</p>')
  assert.equal(markdownRender('a  \nb'), '<p>a<br>b</p>')
})

test('escapes html inside blockquotes and tables', () => {
  assert.match(markdownRender('> <b>x</b>'), /&lt;b&gt;x/)
  assert.match(markdownRender('| a |\n| --- |\n| <b>x</b> |'), /&lt;b&gt;x/)
})

test('renders an image with a title', () => {
  assert.match(markdownRender('![a](https://x.test/a.png "标题")'), /title="标题"/)
})
