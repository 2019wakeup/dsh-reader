import test from 'node:test'
import assert from 'node:assert/strict'
import { api } from '../src/client/api.js'

function stallFetch(t) {
  const original = globalThis.fetch
  globalThis.fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      const signal = init && init.signal
      if (!signal) return
      if (signal.aborted) {
        reject(new Error('aborted'))
        return
      }
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    })
  t.after(() => {
    globalThis.fetch = original
  })
}

test('a stalled request rejects on its own deadline instead of waiting forever', async (t) => {
  stallFetch(t)
  const started = Date.now()
  await assert.rejects(api.__request('/api/explain', {}, { timeoutMs: 30 }), /timed out/i)
  assert.ok(Date.now() - started < 2_000, 'gave up on schedule')
})

test('requests without a timeout keep the plain fetch path', async (t) => {
  const original = globalThis.fetch
  const seen = []
  globalThis.fetch = async (url, init) => {
    seen.push(init)
    return { ok: true, json: async () => ({ ok: 1 }) }
  }
  t.after(() => {
    globalThis.fetch = original
  })
  assert.deepEqual(await api.__request('/api/store'), { ok: 1 })
  assert.equal(seen[0] === undefined || !seen[0].signal, true, 'no extra signal is attached')
})

test('a real HTTP error still surfaces its own message', async (t) => {
  const original = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 504, json: async () => ({ error: 'model did not answer within 90000ms' }) })
  t.after(() => {
    globalThis.fetch = original
  })
  await assert.rejects(api.__request('/api/explain', {}, { timeoutMs: 5_000 }), /did not answer within/)
})
