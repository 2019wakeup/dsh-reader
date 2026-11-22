import React from 'react'
import { createRoot } from 'react-dom/client'

const EMPTY_STORE = { revision: 0, prefs: {}, docs: {}, concepts: {}, debug: { lastSent: [] } }

async function main() {
  const code = await (await fetch('/reader-client.js')).text()
  window.__ModuleLoader__ = {
    load({ factory }) {
      window.__bundle = factory((name) => {
        if (name === 'react') return React
        throw new Error('unexpected require ' + name)
      })
    },
  }
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
  createRoot(document.getElementById('slot-wrapper')).render(
    React.createElement(window.__view, { sessionId: 'layout-probe' }),
  )
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  window.__ready = true
}

// The reader only needs these two endpoints to render its shell.
const realFetch = window.fetch.bind(window)
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url
  const json = (value) => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } })
  if (url.includes('/api/store')) return json({ store: EMPTY_STORE })
  if (url.includes('/api/list')) return json({ entries: [] })
  if (url.includes('/reader-client.js')) return realFetch(input, init)
  return json({ error: 'not mocked: ' + url })
}

main().catch((error) => {
  window.__pageError = String((error && error.stack) || error)
})
