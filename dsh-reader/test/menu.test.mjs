import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHTML } from 'linkedom'
import { shouldDismissOnPointerDown, shouldDismissOnScroll, isToolbarTarget } from '../src/client/menu.js'

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

test('a scroll inside a floating panel does not dismiss it', () => {
  const { document } = parseHTML(
    '<html><body><div class="rd-card rd-editor"><textarea id="t"></textarea><div class="rd-quote" id="q">x</div></div><div class="rd-trans-card" id="tr"></div><div class="rd-main" id="m"></div></body></html>',
  )
  assert.equal(shouldDismissOnScroll(document.getElementById('t')), false)
  assert.equal(shouldDismissOnScroll(document.getElementById('q')), false)
  assert.equal(shouldDismissOnScroll(document.getElementById('tr')), false)
})

test('a scroll of the reading surface or of the window still dismisses', () => {
  const { document, window } = parseHTML('<html><body><div class="rd-main" id="m"><p id="p">x</p></div></body></html>')
  assert.equal(shouldDismissOnScroll(document.getElementById('m')), true)
  assert.equal(shouldDismissOnScroll(document.getElementById('p')), true)
  assert.equal(shouldDismissOnScroll(window), true)
  assert.equal(shouldDismissOnScroll(document), true)
  assert.equal(shouldDismissOnScroll(null), true)
})

test('a scroll inside any editable field does not dismiss the editor', () => {
  const { document } = parseHTML('<html><body><input id="i"><div contenteditable="true" id="ce">x</div></body></html>')
  assert.equal(shouldDismissOnScroll(document.getElementById('i')), false)
  assert.equal(shouldDismissOnScroll(document.getElementById('ce')), false)
})
