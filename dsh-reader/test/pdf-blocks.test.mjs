import test from 'node:test'
import assert from 'node:assert/strict'
import { pdfPageBlocks } from '../src/client/pdf.js'

function fakePdf(items) {
  return {
    doc: {
      async getPage() {
        return { async getTextContent() { return { items } } }
      },
    },
  }
}

const item = (str, x, y, size = 12) => ({ str, transform: [1, 0, 0, size, x, y] })

test('groups adjacent lines into paragraphs and drops tiny blocks', async () => {
  const blocks = await pdfPageBlocks(
    fakePdf([
      item('这是第一段的第一行', 60, 800),
      item('这是第一段的第二行', 60, 786),
      item('12', 500, 740),
      item('这是第二段，和上面隔开了一段距离。', 60, 740),
    ]),
    3,
  )
  assert.equal(blocks.length, 2)
  assert.match(blocks[0].text, /第一段的第一行 这是第一段的第二行/)
  assert.equal(blocks[0].id, 'pg3-0')
  assert.match(blocks[1].text, /第二段/)
})

test('orders items on a line by x position', () => {
  return pdfPageBlocks(
    fakePdf([
      item('世界', 200, 800),
      item('你好', 60, 800),
      item('下一行内容比较长一些。', 60, 786),
    ]),
    1,
  ).then((blocks) => {
    assert.match(blocks[0].text, /^你好 世界/)
  })
})
