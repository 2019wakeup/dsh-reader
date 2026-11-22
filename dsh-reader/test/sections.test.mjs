import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHTML } from 'linkedom'

class TestDOMParser {
  parseFromString(text) {
    return parseHTML(`<html><body>${String(text)}</body></html>`).document
  }
}
globalThis.DOMParser = TestDOMParser

const { markdownSections, epubSections, pdfSections } = await import('../src/client/sections.js')

test('splits markdown by headings', () => {
  const sections = markdownSections('# 一\nA\n## 二\nB\n')
  assert.equal(sections.length, 2)
  assert.equal(sections[0].title, '一')
  assert.equal(sections[1].level, 2)
  assert.match(sections[1].text, /B/)
})

test('chunks a long markdown section and caps the count', () => {
  const sections = markdownSections('# 一\n' + '段落。\n\n'.repeat(5000), { max: 3 })
  assert.ok(sections.length > 1)
  assert.ok(sections.length <= 3)
  assert.ok(sections.every((section) => section.text.length <= 6000))
})

test('ignores headings inside fenced code', () => {
  const sections = markdownSections('# 安装\n```sh\n# 运行\n```\n正文')
  assert.equal(sections.length, 1)
  assert.equal(sections[0].title, '安装')
})

test('covers a 300-page pdf instead of stopping at 150', async () => {
  const pdf = {
    numPages: 300,
    doc: {
      async getPage(number) {
        return { async getTextContent() { return { items: [{ str: `page ${number}` }] } } }
      },
    },
  }
  const sections = await pdfSections(pdf)
  assert.ok(sections.length >= 25, `expected wider coverage, got ${sections.length}`)
  assert.equal(sections[sections.length - 1].title, '291-300')
})

test('builds epub sections from chapters', () => {
  const sections = epubSections({ chapters: [{ label: '第一章', html: '<p>hello <b>world</b></p>' }] })
  assert.equal(sections.length, 1)
  assert.equal(sections[0].title, '第一章')
  assert.equal(sections[0].text, 'hello world')
})

test('builds pdf sections from page text', async () => {
  const pdf = {
    numPages: 2,
    doc: {
      async getPage(number) {
        return { async getTextContent() { return { items: [{ str: `page ${number}` }] } } }
      },
    },
  }
  const sections = await pdfSections(pdf, { pagesPerSection: 2 })
  assert.equal(sections.length, 1)
  assert.equal(sections[0].page, 1)
  assert.match(sections[0].text, /page 1/)
  assert.match(sections[0].text, /page 2/)
})
