import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTree,
  buildGuideTree,
  layoutTree,
  guideMarkdown,
  splitNodeTitle,
  chunkNodeLines,
  mapGridVars,
  documentTitle,
  cleanGuideSummary,
  sanitizeGuide,
} from '../src/client/mindmap.js'

const sections = [
  { id: 'a', title: '第一部分', level: 1, summary: 'A' },
  { id: 'a1', title: '第一章', level: 2, summary: 'A1' },
  { id: 'a2', title: '第二章', level: 2, summary: 'A2' },
  { id: 'b', title: '第二部分', level: 1, summary: 'B' },
]

test('builds a tree from heading levels', () => {
  const tree = buildTree('书', sections)
  assert.equal(tree.title, '书')
  assert.equal(tree.children.length, 2)
  assert.equal(tree.children[0].children.length, 2)
  assert.equal(tree.children[1].children.length, 0)
})

test('lays out visible nodes and edges', () => {
  const layout = layoutTree(buildTree('书', sections))
  assert.equal(layout.nodes.length, 5)
  assert.equal(layout.edges.length, 4)
  const root = layout.nodes.find((node) => node.id === 'root')
  assert.ok(root && root.x === 0)
})

test('collapsing a branch hides its descendants', () => {
  const layout = layoutTree(buildTree('书', sections), new Set(['a']))
  const ids = layout.nodes.map((node) => node.id)
  assert.ok(ids.includes('a'))
  assert.ok(!ids.includes('a1'))
  assert.equal(layout.edges.length, 2)
})

test('exports a readable markdown outline', () => {
  const guide = { synopsis: '主旨', questions: ['q1', 'q2'], sections: [{ title: '一', summary: 'S', keyPoints: ['k'] }] }
  const text = guideMarkdown({ title: '书', guide })
  assert.match(text, /^# 书/m)
  assert.match(text, /主旨/)
  assert.match(text, /q1/)
  assert.match(text, /二|一/)
})


test('chunked sections of one chapter merge into the chapter node', () => {
  const tree = buildGuideTree('书', {
    parts: [
      { id: 'c1', title: '01 示例章节', summary: '本篇摘要', sectionIds: ['c1-1', 'c1-2', 'c1-3'] },
    ],
    sections: [
      { id: 'c1-1', title: '01 示例章节（1）', page: 3, summary: '第一段' },
      { id: 'c1-2', title: '01 示例章节（2）', page: 11, summary: '第二段' },
      { id: 'c1-3', title: '01 示例章节（3）', page: 20, summary: '第三段' },
    ],
  })
  assert.equal(tree.children.length, 1)
  assert.equal(tree.children[0].children.length, 3, 'chunk children stay available for drill-down')
  assert.deepEqual(tree.children[0].children.map((child) => child.chunkIndex), [1, 2, 3])
  const collapsed = layoutTree(tree, new Set(['c1']))
  assert.equal(collapsed.nodes.length, 2, 'the map opens at chapter level')
  const expanded = layoutTree(tree, new Set())
  assert.equal(expanded.nodes.length, 5)
})

test('long node titles wrap to at most two lines', () => {
  const short = splitNodeTitle('短标题')
  assert.deepEqual(short, ['短标题'])
  const long = splitNodeTitle('01 示例章节——价格波动与阶段划分')
  assert.equal(long.length, 2)
  assert.ok(long[0].length <= 17)
  const veryLong = splitNodeTitle('01 示例章节——价格波动与阶段划分以及更多补充说明文字用于测试超长标题换行与省略')
  assert.equal(veryLong.length, 2)
  assert.ok(veryLong[1].endsWith('…'))
})


test('chunk labels are content-based so siblings no longer repeat the chapter title', () => {
  const chapter = '01 人生财富靠康波——康波中的价格波动'
  const tree = buildGuideTree('书', {
    parts: [{ id: 'c1', title: chapter, summary: '篇摘要', sectionIds: ['c1-1', 'c1-2', 'c1-3'] }],
    sections: [
      { id: 'c1-1', title: `${chapter}（1）`, summary: '康波本质是价格波动。', keyPoints: ['康波长度约一个甲子，人生财富由康波决定。'] },
      { id: 'c1-2', title: `${chapter}（2）`, summary: '大宗商品10年牛市后熊市通常贯穿康波衰退和萧条阶段。', keyPoints: [] },
      { id: 'c1-3', title: `${chapter}（3）`, summary: '', keyPoints: [] },
    ],
  })
  const children = tree.children[0].children
  const labels = children.map((child) => chunkNodeLines(child).join(''))
  assert.equal(new Set(labels).size, 3, `labels must be distinct: ${labels.join(' | ')}`)
  labels.forEach((label, index) => assert.ok(label.startsWith(`（${index + 1}）`), label))
  assert.ok(!labels[0].includes(chapter), 'chunk label must not repeat the chapter title')
  assert.match(labels[0], /康波长度约一个甲子/)
  assert.match(labels[1], /大宗商品10年牛市后熊市/)
  assert.match(labels[2], /^（3）01 /, 'falls back to the heading when there is no summary')
})

test('document titles drop extensions and download-site noise', () => {
  assert.equal(documentTitle('人生财富靠康波 (周金涛) (z-library.sk, 1lib.sk, z-lib.sk).epub'), '人生财富靠康波 (周金涛)')
  assert.equal(documentTitle('示例-分布式系统阅读.md'), '示例-分布式系统阅读')
  assert.equal(documentTitle(''), '导读')
})

test('guide summaries with a leaked JSON envelope are unwrapped for display', () => {
  const raw = '{\n  "summary": "作者认为经历调整后经济将复苏。",\n  "keyPoints": ["内需带动", "投资驱动"]\n}'
  const guide = sanitizeGuide({
    synopsis: raw,
    parts: [{ id: 'p1', title: '篇', summary: raw, keyPoints: [raw] }],
    sections: [{ id: 's1', title: '一', summary: raw, keyPoints: [raw] }],
  })
  assert.equal(guide.sections[0].summary, '作者认为经历调整后经济将复苏。')
  assert.ok(!guide.sections[0].summary.includes('{'))
  assert.equal(guide.synopsis, '作者认为经历调整后经济将复苏。')
  assert.equal(guide.parts[0].summary, '作者认为经历调整后经济将复苏。')
  assert.equal(cleanGuideSummary('普通摘要，保留原文。'), '普通摘要，保留原文。')
})



test('grid vars scale with zoom and follow the pan one to one', () => {
  const base = mapGridVars({ pan: { x: 0, y: 0 }, scale: 1 })
  assert.equal(base['--rd-grid-size'], '24px')
  const zoomed = mapGridVars({ pan: { x: 0, y: 0 }, scale: 0.55 })
  assert.ok(Math.abs(parseFloat(zoomed['--rd-grid-size']) - 13.2) < 0.01, zoomed['--rd-grid-size'])
  const panned = mapGridVars({ pan: { x: 40, y: 24 }, scale: 1 })
  assert.ok(Math.abs(parseFloat(panned['--rd-grid-x']) - parseFloat(base['--rd-grid-x']) - 40) < 0.01)
  assert.ok(Math.abs(parseFloat(panned['--rd-grid-y']) - parseFloat(base['--rd-grid-y']) - 24) < 0.01)
  // a defensive floor keeps dots from collapsing at extreme zoom-out
  assert.ok(parseFloat(mapGridVars({ scale: 0.1 })['--rd-grid-size']) >= 8)
})
