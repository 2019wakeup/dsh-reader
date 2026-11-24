import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTranscript, formatLocation, buildQuoteText, QUICK_ASKS, chatMessageCount, messageAttachments } from '../src/client/chat-transcript.js'

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
  assert.equal(rows.length, 2, 'user row plus one merged streaming answer')
  const live = rows.at(-1)
  assert.equal(live.kind, 'assistant')
  assert.equal(live.streaming, true)
  // The running node carries no text yet; the streamed text comes from the
  // platform's duplicate legacy partial and must land in the same bubble.
  assert.deepEqual(live.blocks.map((block) => block.text), ['正在'])
  assert.deepEqual(live.activities, ['bash'], 'live tool names ride on the streaming row')
})

test('running 节点只有推理时，流式文本仍并入同一气泡且只出现一次', () => {
  const snap = snapshot(
    [
      node('u1', 'user', { turn: 4, content: [{ type: 'text', text: '问' }] }),
      node('a1', 'assistant-step', {
        turn: 4,
        step: 1,
        status: 'running',
        blocks: [{ kind: 'reasoning', text: '先判断类型' }],
      }),
    ],
    { turn: 4, step: 1, status: 'running', blocks: [{ kind: 'text', text: '流式正文' }] },
    [{ callId: 'c1', name: 'read_image' }],
  )
  const rows = buildTranscript(snap)
  assert.equal(rows.filter((row) => row.kind === 'status').length, 0, 'no separate status row')
  const answer = rows.at(-1)
  assert.deepEqual(answer.blocks.map((block) => block.text), ['流式正文'])
  assert.equal(answer.process.count, 1, 'reasoning stays folded in the process pill')
  assert.deepEqual(answer.activities, ['read_image'])
})

test('compact 折叠工具与推理，full 展开成行', () => {
  const snap = snapshot([
    node('a1', 'assistant-step', {
      turn: 1,
      status: 'settled',
      blocks: [
        { kind: 'reasoning', text: '先想一下' },
        { kind: 'text', text: '答案' },
        { kind: 'tool-call', name: 'bash', callId: 'c1' },
      ],
    }),
    node('t1', 'tool-call', { turn: 1, name: 'bash', root: { status: 'done' } }),
  ])
  const compact = buildTranscript(snap)
  assert.deepEqual(compact.map((row) => row.kind), ['assistant'])
  assert.deepEqual(compact[0].blocks.map((block) => block.kind), ['text'])
  assert.equal(compact[0].process.count, 2)
  assert.deepEqual(compact[0].process.tools, ['bash'])
  const full = buildTranscript(snap, { detail: 'full' })
  assert.deepEqual(full.map((row) => row.kind), ['assistant', 'tool'])
  assert.equal(full[0].process, null)
  assert.deepEqual(full[0].blocks.map((block) => block.kind), ['reasoning', 'text', 'tool-call'])
})

test('系统类节点被过滤，错误保留', () => {
  const snap = snapshot([
    node('c1', 'context', { turn: 1 }),
    node('e1', 'turn-error', { turn: 1, message: '模型失败' }),
  ])
  const rows = buildTranscript(snap)
  assert.deepEqual(rows.map((r) => r.kind), ['error'])
  assert.equal(rows[0].text, '模型失败')
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

test('turn-max-tokens 与 interrupted 各自成为独立行', () => {
  const snap = snapshot([
    node('u1', 'user', { turn: 1, content: [{ type: 'text', text: '问' }] }),
    node('a1', 'assistant-step', { turn: 1, status: 'interrupted', blocks: [{ kind: 'text', text: '半句' }] }),
    node('m1', 'turn-max-tokens', { turn: 2, message: '达到上限' }),
  ])
  const rows = buildTranscript(snap)
  assert.deepEqual(rows.map((r) => r.kind), ['user', 'interrupted', 'error'])
  assert.equal(rows[2].text, '达到上限')
})

test('运行中的 assistant 节点标记 streaming，hidden 节点不计数', () => {
  const snap = snapshot([
    node('a1', 'assistant-step', { turn: 1, status: 'running', blocks: [{ kind: 'text', text: '流式中' }] }),
    node('a2', 'assistant-step', { turn: 1, status: 'settled', blocks: [{ kind: 'text', text: '隐藏' }] }, { visibility: 'hidden' }),
  ])
  const rows = buildTranscript(snap)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].streaming, true)
  assert.equal(chatMessageCount(snap), 1)
})

test('formatLocation 缺字段时逐级兜底', () => {
  assert.equal(formatLocation({ name: '书.pdf', ext: '.pdf' }, { page: 3 }), '《书.pdf》 第 3 页')
  assert.equal(formatLocation({ name: '书' }, { chapterTitle: '一致性模型', percent: 42 }), '《书》 一致性模型 · 42%')
  assert.equal(formatLocation({}, {}), '')
})

test('buildQuoteText 空正文只保留位置行', () => {
  assert.equal(buildQuoteText('《书》', '   '), '《书》')
  assert.equal(buildQuoteText('', '正文'), '正文')
})

test('真实流式快照：running 节点与 legacy.partial 只渲染一次', () => {
  const snap = snapshot(
    [
      node('u1', 'user', { turn: 3, content: [{ type: 'text', text: '问' }] }),
      node('a1', 'assistant-step', { turn: 3, step: 1, status: 'running', blocks: [{ kind: 'text', text: '前半段' }] }),
    ],
    { turn: 3, step: 1, status: 'running', blocks: [{ kind: 'text', text: '前半段' }] },
  )
  const rows = buildTranscript(snap)
  assert.equal(rows.filter((row) => row.kind === 'assistant').length, 1, 'streaming answer must not repeat')
  assert.equal(rows.at(-1).streaming, true)
})

test('真实工具形状：phase/isError 决定状态，参数取自 call.argsRaw', () => {
  const snap = snapshot([
    node('t1', 'tool-call', { turn: 1, name: 'bash', root: { phase: 'start', call: { callId: 'c1', argsRaw: '{"cmd":"ls"}' } } }),
    node('t2', 'tool-call', { turn: 1, name: 'read', root: { phase: 'result', isError: true } }),
    node('t3', 'tool-call', { turn: 1, name: 'write', root: { phase: 'result' } }),
  ])
  const rows = buildTranscript(snap, { detail: 'full' })
  assert.deepEqual(rows.map((row) => row.status), ['running', 'error', 'done'])
  assert.equal(rows[0].detail, '{"cmd":"ls"}')
})

test('full 模式下节点已显示的运行中工具不再从 runningCalls 重复成行', () => {
  const snap = snapshot(
    [node('t1', 'tool-call', { turn: 1, name: 'bash', root: { phase: 'start', call: { callId: 'c1' } } })],
    null,
    [{ callId: 'c1', name: 'bash', argsRaw: '{}' }],
  )
  const rows = buildTranscript(snap, { detail: 'full' })
  assert.equal(rows.filter((row) => row.kind === 'tool').length, 1)
})

test('interrupted 行保留已经生成的正文', () => {
  const snap = snapshot([
    node('a1', 'assistant-step', {
      turn: 1,
      status: 'interrupted',
      blocks: [
        { kind: 'text', text: '写了一半' },
        { kind: 'tool-call', name: 'bash', callId: 'c1' },
      ],
    }),
  ])
  const rows = buildTranscript(snap)
  assert.equal(rows[0].kind, 'interrupted')
  assert.equal(rows[0].blocks.length, 1)
  assert.equal(rows[0].blocks[0].text, '写了一半')
})

test('status 行沿用运行中工具自身的轮次', () => {
  const snap = snapshot(
    [node('u1', 'user', { turn: 1, content: [{ type: 'text', text: '旧问题' }] })],
    null,
    [{ callId: 'c9', name: 'bash', turn: 5 }],
  )
  const rows = buildTranscript(snap)
  assert.equal(rows.at(-1).kind, 'status')
  assert.equal(rows.at(-1).turn, 5)
})

test('同一轮的多段助手步骤合并成一条回答', () => {
  const snap = snapshot([
    node('u1', 'user', { turn: 4, content: [{ type: 'text', text: '问' }] }),
    node('a1', 'assistant-step', {
      turn: 4,
      step: 1,
      status: 'settled',
      blocks: [{ kind: 'reasoning', text: '想一下' }, { kind: 'tool-call', name: 'bash', callId: 'c1' }],
    }),
    node('a2', 'assistant-step', { turn: 4, step: 2, status: 'settled', blocks: [{ kind: 'tool-call', name: 'read', callId: 'c2' }] }),
    node('a3', 'assistant-step', { turn: 4, step: 3, status: 'settled', blocks: [{ kind: 'text', text: '答案' }] }),
  ])
  const rows = buildTranscript(snap)
  assert.deepEqual(rows.map((row) => row.kind), ['user', 'assistant'])
  assert.equal(rows[1].blocks.length, 1)
  assert.equal(rows[1].blocks[0].text, '答案')
  assert.equal(rows[1].process.count, 3)
  assert.deepEqual(rows[1].process.tools, ['bash', 'read'])
})

test('没有正文的纯工具步骤不单独成行', () => {
  const snap = snapshot([
    node('a1', 'assistant-step', {
      turn: 2,
      step: 1,
      status: 'settled',
      blocks: [{ kind: 'reasoning', text: '调用工具' }, { kind: 'tool-call', name: 'bash', callId: 'c1' }],
    }),
  ])
  assert.deepEqual(buildTranscript(snap), [])
  // Full detail keeps the step row with its reasoning and tool-call blocks.
  const full = buildTranscript(snap, { detail: 'full' })
  assert.deepEqual(full.map((row) => row.kind), ['assistant'])
  assert.deepEqual(full[0].blocks.map((block) => block.kind), ['reasoning', 'tool-call'])
})

test('步骤正文缺失时回退到 finalized message', () => {
  const snap = snapshot([
    node('a1', 'assistant-step', {
      turn: 1,
      step: 1,
      status: 'settled',
      blocks: [{ kind: 'tool-call', name: 'bash', callId: 'c1' }],
      finalNode: { blocks: [{ kind: 'text', text: '最终答案' }] },
    }),
  ])
  const rows = buildTranscript(snap)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].blocks[0].text, '最终答案')
})


test('用户消息中的图片与文件附件被保留为引用，不混进正文', () => {
  const image = {
    attachmentId: 'sha256:' + 'a'.repeat(64),
    mediaType: 'image/webp',
    bytes: 92084,
    width: 868,
    height: 1464,
    name: 'image.png',
  }
  const file = { attachmentId: 'sha256:' + 'b'.repeat(64), name: '报告.pdf', bytes: 204800 }
  const snap = snapshot([
    node('u1', 'user', {
      turn: 1,
      content: [{ type: 'image', attachment: image }, { type: 'file', attachment: file }, { type: 'text', text: '看这张图和附件' }],
    }),
  ])
  const [row] = buildTranscript(snap)
  assert.equal(row.kind, 'user')
  assert.equal(row.text, '看这张图和附件')
  assert.equal(row.images.length, 1)
  assert.equal(row.images[0].attachmentId, image.attachmentId)
  assert.equal(row.images[0].mediaType, 'image/webp')
  assert.deepEqual(row.files, [{ attachmentId: file.attachmentId, name: '报告.pdf', bytes: 204800 }])
})

test('assistant 的图片块保留附件引用', () => {
  const image = { attachmentId: 'sha256:' + 'c'.repeat(64), mediaType: 'image/png', bytes: 10, width: 4, height: 4 }
  const snap = snapshot([
    node('a1', 'assistant-step', { turn: 1, step: 1, status: 'settled', blocks: [{ kind: 'image', attachment: image }] }),
  ])
  const rows = buildTranscript(snap)
  assert.equal(rows[0].blocks[0].kind, 'image')
  assert.equal(rows[0].blocks[0].attachment.attachmentId, image.attachmentId)
})

test('messageAttachments 忽略损坏或非附件内容', () => {
  assert.deepEqual(messageAttachments({ content: [{ type: 'image', attachment: { attachmentId: 'nope' } }] }), {
    images: [],
    files: [],
  })
  assert.deepEqual(messageAttachments({ content: [{ type: 'text', text: 'x' }] }), { images: [], files: [] })
  assert.deepEqual(messageAttachments(null), { images: [], files: [] })
})
