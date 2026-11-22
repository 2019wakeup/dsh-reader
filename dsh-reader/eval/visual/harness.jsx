import React from 'react'
import { createRoot } from 'react-dom/client'

const params = new URLSearchParams(location.search)
const sessionId = params.get('session') || ''

function bad(message) {
  document.body.innerHTML = `<pre id="boot-error" style="padding:16px;color:#b91c1c">${String(message)}</pre>`
  window.__bootError = String(message)
}

async function main() {
  const fixtures = await (await fetch('/fixtures.json')).json()
  const store = fixtures.store
  let currentStore = structuredClone(store)
  const realFetch = window.fetch.bind(window)
  const json = (value, status = 200) =>
    new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url
    const path = url.startsWith(location.origin) ? url.slice(location.origin.length) : url
    if (path.startsWith('/dsh-reader-live/assets/')) return realFetch(input, init)
    if (path.startsWith('/fixtures.json')) return realFetch(input, init)
    if (path.startsWith('/dsh-reader-live/api/store')) return json({ store: currentStore })
    if (path.startsWith('/dsh-reader-live/api/list')) return json({ entries: fixtures.entries })
    if (path.startsWith('/dsh-reader-live/api/file')) {
      const response = await realFetch('/real' + path, { headers: init?.headers })
      return new Response(await response.arrayBuffer(), {
        status: response.status,
        headers: {
          'content-type': response.headers.get('content-type') || 'application/octet-stream',
          'x-doc-fingerprint': response.headers.get('x-doc-fingerprint') || '',
        },
      })
    }
    if (path.includes('/api/mutate')) {
      try {
        const op = JSON.parse(init?.body || '{}')
        if (op.op === 'prefs/set' && op.prefs) currentStore.prefs = { ...currentStore.prefs, ...op.prefs }
      } catch {
        /* keep the fixture unchanged */
      }
      return json({ store: currentStore })
    }
    if (path.includes('/api/guide')) return json({ guide: fixtures.guide, reused: 0, generated: 0, store: currentStore })
    if (path.includes('/api/explain')) {
      const payload = JSON.parse(init?.body || '{}')
      let concept = { ...fixtures.concept, occurrences: [] }
      if (payload.parentId) {
        // Reuse the second fixture concept so the store and the concept-library
        // counts stay untouched; this is only for the stacked-card rendering test.
        concept = {
          ...fixtures.store.concepts.c2,
          occurrences: [],
          parentId: payload.parentId,
        }
      }
      return json({ concept, store: currentStore })
    }
    if (path.includes('/api/concept/ask')) return json({ answer: '示例回答：这是视觉测试夹具。', store: currentStore })
    if (path.includes('/api/translate')) {
      const payload = JSON.parse(init?.body || '{}')
      const translations = {}
      for (const segment of payload.segments || []) {
        translations[segment.id] = `译文：${String(segment.text || '').slice(0, 16)}`
      }
      return json({
        translations,
        cached: 0,
        generated: Object.keys(translations).length,
        target: payload.target,
      })
    }
    if (path.includes('/api/models'))
      return json({
        current: { provider: 'p', model: 'm' },
        providers: [
          { id: 'p', name: 'Provider P', models: [{ id: 'm', name: 'Model M' }] },
          { id: 'p2', name: 'Provider P2', models: [{ id: 'm2', name: 'Model M2' }] },
        ],
      })
    if (path.includes('/api/backups')) return json({ backups: [{ name: 'store-0.json', size: 100, at: 1 }] })
    if (path.includes('/api/import') || path.includes('/api/restore') || path.includes('/api/export')) return json({ store: currentStore })
    return json({ error: 'not mocked: ' + path }, 400)
  }

  window.__ModuleLoader__ = {
    load({ factory }) {
      window.__bundle = factory((name) => {
        if (name === 'react') return React
        throw new Error('unexpected require ' + name)
      })
    },
  }
  const code = await (await realFetch('/reader-client.js')).text()
  new Function(code)()
  const ctx = {
    slots: {
      inject(_slot, callback) {
        callback()
      },
      register(_spec, component) {
        window.__view = component
      },
    },
  }
  window.__bundle.apply(ctx)
  createRoot(document.getElementById('root')).render(
    React.createElement(window.__view, { sessionId }),
  )
  window.__visualReady = true
}

main().catch((error) => bad((error && error.stack) || error))
