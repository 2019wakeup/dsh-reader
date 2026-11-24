# 阅读器内对话面板（方案 A）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在阅读器右侧抽屉里新增“对话”页签，用原生 `inputActions.insertQuote` 把选中原文送进底部输入框，并用 `useChat` 实时镜像当前会话的回答，形成边读边聊、可逐层追问的体验。

**Architecture:** 客户端只消费 `conversation.view` 已注入的标准 props（`useChat` / `useInput` / `useSession` / `inputActions` / `openView`），新增一个模块级独立组件订阅对话快照，避免整书重渲染；宿主侧新增阅读位置上报与两个只读工具，让助手能自己读前后文。所有改动挂在外壳层与新增文件，概念卡代码不动。

**Tech Stack:** 纯 JavaScript ESM（无 TypeScript）、React 18（`React.createElement`，无 JSX）、Cordis 客户端 Slot、Node 22（宿主）、node:test + jsdom、esbuild + puppeteer-core（视觉基线）。

**Spec:** `docs/superpowers/specs/2026-11-23-reader-chat-panel-design.md`

## Global Constraints

- 版本号：0.13.0（`package.json` 与发布检查同步）。
- 不新增运行时依赖；开发依赖沿用现有 `esbuild`、`jsdom`、`puppeteer-core`、`pngjs`。
- 客户端源码改完必须运行 `node scripts/build-client.mjs` 重新生成 `client.js`，并把生成物一并提交。
- 新增界面文案必须同时写 `src/client/i18n.js` 的中文与英文两个字典。
- 不得修改概念卡的渲染、数据、宿主路由与既有测试断言。
- 面板组件不得直接查询 DSH DOM、不得写全局变量；一切对话数据来自 props。
- 所有验证命令：`node --test test/*.test.mjs`、`node eval/run.mjs`、`node eval/visual.mjs`、`node eval/layout-host.mjs`、`node scripts/release-check.mjs`。
- 视觉基线阈值：像素差 ≤ 0.3%；只有本功能造成的差异才更新基线。

## Review Focus

1. **旧版 DSH 缺少标准 props**：`useChat` / `inputActions` / `useSession` 任一缺失时，阅读器照常可用，入口隐藏，控制台无报错。
2. **输入框忙碌时提问**：`phase !== 'plain'` 时点“问 AI”，不崩溃、告知“输入框正在忙”、保留选区。
3. **会话切换**：切换会话后面板显示新会话的对话，不残留上一会话的行。
4. **极端选区**：空选区不出现“问 AI”；超过 2000 字的选区被截断并带省略号。
5. **流式中的滚动**：用户上滚后新 token 到达不强制拉回底部，出现“回到底部”按钮。

---

## File Structure

**新建**

| 文件 | 职责 |
|---|---|
| `src/client/chat-transcript.js` | 纯函数：快照 → 行模型、位置文案、引用文本、快捷追问定义 |
| `src/client/chat-panel.js` | 模块级组件：`ReaderChatPanel`、`ChatToolbarButton`、`ChatSubmitWatcher` |
| `src/client/chat-context.js` | 从当前文档构造位置对象与上下文窗口（不发起请求） |
| `lib/reader-context.js` | 宿主侧纯逻辑：位置/窗口文件读写、`reader_context` 与 `reader_read` 的取数实现 |
| `test/chat-transcript.test.mjs` | 行模型与文案单测 |
| `test/chat-panel.test.mjs` | 面板 jsdom 交互测试 |
| `test/chat-context.test.mjs` | 客户端位置/窗口/节流单测 |
| `test/reader-context.test.mjs` | 宿主侧位置文件与工具取数单测 |

**修改**

| 文件 | 改动 |
|---|---|
| `src/client/app.js` | 抽屉壳层抽取、`chat` 页签、工具栏按钮、选区浮层入口、位置上报调用 |
| `src/client/api.js` | 新增 `context(sessionId, payload)` |
| `src/client/styles.js` | 面板、行、未读点、快捷追问样式 |
| `src/client/i18n.js` | 新文案（zh/en） |
| `lib/prefs.js` | `chatWidth: 420` |
| `lib/store.js` | `reading` 顶层字段的归一化 |
| `index.js` | `inject` 增 `tools`、`/api/context` 路由、两个工具注册 |
| `scripts/build-client.mjs` | 文件清单加入三个新客户端文件 |
| `eval/visual/harness.jsx` | 注入假标准 props、`window.__chatPush`、`window.__quotes` |
| `eval/visual.mjs` | 新增面板检查与基线 |
| `eval/cases.mjs` | 新增契约用例 |
| `scripts/release-check.mjs` | 计数更新 |
| `docs/DETAIL.md`、`README.md` | 功能说明 |

---

### Task 1: 对话行模型（纯函数）

**Files:**
- Create: `src/client/chat-transcript.js`
- Test: `test/chat-transcript.test.mjs`

**Interfaces:**
- Produces:
  - `QUICK_ASKS: ReadonlyArray<{ id: string, question: string }>`，顺序固定为 explain / example / relation / intent。
  - `buildTranscript(chat, options?): Row[]`，`options = { limitTurns?: number, all?: boolean, maxText?: number }`，默认 `limitTurns = 8`、`maxText = 2000`。
  - `formatLocation(doc, position): string`
  - `buildQuoteText(location, text, maxText?): string`
  - `chatMessageCount(chat): number`
  - Row 联合类型：
    - `{ kind: 'user', key: string, turn: number, text: string }`
    - `{ kind: 'assistant', key: string, turn: number, blocks: Block[], streaming: boolean }`
    - `{ kind: 'tool', key: string, turn: number, name: string, status: 'running' | 'done' | 'error', detail: string }`
    - `{ kind: 'error', key: string, turn: number, text: string }`
  - Block：`{ kind: 'text', text } | { kind: 'reasoning', text } | { kind: 'tool-call', name, callId } | { kind: 'image' }`

- [ ] **Step 1: 写失败测试**

```js
// test/chat-transcript.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTranscript, formatLocation, buildQuoteText, QUICK_ASKS, chatMessageCount } from '../src/client/chat-transcript.js'

function node(key, kind, data, extra = {}) {
  return { key, kind, id: key, target: 'chat', data, anchorSeq: 0, location: { kind: 'turn', turn: { turn: data.turn ?? 1 } }, visibility: 'visible', ...extra }
}

function snapshot(nodes, partial = null, runningCalls = []) {
  const map = new Map(nodes.map((n) => [n.key, n]))
  return {
    order: nodes.map((n) => n.key),
    nodes: { get: (key) => map.get(key) },
    legacy: { nodes: [], turnTimings: new Map(), turnEnds: new Map(), partial, runningCalls },
  }
}

test('user 与 assistant 行按 order 输出并跳过 hidden', () => {
  const snap = snapshot([
    node('u1', 'user', { turn: 1, content: [{ type: 'text', text: '问一' }] }),
    node('a1', 'assistant-step', { turn: 1, step: 1, status: 'settled', blocks: [{ kind: 'text', text: '答一' }] }),
    node('h1', 'context', { turn: 1 }, { visibility: 'hidden' }),
  ])
  const rows = buildTranscript(snap)
  assert.deepEqual(rows.map((r) => r.kind), ['user', 'assistant'])
  assert.equal(rows[0].text, '问一')
  assert.equal(rows[1].blocks[0].text, '答一')
  assert.equal(rows[1].streaming, false)
})

test('流式 partial 与运行中工具进入尾部行', () => {
  const snap = snapshot(
    [node('u1', 'user', { turn: 2, content: [{ type: 'text', text: '问' }] })],
    { turn: 2, step: 1, status: 'running', blocks: [{ kind: 'text', text: '正在' }] },
    [{ callId: 'c1', name: 'bash', argsRaw: '{}' }],
  )
  const rows = buildTranscript(snap)
  assert.equal(rows.at(-2).streaming, true)
  assert.equal(rows.at(-1).kind, 'tool')
  assert.equal(rows.at(-1).status, 'running')
})

test('系统类节点被过滤，错误保留', () => {
  const snap = snapshot([
    node('c1', 'context', { turn: 1 }),
    node('e1', 'turn-error', { turn: 1, message: '模型失败' }),
  ])
  const rows = buildTranscript(snap)
  assert.deepEqual(rows.map((r) => r.kind), ['error'])
})

test('limitTurns 只保留最近 N 轮，all 关闭截断', () => {
  const nodes = []
  for (let turn = 1; turn <= 12; turn += 1) {
    nodes.push(node(`u${turn}`, 'user', { turn, content: [{ type: 'text', text: `问题${turn}` }] }))
  }
  const snap = snapshot(nodes)
  assert.equal(buildTranscript(snap).length, 8)
  assert.equal(buildTranscript(snap, { all: true }).length, 12)
})

test('formatLocation 覆盖 PDF 与章节两种形态', () => {
  assert.equal(formatLocation({ name: '书.pdf', ext: '.pdf' }, { page: 3, total: 120 }), '《书.pdf》 第 3 页 / 共 120 页')
  assert.equal(
    formatLocation({ name: '书.epub', ext: '.epub' }, { chapter: 2, chapterTitle: '一致性模型', percent: 42 }),
    '《书.epub》 第 3 章 · 一致性模型 · 42%',
  )
  assert.equal(formatLocation({ name: '书.md', ext: '.md' }, {}), '《书.md》')
})

test('buildQuoteText 首行位置、正文压空白并截断', () => {
  assert.equal(buildQuoteText('《书》', '  很多\n\n空白  '), '《书》\n很多 空白')
  const long = 'x'.repeat(2500)
  const out = buildQuoteText('《书》', long)
  assert.equal(out.length, '《书》'.length + 1 + 2000 + 1)
  assert.ok(out.endsWith('…'))
})

test('chatMessageCount 只数可见的 user/assistant', () => {
  const snap = snapshot([
    node('u1', 'user', { turn: 1, content: [] }),
    node('a1', 'assistant-step', { turn: 1, status: 'settled', blocks: [] }),
    node('t1', 'tool-call', { turn: 1, root: {} }),
  ])
  assert.equal(chatMessageCount(snap), 2)
})

test('QUICK_ASKS 顺序固定', () => {
  assert.deepEqual(QUICK_ASKS.map((item) => item.id), ['explain', 'example', 'relation', 'intent'])
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/chat-transcript.test.mjs`
Expected: FAIL，报 `Cannot find module .../chat-transcript.js`

- [ ] **Step 3: 实现 `src/client/chat-transcript.js`**

实现要点：`textOf(value)` 递归兼容 `string` / `{ text }` / `{ content: [] }` / `{ blocks: [] }` / `{ message }`；`nodeTurn(node)` 依次尝试 `node.location.turn.turn`、`node.data.turn`，都缺失记 0；系统类 kind 跳过集合 `context / system-prompt / command / command-input / model-retry / compaction / manual-compaction / unknown / turn-start / turn-end / turn-trigger / turn-process / turn-tail / turn-error`（`turn-error` 单独映射为 error 行，故不跳过）；`turn-max-tokens` 映射为 error 行；`visibility === 'hidden'` 跳过；辅助 `toolStatus(node)` 依据 `data.root.status` 映射 `running / done / error`，缺失记 `done`。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test test/chat-transcript.test.mjs`
Expected: 8 tests PASS

- [ ] **Step 5: 提交**

```bash
git add src/client/chat-transcript.js test/chat-transcript.test.mjs
git commit -m "feat(reader): add chat transcript row model"
```

---

### Task 2: 对话面板组件

**Files:**
- Create: `src/client/chat-panel.js`
- Modify: `src/client/styles.js`, `src/client/i18n.js`, `scripts/build-client.mjs`
- Test: `test/chat-panel.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `buildTranscript`、`QUICK_ASKS`、`chatMessageCount`、`formatLocation`、`buildQuoteText`；`markdownRender`（`src/client/markdown.js`）、`sanitizeHtml`（`src/client/sanitize.js`）。
- Produces:
  - `ReaderChatPanel(props)`，props：`{ t, doc, position, useChat, useInput, useSession, openView, onClose }`。
  - `ChatToolbarButton(props)`，props：`{ t, open, onToggle, useChat }`。
  - `ChatSubmitWatcher(props)`，props：`{ useInput, onSend }`（不渲染任何节点）。
  - DOM 约定：面板根 `.rd-chat`；每行 `[data-chat-row]` 且 `data-kind` 为行类型；空状态 `.rd-chat-empty`；未读点 `.rd-chat-unread`；用户行 `.rd-chat-user`；助手正文 `.rd-chat-md`。
- `i18n` 新增键：`tab.chat`、`label.chatEmpty`、`label.chatShowAll`、`label.chatCollapse`、`label.chatJump`、`label.chatBackToBottom`、`label.chatBusy`、`label.chatUnread`、`action.askChat`、`action.quickAsk`、`quick.explain`、`quick.example`、`quick.relation`、`quick.intent`、`label.composerBusy`、`label.chatUnavailable`。

- [ ] **Step 1: 写失败测试**

```js
// test/chat-panel.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ReaderChatPanel, ChatToolbarButton } from '../src/client/chat-panel.js'

// （jsdom 全局初始化照抄 test/concept-delete.test.mjs 的前 30 行）

const t = (key) => key
function makeChat(nodes, partial = null) {
  const map = new Map(nodes.map((n) => [n.key, n]))
  return { order: nodes.map((n) => n.key), nodes: { get: (k) => map.get(k) }, legacy: { nodes: [], turnTimings: new Map(), turnEnds: new Map(), partial, runningCalls: [] } }
}
const useChatOf = (snapshot) => (selector) => selector(snapshot)
const useInputOf = (phase) => (selector) => selector({ phase, draft: '', draftRev: 0, attachmentIds: [], occurrences: [], queue: [] })
const useSessionOf = (running) => (selector) => selector({ running, removed: false, subagent: null })

test('面板渲染行并标记空状态', async () => {
  const host = document.createElement('div')
  const root = createRoot(host)
  const chat = makeChat([
    { key: 'u1', kind: 'user', data: { turn: 1, content: [{ type: 'text', text: '问一' }] }, location: { kind: 'turn', turn: { turn: 1 } }, visibility: 'visible' },
    { key: 'a1', kind: 'assistant-step', data: { turn: 1, status: 'settled', blocks: [{ kind: 'text', text: '答一' }] }, location: { kind: 'turn', turn: { turn: 1 } }, visibility: 'visible' },
  ])
  await act(async () => {
    root.render(React.createElement(ReaderChatPanel, {
      t, doc: { name: '书.md', ext: '.md' }, position: { chapter: 0 },
      useChat: useChatOf(chat), useInput: useInputOf('plain'), useSession: useSessionOf(false),
      openView: () => {}, onClose: () => {},
    }))
  })
  assert.equal(host.querySelectorAll('[data-chat-row]').length, 2)
  assert.equal(host.querySelector('[data-chat-row]').getAttribute('data-kind'), 'user')
})

test('空会话显示引导文案', async () => {
  // 渲染 makeChat([])，断言 .rd-chat-empty 文本为 t('label.chatEmpty')
})

test('工具栏按钮在最新消息到达且面板关闭时点亮未读点', async () => {
  // 先以 open=true 渲染，调用 root.render 换到 open=false，再用新的 useChat 快照渲染，
  // 断言 .rd-chat-unread 存在；再以 open=true 渲染，断言消失
})

test('提交时代理 onSend 被调用一次', async () => {
  // 用可变 phase：先 plain，再 rerender 成 sending，断言 onSend 计数为 1
})

test('标准 props 缺失时显示不可用且不抛错', async () => {
  // 不传 useChat/useInput/useSession，只传 t/doc/position/onClose；
  // 断言 .rd-chat-unavailable 存在、控制台无异常
})

test('会话切换后只显示新会话的行', async () => {
  // 先以会话 A 的快照渲染，再以会话 B 的快照 rerender，断言 [data-chat-row] 只含 B 的文本
})

test('忙碌阶段显示状态条', async () => {
  // useInput 返回 phase: 'sending'，断言 .rd-chat-busy 存在；phase: 'plain' 时不存在
})

test('isNearBottom 判定跟随阈值', () => {
  assert.equal(isNearBottom({ scrollHeight: 1000, scrollTop: 700, clientHeight: 260 }), true)
  assert.equal(isNearBottom({ scrollHeight: 1000, scrollTop: 500, clientHeight: 260 }), false)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/chat-panel.test.mjs`
Expected: FAIL，`Cannot find module .../chat-panel.js`

- [ ] **Step 3: 实现组件与样式**

实现要点：

1. `ReaderChatPanel` 内部：`const chat = useChat((s) => s)`；`const phase = useInput((s) => s.phase)`；`const running = useSession((s) => s.running)`；`rows = React.useMemo(() => buildTranscript(chat, { all: showAll }), [chat, showAll])`；行需要稳定 key。
2. 每个 props hook 可能缺失，统一用 `safeHook(hook)` 包一层：缺失时返回常量选择器，面板显示“当前 DSH 版本不支持对话面板”。
3. 助手文本块用 `markdownRender(text)` 生成 HTML，经 `sanitizeHtml(html, () => null)` 后放进 `.rd-chat-md` 的 `dangerouslySetInnerHTML`；推理块折叠成一行 `<details>`；工具块渲染 `name` + 状态点。
4. 滚动跟随：`scrollRef` 上绑定 onScroll，距底部 < 40px 视为贴底；贴底时新行到达自动 `scrollTop = scrollHeight`；不贴底时显示“回到底部”按钮。
5. `ChatSubmitWatcher` 用 ref 保存回调，phase 从 `plain` 变为非 plain 时调用一次 `onSend`。
6. 样式加进 `styles.js` 的 `READER_CSS`，全部使用 `--dsw-alias-*` 变量，深浅色/护眼主题自动适配；`.rd-chat` 自身 `display:flex;flex-direction:column;min-height:0;flex:1`，覆盖抽屉 body 的内边距。
7. 导出纯函数 `isNearBottom({ scrollHeight, scrollTop, clientHeight }, threshold = 40): boolean`，跟随逻辑用它判定。
8. `phase !== 'plain'` 时面板顶部渲染 `.rd-chat-busy` 状态条，文案 `t('label.chatBusy')`；`useSession` 报 `running` 时状态条同样可见。
9. 任一标准 hook 缺失时渲染 `.rd-chat-unavailable`（文案 `t('label.chatUnavailable')`），其余 UI 不渲染，不抛异常。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test test/chat-panel.test.mjs`
Expected: 4 tests PASS

- [ ] **Step 5: 提交**

```bash
node scripts/build-client.mjs
git add src/client/chat-panel.js src/client/styles.js src/client/i18n.js scripts/build-client.mjs client.js test/chat-panel.test.mjs
git commit -m "feat(reader): add in-reader chat panel components"
```

---

### Task 3: 抽屉装配（页签、工具栏、宽度、自动打开）

**Files:**
- Modify: `src/client/app.js`（`renderDrawer` 约 2925-3660、`renderToolbar` 约 2659、宽度 key 约 715）
- Modify: `src/client/styles.js`
- Modify: `eval/visual/harness.jsx`、`eval/visual.mjs`
- Test: `test/chat-panel.test.mjs`（追加 jsdom 用例）

**Interfaces:**
- Consumes: Task 2 的 `ReaderChatPanel`、`ChatToolbarButton`、`ChatSubmitWatcher`。
- Produces: `drawer === 'chat'` 状态；`renderDrawerShell(title, body, options?)` 内部函数；`chatWidth` 宽度键。

- [ ] **Step 1: 追加失败用例**

```js
test('抽屉切到 chat 页签时渲染面板，切走时卸载', async () => {
  // 用 fetch mock 渲染 ReaderView（照抄 test/concept-delete.test.mjs 的 ReaderView 挂载方式），
  // 传入假 props.useChat / useInput / useSession / inputActions / openView
  // 点击工具栏“对话”按钮，断言 document.querySelector('.rd-chat') 存在、[data-chat-row] 数量正确
  // 再点击一次，断言 .rd-chat 消失
})
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/chat-panel.test.mjs`
Expected: FAIL，找不到“对话”按钮

- [ ] **Step 3: 实现**

1. 抽取 `renderDrawerShell(title, body, { className } = {})`：把现有抽屉头 + 抽屉体 + 关闭按钮结构收进一个函数，替换 `renderDrawer` 里各处重复的壳层（含 PDF 目录“结构未就绪”那个提前返回分支）。输出保持逐字节一致。
2. `titles` 增加 `chat: t('tab.chat')`；`renderDrawer` 增加 `drawer === 'chat'` 分支，body 渲染 `h(ReaderChatPanel, { ... })`，并给 `.rd-drawer-body` 加 `rd-drawer-chat` 修饰类去掉内边距。
3. 工具栏 `renderToolbar` 插入 `h(ChatToolbarButton, { t, open: drawer === 'chat', onToggle: () => setDrawer(drawer === 'chat' ? null : 'chat'), useChat: props.useChat })`。
4. 阅读器根节点挂 `h(ChatSubmitWatcher, { useInput: props.useInput, onSend: () => setDrawer('chat') })`。
5. 宽度：`drawerWidthKey` 改为 `drawer === 'chat' ? 'chatWidth' : drawer === 'guide' && guideView === 'map' ? 'mapWidth' : 'drawerWidth'`；默认值 `chatWidth` 取 `prefs.chatWidth || 420`，上限 720。
6. 会话恢复：`drawer` 字段已持久化，确认恢复 `chat` 时面板正常挂载；`drawerViewKey` 对 chat 自然等于 `'chat'`，滚动记忆独立。
7. 旧版 DSH 缺 `useChat` 时：`ChatToolbarButton` 在 `useChat` 缺失时返回 `null`，工具栏按钮不出现。
8. 面板内文本同样可选中并触发“问 AI”：现有选区浮层监听挂在阅读器根节点，确认 `.rd-chat` 在监听范围内；若抽屉被排除，把监听容器扩到包含抽屉。补一条 jsdom 用例：在 `.rd-chat-md` 上构造选区并派发 `mouseup`，断言 `.rd-mini` 出现且含 `action.askChat`。

- [ ] **Step 4: 更新视觉夹具与检查**

`eval/visual/harness.jsx` 增加假 props：`useChat`（返回 `chatFixture` 快照，支持 `window.__chatPush(n)` 追加消息并触发重渲染）、`useInput`（可变 phase，`window.__setPhase`）、`useSession`（返回 `{ running: false, removed: false, subagent: null }` 的形状）、`inputActions`（把调用记录进 `window.__quotes` 与 `window.__inserted`，返回 true）、`openView`（记录到 `window.__openedView`）、`viewRequest: null`、`completeViewRequest: () => {}`。fetch mock 增加 `/api/context` 分支返回 `{ ok: true }` 并把请求体记到 `window.__contextPosts`。

`eval/visual.mjs` 新增检查（沿用 `record(name, pass, detail)`）：

```js
record('chat panel opens from toolbar', await page.$('.rd-chat') !== null)
record('chat panel renders transcript rows', (await page.$$('[data-chat-row]')).length >= 2)
record('chat unread dot appears when closed', /* 关闭面板后 __chatPush(1)，等待一拍，查 .rd-chat-unread */)
record('quote inserts passage with location', /* 选中正文 → 点 .rd-mini 的“问 AI” → window.__quotes[0] 含《书名》与正文 */)
record('quick ask inserts question after quote', /* 点“解释这段” → window.__inserted[0] 含 quick.explain 文案 */)
record('open chat page delegates to openView', /* 点面板头部对话页按钮 → window.__openedView === 'chat' */)
```

同步新增/更新 `eval/visual/baseline` 截图（面板打开态、空状态），并在 `scripts/release-check.mjs` 更新视觉计数。

- [ ] **Step 5: 运行验证**

Run:
```bash
node --test test/chat-panel.test.mjs
node eval/visual.mjs
```
Expected: jsdom 用例 PASS；视觉检查全部 PASS（含新基线）。

- [ ] **Step 6: 提交**

```bash
node scripts/build-client.mjs
git add src/client/app.js src/client/styles.js eval/visual/harness.jsx eval/visual.mjs eval/visual/baseline scripts/release-check.mjs client.js test/chat-panel.test.mjs
git commit -m "feat(reader): mount chat drawer tab with live transcript"
```

---

### Task 4: 选区浮层“问 AI”与快捷追问

**Files:**
- Create: `src/client/chat-context.js`（本任务只放 `currentPosition`，Task 6 继续充实）
- Modify: `src/client/app.js`（`renderMenu` 约 4166、卡片内追问保持不动）
- Test: `test/chat-panel.test.mjs`（追加）

**Interfaces:**
- Consumes: Task 1 的 `formatLocation`、`buildQuoteText`、`QUICK_ASKS`；Task 3 的 `setDrawer('chat')`。
- Produces: 组件内函数 `askChatSelection(question?: string): boolean`。

- [ ] **Step 1: 追加失败用例**

```js
test('选中正文点问 AI 后引用与位置进入输入框', async () => {
  // inputActions.insertQuote 记录参数；断言第一行是《书名》…，第二行是选中文本
})
test('快捷追问在引用之后插入问句', async () => {
  // 断言调用顺序：insertQuote → captureInsertion → insertText(question, span)
})
test('insertQuote 返回 false 时提示且不清选区', async () => {
  // inputActions.insertQuote 返回 false；断言出现 .rd-mini 的错误提示、selection.toString() 仍非空、未打开 chat 抽屉
})
test('空选区不显示问 AI 入口', async () => {
  // 只选中空白时 renderMenu 不出现 action.askChat 按钮
})
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/chat-panel.test.mjs`
Expected: FAIL

- [ ] **Step 3: 实现**

1. `askChatSelection`：
```js
const askChatSelection = (question) => {
  const actions = props.inputActions
  if (!actions || typeof actions.insertQuote !== 'function') {
    setMenuError(t('label.chatUnavailable'))
    return false
  }
  const text = (menu && menu.text ? menu.text : '').trim()
  if (!text) return false
  const quote = buildQuoteText(formatLocation(doc, currentPosition()), text)
  if (!actions.insertQuote(quote)) {
    setMenuError(t('label.composerBusy'))
    return false
  }
  if (question && typeof actions.captureInsertion === 'function' && typeof actions.insertText === 'function') {
    const span = actions.captureInsertion()
    actions.insertText(question, span)
  }
  setMenu(null)
  setMenuError('')
  dismissSelection(window)
  setDrawer('chat')
  return true
}
```
2. `renderMenu` 在“解释”之前插入主按钮 `问 AI`（`t('action.askChat')`）与 `<select>` 或四个小按钮作为快捷追问入口；选中空白（`menu.text.trim() === ''`）时整组不渲染。
3. `setMenuError` 状态与 `.rd-mini` 内的错误行；切选区或关闭浮层时清空。
4. `currentPosition()` 由本任务创建的 `src/client/chat-context.js` 提供：`currentPosition(doc, { chapter, chapterTitle, page, total, percent })`，纯函数、无副作用，Task 6 复用它做上报。

- [ ] **Step 4: 运行验证**

Run: `node --test test/chat-panel.test.mjs && node eval/visual.mjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
node scripts/build-client.mjs
git add src/client/app.js client.js test/chat-panel.test.mjs
git commit -m "feat(reader): quote book selections into the native composer"
```

---

### Task 5: 跳转原生对话页

**Files:**
- Modify: `src/client/chat-panel.js`（头部按钮）、`src/client/i18n.js`

- [ ] **Step 1: 写失败测试**

```js
test('面板头部的对话页按钮调用 openView(chat)', async () => {
  // openView 记录参数；点击 [data-chat-action="open-view"]；断言 === 'chat'
})
test('openView 缺失时按钮不渲染', async () => {})
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/chat-panel.test.mjs`
Expected: FAIL

- [ ] **Step 3: 实现**

面板头部右侧按钮 `data-chat-action="open-view"`，`onClick` 调用 `openView('chat', '')`；`openView` 不是函数时不渲染。按钮为图标 + 文案 `t('label.chatJump')`，`title` 同文案。

- [ ] **Step 4: 运行确认通过并提交**

```bash
node --test test/chat-panel.test.mjs
node scripts/build-client.mjs
git add src/client/chat-panel.js src/client/i18n.js client.js test/chat-panel.test.mjs
git commit -m "feat(reader): jump from chat panel to the full conversation"
```

---

### Task 6: 阅读位置上报（客户端）

**Files:**
- Modify: `src/client/chat-context.js`（Task 4 已创建，本任务补 `buildContextWindow` 与 `createPositionReporter`）
- Modify: `src/client/api.js`、`src/client/app.js`
- Test: `test/chat-context.test.mjs`

**Interfaces:**
- Produces:
  - `currentPosition(doc, state): { path, name, ext, chapter, chapterTitle, page, total, percent }`
  - `buildContextWindow(doc, state): Promise<{ title: string, text: string } | null>`，文本上限 24000 字。
  - `createPositionReporter({ api, sessionId, throttleMs = 1500 })`，返回 `{ report(position, window), flush(), dispose() }`。
  - `api.context(sessionId, payload)` 调用 `POST /dsh-reader-live/api/context`。

- [ ] **Step 1: 写失败测试**

```js
test('currentPosition 输出 PDF 页码与章节百分比', () => {})
test('createPositionReporter 节流：连续三次 report 只发一次请求', async () => {})
test('flush 立即发送最后一次位置', async () => {})
test('buildContextWindow 对 markdown 截取当前章节文本', async () => {})
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/chat-context.test.mjs`

- [ ] **Step 3: 实现**

1. `chat-context.js`：纯函数 + 抽取文本（md 用 `doc.text` 与章节偏移；epub 用 `doc.epub.chapters[chapter].html` 去标签；pdf 用 `pdfPageBlocks(doc.pdf.doc, page-1..page+1)` 拼接，失败返回 null）。
2. `api.js` 增加 `context(sessionId, payload)`（`request` 帮助函数已存在，保持同样的错误处理）。
3. `app.js`：在打开文档、`setChapter`、`setPage` 后调用 `reporter.report(...)`；组件卸载时 `dispose()`；会话切换时重建 reporter。

- [ ] **Step 4: 运行确认通过并提交**

```bash
node --test test/chat-context.test.mjs
node scripts/build-client.mjs
git add src/client/chat-context.js src/client/api.js src/client/app.js client.js test/chat-context.test.mjs scripts/build-client.mjs
git commit -m "feat(reader): report reading position and context window"
```

---

### Task 7: 宿主位置存储与 `/api/context` 路由

**Files:**
- Create: `lib/reader-context.js`
- Modify: `lib/prefs.js`、`lib/store.js`、`index.js`
- Test: `test/reader-context.test.mjs`（追加）

**Interfaces:**
- Produces:
  - `readingContextPath(cwd): string` → `<cwd>/.dsh-reader/context.json`
  - `readReadingContext(cwd): Promise<{ version: 1, sessions: Record<string, Entry> }>`
  - `writeReadingSession(cwd, sessionId, entry): Promise<void>`，单会话窗口上限 24000 字，总会话数上限 10（按 `updatedAt` 淘汰最旧）。
  - `pickReaderTarget(context, sessionId): Entry | undefined`
  - `store.reading`：`{ [sessionId]: { path, name, ext, chapter, chapterTitle, page, total, percent, updatedAt } }`，由 `normalizeV2` 容错重建（缺失时 `{}`，未知字段丢弃）。
- `POST /dsh-reader-live/api/context`：body `{ sessionId, position, window? }`，写 store.reading 与 context.json，返回 `{ ok: true }`；`sessionId` 缺失返回 400。

- [ ] **Step 1: 写失败测试**

```js
test('writeReadingSession 保留窗口并截断到上限', async () => {})
test('超过 10 个会话时淘汰最旧', async () => {})
test('store normalizeV2 缺 reading 时补空对象，非法值被丢弃', async () => {})
test('prefs 新增 chatWidth 默认 420 并夹在 320-720', async () => {})
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/reader-context.test.mjs`

- [ ] **Step 3: 实现**

`lib/reader-context.js` 用 `node:fs/promises` 读写，原子写（临时文件 + rename）；路径解析沿用 `lib/paths.js`。`index.js` 增加路由（沿用 `add({ kind: 'exact', path, handler })` 写法）与 body 解析保护。`lib/prefs.js` 加 `chatWidth: 420`；`lib/store.js` 的 `normalizeV2` 增加 `reading`，`emptyStore()` 同步。

- [ ] **Step 4: 运行确认通过并提交**

```bash
node --test test/reader-context.test.mjs
git add lib/reader-context.js lib/prefs.js lib/store.js index.js test/reader-context.test.mjs
git commit -m "feat(reader): persist reading position for host tools"
```

---

### Task 8: 宿主工具 `reader_context` 与 `reader_read`

**Files:**
- Modify: `lib/reader-context.js`、`index.js`
- Test: `test/reader-context.test.mjs`（追加）

**Interfaces:**
- Produces:
  - `describeReaderContext(entry): string`
  - `readReaderWindow(entry, args): { title, text, truncated }`
  - 工具 `reader_context`（无参）与 `reader_read`（`{ mode?: 'around'|'chapter'|'toc', query?: string, limit?: number }`），通过 `ctx.tools.register(defineTool({...}))` 注册，`defineTool` 来自 `@deepseek-ai/dsh-tools`。
- `inject` 增加 `'tools'`。

- [ ] **Step 1: 写失败测试**

```js
test('reader_context 有位置时返回书名、章节与页码', () => {})
test('reader_context 无位置时返回引导语而不是报错', () => {})
test('reader_read around 受限 limit 截断并标注 truncated', () => {})
test('reader_read toc 返回章节标题列表', () => {})
test('reader_read search 无命中返回空列表文案', () => {})
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/reader-context.test.mjs`

- [ ] **Step 3: 实现**

`execute(args, exec)` 里取 `const sessionId = exec.agent && exec.agent.id`，用 `ctx.workingDirectory.get(exec.agent.session)` 得到 cwd，读 `context.json`；没有窗口时返回明确提示（“客户端尚未上报阅读位置”）。工具描述里写明“读取用户当前正在阅读的书；当用户问‘这段’‘上文’时先调用它”。`output.render` 返回 `[{ type: 'text', text }]`。

- [ ] **Step 4: 运行确认通过并提交**

```bash
node --test test/reader-context.test.mjs
git add lib/reader-context.js index.js test/reader-context.test.mjs
git commit -m "feat(reader): expose reading context and window as agent tools"
```

---

### Task 9: 集成验证、文档与版本发布

**Files:**
- Modify: `package.json`、`README.md`、`docs/DETAIL.md`、`eval/cases.mjs`、`eval/run.mjs`（如计数写死）、`scripts/release-check.mjs`

- [ ] **Step 1: 全量测试**

Run:
```bash
node --test test/*.test.mjs
node eval/run.mjs
node eval/visual.mjs
node eval/layout-host.mjs
node scripts/release-check.mjs
```
Expected: 全部 PASS；记录新的用例与视觉计数。

- [ ] **Step 2: 安装到本机验证真实数据**

```bash
# 用 plugin_manager 重新安装当前目录（remove_bundle → install_bundle）
# 打开 DSH Web，进入阅读视图，打开文档，点“对话”，确认：
# - 对话页签出现且显示本会话已有消息
# - 选中一段 → 问 AI → 底部输入框出现引用块（首行含书名与位置）
# - 回车发送 → 回答流入面板
```

若 `useChat` 在真实环境为空：停止并报告，退化为方案 C（发送后自动切到对话页），不合并本分支。

- [ ] **Step 3: 更新文档与版本**

`package.json` 版本改 `0.13.0`；`README.md` 增加“读书对话”一节（能力、入口、与概念卡追问的区别）；`docs/DETAIL.md` 补面板 props 与 `/api/context` 契约；`eval/cases.mjs` 增加 `chat.transcript`、`chat.quote`、`reader.context`、`reader.read` 四个契约用例；`scripts/release-check.mjs` 更新计数与版本断言。

- [ ] **Step 4: 最终提交**

```bash
node scripts/build-client.mjs
git add package.json README.md docs/DETAIL.md eval scripts/release-check.mjs client.js
git commit -m "chore(reader): release 0.13.0 with in-reader conversation"
```

---

## 依赖与并行

- 客户端链：Task 1 → 2 → 3 → 4 → 5 → 6。
- 宿主链：Task 7 → 8，只与 Task 6 的请求体契约耦合，可与客户端链并行开发（文件完全不重叠）。
- Task 9 依赖两条链全部完成，由集成者执行。

---

## 执行约定（本轮双链并行）

- 客户端链与宿主链在同一工作树、同一分支并行施工，文件集合不相交，**执行者不运行任何 git 命令**，提交由集成者统一完成。
- 客户端链只跑 `test/chat-*.test.mjs` 与 app.js 相关回归集，宿主链只跑 `test/reader-context.test.mjs`、`test/store.test.mjs`、`test/migrate.test.mjs`；全量测试与视觉基线由集成者在两条链汇合后统一跑。
- 客户端链负责重新生成 `client.js`；宿主链不碰 `src/`、`client.js`、`package.json`。
- 两条链各自把工作说明写到 `/tmp/dsh-reader-chat/` 下，集成者据此审查与提交。
