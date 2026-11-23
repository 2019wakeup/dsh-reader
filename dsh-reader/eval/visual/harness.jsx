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
    if (path.startsWith('/dsh-reader-live/api/context')) {
      try {
        ;(window.__contextPosts ||= []).push(JSON.parse(init?.body || '{}'))
      } catch {
        /* keep the visual run alive even if a body is malformed */
      }
      return json({ ok: true })
    }
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

  // The reader view is a `conversation.view` entry: the real platform injects
  // these standard props. The harness fakes them so the chat panel can be
  // exercised without a live model.
  const chat = { messages: [], listeners: new Set(), turn: 0, snapshot: null }
  function makeSnapshot(messages) {
    const nodes = messages.map((message) => ({
      key: message.key,
      kind: message.kind,
      id: message.key,
      data: message.data,
      anchorSeq: 0,
      location: { kind: 'turn', turn: { turn: message.data.turn ?? 1 } },
      visibility: 'visible',
    }))
    const map = new Map(nodes.map((node) => [node.key, node]))
    return {
      order: nodes.map((node) => node.key),
      nodes: { get: (key) => map.get(key) },
      legacy: { nodes: [], turnTimings: new Map(), turnEnds: new Map(), partial: null, runningCalls: [] },
    }
  }
  function emitChat() {
    chat.snapshot = makeSnapshot(chat.messages)
    for (const listener of [...chat.listeners]) listener()
  }
  function pushChat(count = 1) {
    for (let index = 0; index < count; index += 1) {
      chat.turn += 1
      // One turn, two steps: a tool-only step then the answer. The reading panel
      // must merge them into one answer row (see chat-transcript mergeTurnSteps).
      chat.messages.push({
        key: `t${chat.turn}-s1`,
        kind: 'assistant-step',
        data: {
          turn: chat.turn,
          step: 1,
          status: 'settled',
          blocks: [
            { kind: 'reasoning', text: '先判断这属于哪一类问题。' },
            { kind: 'tool-call', name: 'bash', callId: `c${chat.turn}` },
          ],
        },
      })
      chat.messages.push({
        key: `t${chat.turn}-s2`,
        kind: 'assistant-step',
        data: {
          turn: chat.turn,
          step: 2,
          status: 'settled',
          blocks: [{ kind: 'text', text: `第 ${chat.turn} 条流式回答：分布式系统把一致性拆成多个层级。` }],
        },
      })
    }
    emitChat()
  }
  function useChatSelector(selector) {
    return React.useSyncExternalStore(
      (listener) => {
        chat.listeners.add(listener)
        return () => chat.listeners.delete(listener)
      },
      () => selector(chat.snapshot),
    )
  }
  const inputState = { phase: 'plain' }
  const inputListeners = new Set()
  function setPhase(phase) {
    inputState.phase = phase
    for (const listener of [...inputListeners]) listener()
  }
  function useInputSelector(selector) {
    return React.useSyncExternalStore(
      (listener) => {
        inputListeners.add(listener)
        return () => inputListeners.delete(listener)
      },
      () => selector(inputState),
    )
  }
  const useSessionSelector = (selector) => selector({ running: false, removed: false, subagent: null })
  window.__quotes = []
  window.__inserted = []
  window.__openedView = null
  window.__contextPosts = []
  window.__chatPush = pushChat
  window.__chatClear = () => {
    chat.messages = []
    chat.turn = 0
    emitChat()
  }
  window.__setPhase = setPhase
  const inputActions = {
    insertQuote(text) {
      window.__quotes.push(String(text || ''))
      return true
    },
    captureInsertion() {
      window.__captureCount = (window.__captureCount || 0) + 1
      return { revision: window.__captureCount }
    },
    insertText(text, span) {
      window.__inserted.push({ text: String(text || ''), span })
      return true
    },
    setDraft() {},
    submit() {},
    addAttachments() {},
    removeAttachment() {},
    persistDraft() {},
  }
  chat.turn = 1
  chat.messages.push({
    key: 'u1',
    kind: 'user',
    data: { turn: 1, content: [{ type: 'text', text: '这本书的核心观点是什么？' }] },
  })
  emitChat()
  window.__chatPush(1)

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
    React.createElement(window.__view, {
      sessionId,
      useChat: useChatSelector,
      useInput: useInputSelector,
      useSession: useSessionSelector,
      inputActions,
      openView: (view, focus) => {
        window.__openedView = { view, focus }
      },
      viewRequest: null,
      completeViewRequest: () => {},
    }),
  )
  window.__visualReady = true
}

main().catch((error) => bad((error && error.stack) || error))
