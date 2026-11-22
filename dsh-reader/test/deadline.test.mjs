import test from 'node:test'
import assert from 'node:assert/strict'
import { createDeadline } from '../lib/deadline.js'

const tick = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

test('aborts and reports a timeout when the deadline passes', async () => {
  const deadline = createDeadline({ timeoutMs: 20 })
  assert.equal(deadline.signal.aborted, false)
  await tick(40)
  assert.equal(deadline.signal.aborted, true)
  assert.equal(deadline.timedOut, true)
  deadline.dispose()
})

test('without a timeout it only follows the caller signal', async () => {
  const parent = new AbortController()
  const deadline = createDeadline({ signal: parent.signal })
  await tick(20)
  assert.equal(deadline.signal.aborted, false)
  parent.abort()
  assert.equal(deadline.signal.aborted, true)
  assert.equal(deadline.timedOut, false, 'a caller abort is not our timeout')
  deadline.dispose()
})

test('a caller that already aborted is forwarded immediately', () => {
  const parent = new AbortController()
  parent.abort()
  const deadline = createDeadline({ timeoutMs: 5_000, signal: parent.signal })
  assert.equal(deadline.signal.aborted, true)
  assert.equal(deadline.timedOut, false)
  deadline.dispose()
})

test('dispose clears the timer so a finished call never fires later', async () => {
  let fired = false
  const deadline = createDeadline({ timeoutMs: 15 })
  deadline.signal.addEventListener('abort', () => {
    fired = true
  })
  deadline.dispose()
  await tick(40)
  assert.equal(fired, false)
  assert.equal(deadline.signal.aborted, false)
})

test('the nearest deadline wins when both a timeout and an abort are pending', async () => {
  const parent = new AbortController()
  const deadline = createDeadline({ timeoutMs: 500, signal: parent.signal })
  parent.abort()
  await tick(20)
  assert.equal(deadline.signal.aborted, true)
  assert.equal(deadline.timedOut, false)
  deadline.dispose()
})
