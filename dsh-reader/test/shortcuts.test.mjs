import test from 'node:test'
import assert from 'node:assert/strict'
import { shortcutFor } from '../src/client/shortcuts.js'

function key(name, extra = {}) {
  return { key: name, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...extra }
}

test('maps page keys to next and previous', () => {
  assert.equal(shortcutFor(key('ArrowRight')), 'next')
  assert.equal(shortcutFor(key('ArrowDown')), 'next')
  assert.equal(shortcutFor(key('PageDown')), 'next')
  assert.equal(shortcutFor(key('ArrowLeft')), 'prev')
  assert.equal(shortcutFor(key('ArrowUp')), 'prev')
  assert.equal(shortcutFor(key('PageUp')), 'prev')
})

test('supports the jk page-key preset', () => {
  assert.equal(shortcutFor(key('j'), { pageKeys: 'jk' }), 'next')
  assert.equal(shortcutFor(key('k'), { pageKeys: 'jk' }), 'prev')
  assert.equal(shortcutFor(key('j')), null, 'jk only applies when selected')
  assert.equal(shortcutFor(key('j'), { editable: true, pageKeys: 'jk' }), null)
})

test('maps home and end to document edges', () => {
  assert.equal(shortcutFor(key('Home')), 'start')
  assert.equal(shortcutFor(key('End')), 'end')
})

test('maps undo and redo with the platform modifier', () => {
  assert.equal(shortcutFor(key('z', { metaKey: true })), 'undo')
  assert.equal(shortcutFor(key('Z', { ctrlKey: true })), 'undo')
  assert.equal(shortcutFor(key('z', { metaKey: true, shiftKey: true })), 'redo')
})

test('maps command-f to search', () => {
  assert.equal(shortcutFor(key('f', { metaKey: true })), 'search')
})

test('maps question mark to help', () => {
  assert.equal(shortcutFor(key('?')), 'help')
})

test('ignores everything in editable targets', () => {
  assert.equal(shortcutFor(key('ArrowRight'), { editable: true }), null)
  assert.equal(shortcutFor(key('z', { metaKey: true }), { editable: true }), null)
})

test('ignores unrelated keys and alt combos', () => {
  assert.equal(shortcutFor(key('a')), null)
  assert.equal(shortcutFor(key('ArrowRight', { altKey: true })), null)
})
