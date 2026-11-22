import test from 'node:test'
import assert from 'node:assert/strict'
import { panelPosition } from '../src/client/floating.js'

const bounds = { left: 0, top: 0, right: 1280, bottom: 860, width: 1280, height: 860 }

test('keeps a panel inside the right and bottom edges', () => {
  const position = panelPosition({
    anchor: { left: 1240, top: 820, width: 30, height: 20 },
    width: 330,
    height: 300,
    bounds,
  })
  assert.ok(position.left + position.width <= bounds.right - 8)
  assert.ok(position.top + position.height <= bounds.bottom - 8)
})

test('opens below the anchor when there is no room above', () => {
  const position = panelPosition({
    anchor: { left: 200, top: 120, width: 40, height: 20 },
    width: 330,
    height: 300,
    bounds,
  })
  assert.equal(position.top, 150)
})

test('shrinks the panel and clamps to a narrow reader surface', () => {
  const narrow = { left: 240, top: 44, right: 620, bottom: 860, width: 380, height: 816 }
  const position = panelPosition({
    anchor: { left: 560, top: 300, width: 40, height: 20 },
    width: 330,
    height: 520,
    bounds: narrow,
  })
  assert.ok(position.width <= narrow.width - 16)
  assert.ok(position.left >= narrow.left + 8)
  assert.ok(position.left + position.width <= narrow.right - 8)
  assert.ok(position.top >= narrow.top + 52)
  assert.ok(position.top + position.height <= narrow.bottom - 8)
})
