import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHTML } from 'linkedom'
import { createHistory, isEditableTarget } from '../src/client/history.js'

test('undo returns the last pushed entry and moves it to the redo stack', () => {
  const history = createHistory()
  history.push({ label: 'add', undo: { op: 'x' }, redo: { op: 'y' } })
  assert.equal(history.undo().label, 'add')
  assert.equal(history.canUndo(), false)
  assert.equal(history.redo().label, 'add')
  assert.equal(history.canRedo(), false)
})

test('caps the stack at the limit', () => {
  const history = createHistory(2)
  history.push({ label: '1' })
  history.push({ label: '2' })
  history.push({ label: '3' })
  assert.equal(history.undo().label, '3')
  assert.equal(history.undo().label, '2')
  assert.equal(history.undo(), null)
})

test('pushing after undo clears the redo stack', () => {
  const history = createHistory()
  history.push({ label: 'a' })
  history.undo()
  history.push({ label: 'b' })
  assert.equal(history.canRedo(), false)
})

test('undo on an empty stack returns null', () => {
  const history = createHistory()
  assert.equal(history.undo(), null)
  assert.equal(history.redo(), null)
})

test('clear empties both stacks', () => {
  const history = createHistory()
  history.push({ label: 'a' })
  history.undo()
  history.clear()
  assert.equal(history.canUndo(), false)
  assert.equal(history.canRedo(), false)
})

test('a delete entry keeps the full annotation payload for restore', () => {
  const history = createHistory()
  const annotation = { id: 'a1', kind: 'text', chapter: 0, quote: 'q', occurrence: 1, color: '#6fcf97', note: 'n' }
  history.push({
    label: 'delete',
    undo: { op: 'annotation/add', docKey: 'd', annotation },
    redo: { op: 'annotation/remove', docKey: 'd', id: 'a1' },
  })
  assert.deepEqual(history.undo().undo.annotation, annotation)
})

test('treats inputs, textareas and contenteditable as editable', () => {
  const { document } = parseHTML(
    '<html><body><input id="i"><textarea id="t"></textarea><div id="e" contenteditable="true"></div><p id="p"></p></body></html>',
  )
  assert.equal(isEditableTarget(document.getElementById('i')), true)
  assert.equal(isEditableTarget(document.getElementById('t')), true)
  assert.equal(isEditableTarget(document.getElementById('e')), true)
  assert.equal(isEditableTarget(document.getElementById('p')), false)
})
