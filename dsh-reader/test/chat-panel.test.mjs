import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ReaderChatPanel, ChatToolbarButton, ChatSubmitWatcher, isNearBottom } from '../src/client/chat-panel.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'http://localhost' })
const win = dom.window
globalThis.window = win
globalThis.document = win.document
Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true })
globalThis.HTMLElement = win.HTMLElement
globalThis.Node = win.Node
globalThis.NodeFilter = win.NodeFilter
globalThis.MutationObserver = win.MutationObserver
globalThis.getComputedStyle = win.getComputedStyle
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
globalThis.DOMParser = win.DOMParser

const t = (key) => key

function chatNode(key, kind, data, extra = {}) {
  return {
    key,
    kind,
    id: key,
    data,
    location: { kind: 'turn', turn: { turn: data.turn ?? 1 } },
    visibility: 'visible',
    ...extra,
  }
}

function makeChat(nodes, partial = null, runningCalls = []) {
  const map = new Map(nodes.map((node) => [node.key, node]))
  return {
    order: nodes.map((node) => node.key),
    nodes: { get: (key) => map.get(key) },
    legacy: { nodes: [], turnTimings: new Map(), turnEnds: new Map(), partial, runningCalls },
  }
}

const useChatOf = (snapshot) => (selector) => selector(snapshot)
const useInputOf = (phase) => (selector) => selector({ phase, draft: '', draftRev: 0, attachmentIds: [], occurrences: [], queue: [] })
const useSessionOf = (running) => (selector) => selector({ running, removed: false, subagent: null })

function panelProps(overrides = {}) {
  return {
    t,
    doc: { name: '书.md', ext: '.md' },
    position: { chapter: 0 },
    useChat: useChatOf(makeChat([])),
    useInput: useInputOf('plain'),
    useSession: useSessionOf(false),
    openView: () => {},
    onClose: () => {},
    ...overrides,
  }
}

async function mountPanel(ctx, props) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  ctx.after(() => {
    try {
      root.unmount()
    } catch {
      /* already unmounted */
    }
    host.remove()
  })
  await act(async () => {
    root.render(React.createElement(ReaderChatPanel, props))
  })
  return { host, root }
}

test('面板渲染行并标记空状态', async (ctx) => {
  const chat = makeChat([
    chatNode('u1', 'user', { turn: 1, content: [{ type: 'text', text: '问一' }] }),
    chatNode('a1', 'assistant-step', { turn: 1, status: 'settled', blocks: [{ kind: 'text', text: '答一' }] }),
  ])
  const { host } = await mountPanel(ctx, panelProps({ useChat: useChatOf(chat) }))
  assert.equal(host.querySelectorAll('[data-chat-row]').length, 2)
  assert.equal(host.querySelector('[data-chat-row]').getAttribute('data-kind'), 'user')
  assert.equal(host.querySelector('.rd-chat-empty'), null)
})

test('空会话显示引导文案', async (ctx) => {
  const { host } = await mountPanel(ctx, panelProps())
  const empty = host.querySelector('.rd-chat-empty')
  assert.ok(empty, 'empty state rendered')
  assert.match(empty.textContent, new RegExp(t('label.chatEmpty')))
})

test('工具栏按钮在最新消息到达且面板关闭时点亮未读点', async (ctx) => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  ctx.after(() => {
    try {
      root.unmount()
    } catch {
      /* already unmounted */
    }
    host.remove()
  })
  let snapshot = makeChat([chatNode('u1', 'user', { turn: 1, content: [{ type: 'text', text: '问一' }] })])
  const useChat = (selector) => selector(snapshot)
  const render = async (open) => {
    await act(async () => {
      root.render(React.createElement(ChatToolbarButton, { t, open, onToggle: () => {}, useChat }))
    })
  }
  await render(true)
  assert.equal(host.querySelector('.rd-chat-unread'), null)
  await render(false)
  assert.equal(host.querySelector('.rd-chat-unread'), null)
  snapshot = makeChat([
    chatNode('u1', 'user', { turn: 1, content: [{ type: 'text', text: '问一' }] }),
    chatNode('a1', 'assistant-step', { turn: 1, status: 'settled', blocks: [{ kind: 'text', text: '答一' }] }),
  ])
  await render(false)
  assert.ok(host.querySelector('.rd-chat-unread'), 'unread dot appears while closed')
  await render(true)
  assert.equal(host.querySelector('.rd-chat-unread'), null, 'opening clears the dot')
})

test('提交时代理 onSend 被调用一次', async (ctx) => {
  let sent = 0
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  ctx.after(() => {
    try {
      root.unmount()
    } catch {
      /* already unmounted */
    }
    host.remove()
  })
  const render = async (phase) => {
    await act(async () => {
      root.render(
        React.createElement(ChatSubmitWatcher, {
          useInput: useInputOf(phase),
          onSend: () => {
            sent += 1
          },
        }),
      )
    })
  }
  await render('plain')
  await render('sending')
  await render('submitting')
  assert.equal(sent, 1, 'one send detected across a non-plain phase')
})

test('标准 props 缺失时显示不可用且不抛错', async (ctx) => {
  const errors = []
  const original = console.error
  console.error = (...args) => errors.push(args.join(' '))
  try {
    const { host } = await mountPanel(ctx, { t, doc: { name: '书.md', ext: '.md' }, position: {}, onClose: () => {} })
    assert.ok(host.querySelector('.rd-chat-unavailable'), 'unavailable notice rendered')
    assert.equal(host.querySelectorAll('[data-chat-row]').length, 0)
    assert.equal(errors.length, 0, errors.join(' | '))
  } finally {
    console.error = original
  }
})

test('会话切换后只显示新会话的行', async (ctx) => {
  const chatA = makeChat([
    chatNode('a-u1', 'user', { turn: 1, content: [{ type: 'text', text: '会话 A 的问题' }] }),
    chatNode('a-a1', 'assistant-step', { turn: 1, status: 'settled', blocks: [{ kind: 'text', text: '会话 A 的回答' }] }),
  ])
  const chatB = makeChat([
    chatNode('b-u1', 'user', { turn: 1, content: [{ type: 'text', text: '会话 B 的问题' }] }),
  ])
  let snapshot = chatA
  const useChat = (selector) => selector(snapshot)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  ctx.after(() => {
    try {
      root.unmount()
    } catch {
      /* already unmounted */
    }
    host.remove()
  })
  await act(async () => {
    root.render(React.createElement(ReaderChatPanel, panelProps({ useChat })))
  })
  assert.match(host.textContent, /会话 A/)
  snapshot = chatB
  await act(async () => {
    root.render(React.createElement(ReaderChatPanel, panelProps({ useChat })))
  })
  const rows = host.querySelectorAll('[data-chat-row]')
  assert.equal(rows.length, 1)
  assert.match(rows[0].textContent, /会话 B/)
  assert.doesNotMatch(host.textContent, /会话 A/)
})

test('忙碌阶段显示状态条', async (ctx) => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  ctx.after(() => {
    try {
      root.unmount()
    } catch {
      /* already unmounted */
    }
    host.remove()
  })
  const render = async (phase) => {
    await act(async () => {
      root.render(React.createElement(ReaderChatPanel, panelProps({ useInput: useInputOf(phase) })))
    })
  }
  await render('plain')
  assert.equal(host.querySelector('.rd-chat-busy'), null)
  await render('sending')
  const busy = host.querySelector('.rd-chat-busy')
  assert.ok(busy, 'busy bar rendered')
  assert.equal(busy.textContent, t('label.chatBusy'))
  await act(async () => {
    root.render(
      React.createElement(
        ReaderChatPanel,
        panelProps({ useInput: useInputOf('plain'), useSession: useSessionOf(true) }),
      ),
    )
  })
  assert.ok(host.querySelector('.rd-chat-busy'), 'running session also shows the busy bar')
  await act(async () => {
    root.render(
      React.createElement(
        ReaderChatPanel,
        panelProps({ useInput: useInputOf('plain'), useSession: useSessionOf(false) }),
      ),
    )
  })
  assert.equal(host.querySelector('.rd-chat-busy'), null, 'idle session hides the busy bar')
})

test('isNearBottom 判定跟随阈值', () => {
  assert.equal(isNearBottom({ scrollHeight: 1000, scrollTop: 700, clientHeight: 260 }), true)
  assert.equal(isNearBottom({ scrollHeight: 1000, scrollTop: 500, clientHeight: 260 }), false)
})

test('显示全部按钮展开被截断的历史轮次', async (ctx) => {
  const nodes = []
  for (let turn = 1; turn <= 10; turn += 1) {
    nodes.push(chatNode(`u${turn}`, 'user', { turn, content: [{ type: 'text', text: `问题${turn}` }] }))
  }
  const { host } = await mountPanel(ctx, panelProps({ useChat: useChatOf(makeChat(nodes)) }))
  assert.equal(host.querySelectorAll('[data-chat-row]').length, 8)
  const toggle = host.querySelector('.rd-chat-toggle')
  assert.ok(toggle, 'show-all control rendered')
  assert.equal(toggle.textContent, t('label.chatShowAll'))
  await act(async () => {
    toggle.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  })
  assert.equal(host.querySelectorAll('[data-chat-row]').length, 10)
})

// ---------------------------------------------------------------------------
// ReaderView integration: drawer tab, toolbar button, selection inside panel.
// Loaded through client.js (the shipped bundle), like the other app-level tests.
// ---------------------------------------------------------------------------

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const tick = (ms = 25) => new Promise((resolve) => setTimeout(resolve, ms))

if (win.Range) {
  win.Range.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 })
  win.Range.prototype.getClientRects = () => []
}

async function waitFor(check, timeout = 3000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (check()) return true
    await tick(20)
  }
  return false
}

function jsonResponse(value) {
  return {
    ok: true,
    status: 200,
    json: async () => value,
    arrayBuffer: async () => new TextEncoder().encode('').buffer,
    headers: { get: () => null },
  }
}

let integrationStore = null

function resetIntegrationStore() {
  integrationStore = {
    version: 2,
    revision: 1,
    prefs: {},
    concepts: {},
    docs: {},
  }
}

function loadBundleComponent() {
  const code = fs.readFileSync(path.join(here, '..', 'client.js'), 'utf8')
  let entry = null
  win.__ModuleLoader__ = {
    load(registration) {
      entry = registration
    },
  }
  new Function('window', code)(win)
  const mod = entry.factory((name) => {
    if (name === 'react') return React
    throw new Error('unexpected module ' + name)
  })
  let component = null
  mod.apply({
    slots: {
      inject(_key, callback) {
        callback()
      },
      register(_options, registered) {
        component = registered
        return () => {}
      },
    },
  })
  return component
}

function installIntegrationFetch() {
  const mock = async (url, init = {}) => {
    const target = String(url)
    if (target.includes('/api/list')) {
      return jsonResponse({ cwd: '/w', dir: '.', entries: [{ name: 'book.md', type: 'file', path: 'book.md' }] })
    }
    if (target.includes('/api/models')) {
      return jsonResponse({ current: { provider: 'p', model: 'm' }, providers: [] })
    }
    if (target.includes('/api/store') && !target.includes('/api/mutate')) {
      integrationStore.revision += 1
      return jsonResponse({ store: JSON.parse(JSON.stringify(integrationStore)) })
    }
    if (target.includes('/api/file')) {
      const bytes = new TextEncoder().encode('# Title\n\n分布式系统 正文里提到了线性一致性。\n').buffer
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        arrayBuffer: async () => bytes,
        headers: { get: (name) => (name === 'x-doc-fingerprint' ? 'fp1' : null) },
      }
    }
    if (target.includes('/api/mutate')) {
      const op = JSON.parse(init.body || '{}')
      if (op.op === 'prefs/set') integrationStore.prefs = { ...integrationStore.prefs, ...op.prefs }
      integrationStore.revision += 1
      return jsonResponse({ store: JSON.parse(JSON.stringify(integrationStore)) })
    }
    if (target.includes('/api/context')) return jsonResponse({ ok: true })
    return jsonResponse({})
  }
  // The bundle is evaluated with `new Function`, so its free `fetch` resolves
  // from the Node global, not from the jsdom window.
  globalThis.fetch = mock
  win.fetch = mock
}

function readerChatProps(options = {}) {
  const chat = makeChat([
    chatNode('u1', 'user', { turn: 1, content: [{ type: 'text', text: '这本书讲什么？' }] }),
    chatNode('a1', 'assistant-step', { turn: 1, status: 'settled', blocks: [{ kind: 'text', text: '它用分布式系统举例。' }] }),
  ])
  const quotes = []
  const inserted = []
  const calls = []
  const inputActions = {
    insertQuote:
      options.insertQuote ||
      ((text) => {
        calls.push('quote')
        quotes.push(text)
        return true
      }),
    captureInsertion: () => {
      calls.push('capture')
      return { revision: calls.length }
    },
    insertText: (text, span) => {
      calls.push('insert')
      inserted.push({ text, span })
      return true
    },
  }
  return {
    chat,
    quotes,
    inserted,
    calls,
    props: {
      useChat: (selector) => selector(chat),
      useInput: (selector) => selector({ phase: 'plain', draft: '', draftRev: 0 }),
      useSession: (selector) => selector({ running: false, removed: false, subagent: null }),
      inputActions,
      openView: () => {},
    },
  }
}

async function selectInProse(container, needle) {
  const prose = container.querySelector('.rd-prose')
  assert.ok(prose, 'prose rendered')
  const walker = win.document.createTreeWalker(prose, 4)
  let node = null
  let current
  while ((current = walker.nextNode())) {
    if ((current.nodeValue || '').includes(needle)) {
      node = current
      break
    }
  }
  assert.ok(node, `text node containing ${JSON.stringify(needle)}`)
  const index = node.nodeValue.indexOf(needle)
  const range = win.document.createRange()
  range.setStart(node, index)
  range.setEnd(node, index + needle.length)
  const selection = win.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  await act(async () => {
    node.parentElement.dispatchEvent(new win.MouseEvent('mouseup', { bubbles: true }))
    await tick(30)
  })
  return { range, element: node.parentElement }
}

async function mountReader(ctx, extraProps = {}) {
  resetIntegrationStore()
  Object.defineProperty(win.navigator, 'language', { value: 'zh-CN', configurable: true })
  Object.defineProperty(win.navigator, 'languages', { value: ['zh-CN'], configurable: true })
  installIntegrationFetch()
  const component = loadBundleComponent()
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  ctx.after(() => {
    try {
      root.unmount()
    } catch {
      /* already unmounted */
    }
    container.remove()
  })
  await act(async () => {
    root.render(React.createElement(component, { sessionId: 's1', ...extraProps }))
  })
  const opened = await waitFor(() => container.querySelector('.rd-entry'))
  assert.ok(opened, 'library entry rendered')
  const entry = container.querySelector('.rd-entry')
  await act(async () => {
    entry.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  })
  const ready = await waitFor(() => container.querySelector('.rd-prose'))
  assert.ok(ready, 'document body rendered: ' + (container.querySelector('.rd-error')?.textContent || '').slice(0, 300))
  return { container, root, component, initialProps: { sessionId: 's1', ...extraProps } }
}

function toolbarButton(container, labels) {
  return Array.from(container.querySelectorAll('.rd-toolbar button')).find((button) =>
    labels.includes(String(button.textContent || '').trim()),
  )
}

test('抽屉切到 chat 页签时渲染面板，切走时卸载', async (ctx) => {
  const fixture = readerChatProps()
  const { container } = await mountReader(ctx, fixture.props)
  const chatButton = toolbarButton(container, ['对话', 'Chat'])
  assert.ok(chatButton, 'chat toolbar button rendered: ' + Array.from(container.querySelectorAll('.rd-toolbar button')).map((b) => b.textContent).join('|'))
  assert.equal(container.querySelector('.rd-chat'), null, 'panel starts closed')
  await act(async () => {
    chatButton.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  })
  const open = await waitFor(() => container.querySelector('.rd-chat'))
  assert.ok(open, 'chat panel mounted')
  assert.equal(container.querySelectorAll('[data-chat-row]').length, 2)
  const drawerTitle = container.querySelector('.rd-drawer-head span')
  assert.equal(drawerTitle.textContent, '对话')
  await act(async () => {
    chatButton.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  })
  const closed = await waitFor(() => !container.querySelector('.rd-chat'))
  assert.ok(closed, 'chat panel unmounted when the tab closes')
})

test('面板内选中文字也会打开选区浮层', async (ctx) => {
  const fixture = readerChatProps()
  const { container } = await mountReader(ctx, fixture.props)
  const chatButton = toolbarButton(container, ['对话', 'Chat'])
  await act(async () => {
    chatButton.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  })
  await waitFor(() => container.querySelector('.rd-chat-md'))
  const target = container.querySelector('.rd-chat-md')
  const textNode = Array.from(target.childNodes).find((node) => node.nodeType === 3) || target.firstChild
  assert.ok(textNode, 'panel has selectable text')
  const range = win.document.createRange()
  range.selectNodeContents(textNode)
  const selection = win.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  await act(async () => {
    target.dispatchEvent(new win.MouseEvent('mouseup', { bubbles: true }))
    await tick(30)
  })
  const menuReady = await waitFor(() => container.querySelector('.rd-mini'))
  assert.ok(menuReady, 'selection toolbar opens inside the panel')
  assert.match(container.querySelector('.rd-mini').textContent, /解释/)
})

test('选中正文点问 AI 后引用与位置进入输入框', async (ctx) => {
  const fixture = readerChatProps()
  const { container } = await mountReader(ctx, fixture.props)
  await selectInProse(container, '分布式系统')
  const menuReady = await waitFor(() => container.querySelector('.rd-mini'))
  assert.ok(menuReady, 'selection toolbar opens')
  const ask = Array.from(container.querySelectorAll('.rd-mini button')).find(
    (button) => String(button.textContent || '').trim() === '问 AI',
  )
  assert.ok(ask, 'ask AI entry: ' + container.querySelector('.rd-mini').textContent)
  await act(async () => {
    ask.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  })
  assert.equal(fixture.quotes.length, 1, 'insertQuote called once')
  const lines = fixture.quotes[0].split('\n')
  assert.equal(lines.length, 2)
  assert.match(lines[0], /《book\.md》/)
  assert.match(lines[0], /%/)
  assert.equal(lines[1], '分布式系统')
  const panelReady = await waitFor(() => container.querySelector('.rd-chat'))
  assert.ok(panelReady, 'chat drawer opens after quoting')
})

test('快捷追问在引用之后插入问句', async (ctx) => {
  const fixture = readerChatProps()
  const { container } = await mountReader(ctx, fixture.props)
  await selectInProse(container, '分布式系统')
  const selectReady = await waitFor(() => container.querySelector('.rd-mini select'))
  assert.ok(selectReady, 'quick ask control rendered')
  const select = container.querySelector('.rd-mini select')
  const setter = Object.getOwnPropertyDescriptor(win.HTMLSelectElement.prototype, 'value').set
  await act(async () => {
    setter.call(select, 'explain')
    select.dispatchEvent(new win.Event('change', { bubbles: true }))
  })
  const quoteIndex = fixture.calls.indexOf('quote')
  const lastCapture = fixture.calls.lastIndexOf('capture')
  const insertIndex = fixture.calls.indexOf('insert')
  assert.ok(quoteIndex >= 0, 'quote inserted: ' + fixture.calls.join(','))
  assert.ok(lastCapture > quoteIndex, 'insertion span re-captured after the quote: ' + fixture.calls.join(','))
  assert.ok(insertIndex > lastCapture, 'question inserted after the quote: ' + fixture.calls.join(','))
  assert.equal(fixture.calls.filter((call) => call === 'capture').length, 2)
  assert.equal(fixture.inserted.length, 1)
  assert.equal(fixture.inserted[0].text, '解释这段')
})

test('insertQuote 返回 false 时提示且不清选区', async (ctx) => {
  const fixture = readerChatProps({ insertQuote: () => false })
  const { container } = await mountReader(ctx, fixture.props)
  await selectInProse(container, '分布式系统')
  const menuReady = await waitFor(() => container.querySelector('.rd-mini'))
  assert.ok(menuReady)
  const ask = Array.from(container.querySelectorAll('.rd-mini button')).find(
    (button) => String(button.textContent || '').trim() === '问 AI',
  )
  assert.ok(ask)
  await act(async () => {
    ask.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  })
  const error = container.querySelector('.rd-mini-error')
  assert.ok(error, 'busy hint rendered in the selection toolbar')
  assert.equal(error.textContent, '输入框正在忙，稍后再试')
  assert.ok(win.getSelection().toString().trim().length > 0, 'selection kept for retry')
  assert.equal(container.querySelector('.rd-chat'), null, 'panel does not open on failure')
})

test('空选区不显示问 AI 入口', async (ctx) => {
  const fixture = readerChatProps()
  const { container } = await mountReader(ctx, fixture.props)
  const prose = container.querySelector('.rd-prose')
  const walker = win.document.createTreeWalker(prose, 4)
  let node = null
  let current
  while ((current = walker.nextNode())) {
    if (/\s/.test(current.nodeValue || '')) {
      node = current
      break
    }
  }
  assert.ok(node, 'whitespace text node found')
  const index = node.nodeValue.indexOf(' ')
  const range = win.document.createRange()
  range.setStart(node, index)
  range.setEnd(node, index + 1)
  const selection = win.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  await act(async () => {
    node.parentElement.dispatchEvent(new win.MouseEvent('mouseup', { bubbles: true }))
    await tick(30)
  })
  assert.equal(container.querySelector('.rd-mini'), null, 'no toolbar for an empty selection')
})

test('inputActions 缺失时浮层不显示问 AI', async (ctx) => {
  const fixture = readerChatProps()
  const { inputActions, ...rest } = fixture.props
  const { container } = await mountReader(ctx, rest)
  await selectInProse(container, '分布式系统')
  const menuReady = await waitFor(() => container.querySelector('.rd-mini'))
  assert.ok(menuReady)
  assert.doesNotMatch(container.querySelector('.rd-mini').textContent, /问 AI/)
  assert.match(container.querySelector('.rd-mini').textContent, /解释/)
})

test('面板头部的对话页按钮调用 openView(chat)', async (ctx) => {
  const calls = []
  const { host } = await mountPanel(
    ctx,
    panelProps({ openView: (view, focus) => calls.push({ view, focus }) }),
  )
  const button = host.querySelector('[data-chat-action="open-view"]')
  assert.ok(button, 'open-in-conversation button rendered')
  assert.equal(button.textContent, t('label.chatJump'))
  await act(async () => {
    button.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  })
  assert.deepEqual(calls, [{ view: 'chat', focus: '' }])
})

test('openView 缺失时对话页按钮不渲染', async (ctx) => {
  const { host } = await mountPanel(ctx, panelProps({ openView: undefined }))
  assert.equal(host.querySelector('[data-chat-action="open-view"]'), null)
})

test('底部输入框开始提交时自动打开对话页签', async (ctx) => {
  const fixture = readerChatProps()
  const phases = { value: 'plain' }
  const useInput = (selector) => selector({ phase: phases.value, draft: '', draftRev: 0 })
  const { container, root, component, initialProps } = await mountReader(ctx, { ...fixture.props, useInput })
  assert.equal(container.querySelector('.rd-chat'), null, 'panel starts closed')
  phases.value = 'sending'
  await act(async () => {
    root.render(React.createElement(component, initialProps))
  })
  const panelReady = await waitFor(() => container.querySelector('.rd-chat'))
  assert.ok(panelReady, 'submitting from the native composer opens the chat tab')
})

test('问答双方有各自的角色标签', async (ctx) => {
  const chat = makeChat([
    chatNode('u1', 'user', { turn: 1, content: [{ type: 'text', text: '问一' }] }),
    chatNode('a1', 'assistant-step', { turn: 1, status: 'settled', blocks: [{ kind: 'text', text: '答一' }] }),
  ])
  const { host } = await mountPanel(ctx, panelProps({ useChat: useChatOf(chat) }))
  const user = host.querySelector('[data-role="user"]')
  const assistant = host.querySelector('[data-role="assistant"]')
  assert.ok(user, 'user row carries its role')
  assert.ok(assistant, 'assistant row carries its role')
  assert.equal(user.querySelector('.rd-chat-role').textContent, 'label.chatRoleUser')
  assert.equal(assistant.querySelector('.rd-chat-role').textContent, 'label.chatRoleAssistant')
})

test('引用消息把位置行渲染成来源行', async (ctx) => {
  const chat = makeChat([
    chatNode('u1', 'user', { turn: 1, content: [{ type: 'text', text: '《书.md》 第 2 章 · CAP 定理\n一致性是什么意思？' }] }),
  ])
  const { host } = await mountPanel(ctx, panelProps({ useChat: useChatOf(chat) }))
  const source = host.querySelector('.rd-chat-source')
  assert.ok(source, 'source line rendered')
  assert.equal(source.textContent, '《书.md》 第 2 章 · CAP 定理')
  assert.ok(host.querySelector('.rd-chat-bubble .rd-chat-md'), 'question body rendered')
})

test('推理与工具调用默认折叠，切换过程后展开', async (ctx) => {
  const chat = makeChat([
    chatNode('a1', 'assistant-step', {
      turn: 1,
      status: 'settled',
      blocks: [
        { kind: 'reasoning', text: '先想一下' },
        { kind: 'text', text: '答案' },
        { kind: 'tool-call', name: 'bash', callId: 'c1' },
      ],
    }),
  ])
  const { host, root } = await mountPanel(ctx, panelProps({ useChat: useChatOf(chat) }))
  assert.ok(host.querySelector('.rd-chat-process'), 'process summary collapsed into one line')
  assert.equal(host.querySelectorAll('.rd-chat-tool').length, 0, 'no tool rows by default')
  const toggle = host.querySelector('[data-chat-action="toggle-process"]')
  assert.ok(toggle, 'process toggle present')
  await act(async () => {
    toggle.click()
  })
  assert.ok(host.querySelectorAll('.rd-chat-tool').length >= 1, 'tool rows appear in full detail')
})

test('已停止的回答仍显示已生成正文', async (ctx) => {
  const chat = makeChat([
    chatNode('a1', 'assistant-step', { turn: 1, status: 'interrupted', blocks: [{ kind: 'text', text: '写到一半' }] }),
  ])
  const { host } = await mountPanel(ctx, panelProps({ useChat: useChatOf(chat) }))
  const row = host.querySelector('[data-kind="interrupted"]')
  assert.ok(row, 'interrupted row rendered')
  assert.match(row.textContent, /写到一半/)
  assert.match(row.textContent, /label\.chatStopped/)
})

test('以书名开头的普通提问不会被当成引用来源', async (ctx) => {
  const chat = makeChat([
    chatNode('u1', 'user', { turn: 1, content: [{ type: 'text', text: '《三体》讲了什么？' }] }),
  ])
  const { host } = await mountPanel(ctx, panelProps({ useChat: useChatOf(chat) }))
  assert.equal(host.querySelector('.rd-chat-source'), null)
  assert.match(host.textContent, /《三体》讲了什么？/)
})

test('空面板显示当前书名', async (ctx) => {
  const { host } = await mountPanel(ctx, panelProps())
  const book = host.querySelector('.rd-chat-empty-book')
  assert.ok(book, 'book name shown in the empty state')
  assert.match(book.textContent, /书\.md/)
})

test('聊天面板内选区只提供对话动作，不提供书内标注', async (ctx) => {
  const fixture = readerChatProps()
  const { container } = await mountReader(ctx, fixture.props)
  const chatButton = toolbarButton(container, ['对话', 'Chat'])
  await act(async () => {
    chatButton.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  })
  await waitFor(() => container.querySelector('.rd-chat-md'))
  const target = container.querySelector('.rd-chat-md')
  const textNode = Array.from(target.childNodes).find((node) => node.nodeType === 3) || target.firstChild
  const range = win.document.createRange()
  range.selectNodeContents(textNode)
  const selection = win.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  await act(async () => {
    target.dispatchEvent(new win.MouseEvent('mouseup', { bubbles: true }))
    await tick(30)
  })
  const menuReady = await waitFor(() => container.querySelector('.rd-mini'))
  assert.ok(menuReady, 'selection toolbar opens inside the panel')
  const menu = container.querySelector('.rd-mini')
  const buttonLabels = Array.from(menu.querySelectorAll('button')).map((button) => String(button.textContent || '').trim())
  assert.ok(buttonLabels.includes('问 AI'), 'conversation action offered: ' + buttonLabels.join('/'))
  assert.equal(menu.querySelectorAll('.rd-swatch').length, 0, 'no highlight swatches in the chat panel')
  assert.equal(buttonLabels.includes('笔记'), false, 'no note action in the chat panel')
  assert.equal(buttonLabels.includes('解释'), false, 'no book explain action in the chat panel')
})

test('展开过程只展开工具，思维链留到下一级手动展开', async (ctx) => {
  const chat = makeChat([
    chatNode('a1', 'assistant-step', {
      turn: 1,
      status: 'settled',
      blocks: [
        { kind: 'reasoning', text: '第一段想法' },
        { kind: 'reasoning', text: '第二段想法' },
        { kind: 'tool-call', name: 'bash', callId: 'c1' },
        { kind: 'tool-call', name: 'bash', callId: 'c2' },
        { kind: 'text', text: '答案' },
      ],
    }),
  ])
  const { host } = await mountPanel(ctx, panelProps({ useChat: useChatOf(chat) }))
  const process = host.querySelector('.rd-chat-process')
  assert.ok(process, 'process disclosure rendered')
  const summary = process.querySelector('summary')
  await act(async () => {
    summary.click()
  })
  assert.equal(process.hasAttribute('open'), true, 'process expands on click')
  const chips = Array.from(process.querySelectorAll('.rd-chat-chip')).map((node) => node.textContent)
  assert.deepEqual(chips, ['tool.command × 2'], 'repeated tools aggregate into one phrased chip')
  const reasoning = process.querySelector('details[data-chat-reasoning]')
  assert.ok(reasoning, 'reasoning has its own disclosure')
  assert.equal(reasoning.hasAttribute('open'), false, 'reasoning stays folded after opening the process')
  // Like the native chat, the folded reasoning line previews its first sentence.
  assert.match(reasoning.querySelector('summary').textContent, /第一段想法/)
  assert.match(reasoning.textContent, /第一段想法/)
})
