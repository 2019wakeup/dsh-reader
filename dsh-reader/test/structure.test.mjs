import test from 'node:test'
import { JSDOM } from 'jsdom'
import assert from 'node:assert/strict'
const dom = new JSDOM('<!doctype html><html><body></body></html>')
globalThis.DOMParser = dom.window.DOMParser

import {
  flattenOutline,
  sampleText,
  chaptersFromToc,
  planPdfSections,
  pageGroupChapters,
  pdfGuideStructure,
  markdownGuideStructure,
  epubGuideStructure,
  destinationPage,
  outlineReliable,
  detectPdfChapters,
} from '../src/client/structure.js'

function fakePdf({ outline = null, pages = 10 } = {}) {
  return {
    numPages: pages,
    doc: {
      async getOutline() {
        return outline
      },
      async getDestination(name) {
        return name === 'ch1' ? [{ num: 1 }] : null
      },
      async getPageIndex(ref) {
        return ref.num
      },
      async getPage(number) {
        return {
          async getTextContent() {
            return { items: [{ str: `page ${number} text` }] }
          },
        }
      },
    },
  }
}

test('flattens nested outline levels', () => {
  const flat = flattenOutline([
    { title: 'Part', items: [{ title: 'Ch 1', items: [{ title: 'Sec 1.1' }] }] },
    { title: 'Ch 2' },
  ])
  assert.deepEqual(
    flat.map((item) => [item.title, item.level]),
    [
      ['Part', 1],
      ['Ch 1', 2],
      ['Sec 1.1', 3],
      ['Ch 2', 1],
    ],
  )
})

test('resolves named and ref destinations to 1-based pages', async () => {
  const pdf = fakePdf()
  assert.equal(await destinationPage(pdf, 'ch1'), 2)
  assert.equal(await destinationPage(pdf, [{ num: 4 }]), 5)
  assert.equal(await destinationPage(pdf, null), null)
})

test('chapters prefer level 1 and fall back to deeper levels', () => {
  const toc = [
    { level: 1, title: 'A', page: 1 },
    { level: 1, title: 'B', page: 5 },
    { level: 2, title: 'B1', page: 5 },
  ]
  const chapters = chaptersFromToc(toc, 10)
  assert.equal(chapters.length, 2)
  assert.equal(chapters[0].end, 4)
  assert.equal(chapters[1].end, 10)
  const deep = chaptersFromToc([{ level: 1, title: 'only', page: 1 }, { level: 2, title: 'x', page: 2 }, { level: 2, title: 'y', page: 6 }], 10)
  assert.equal(deep.length, 2)
  assert.equal(deep[0].title, 'x')
})

test('section planning respects the budget and covers every page', () => {
  const chapters = chaptersFromToc(
    [
      { level: 1, title: 'A', page: 1 },
      { level: 1, title: 'B', page: 30 },
      { level: 1, title: 'C', page: 60 },
    ],
    100,
  )
  const plan = planPdfSections(chapters, 100, { maxSections: 12 })
  assert.ok(plan.length <= 12, `expected <=12, got ${plan.length}`)
  assert.equal(plan[plan.length - 1].end, 100)
  assert.equal(plan[0].page, 1)
})

test('fallback page groups walk the whole document', () => {
  const groups = pageGroupChapters(23, 10)
  assert.equal(groups.length, 3)
  assert.equal(groups[2].end, 23)
})

test('rejects a broken outline that points many entries at one page', () => {
  const broken = Array.from({ length: 26 }, (_, index) => ({
    id: `t${index}`,
    title: `ch ${index}`,
    level: 1,
    page: index === 0 ? 3 : 2,
  }))
  assert.equal(outlineReliable(broken, 523), false)
})

test('accepts a normal outline and caps parts', () => {
  const toc = Array.from({ length: 30 }, (_, index) => ({ id: `t${index}`, title: `ch ${index}`, level: 1, page: index * 10 + 1 }))
  assert.equal(outlineReliable(toc, 300), true)
  const chapters = chaptersFromToc(toc, 300)
  const plan = planPdfSections(chapters, 300, { maxSections: 48, maxParts: 20 })
  const ids = new Set(plan.map((item) => item.partId))
  assert.ok(ids.size <= 20, `expected <=20 parts, got ${ids.size}`)
})

test('detects chapters from typography when bookmarks are broken', async () => {
  const pages = {
    1: [],
    2: [],
    3: [['版权信息', 19], ['书名：示例书', 15], ['作者：周金涛', 15], ['出版社：中信出版集团', 15]],
    4: [['推荐序一 人生小周期', 19], ['“人生发财靠康波”，这是很多人愿意走进并了解周金涛先生的最直观', 15], ['浅白的初心。但周金涛先生倡导的“结构主义”', 15]],
    5: [['推荐序二', 19], ['“示例书”。', 15], ['站在 2024 年回望，也许每个中国人', 15]],
    6: [['第一部分 涛动周期论', 19], ['01 示例章节', 19], ['康波中的价格波动', 15], ['在第五次康波中工业化起飞的中国', 15]],
    7: [['02 繁荣的起点', 19], ['工业化转型期的投资全景', 15], ['长波衰退中的增长与通胀', 15], ['结构主义的薪火', 15]],
    8: [['后记 人生是一场康波', 19], ['人生就是一场康波', 15], ['周期波动与结构演进', 15], ['制度变革与增长', 15]],
  }
  const pdf = {
    numPages: 8,
    doc: {
      async getPage(number) {
        return {
          async getTextContent() {
            return {
              items: (pages[number] || []).map(([str, size], index) => ({
                str,
                transform: [1, 0, 0, size, 0, 700 - index * 20],
              })),
            }
          },
        }
      },
    },
  }
  const chapters = await detectPdfChapters(pdf, 8)
  assert.ok(chapters && chapters.length >= 4, 'detected chapters')
  assert.equal(chapters[0].title, '版权信息')
  assert.equal(chapters[0].page, 3)
})

test('pdf structure merges outline chapters into parts and sections', async () => {
  const outline = [
    { title: 'Chapter One', dest: [{ num: 0 }] },
    { title: 'Chapter Two', dest: [{ num: 5 }] },
  ]
  const pdf = fakePdf({ outline, pages: 12 })
  const structure = await pdfGuideStructure(pdf, { maxSections: 8 })
  assert.deepEqual(structure.toc.map((item) => [item.title, item.page]), [
    ['Chapter One', 1],
    ['Chapter Two', 6],
  ])
  assert.equal(structure.parts.length, 2)
  assert.equal(structure.parts[0].title, 'Chapter One')
  assert.ok(structure.parts.every((part) => part.sectionIds.length > 0))
  assert.ok(structure.sections.every((section) => section.text.includes('page')))
  assert.equal(structure.coverage.from, 1)
  assert.equal(structure.coverage.to, structure.coverage.total)
})

test('sampleText keeps the head and tail with a marker', () => {
  const sampled = sampleText('a'.repeat(100) + 'b'.repeat(100), 40)
  assert.ok(sampled.length <= 40)
  assert.match(sampled, /中间省略/)
  assert.ok(sampled.startsWith('a'))
  assert.ok(sampled.endsWith('b'))
})

test('epub structure turns chapters into parts and bounded sections', () => {
  const book = {
    chapters: [
      { label: '第一章', html: '<p>' + '甲'.repeat(50) + '</p>' },
      { label: '第二章', html: '<p>乙</p>' },
      { label: '', html: '<p></p>' },
    ],
  }
  const structure = epubGuideStructure(book, { maxSections: 4 })
  assert.equal(structure.toc.length, 3)
  assert.equal(structure.parts.length, 2)
  assert.ok(structure.sections.length >= 2)
  assert.equal(structure.sections[0].title, '第一章')
})

test('quick mode plans one sampled section per chapter', () => {
  const chapters = Array.from({ length: 30 }, (_, index) => ({
    id: `ch${index}`,
    title: `章 ${index + 1}`,
    page: index * 10 + 1,
    end: index * 10 + 10,
    fallback: true,
  }))
  const plan = planPdfSections(chapters, 300, { maxSections: 32, maxParts: 24, oneSectionPerPart: true })
  const parts = new Set(plan.map((item) => item.partId))
  assert.ok(parts.size <= 24)
  assert.equal(plan.length, parts.size)
  assert.equal(plan[plan.length - 1].end, 300)
})

test('epub quick mode keeps every chapter as its own part', () => {
  const chapters = Array.from({ length: 27 }, (_, index) => ({
    label: `第${index + 1}章`,
    html: `<p>${'字'.repeat(300)}</p>`,
  }))
  const structure = epubGuideStructure({ chapters }, { maxSections: 32, oneSectionPerPart: true })
  assert.equal(structure.parts.length, 27)
  assert.equal(structure.sections.length, 27)
  assert.ok(structure.parts.every((part) => part.sectionIds.length === 1))
})

test('markdown structure builds parts and bounded sections', () => {
  const long = 'x'.repeat(7000)
  const text = `# Book\n\n${long}\n\n## One\n\nshort\n\n## Two\n\nshort\n\n## Three\n\nshort`
  const structure = markdownGuideStructure(text, { maxSections: 4 })
  assert.ok(structure.sections.length <= 4)
  assert.ok(structure.parts.length >= 1)
  assert.ok(structure.parts.every((part) => part.sectionIds.length > 0))
  assert.ok(structure.sections[0].text.length <= 6000)
})
