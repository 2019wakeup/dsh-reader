import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHTML } from 'linkedom'
import { shouldDismissOnPointerDown, isToolbarTarget } from '../src/client/menu.js'

test('keeps the menu when the pointer lands inside it', () => {
  const { document } = parseHTML('<html><body><div class="rd-mini"><button id="b">x</button></div></body></html>')
  assert.equal(shouldDismissOnPointerDown(document.getElementById('b')), false)
})

test('dismisses on the page background and on null', () => {
  const { document } = parseHTML('<html><body><p id="p">x</p></body></html>')
  assert.equal(shouldDismissOnPointerDown(document.getElementById('p')), true)
  assert.equal(shouldDismissOnPointerDown(null), true)
})

test('recognises a click on the toolbar itself', () => {
  const { document } = parseHTML(
    '<html><body><div class="rd-mini"><button id="b">x</button></div><p id="p">y</p></body></html>',
  )
  assert.equal(isToolbarTarget(document.getElementById('b')), true)
  assert.equal(isToolbarTarget(document.getElementById('p')), false)
})

test('keeps the concept card open while selecting inside it', () => {
  const { document } = parseHTML('<html><body><div class="rd-card"><span id="s">x</span></div></body></html>')
  assert.equal(shouldDismissOnPointerDown(document.getElementById('s')), false)
})
