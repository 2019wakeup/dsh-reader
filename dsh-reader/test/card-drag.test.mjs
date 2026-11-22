import test from 'node:test'
import assert from 'node:assert/strict'
import { clampCardPosition } from '../src/client/card-drag.js'

const bounds = { left: 0, top: 0, right: 1280, bottom: 860 }

test('short cards can reach the lower half of the reader', () => {
  const result = clampCardPosition({ left: 900, top: 700, width: 330, height: 300 }, bounds)
  assert.deepEqual(result, { left: 900, top: 552 })
})

test('tall cards stop before their own height leaves the reader', () => {
  const result = clampCardPosition({ left: 900, top: 700, width: 330, height: 700 }, bounds)
  assert.equal(result.top, 152)
})

test('cards cannot cover the toolbar or leave the sides', () => {
  const result = clampCardPosition({ left: -500, top: -500, width: 330, height: 300 }, bounds)
  assert.deepEqual(result, { left: 4, top: 52 })
  const right = clampCardPosition({ left: 5000, top: 100, width: 330, height: 300 }, bounds)
  assert.equal(right.left, 1280 - 330 - 8)
})

test('bounds are flipped when the card is wider than the reader', () => {
  const result = clampCardPosition({ left: 800, top: 100, width: 1600, height: 300 }, { left: 0, top: 0, right: 900, bottom: 500 })
  assert.equal(result.left, 4)
  assert.equal(result.top, 100)
})
