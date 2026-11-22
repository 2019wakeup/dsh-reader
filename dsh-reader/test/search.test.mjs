import test from 'node:test'
import assert from 'node:assert/strict'
import { searchText } from '../src/client/search.js'

test('finds case-insensitive matches with context', () => {
  const results = searchText('Hello world hello', 'hello')
  assert.equal(results.length, 2)
  assert.equal(results[0].index, 0)
  assert.match(results[0].snippet, /Hello world/)
})

test('caps the number of results', () => {
  const results = searchText('a '.repeat(100), 'a', 3)
  assert.equal(results.length, 3)
})

test('returns nothing for an empty query', () => {
  assert.deepEqual(searchText('text', '   '), [])
})
