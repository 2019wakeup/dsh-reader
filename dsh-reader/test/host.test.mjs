import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { apply } from '../index.js'
import { readStore } from '../lib/store.js'

const SESSION = { id: 's1', header: { cwd: '' } }

function makeCtx(
  cwd,
  {
    llmText = '{"definition":"D","intuition":"I","context":"C","examples":[]}',
    llmReply,
    web,
    llmDelay = 0,
    llmStall = false,
  } = {},
) {
  const routes = []
  let calls = 0
  const ctx = {
    effect(callback) {
      callback()
      return () => {}
    },
    get(name) {
      return name === 'web' ? web : undefined
    },
    webServer: { register(route) { routes.push(route); return () => {} } },
    sessionPersistence: { stat: async (id) => (id === SESSION.id ? { header: { cwd } } : undefined) },
    workingDirectory: { defaultDirectory: cwd },
    agentDefaultModel: { currentSelection: () => ({ provider: 'p', model: 'm' }) },
    llm: {
      async resolveModelInfo(provider, model) {
        return { reasoning: { efforts: [{ id: 'max' }, { id: 'medium' }, { id: 'low' }] }, provider, model }
      },
      async listProviders() {
        return [{ id: 'p', name: 'Provider P' }, { id: 'p2', name: 'Provider P2' }]
      },
      async listModels(provider) {
        return provider === 'p'
          ? [{ id: 'm', name: 'Model M' }]
          : [{ id: 'm2', name: 'Model M2' }]
      },
      async *stream(options) {
        calls++
        if (llmStall) {
          // A provider that stops producing chunks without ever finishing: the
          // only way out is the deadline aborting the signal.
          await new Promise((_resolve, reject) => {
            const signal = options.signal
            if (!signal) return
            if (signal.aborted) {
              reject(new Error('aborted'))
              return
            }
            signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
          })
        }
        if (llmDelay) await new Promise((resolve) => setTimeout(resolve, llmDelay))
        ctx.lastStream = options
        const text = typeof llmReply === 'function' ? llmReply(options) : llmText
        yield { type: 'text-delta', text }
        yield { type: 'finish', reason: { kind: 'stop' } }
      },
    },
  }
  return { ctx, routes, calls: () => calls }
}

async function caller(routes) {
  const prefixes = routes.filter((route) => route.kind === 'prefix').sort((a, b) => b.path.length - a.path.length)
  return async (url, init = {}) => {
    const parsed = new URL('http://local' + url)
    const method = init.method || 'GET'
    const exact = routes.find((route) => route.kind === 'exact' && route.path === parsed.pathname)
    const prefix = prefixes.find((route) => parsed.pathname.startsWith(route.path))
    const route = exact || prefix
    assert.ok(route, 'registered a route for ' + parsed.pathname)
    if (typeof route.handler === 'function') {
      const request = Readable.from([Buffer.from(String(init.body || ''))])
      request.url = parsed.pathname + parsed.search
      request.method = method
      const out = { status: 0, headers: {}, chunks: [] }
      const response = {
        writeHead(status, headers) {
          out.status = status
          out.headers = headers || {}
        },
        write(chunk) {
          if (chunk) out.chunks.push(Buffer.from(chunk))
        },
        end(chunk) {
          if (chunk) out.chunks.push(Buffer.from(chunk))
        },
      }
      await route.handler(request, response)
      const text = Buffer.concat(out.chunks).toString('utf8')
      return {
        status: out.status,
        headers: { get: (key) => out.headers[key] || out.headers[key.toLowerCase()] },
        text: async () => text,
        json: async () => JSON.parse(text),
      }
    }
    return route.resource(new Request('http://local' + url, init))
  }
}

async function setup(t, options) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'reader-host-'))
  await fs.writeFile(path.join(cwd, 'book.md'), '# Title\nhello')
  await fs.mkdir(path.join(cwd, 'sub'))
  const made = makeCtx(cwd, options)
  apply(made.ctx)
  t.after(() => fs.rm(cwd, { recursive: true, force: true }))
  return { cwd, ...made, call: await caller(made.routes) }
}

test('registers reads as resources and writes as handlers', async (t) => {
  const { routes } = await setup(t)
  assert.ok(routes.some((route) => route.kind === 'prefix' && route.path === '/dsh-reader-live/assets'))
  for (const name of ['session', 'list', 'file']) {
    assert.ok(
      routes.some((route) => route.kind === 'exact' && route.path === `/dsh-reader-live/api/${name}` && typeof route.resource === 'function'),
      `exact resource for ${name}`,
    )
  }
  for (const name of ['store', 'explain']) {
    assert.ok(
      routes.some((route) => route.kind === 'exact' && route.path === `/dsh-reader-live/api/${name}` && typeof route.handler === 'function'),
      `exact handler for ${name}`,
    )
  }
})

test('lists directory entries for the session workspace', async (t) => {
  const { call } = await setup(t)
  const res = await call('/dsh-reader-live/api/list?sessionId=s1&dir=.')
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(body.entries.some((item) => item.name === 'book.md'))
  assert.ok(body.entries.some((item) => item.name === 'sub' && item.type === 'dir'))
})

test('rejects path traversal with 403', async (t) => {
  const { call } = await setup(t)
  const res = await call('/dsh-reader-live/api/file?sessionId=s1&path=../secret.txt')
  assert.equal(res.status, 403)
})

test('serves markdown bytes with a text content type and a fingerprint', async (t) => {
  const { call } = await setup(t)
  const res = await call('/dsh-reader-live/api/file?sessionId=s1&path=book.md')
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /text\/markdown/)
  assert.match(await res.text(), /Title/)
  assert.match(res.headers.get('x-doc-fingerprint'), /^[0-9a-f]{64}$/)
})

test('doc/upsert rebinds a renamed path without touching annotations', async (t) => {
  const { call } = await setup(t)
  const mutate = (body) =>
    call('/dsh-reader-live/api/mutate?sessionId=s1', { method: 'POST', body: JSON.stringify(body) })
  await mutate({ op: 'doc/upsert', docKey: 'fp', path: 'a.md' })
  await mutate({ op: 'annotation/add', docKey: 'fp', annotation: { id: 'a1', quote: 'x' } })
  const res = await mutate({ op: 'doc/upsert', docKey: 'fp', path: 'b.md' })
  const body = await res.json()
  assert.equal(body.store.docs.fp.path, 'b.md')
  assert.equal(body.store.docs.fp.annotations[0].id, 'a1')
})

test('mutates a concept and reads it back', async (t) => {
  const { call } = await setup(t)
  const concept = { id: 'c1', term: '线性一致性', definition: 'D' }
  const res = await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'concept/upsert', concept }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.store.concepts.c1.term, '线性一致性')
  const get = await call('/dsh-reader-live/api/store?sessionId=s1')
  assert.equal((await get.json()).store.concepts.c1.id, 'c1')
})

test('deleting a concept hands its children to the level above', async (t) => {
  const { call } = await setup(t)
  const mutate = (body) =>
    call('/dsh-reader-live/api/mutate?sessionId=s1', { method: 'POST', body: JSON.stringify(body) })
  await mutate({ op: 'concept/upsert', concept: { id: 'a', term: 'A', definition: 'a' } })
  await mutate({ op: 'concept/upsert', concept: { id: 'b', term: 'B', definition: 'b', parentId: 'a' } })
  await mutate({ op: 'concept/upsert', concept: { id: 'c', term: 'C', definition: 'c', parentId: 'b' } })
  const gone = await mutate({ op: 'concept/delete', id: 'b' })
  const store = (await gone.json()).store
  assert.equal(store.concepts.b, undefined)
  // The grandchild is promoted to the deleted card's own parent, so no card is
  // left pointing at a concept that no longer exists.
  assert.equal(store.concepts.c.parentId, 'a')
  const top = await mutate({ op: 'concept/delete', id: 'a' })
  const after = (await top.json()).store
  assert.equal(after.concepts.a, undefined)
  assert.equal(after.concepts.c.parentId, null)
})

test('serializes concurrent mutations without losing one', async (t) => {
  const { call } = await setup(t)
  await Promise.all([
    call('/dsh-reader-live/api/mutate?sessionId=s1', { method: 'POST', body: JSON.stringify({ op: 'concept/upsert', concept: { id: 'a', term: 'A' } }) }),
    call('/dsh-reader-live/api/mutate?sessionId=s1', { method: 'POST', body: JSON.stringify({ op: 'concept/upsert', concept: { id: 'b', term: 'B' } }) }),
  ])
  const get = await call('/dsh-reader-live/api/store?sessionId=s1')
  const stored = (await get.json()).store.concepts
  assert.ok(stored.a)
  assert.ok(stored.b)
})

test('rejects an unknown mutation', async (t) => {
  const { call } = await setup(t)
  const res = await call('/dsh-reader-live/api/mutate?sessionId=s1', { method: 'POST', body: JSON.stringify({ op: 'nope' }) })
  assert.equal(res.status, 400)
})

test('does not serve html as html', async (t) => {
  const { cwd, call } = await setup(t)
  await fs.writeFile(path.join(cwd, 'page.html'), '<script>alert(1)</script>')
  const res = await call('/dsh-reader-live/api/file?sessionId=s1&path=page.html')
  assert.notEqual(res.headers.get('content-type'), 'text/html; charset=utf-8')
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
})

test('rejects a symlink that escapes the workspace', async (t) => {
  const { cwd, call } = await setup(t)
  await fs.symlink('/etc/hosts', path.join(cwd, 'leak.md'))
  const res = await call('/dsh-reader-live/api/file?sessionId=s1&path=leak.md')
  assert.equal(res.status, 403)
})

test('explains a new concept once and reuses it afterwards', async (t) => {
  const { call, calls } = await setup(t)
  const payload = { term: '线性一致性', sentence: '它要求实时一致。', paragraph: '段落', docTitle: '书' }
  const first = await call('/dsh-reader-live/api/explain?sessionId=s1', { method: 'POST', body: JSON.stringify(payload) })
  const one = await first.json()
  assert.equal(first.status, 200)
  assert.equal(one.concept.term, '线性一致性')
  assert.equal(one.concept.definition, 'D')

  const second = await call('/dsh-reader-live/api/explain?sessionId=s1', { method: 'POST', body: JSON.stringify(payload) })
  const two = await second.json()
  assert.equal(two.concept.id, one.concept.id)
  assert.equal(calls(), 1)
})

test('explain keeps concepts that already existed', async (t) => {
  const { call } = await setup(t)
  await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'concept/upsert', concept: { id: 'c0', term: '已有概念' } }),
  })
  const res = await call('/dsh-reader-live/api/explain?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ term: '新概念', sentence: 's', paragraph: 'p' }),
  })
  const body = await res.json()
  assert.ok(body.store, 'explain returns the authoritative store')
  assert.ok(body.store.concepts.c0, 'pre-existing concept survives')
  assert.ok(Object.values(body.store.concepts).some((item) => item.term === '新概念'))
})

test('two explains running together both persist', async (t) => {
  const { call } = await setup(t)
  const explain = (term) =>
    call('/dsh-reader-live/api/explain?sessionId=s1', {
      method: 'POST',
      body: JSON.stringify({ term, sentence: 's', paragraph: 'p' }),
    })
  await Promise.all([explain('并发甲'), explain('并发乙')])
  const get = await call('/dsh-reader-live/api/store?sessionId=s1')
  const terms = Object.values((await get.json()).store.concepts).map((item) => item.term)
  assert.ok(terms.includes('并发甲'), 'first concurrent concept persisted')
  assert.ok(terms.includes('并发乙'), 'second concurrent concept persisted')
})

test('explain stores the first occurrence and dedupes repeats', async (t) => {
  const { call } = await setup(t)
  const mutate = (body) =>
    call('/dsh-reader-live/api/mutate?sessionId=s1', { method: 'POST', body: JSON.stringify(body) })
  await mutate({ op: 'doc/upsert', docKey: 'fp1', path: 'a.md' })
  const payload = { term: 'occ-a', sentence: 's', paragraph: 'p', docKey: 'fp1', chapter: 0, quote: 'occ-a', occurrence: 0 }
  const first = await call('/dsh-reader-live/api/explain?sessionId=s1', { method: 'POST', body: JSON.stringify(payload) })
  const one = await first.json()
  assert.equal(one.concept.occurrences.length, 1)
  const second = await call('/dsh-reader-live/api/explain?sessionId=s1', { method: 'POST', body: JSON.stringify(payload) })
  const two = await second.json()
  assert.equal(two.concept.occurrences.length, 1)
})

test('occurrences on different pdf pages are kept separately', async (t) => {
  const { call } = await setup(t)
  const mutate = (body) =>
    call('/dsh-reader-live/api/mutate?sessionId=s1', { method: 'POST', body: JSON.stringify(body) })
  await mutate({ op: 'doc/upsert', docKey: 'fp1', path: 'a.pdf' })
  const post = (page) =>
    call('/dsh-reader-live/api/explain?sessionId=s1', {
      method: 'POST',
      body: JSON.stringify({ term: 'page-term', sentence: 's', paragraph: 'p', docKey: 'fp1', chapter: 0, page, quote: 'page-term', occurrence: 0 }),
    })
  await post(12)
  const second = await post(87)
  const body = await second.json()
  assert.equal(body.concept.occurrences.length, 2)
  assert.deepEqual(body.concept.occurrences.map((item) => item.page), [12, 87])
})

test('a second document appends a second occurrence', async (t) => {
  const { call } = await setup(t)
  const mutate = (body) =>
    call('/dsh-reader-live/api/mutate?sessionId=s1', { method: 'POST', body: JSON.stringify(body) })
  await mutate({ op: 'doc/upsert', docKey: 'fp1', path: 'a.md' })
  await mutate({ op: 'doc/upsert', docKey: 'fp2', path: 'b.md' })
  const post = (docKey) =>
    call('/dsh-reader-live/api/explain?sessionId=s1', {
      method: 'POST',
      body: JSON.stringify({ term: 'occ-b', sentence: 's', paragraph: 'p', docKey, chapter: 0, quote: 'occ-b', occurrence: 0 }),
    })
  await post('fp1')
  const second = await post('fp2')
  const body = await second.json()
  assert.equal(body.concept.occurrences.length, 2)
})

test('rejects an occurrence for a docKey that is not in the store', async (t) => {
  const { call } = await setup(t)
  const res = await call('/dsh-reader-live/api/explain?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ term: 'occ-c', sentence: 's', paragraph: 'p', docKey: 'nope', chapter: 0, quote: 'occ-c', occurrence: 0 }),
  })
  assert.equal(res.status, 400)
})

test('prefs/set stores validated preferences', async (t) => {
  const { call } = await setup(t)
  const res = await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'prefs/set', prefs: { fontSize: 20, hoverDelay: 220, cardTrigger: 'click' } }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.store.prefs.fontSize, 20)
  assert.equal(body.store.prefs.hoverDelay, 220)
  assert.equal(body.store.prefs.cardTrigger, 'click')
  assert.equal(body.store.prefs.lineHeight, 1.85, 'untouched prefs keep their defaults')
})

test('prefs/set rejects values outside the allowed range', async (t) => {
  const { call } = await setup(t)
  const res = await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'prefs/set', prefs: { fontSize: 99 } }),
  })
  assert.equal(res.status, 400)
})

test('guide generates section summaries and reuses unchanged chapters', async (t) => {
  const llmReply = (options) =>
    options.system.includes('synopsis')
      ? '{"synopsis":"全书主旨","questions":["q1","q2","q3"]}'
      : '{"summary":"章节摘要","keyPoints":["k1","k2"]}'
  const { call } = await setup(t, { llmReply })
  await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'doc/upsert', docKey: 'fp1', path: 'a.md' }),
  })
  const base = {
    docKey: 'fp1',
    title: '书',
    sections: [
      { id: 's1', title: '一', level: 1, text: 'aaa' },
      { id: 's2', title: '二', level: 1, text: 'bbb' },
    ],
  }
  const post = (payload) =>
    call('/dsh-reader-live/api/guide?sessionId=s1', { method: 'POST', body: JSON.stringify(payload) })

  const first = await (await post(base)).json()
  assert.equal(first.generated, 2)
  assert.equal(first.reused, 0)
  assert.equal(first.guide.synopsis, '全书主旨')
  assert.equal(first.guide.sections.length, 2)

  const second = await (await post(base)).json()
  assert.equal(second.generated, 0)
  assert.equal(second.reused, 2)
  assert.equal(second.guide.synopsis, '全书主旨')

  const changed = { ...base, sections: [base.sections[0], { ...base.sections[1], text: 'ccc' }] }
  const third = await (await post(changed)).json()
  assert.equal(third.generated, 1)
  assert.equal(third.reused, 1)
})

test('guide streams progress events and a done event', async (t) => {
  const llmReply = (options) =>
    options.system.includes('synopsis')
      ? '{"synopsis":"主旨","questions":["q1"]}'
      : '{"summary":"摘要","keyPoints":[]}'
  const { call } = await setup(t, { llmReply })
  await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'doc/upsert', docKey: 'fp1', path: 'a.md' }),
  })
  const res = await call('/dsh-reader-live/api/guide?sessionId=s1&stream=1', {
    method: 'POST',
    body: JSON.stringify({
      docKey: 'fp1',
      title: '书',
      sections: [
        { id: 's1', title: '一', text: 'aaa' },
        { id: 's2', title: '二', text: 'bbb' },
      ],
    }),
  })
  const events = (await res.text())
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  assert.equal(events.filter((event) => event.type === 'progress').length, 2)
  const done = events.find((event) => event.type === 'done')
  assert.ok(done && done.guide.sections.length === 2)
})

test('guide builds part summaries for long books and reuses them', async (t) => {
  const llmReply = (options) => {
    if (options.system.includes('篇章')) return '{"summary":"篇章摘要","keyPoints":["要点"]}'
    if (options.system.includes('全书')) return '{"synopsis":"全书主旨","questions":["q1","q2","q3"]}'
    return '{"summary":"段摘要","keyPoints":[]}'
  }
  const { call, calls } = await setup(t, { llmReply })
  await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'doc/upsert', docKey: 'fp1', path: 'long.md' }),
  })
  const payload = {
    docKey: 'fp1',
    title: '长书',
    sections: [
      { id: 's1', title: '一', text: 'a', page: 3 },
      { id: 's2', title: '二', text: 'b', page: 11, chapter: 2 },
      { id: 's3', title: '三', text: 'c', page: 20 },
      { id: 's4', title: '四', text: 'd', page: 30 },
    ],
    parts: [
      { id: 'pt1', title: '篇一', sectionIds: ['s1', 's2'] },
      { id: 'pt2', title: '篇二', sectionIds: ['s3', 's4'] },
    ],
  }
  const run = () =>
    call('/dsh-reader-live/api/guide?sessionId=s1&stream=1', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  const first = await run()
  const events = (await first.text()).trim().split('\n').map((line) => JSON.parse(line))
  const done = events.find((event) => event.type === 'done')
  if (!done) console.error('GUIDE EVENTS:', JSON.stringify(events).slice(0, 800))
  assert.equal(done.guide.parts.length, 2)
  assert.equal(done.guide.parts[0].summary, '篇章摘要')
  assert.equal(done.guide.sections[0].page, 3, 'page survives for guide jumps')
  assert.equal(done.guide.sections[1].chapter, 2, 'chapter survives for epub jumps')
  assert.equal(done.partsGenerated, 2)
  assert.equal(events.filter((event) => event.phase === 'part').length, 2)

  const before = calls()
  const second = await run()
  const secondDone = (await second.text()).trim().split('\n').map((line) => JSON.parse(line)).find((event) => event.type === 'done')
  assert.equal(secondDone.partsGenerated, 0)
  assert.equal(secondDone.reused, 4)
  assert.equal(secondDone.guide.sections[0].page, 3, 'cached summary keeps its page')
  assert.equal(calls(), before, 'a fully cached guide makes no model calls')
})

test('single-section parts reuse the section summary without another call', async (t) => {
  const seen = []
  const llmReply = (options) => {
    seen.push(options.system)
    if (options.system.includes('全书')) return '{"synopsis":"主旨","questions":[]}'
    return '{"summary":"段摘要","keyPoints":["k"]}'
  }
  const { call, calls } = await setup(t, { llmReply })
  await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'doc/upsert', docKey: 'fp1', path: 'a.md' }),
  })
  const payload = {
    docKey: 'fp1',
    title: '书',
    sections: [
      { id: 's1', title: '一', text: 'a' },
      { id: 's2', title: '二', text: 'b' },
    ],
    parts: [
      { id: 'p1', title: '篇一', sectionIds: ['s1'] },
      { id: 'p2', title: '篇二', sectionIds: ['s2'] },
    ],
  }
  const run = () =>
    call('/dsh-reader-live/api/guide?sessionId=s1&stream=1', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  const events = (await (await run()).text()).trim().split('\n').map((line) => JSON.parse(line))
  const done = events.find((event) => event.type === 'done')
  assert.equal(done.partsGenerated, 0)
  assert.equal(done.guide.parts.length, 2)
  assert.equal(done.guide.parts[0].summary, '段摘要')
  assert.equal(done.guide.parts[0].title, '篇一')
  assert.equal(calls(), 3, 'two section summaries plus one overview')
  assert.equal(seen.filter((system) => system.includes('篇章')).length, 0, 'no part-level calls')

  const before = calls()
  await run()
  assert.equal(calls(), before, 'a cached guide makes no model calls')
})

test('guide rejects a part that references an unknown section', async (t) => {
  const { call } = await setup(t)
  await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'doc/upsert', docKey: 'fp1', path: 'a.md' }),
  })
  const res = await call('/dsh-reader-live/api/guide?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({
      docKey: 'fp1',
      sections: [{ id: 's1', title: '一', text: 'a' }],
      parts: [{ id: 'p1', title: '篇', sectionIds: ['missing'] }],
    }),
  })
  assert.equal(res.status, 400)
})

test('guide fails instead of storing blank sections', async (t) => {
  const { call } = await setup(t, { llmReply: () => '' })
  await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'doc/upsert', docKey: 'fp1', path: 'a.md' }),
  })
  const res = await call('/dsh-reader-live/api/guide?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ docKey: 'fp1', sections: [{ id: 's1', title: '一', text: 'x' }] }),
  })
  assert.equal(res.status, 502)
  const store = (await (await call('/dsh-reader-live/api/store?sessionId=s1')).json()).store
  assert.equal(store.docs.fp1.guide, undefined)
})

test('guide rejects an unknown document', async (t) => {
  const { call } = await setup(t)
  const res = await call('/dsh-reader-live/api/guide?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ docKey: 'nope', sections: [{ id: 's', text: 'x' }] }),
  })
  assert.equal(res.status, 400)
})

test('ask answers and caches the Q&A on the concept', async (t) => {
  const { call } = await setup(t, { llmReply: () => '这是回答。' })
  await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'concept/upsert', concept: { id: 'c1', term: 'T', definition: 'D' } }),
  })
  const ask = (question) =>
    call('/dsh-reader-live/api/concept/ask?sessionId=s1', {
      method: 'POST',
      body: JSON.stringify({ conceptId: 'c1', question }),
    })
  const first = await (await ask('为什么？')).json()
  assert.equal(first.answer, '这是回答。')
  assert.equal(first.store.concepts.c1.qa.length, 1)
  const second = await (await ask('再问一次')).json()
  assert.equal(second.store.concepts.c1.qa.length, 2)
})

test('ask gives the model the related concept definitions', async (t) => {
  let captured = ''
  const llmReply = (options) => {
    captured = options.messages[0].content[0].text
    return '回答'
  }
  const { call } = await setup(t, { llmReply })
  const mutate = (body) =>
    call('/dsh-reader-live/api/mutate?sessionId=s1', { method: 'POST', body: JSON.stringify(body) })
  await mutate({ op: 'concept/upsert', concept: { id: 'c1', term: '甲', related: ['乙'] } })
  await mutate({ op: 'concept/upsert', concept: { id: 'c2', term: '乙', definition: '乙的定义' } })
  await call('/dsh-reader-live/api/concept/ask?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ conceptId: 'c1', question: '甲乙关系？' }),
  })
  assert.match(captured, /乙的定义/)
})

test('records outbound explain and ask requests for transparency', async (t) => {
  const { call } = await setup(t)
  await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'doc/upsert', docKey: 'fp1', path: 'a.md' }),
  })
  await call('/dsh-reader-live/api/explain?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ term: '一致性', sentence: 's', paragraph: 'p', docKey: 'fp1', chapter: 0, quote: '一致性', occurrence: 0 }),
  })
  const store = (await (await call('/dsh-reader-live/api/store?sessionId=s1')).json()).store
  assert.equal(store.debug.lastSent[0].kind, 'explain')
  assert.equal(store.debug.lastSent[0].preview, '一致性')
})

test('follow-up can use general knowledge and optional web search', async (t) => {
  let captured = ''
  const web = {
    calls: [],
    async searchReady(provider) {
      this.readyProvider = provider
      return true
    },
    async search(request) {
      this.calls.push(request)
      return {
        content: '网络摘要内容',
        sources: [{ title: '来源一', url: 'https://example.com/a', snippet: '片段' }],
        truncated: false,
      }
    },
  }
  const { call } = await setup(t, {
    web,
    llmReply: (options) => {
      captured = `${options.system || ''}\n${options.messages[0].content[0].text}`
      return '按三层回答'
    },
  })
  await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'concept/upsert', concept: { id: 'c1', term: '线性一致性' } }),
  })
  const res = await (await call('/dsh-reader-live/api/concept/ask?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ conceptId: 'c1', question: '它和最终一致性有什么差别？', web: true }),
  })).json()
  assert.equal(res.web.used, true)
  assert.equal(res.web.sources[0].url, 'https://example.com/a')
  assert.equal(res.store.concepts.c1.qa[0].web.sources.length, 1)
  assert.match(captured, /通用知识/)
  assert.match(captured, /联网结果/)
  assert.match(captured, /网络摘要内容/)
  assert.equal(web.calls.length, 1)
  assert.match(web.calls[0].query, /线性一致性/)
})

test('follow-up falls back when web search is unavailable', async (t) => {
  const { call } = await setup(t)
  await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'concept/upsert', concept: { id: 'c1', term: 'T' } }),
  })
  const res = await (await call('/dsh-reader-live/api/concept/ask?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ conceptId: 'c1', question: 'q', web: true }),
  })).json()
  assert.equal(res.web.used, false)
  assert.ok(res.web.error)
  assert.ok(res.answer.length > 0)
})

test('lists providers and their models for the settings picker', async (t) => {
  const { call } = await setup(t)
  const body = await (await call('/dsh-reader-live/api/models?sessionId=s1')).json()
  assert.equal(body.current.provider, 'p')
  assert.equal(body.providers.length, 2)
  assert.equal(body.providers[0].models[0].id, 'm')
  assert.equal(body.providers[1].models[0].id, 'm2')
})

test('uses the plugin model preference for explanations', async (t) => {
  const { call, ctx } = await setup(t)
  await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'prefs/set', prefs: { model: { provider: 'p2', model: 'm2' } } }),
  })
  await call('/dsh-reader-live/api/explain?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ term: 'T', sentence: 's', paragraph: 'p' }),
  })
  assert.equal(ctx.lastStream.provider, 'p2')
  assert.equal(ctx.lastStream.model, 'm2')
})

test('rejects an invalid model preference', async (t) => {
  const { call } = await setup(t)
  const res = await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'prefs/set', prefs: { model: { provider: '', model: 'm' } } }),
  })
  assert.equal(res.status, 400)
})

test('concurrent explanations of one term share a model call', async (t) => {
  const { call, calls } = await setup(t, { llmDelay: 20 })
  const mutate = (body) =>
    call('/dsh-reader-live/api/mutate?sessionId=s1', { method: 'POST', body: JSON.stringify(body) })
  await mutate({ op: 'doc/upsert', docKey: 'fp1', path: 'a.md' })
  await mutate({ op: 'doc/upsert', docKey: 'fp2', path: 'b.md' })
  const explain = (docKey) =>
    call('/dsh-reader-live/api/explain?sessionId=s1', {
      method: 'POST',
      body: JSON.stringify({ term: '同词', sentence: 's', paragraph: 'p', docKey, chapter: 0, quote: '同词', occurrence: 0 }),
    })
  const [first, second] = await Promise.all([explain('fp1'), explain('fp2')])
  assert.equal((await first.json()).concept.term, '同词')
  assert.equal((await second.json()).concept.term, '同词')
  assert.equal(calls(), 1, 'one model call for both readers')
  const store = (await (await call('/dsh-reader-live/api/store?sessionId=s1')).json()).store
  const concepts = Object.values(store.concepts).filter((concept) => concept.term === '同词')
  assert.equal(concepts.length, 1)
  assert.equal(concepts[0].occurrences.length, 2)
})

test('routes simple explanations through the quick prompt and low effort', async (t) => {
  let system = ''
  const llmReply = (options) => {
    system = options.system
    return '{"definition":"快速定义","intuition":"快速直觉","examples":["例子"]}'
  }
  const { call, ctx } = await setup(t, { llmReply })
  const body = await (await call('/dsh-reader-live/api/explain?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ term: 'quick-term', sentence: 's', paragraph: 'p' }),
  })).json()
  assert.equal(body.route, 'quick')
  assert.equal(body.concept.depth, 'quick')
  assert.match(system, /只需要快速理解/)
  assert.equal(ctx.lastStream.reasoningEffort, 'low')
  // 260 was too small once the model spends part of the budget before emitting
  // the JSON; the quick path now budgets like the guide's single calls.
  assert.ok(ctx.lastStream.maxTokens >= 900)
  assert.ok(ctx.lastStream.maxTokens <= 1_000)
})

test('upgrades a quick concept to a full explanation on demand', async (t) => {
  const llmReply = (options) =>
    options.system.includes('只需要快速理解')
      ? '{"definition":"快速定义","intuition":"快速直觉"}'
      : '{"definition":"完整定义","intuition":"完整直觉","context":"完整语境","examples":["完整例子"]}'
  const { call } = await setup(t, { llmReply })
  const explain = (depth) =>
    call('/dsh-reader-live/api/explain?sessionId=s1', {
      method: 'POST',
      body: JSON.stringify({ term: '升级词', sentence: 's', paragraph: 'p', depth }),
    })
  const quick = await (await explain('quick')).json()
  assert.equal(quick.route, 'quick')
  const full = await (await explain('full')).json()
  assert.equal(full.route, 'full')
  assert.equal(full.upgraded, true)
  assert.equal(full.concept.depth, 'full')
  assert.equal(full.concept.definition, '完整定义')
  assert.equal(full.concept.context, '完整语境')
})

test('a cached concept returns without a model call', async (t) => {
  const { call, calls } = await setup(t)
  const explain = () =>
    call('/dsh-reader-live/api/explain?sessionId=s1', {
      method: 'POST',
      body: JSON.stringify({ term: 'cached-term', sentence: 's', paragraph: 'p' }),
    })
  await explain()
  const before = calls()
  const second = await (await explain()).json()
  assert.equal(second.route, 'cached')
  assert.equal(calls(), before)
})

test('translates segments in one batch and caches them per document', async (t) => {
  const llmReply = (options) => {
    if (!options.system.includes('专业翻译')) return '{"definition":"D"}'
    const ids = [...options.messages[0].content[0].text.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1])
    return JSON.stringify({ translations: Object.fromEntries(ids.map((id) => [id, `T:${id}`])) })
  }
  const { call, calls } = await setup(t, { llmReply })
  await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'doc/upsert', docKey: 'fp1', path: 'a.md' }),
  })
  const translate = (segments) =>
    call('/dsh-reader-live/api/translate?sessionId=s1', {
      method: 'POST',
      body: JSON.stringify({ docKey: 'fp1', target: 'en', segments }),
    })
  const segments = [
    { id: 'h1', text: '你好' },
    { id: 'h2', text: '世界' },
  ]
  const before = calls()
  const first = await (await translate(segments)).json()
  assert.equal(first.generated, 2)
  assert.equal(first.cached, 0)
  assert.equal(first.translations.h1, 'T:h1')
  assert.equal(calls(), before + 1, 'one batch call for both segments')
  const store = (await (await call('/dsh-reader-live/api/store?sessionId=s1')).json()).store
  const persisted = store.docs.fp1.translations.en
  assert.equal(Object.keys(persisted).length, 2)

  const second = await (await translate(segments)).json()
  assert.equal(second.generated, 0)
  assert.equal(second.cached, 2)
  assert.equal(calls(), before + 1, 'cached translation makes no model call')
})

test('rejects a translation request with an unknown target', async (t) => {
  const { call } = await setup(t)
  const res = await call('/dsh-reader-live/api/translate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ target: 'xx', segments: [{ id: 'a', text: 'hi' }] }),
  })
  assert.equal(res.status, 400)
})

test('rejects a translation request with an unknown source', async (t) => {
  const { call } = await setup(t)
  const res = await call('/dsh-reader-live/api/translate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ from: 'xx', target: 'zh', segments: [{ id: 'a', text: 'hi' }] }),
  })
  assert.equal(res.status, 400)
})

test('keeps at most ten sent entries', async (t) => {
  const { call } = await setup(t)
  for (let index = 0; index < 12; index += 1) {
    await call('/dsh-reader-live/api/explain?sessionId=s1', {
      method: 'POST',
      body: JSON.stringify({ term: `T${index}`, sentence: 's', paragraph: 'p' }),
    })
  }
  const store = (await (await call('/dsh-reader-live/api/store?sessionId=s1')).json()).store
  assert.equal(store.debug.lastSent.length, 10)
  assert.equal(store.debug.lastSent[9].preview, 'T11')
})

test('ask rejects an unknown concept and an empty question', async (t) => {
  const { call } = await setup(t)
  const post = (body) =>
    call('/dsh-reader-live/api/concept/ask?sessionId=s1', { method: 'POST', body: JSON.stringify(body) })
  assert.equal((await post({ conceptId: 'nope', question: 'q' })).status, 400)
  await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'concept/upsert', concept: { id: 'c1', term: 'T' } }),
  })
  assert.equal((await post({ conceptId: 'c1', question: '  ' })).status, 400)
})

test('exports the store as a downloadable json document', async (t) => {
  const { call } = await setup(t)
  const res = await call('/dsh-reader-live/api/export?sessionId=s1')
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-disposition'), /attachment/)
  const body = await res.json()
  assert.equal(body.version, 2)
  assert.ok(body.store)
})

test('import replaces the store and keeps a backup', async (t) => {
  const { call, cwd } = await setup(t)
  const seeded = await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'concept/upsert', concept: { id: 'old', term: '旧' } }),
  })
  assert.equal(seeded.status, 200)
  const incoming = { version: 2, prefs: {}, concepts: { fresh: { id: 'fresh', term: '新' } }, docs: {} }
  const res = await call('/dsh-reader-live/api/import?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ store: incoming }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(body.store.concepts.fresh)
  assert.ok(!body.store.concepts.old)
  const backups = await fs.readdir(path.join(cwd, '.dsh-reader', 'backups'))
  assert.ok(backups.length >= 1)
})

test('import rejects a malformed store', async (t) => {
  const { call } = await setup(t)
  const res = await call('/dsh-reader-live/api/import?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ store: { version: 1 } }),
  })
  assert.equal(res.status, 400)
})

test('a concept reused from another book gains one usage note', async (t) => {
  const llmReply = (options) =>
    options.system.includes('具体怎么用') ? '{"note":"本书偏工程实现"}' : '{"definition":"D"}'
  const { call, calls } = await setup(t, { llmReply })
  const mutate = (body) =>
    call('/dsh-reader-live/api/mutate?sessionId=s1', { method: 'POST', body: JSON.stringify(body) })
  await mutate({ op: 'doc/upsert', docKey: 'fp1', path: 'a.md' })
  await mutate({ op: 'doc/upsert', docKey: 'fp2', path: 'b.md' })
  await mutate({
    op: 'concept/upsert',
    concept: { id: 'c1', term: 'T', definition: 'D', evidence: { docKey: 'fp1' } },
  })
  const explain = (docKey, sentence) =>
    call('/dsh-reader-live/api/explain?sessionId=s1', {
      method: 'POST',
      body: JSON.stringify({ term: 'T', sentence, docTitle: '书', docKey, quote: 'T', occurrence: 0, depth: 'full' }),
    })
  const upgrade = await (await explain('fp1', '本书句子')).json()
  assert.equal(upgrade.concept.depth, 'full', 'full depth upgrades the seeded concept')
  const first = await (await explain('fp2', '另一本书的句子')).json()
  assert.equal(first.concept.contexts.length, 1)
  assert.equal(first.concept.contexts[0].note, '本书偏工程实现')

  const before = calls()
  const second = await (await explain('fp2', '同一本书的另一句')).json()
  assert.equal(second.concept.contexts.length, 1, 'no duplicate note for the same book')
  assert.equal(calls(), before, 'no extra model call for a known book')
})

test('import joins the write queue so a concurrent mutation cannot drop it', async (t) => {
  const { call } = await setup(t)
  await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'doc/upsert', docKey: 'fp', path: 'a.md' }),
  })
  const incoming = { version: 2, prefs: {}, concepts: { fresh: { id: 'fresh', term: '新' } }, docs: {} }
  await Promise.all([
    call('/dsh-reader-live/api/import?sessionId=s1', { method: 'POST', body: JSON.stringify({ store: incoming }) }),
    call('/dsh-reader-live/api/mutate?sessionId=s1', {
      method: 'POST',
      body: JSON.stringify({ op: 'position/set', docKey: 'fp', position: { page: 1 } }),
    }),
  ])
  const store = (await (await call('/dsh-reader-live/api/store?sessionId=s1')).json()).store
  assert.ok(store.concepts.fresh, 'imported concept survives a concurrent write')
})

test('lists backups and restores the newest one', async (t) => {
  const { call } = await setup(t)
  const mutate = (body) =>
    call('/dsh-reader-live/api/mutate?sessionId=s1', { method: 'POST', body: JSON.stringify(body) })
  await mutate({ op: 'concept/upsert', concept: { id: 'old', term: '旧' } })
  await mutate({ op: 'concept/upsert', concept: { id: 'new', term: '新' } })
  const list = await (await call('/dsh-reader-live/api/backups?sessionId=s1')).json()
  assert.ok(list.backups.length >= 1)
  const restored = await (await call('/dsh-reader-live/api/restore?sessionId=s1', { method: 'POST', body: '{}' })).json()
  assert.ok(restored.store, 'restore returns a store')
  assert.ok(restored.name, 'restore reports the snapshot')
})

test('every mutation advances the store revision', async (t) => {
  const { call } = await setup(t)
  const mutate = (body) =>
    call('/dsh-reader-live/api/mutate?sessionId=s1', { method: 'POST', body: JSON.stringify(body) })
  const first = await (await mutate({ op: 'concept/upsert', concept: { id: 'a', term: 'A' } })).json()
  const second = await (await mutate({ op: 'concept/upsert', concept: { id: 'b', term: 'B' } })).json()
  assert.equal(second.store.revision, first.store.revision + 1)
})

test('concept/merge folds the source into the target and deletes it', async (t) => {
  const { call } = await setup(t)
  const mutate = (body) =>
    call('/dsh-reader-live/api/mutate?sessionId=s1', { method: 'POST', body: JSON.stringify(body) })
  await mutate({ op: 'doc/upsert', docKey: 'fp1', path: 'a.md' })
  await mutate({
    op: 'concept/upsert',
    concept: { id: 'src', term: 'LC', aliases: ['linear'], occurrences: [{ docKey: 'fp1', quote: 'LC', chapter: 0, occurrence: 0 }], qa: [{ q: 'q', a: 'a' }] },
  })
  await mutate({ op: 'concept/upsert', concept: { id: 'dst', term: '线性一致性', occurrences: [] } })
  const res = await mutate({ op: 'concept/merge', fromId: 'src', toId: 'dst' })
  const store = (await res.json()).store
  assert.ok(store.concepts.dst)
  assert.ok(!store.concepts.src)
  assert.ok(store.concepts.dst.aliases.includes('LC'))
  assert.equal(store.concepts.dst.occurrences.length, 1)
  assert.equal(store.concepts.dst.qa.length, 1)
})

test('doc/relink moves annotations from a stale fingerprint', async (t) => {
  const { call } = await setup(t)
  const mutate = (body) =>
    call('/dsh-reader-live/api/mutate?sessionId=s1', { method: 'POST', body: JSON.stringify(body) })
  await mutate({ op: 'doc/upsert', docKey: 'old', path: 'a.md' })
  await mutate({ op: 'doc/upsert', docKey: 'new', path: 'a.md' })
  await mutate({ op: 'annotation/add', docKey: 'old', annotation: { id: 'a1', quote: 'x' } })
  const res = await mutate({ op: 'doc/relink', fromKey: 'old', toKey: 'new' })
  const store = (await res.json()).store
  assert.equal(store.docs.new.annotations[0].id, 'a1')
  assert.equal(store.docs.old, undefined)
})

test('persists the pdf spread preference', async (t) => {
  const { call } = await setup(t)
  const res = await call('/dsh-reader-live/api/mutate?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ op: 'prefs/set', prefs: { pdfSpread: true } }),
  })
  const body = await res.json()
  assert.equal(body.store.prefs.pdfSpread, true)
})

test('returns 400 when the session cannot be resolved', async (t) => {
  const { call } = await setup(t)
  const res = await call('/dsh-reader-live/api/list?sessionId=nope&dir=.')
  assert.equal(res.status, 400)
})

test('a stalled explanation is aborted and reported instead of spinning forever', async (t) => {
  const previous = process.env.DSH_READER_EXPLAIN_TIMEOUT_MS
  process.env.DSH_READER_EXPLAIN_TIMEOUT_MS = '60'
  t.after(() => {
    if (previous === undefined) delete process.env.DSH_READER_EXPLAIN_TIMEOUT_MS
    else process.env.DSH_READER_EXPLAIN_TIMEOUT_MS = previous
  })
  const { call, cwd } = await setup(t, { llmStall: true })
  const res = await call('/dsh-reader-live/api/explain?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ term: '停滞词', depth: 'quick' }),
  })
  assert.equal(res.status, 504)
  const body = await res.json()
  assert.match(body.error, /did not answer within 60ms/)
  const store = await readStore(cwd)
  assert.equal(Object.keys(store.concepts).length, 0, 'nothing half-written')
  assert.equal(store.debug.lastError.route, 'explain')
  assert.equal(store.debug.lastError.status, 504)
  assert.equal(store.debug.lastError.term, '停滞词')
  assert.equal(store.debug.errors.length, 1)

  // The single-flight entry is released, so the retry fails the same fast way
  // instead of joining a promise that can never settle.
  const retry = await call('/dsh-reader-live/api/explain?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ term: '停滞词', depth: 'quick' }),
  })
  assert.equal(retry.status, 504)
  assert.equal((await readStore(cwd)).debug.errors.length, 2)
})

test('a finished explanation is still stored with the explanations last-sent trace', async (t) => {
  const { call, cwd } = await setup(t)
  const res = await call('/dsh-reader-live/api/explain?sessionId=s1', {
    method: 'POST',
    body: JSON.stringify({ term: '正常词', depth: 'quick' }),
  })
  assert.equal(res.status, 200)
  const store = await readStore(cwd)
  assert.equal(store.debug.lastError, null, 'a success leaves no failure breadcrumb')
  assert.equal(store.debug.errors.length, 0)
})
