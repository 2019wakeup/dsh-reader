import test from 'node:test'
import assert from 'node:assert/strict'
import { currentPosition } from '../src/client/chat-context.js'

test('currentPosition 输出 PDF 页码、总页数与百分比', () => {
  const doc = { name: '书.pdf', ext: '.pdf', path: '书.pdf', pdf: { numPages: 120 } }
  assert.deepEqual(currentPosition(doc, { page: 3 }), {
    path: '书.pdf',
    name: '书.pdf',
    ext: '.pdf',
    chapter: 0,
    chapterTitle: '',
    page: 3,
    total: 120,
    percent: 2,
  })
})

test('currentPosition 输出 EPUB 章节与百分比', () => {
  const doc = {
    name: '书.epub',
    ext: '.epub',
    path: '书.epub',
    epub: { chapters: [{ label: '第一章' }, { label: '第二章' }, { label: '第三章' }] },
  }
  const position = currentPosition(doc, { chapter: 1, chapterTitle: '一致性模型', percent: 42 })
  assert.equal(position.chapter, 1)
  assert.equal(position.chapterTitle, '一致性模型')
  assert.equal(position.percent, 42)
  assert.equal(position.page, 0)
  assert.equal(position.total, 0)
})

test('currentPosition 缺字段兜底并夹取百分比', () => {
  assert.equal(currentPosition(null), null)
  const plain = currentPosition({ name: '书.md', ext: '.md' }, {})
  assert.equal(plain.chapter, 0)
  assert.equal(plain.chapterTitle, '')
  assert.equal(plain.page, 0)
  assert.equal(plain.total, 0)
  assert.equal(plain.percent, undefined)
  assert.equal(currentPosition({ name: '书.md', ext: '.md' }, { percent: 250 }).percent, 100)
  assert.equal(currentPosition({ name: '书.md', ext: '.md' }, { percent: -5 }).percent, 0)
})

test('currentPosition 从 epub 章节标题回退并给出章节起点百分比', () => {
  const doc = {
    name: '书.epub',
    ext: '.epub',
    path: '书.epub',
    epub: { chapters: [{ label: '一' }, { label: '二' }, { label: '三' }, { label: '四' }] },
  }
  const position = currentPosition(doc, { chapter: 2 })
  assert.equal(position.chapterTitle, '三')
  assert.equal(position.percent, 50)
})

import { buildContextWindow, createPositionReporter } from '../src/client/chat-context.js'

const tick = (ms = 25) => new Promise((resolve) => setTimeout(resolve, ms))

test('createPositionReporter 节流：连续三次 report 只发一次请求', async () => {
  const calls = []
  const reporter = createPositionReporter({
    api: { context: async (sessionId, payload) => calls.push({ sessionId, payload }) },
    sessionId: 's1',
    throttleMs: 30,
  })
  reporter.report({ page: 1 })
  reporter.report({ page: 2 })
  reporter.report({ page: 3 })
  assert.equal(calls.length, 0, 'nothing sent before the throttle window')
  await tick(70)
  assert.equal(calls.length, 1, 'one request after the throttle window')
  assert.deepEqual(calls[0].payload.position, { page: 3 })
  reporter.dispose()
})

test('flush 立即发送最后一次位置', async () => {
  const calls = []
  const reporter = createPositionReporter({
    api: { context: async (sessionId, payload) => calls.push(payload) },
    sessionId: 's1',
    throttleMs: 200,
  })
  reporter.report({ page: 7 }, { title: '书 · 第 7 页', text: '正文' })
  reporter.flush()
  assert.equal(calls.length, 1, 'flush sends immediately')
  assert.deepEqual(calls[0].position, { page: 7 })
  assert.equal(calls[0].window.text, '正文')
  await tick(60)
  assert.equal(calls.length, 1, 'flush clears the pending timer')
  reporter.dispose()
})

test('dispose 后不再发送，也不会因 api 失败抛错', async () => {
  let sent = 0
  const reporter = createPositionReporter({
    api: {
      context: async () => {
        sent += 1
        throw new Error('offline')
      },
    },
    sessionId: 's1',
    throttleMs: 10,
  })
  reporter.report({ page: 4 })
  await tick(40)
  assert.equal(sent, 1)
  reporter.dispose()
  reporter.report({ page: 5 })
  await tick(40)
  assert.equal(sent, 1, 'disposed reporter ignores later positions')
})

test('buildContextWindow 对 markdown 截取当前章节文本', async () => {
  const source = '# 书名\n\n## 第一节\n第一节的正文。\n\n## 第二节\n第二节的正文。\n\n## 第三节\n第三节的正文。'
  const doc = { name: '书.md', ext: '.md', bytes: new TextEncoder().encode(source).buffer }
  const contextWindow = await buildContextWindow(doc, { chapterTitle: '第二节' })
  assert.ok(contextWindow)
  assert.match(contextWindow.title, /书\.md/)
  assert.match(contextWindow.text, /第二节的正文/)
  assert.doesNotMatch(contextWindow.text, /第一节的正文/)
  assert.doesNotMatch(contextWindow.text, /第三节的正文/)
})

test('buildContextWindow 对 epub 去标签，对缺字段返回 null', async () => {
  const doc = {
    name: '书.epub',
    ext: '.epub',
    epub: { chapters: [{ label: '第一章', html: '<p>第一章<em>正文</em>。</p><script>bad()</script>' }] },
  }
  const contextWindow = await buildContextWindow(doc, { chapter: 0 })
  assert.ok(contextWindow)
  assert.match(contextWindow.title, /第一章/)
  assert.equal(contextWindow.text, '第一章 正文 。')
  assert.doesNotMatch(contextWindow.text, /bad\(\)/)
  assert.equal(await buildContextWindow(null, {}), null)
  assert.equal(await buildContextWindow({ name: '空.md', ext: '.md' }, {}), null)
})

test('buildContextWindow 对 pdf 取当前页前后各一页并标注页范围', async () => {
  const pageText = { 1: '这是第一页的正文内容', 2: '这是第二页的正文内容', 3: '这是第三页的正文内容', 4: '这是第四页的正文内容' }
  const pdfDoc = {
    getPage: async (number) => ({
      getTextContent: async () => ({
        items: [{ str: pageText[number] || '', transform: [10, 0, 0, 10, 0, 100], width: 60 }],
      }),
    }),
  }
  const doc = { name: '书.pdf', ext: '.pdf', pdf: { numPages: 4, doc: pdfDoc } }
  const contextWindow = await buildContextWindow(doc, { page: 2 })
  assert.ok(contextWindow)
  assert.match(contextWindow.title, /第 1-3 页/)
  assert.match(contextWindow.text, /第一页/)
  assert.match(contextWindow.text, /第二页/)
  assert.match(contextWindow.text, /第三页/)
  assert.doesNotMatch(contextWindow.text, /第四页/)
})

test('api.context 把阅读位置 POST 到宿主路由', async () => {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return { ok: true, status: 200, json: async () => ({ ok: true }) }
  }
  try {
    const { api } = await import('../src/client/api.js')
    await api.context('s1', { position: { page: 2 }, window: { title: '书', text: '正文' } })
    assert.match(calls[0].url, /\/dsh-reader-live\/api\/context\?sessionId=s1$/)
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      sessionId: 's1',
      position: { page: 2 },
      window: { title: '书', text: '正文' },
    })
  } finally {
    globalThis.fetch = original
  }
})

test('buildContextWindow 在长文本内按百分比截取当前位置附近的窗口', async () => {
  const head = '开头'.repeat(10000)
  const middle = '中段'.repeat(10000)
  const tail = '结尾'.repeat(10000)
  const source = `${head}${middle}${tail}`
  const doc = { name: '长书.md', ext: '.md', bytes: new TextEncoder().encode(source) }
  const window = await buildContextWindow(doc, { chapter: 0, chapterTitle: '', percent: 92 })
  assert.ok(window, 'window built')
  assert.match(window.text, /结尾/)
  assert.doesNotMatch(window.text, /开头/)
})
