import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import React from 'react'
import { renderToString } from 'react-dom/server'

function fakeDocument() {
  return {
    createElement() {
      return {
        setAttribute() {},
        textContent: '',
        appendChild() {},
      }
    },
    head: { appendChild() {} },
  }
}

function loadBundle() {
  const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  let entry = null
  const win = {
    __ModuleLoader__: {
      load(registration) {
        entry = registration
      },
    },
  }
  new Function('window', code)(win)
  assert.ok(entry, 'bundle registers a module')
  return entry
}

function mount() {
  const entry = loadBundle()
  const registrations = []
  const mod = entry.factory((name) => {
    if (name === 'react') return React
    throw new Error('unexpected module request: ' + name)
  })
  globalThis.document = fakeDocument()
  mod.apply({
    slots: {
      inject(key, callback) {
        assert.equal(key, 'conversation.view')
        callback()
      },
      register(options, component) {
        registrations.push({ options, component })
        return () => {}
      },
    },
  })
  delete globalThis.document
  assert.equal(registrations.length, 1)
  return registrations[0]
}

test('bundle id matches the package name', () => {
  const entry = loadBundle()
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(entry.id, pkg.name)
})

test('registers the reader conversation view', () => {
  const { options } = mount()
  assert.equal(options.name, 'conversation.view')
  assert.equal(options.id, 'reader')
  assert.equal(typeof options.label, 'function')
  assert.ok(['阅读', 'Reader'].includes(options.label()))
})

test('renders the empty library shell without crashing', () => {
  const { component } = mount()
  const html = renderToString(React.createElement(component, { sessionId: 's1' }))
  assert.match(html, /rd-root/)
  assert.match(html, /rd-toolbar/)
})

test('asks for a session when opened without one', () => {
  const { component } = mount()
  const html = renderToString(React.createElement(component, {}))
  assert.match(html, /打开阅读视图|Open the reader/)
})
