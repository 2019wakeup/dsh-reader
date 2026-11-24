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
      legacy: {
        nodes: [],
        turnTimings: new Map(),
        turnEnds: new Map(),
        partial: chat.partial || null,
        runningCalls: Array.isArray(chat.runningCalls) ? chat.runningCalls : [],
      },
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
  window.__chatPushUser = (content) => {
    chat.turn += 1
    const parts = typeof content === 'string' ? [{ type: 'text', text: content }] : Array.isArray(content) ? content : []
    chat.messages.push({
      key: `u${chat.turn}`,
      kind: 'user',
      data: { turn: chat.turn, content: parts },
    })
    emitChat()
  }
  window.__chatClear = () => {
    chat.messages = []
    chat.turn = 0
    chat.partial = null
    chat.runningCalls = []
    emitChat()
  }
  // Streaming state: a running assistant node (reasoning/tool blocks) plus the
  // platform's duplicated legacy partial carrying the text. The panel must show
  // the text in the bubble while streaming and a live action line before text.
  window.__chatStream = ({ text = '', reasoning = '先梳理这段上下文。', tools = [] } = {}) => {
    const turn = chat.turn || 1
    chat.messages = chat.messages.filter((message) => !message.streamingProbe)
    chat.messages.push({
      key: `stream-${turn}`,
      streamingProbe: true,
      kind: 'assistant-step',
      data: { turn, step: 1, status: 'running', blocks: [{ kind: 'reasoning', text: reasoning }] },
    })
    chat.partial = { turn, step: 1, status: 'running', blocks: text ? [{ kind: 'text', text }] : [] }
    chat.runningCalls = tools.map((name, index) => ({ callId: `live-${index}`, name, argsRaw: '{}' }))
    emitChat()
  }
  window.__chatStreamSettle = (text = '流式回答完成。') => {
    chat.messages = chat.messages.filter((message) => !message.streamingProbe)
    chat.partial = null
    chat.runningCalls = []
    chat.turn += 1
    chat.messages.push({
      key: `t${chat.turn}-s1`,
      kind: 'assistant-step',
      data: { turn: chat.turn, step: 1, status: 'settled', blocks: [{ kind: 'text', text }] },
    })
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
    addAttachments(ids) {
      window.__readerAttachmentIds = Array.isArray(ids) ? ids.slice() : []
      return true
    },
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

  // The reader chat panel resolves durable images through the client Session
  // object layer. Serve one generated PNG for every image ref so attachment
  // states can be screenshotted without a live attachment store.
  const FIXTURE_IMAGE_BASE64 = "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"
  function fixtureImageBytes() {
    const binary = atob(FIXTURE_IMAGE_BASE64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return bytes
  }
  const mockSessions = {
    binding: () => ({
      session: {
        readAttachment: async (attachment) => ({ ok: true, value: { attachment, data: fixtureImageBytes() } }),
      },
    }),
  }
  window.__mockSessions = mockSessions
  window.__fixtureImageDataUrl = `data:image/png;base64,${FIXTURE_IMAGE_BASE64}`

  // The reader's Ask-AI flow stages selected figures as composer drafts through
  // the client conversation controller; record them for the visual check.
  const mockConversation = {
    createDrafts(sessionId, files) {
      window.__readerAttachments = Array.from(files || []).map((file) => ({ name: file.name, type: file.type, size: file.size }))
      return Array.from(files || []).map((file, index) => ({ id: `visual-draft-${index + 1}`, file }))
    },
    releaseDraftAttachment(id) {
      window.__readerReleased = [...(window.__readerReleased || []), id]
    },
  }
  window.__mockConversation = mockConversation

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
    sessions: mockSessions,
    conversation: mockConversation,
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
