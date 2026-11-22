import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTree, buildGuideTree, layoutTree, guideMarkdown, splitNodeTitle } from '../src/client/mindmap.js'

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
