import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTree, buildGuideTree, layoutTree, guideMarkdown } from '../src/client/mindmap.js'

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
