import test from 'node:test'
import assert from 'node:assert/strict'
import { guideJobFor, startGuideJob } from '../src/client/guide-jobs.js'

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

test('a guide job keeps running after the view unsubscribes', async () => {
  let release
  const job = startGuideJob('doc-a', async ({ report }) => {
    report({ phase: 'section', done: 1, total: 3 })
    await new Promise((resolve) => {
      release = resolve
    })
    return { guide: { id: 'g1' }, store: { docs: {} }, reused: 2 }
  })
  const seen = []
  const off = job.subscribe((state) => seen.push(state))
  assert.equal(seen[0].busy, true)
  assert.equal(guideJobFor('doc-a').state.progress.done, 1)

  // Simulate switching to the conversation page: drop the listener, keep the job.
  off()
  release()
  await tick()

  const kept = guideJobFor('doc-a')
  assert.equal(kept.state.busy, false)
  assert.equal(kept.state.guide.id, 'g1')
  assert.equal(kept.state.reused, 2)

  // Coming back re-subscribes and immediately sees the finished job.
  const again = []
  kept.subscribe((state) => again.push(state))
  assert.equal(again[0].guide.id, 'g1')
})

test('abort cancels the job without reporting an error', async () => {
  const job = startGuideJob('doc-b', async ({ signal }) => {
    await new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })
    return { guide: { id: 'never' } }
  })
  job.abort()
  await tick()
  assert.equal(job.state.busy, false)
  assert.equal(job.state.cancelled, true)
  assert.equal(job.state.error, '')
  assert.equal(job.state.guide, null)
})
