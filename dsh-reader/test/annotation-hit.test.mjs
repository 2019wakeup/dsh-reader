import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHTML } from 'linkedom'
import { annotationIdAt, shouldOpenEditor } from '../src/client/annotation-hit.js'

test('finds the annotation id on a text highlight', () => {
  const { document } = parseHTML('<html><body><div id="root"><mark class="rd-hl" data-anno="a1">x</mark></div></body></html>')
  const root = document.getElementById('root')
  assert.equal(annotationIdAt(document.querySelector('mark').firstChild, root), 'a1')
})

test('ignores marks outside the reader root', () => {
  const { document } = parseHTML('<html><body><mark data-anno="a1">x</mark><div id="root"></div></body></html>')
  assert.equal(annotationIdAt(document.querySelector('mark'), document.getElementById('root')), null)
})

test('returns null for plain text', () => {
  const { document } = parseHTML('<html><body><div id="root"><p id="p">x</p></div></body></html>')
  assert.equal(annotationIdAt(document.getElementById('p'), document.getElementById('root')), null)
})

test('hits a pdf highlight overlay', () => {
  const { document } = parseHTML(
    '<html><body><div id="root"><div class="rd-pdf-hl" data-anno="p1"></div></div></body></html>',
  )
  assert.equal(annotationIdAt(document.querySelector('.rd-pdf-hl'), document.getElementById('root')), 'p1')
})

test('does not open the editor while the user is selecting text', () => {
  const { document } = parseHTML('<html><body><div id="root"><mark data-anno="a1">x</mark></div></body></html>')
  const root = document.getElementById('root')
  const mark = document.querySelector('mark')
  assert.equal(shouldOpenEditor(mark, root, false), null)
  assert.equal(shouldOpenEditor(mark, root, true), 'a1')
})
