import test from 'node:test'
import assert from 'node:assert/strict'
import { pushCard, popCard, topCard, replaceTop } from '../src/client/cards.js'

test('pushes a child without dropping the parent', () => {
  assert.deepEqual(pushCard(['p'], 'c'), ['p', 'c'])
})

test('caps the stack at three', () => {
  assert.deepEqual(pushCard(['a', 'b', 'c'], 'd'), ['b', 'c', 'd'])
})

test('pop returns the parent once the child closes', () => {
  assert.deepEqual(popCard(['p', 'c']), ['p'])
  assert.deepEqual(popCard(['p']), [])
  assert.deepEqual(popCard([]), [])
})

test('topCard and replaceTop address only the top entry', () => {
  assert.equal(topCard(['p', 'c']), 'c')
  assert.equal(topCard([]), null)
  assert.deepEqual(replaceTop(['p', 'c'], 'c2'), ['p', 'c2'])
})
