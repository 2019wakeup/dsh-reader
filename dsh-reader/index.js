import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolveInWorkspace } from './lib/paths.js'
import { readStore, writeStore, mutateStore, upsertDoc, listBackups, restoreLatestBackup } from './lib/store.js'
import { recordSent } from './lib/sent.js'
import { blockHash } from './src/client/translate.js'
import { buildTranslatePrompt, parseTranslationReply, TRANSLATE_LANGUAGES } from './lib/translate.js'
import { docFingerprint } from './lib/fingerprint.js'
import { buildExplainPrompt, buildQuickExplainPrompt, parseExplanation, buildContextPrompt, parseContextNote, buildAskPrompt } from './lib/explain.js'
import { sectionHash, buildSectionPrompt, buildOverviewPrompt, buildPartPrompt, parseSectionReply, parseOverviewReply, parsePartReply } from './lib/guide.js'

export const inject = ['webServer', 'sessionPersistence', 'llm', 'agentDefaultModel', 'workingDirectory']

const ROOT = '/dsh-reader-live'
const inflightExplains = new Map()
const isRecordObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const ASSET_DIR = fileURLToPath(new URL('./assets/', import.meta.url))
const MAX_FILE_BYTES = 200 * 1024 * 1024
const MAX_BODY_BYTES = 20 * 1024 * 1024

const MIME = {
  '.pdf': 'application/pdf',
  '.epub': 'application/epub+zip',
  '.md': 'text/markdown; charset=utf-8',
  '.markdown': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function normalizeTerm(term) {
  return String(term || '').trim().toLowerCase()
}

function normalizeOccurrence(store, input) {
  if (!input || typeof input !== 'object') throw httpError(400, 'invalid occurrence')
  const docKey = typeof input.docKey === 'string' ? input.docKey : ''
  if (!docKey) throw httpError(400, 'invalid docKey')
  if (!store.docs || !store.docs[docKey]) throw httpError(400, 'unknown docKey')
  return {
    docKey,
    chapter: Number.isFinite(input.chapter) ? input.chapter : 0,
    page: Number.isFinite(input.page) ? input.page : undefined,
    quote: typeof input.quote === 'string' ? input.quote : '',
    occurrence: Number.isFinite(input.occurrence) ? input.occurrence : 0,
  }
}

function sameOccurrence(left, right) {
  return (
    left.docKey === right.docKey &&
    left.quote === right.quote &&
    left.chapter === right.chapter &&
    (left.page || 0) === (right.page || 0) &&
    (left.occurrence || 0) === (right.occurrence || 0)
  )
}

function addOccurrence(store, conceptId, input) {
  const concept = store.concepts[conceptId]
  if (!concept) throw httpError(400, 'unknown concept')
  const occurrence = normalizeOccurrence(store, input)
  if (!Array.isArray(concept.occurrences)) concept.occurrences = []
  if (!concept.occurrences.some((item) => sameOccurrence(item, occurrence))) {
    concept.occurrences.push(occurrence)
  }
  return concept
}

async function workspaceFor(ctx, sessionId) {
  if (sessionId) {
    // The slot may hand over a bare UUID or the stored `session-<uuid>` id.
    const candidates = [sessionId]
    candidates.push(sessionId.startsWith('session-') ? sessionId.slice(8) : `session-${sessionId}`)
    for (const candidate of candidates) {
      const snapshot = await ctx.sessionPersistence.stat(candidate).catch(() => undefined)
      const cwd = snapshot?.header?.cwd
      if (cwd) return cwd
    }
    throw httpError(400, 'session workspace unavailable')
  }
  throw httpError(400, 'sessionId required')
}

async function listDir(cwd, dir) {
  const target = resolveInWorkspace(cwd, dir || '.')
  if (!target.ok) return json({ error: target.code }, 403)
  let entries
  try {
    entries = await fs.readdir(target.abs, { withFileTypes: true })
  } catch {
    return json({ error: 'directory unavailable' }, 404)
  }
  const rows = entries
    .filter((entry) => !entry.name.startsWith('.'))
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'dir' : 'file',
      path: path.relative(cwd, path.join(target.abs, entry.name)),
    }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
  return json({ cwd, dir: path.relative(cwd, target.abs) || '.', entries: rows })
}

async function readFile(cwd, rel) {
  const target = resolveInWorkspace(cwd, rel)
  if (!target.ok) return json({ error: target.code }, 403)
  let stat
  try {
    stat = await fs.stat(target.abs)
  } catch {
    return json({ error: 'file not found' }, 404)
  }
  if (!stat.isFile()) return json({ error: 'not a file' }, 400)
  if (stat.size > MAX_FILE_BYTES) return json({ error: 'file too large' }, 413)
  let root
  try {
    root = await fs.realpath(cwd)
  } catch {
    root = path.resolve(cwd)
  }
  const real = await fs.realpath(target.abs).catch(() => null)
  if (real && real !== root && !real.startsWith(root + path.sep)) return json({ error: 'ESCAPE' }, 403)
  const bytes = await fs.readFile(target.abs)
  const type = MIME[path.extname(target.abs).toLowerCase()] || 'application/octet-stream'
  return new Response(bytes, {
    headers: {
      'content-type': type,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-doc-fingerprint': docFingerprint(bytes),
    },
  })
}

const ASSET_MIME = {
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.bcmap': 'application/octet-stream',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
}

async function serveAsset(name) {
  if (!/^[A-Za-z0-9._/-]+$/.test(name) || name.includes('..')) return json({ error: 'bad asset' }, 400)
  const root = path.resolve(ASSET_DIR)
  const abs = path.resolve(root, name)
  if (!abs.startsWith(root + path.sep)) return json({ error: 'bad asset' }, 400)
  try {
    const bytes = await fs.readFile(abs)
    return new Response(bytes, {
      headers: {
        'content-type': ASSET_MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'public, max-age=3600',
      },
    })
  } catch {
    return json({ error: 'asset not found' }, 404)
  }
}

function pluginModel(store, ctx) {
  const pref = store?.prefs?.model
  if (pref && pref.provider && pref.model) {
    const current = ctx.agentDefaultModel?.currentSelection?.()
    return { provider: pref.provider, model: pref.model, reasoningEffort: current?.reasoningEffort }
  }
  return ctx.agentDefaultModel?.currentSelection?.() || {}
}

const effortCache = new Map()

async function effortsFor(ctx, provider, model) {
  const key = `${provider}|${model}`
  if (effortCache.has(key)) return effortCache.get(key)
  let efforts = []
  try {
    const info = await ctx.llm?.resolveModelInfo?.(provider, model)
    efforts = (info?.reasoning?.efforts || []).map((effort) => effort.id)
  } catch {
    efforts = []
  }
  effortCache.set(key, efforts)
  return efforts
}

async function pickEffort(ctx, provider, model, preferred) {
  const efforts = await effortsFor(ctx, provider, model)
  const order = [...new Set([preferred, 'low', 'minimal', 'medium', 'high', 'max'].filter(Boolean))]
  return order.find((id) => efforts.includes(id)) || null
}

async function complete(ctx, { system, user, maxTokens = 700, signal, provider: providerOverride, model: modelOverride, reasoningEffort }) {
  const selection = ctx.agentDefaultModel?.currentSelection?.()
  const provider = providerOverride || selection?.provider
  const model = modelOverride || selection?.model
  if (!provider || !model) throw httpError(503, 'no model configured')
  let reply = ''
  const stream = ctx.llm.stream({
    provider,
    model,
    ...(reasoningEffort ? { reasoningEffort } : {}),
    system,
    messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
    maxTokens,
    temperature: 0.2,
    signal,
  })
  for await (const chunk of stream) {
    if (chunk.type === 'text-delta') reply += chunk.text
    if (chunk.type === 'finish' && chunk.reason?.kind === 'error') {
      throw httpError(502, chunk.reason.failure?.message || 'model error')
    }
  }
  return reply
}

async function explainConcept(ctx, cwd, body) {
  const term = String(body?.term || '').trim()
  if (!term) throw httpError(400, 'term required')
  const sentence = String(body?.sentence || '')
  const paragraph = String(body?.paragraph || '')
  const store = await readStore(cwd)
  const key = normalizeTerm(term)
  const existing = Object.values(store.concepts).find((concept) => {
    if (!concept || typeof concept !== 'object') return false
    if (normalizeTerm(concept.term) === key) return true
    return Array.isArray(concept.aliases) && concept.aliases.some((alias) => normalizeTerm(alias) === key)
  })
  const model = pluginModel(store, ctx)
  const depth = body?.depth === 'full' ? 'full' : 'quick'
  if (existing) {
    if (depth === 'full' && existing.depth !== 'full' && existing.source !== 'user') {
      const { system, user } = buildExplainPrompt({ term: existing.term, sentence, paragraph, docTitle: body?.docTitle })
      const parsed = parseExplanation(
        await complete(ctx, { system, user, maxTokens: 700, provider: model.provider, model: model.model }),
      )
      const stored = await mutateStore(cwd, (current) => {
        const target = current.concepts[existing.id]
        if (target && target.source !== 'user') {
          target.definition = parsed.definition || target.definition
          target.intuition = parsed.intuition || target.intuition
          target.context = parsed.context || target.context
          target.examples = parsed.examples && parsed.examples.length ? parsed.examples : target.examples
          target.depth = 'full'
          target.updatedAt = Date.now()
        }
        recordSent(current, {
          kind: 'explain',
          preview: term,
          chars: String(body?.sentence || '').length + String(body?.paragraph || '').length,
        })
        if (body?.docKey) addOccurrence(current, existing.id, body)
        return current
      })
      return { concept: stored.concepts[existing.id], reused: false, upgraded: true, route: 'full', store: stored }
    }
    if (body?.docKey) {
      const contexts = Array.isArray(existing.contexts) ? existing.contexts : []
      const needsContext =
        depth === 'full' &&
        Boolean(body.sentence) &&
        Boolean(existing.evidence?.docKey) &&
        existing.evidence.docKey !== body.docKey &&
        !contexts.some((entry) => entry.docKey === body.docKey)
      let note = ''
      if (needsContext) {
        const prompt = buildContextPrompt({
          term: existing.term,
          sentence: body.sentence,
          docTitle: body.docTitle,
        })
        note = parseContextNote(await complete(ctx, { ...prompt, maxTokens: 200, provider: model.provider, model: model.model })).note
      }
      const stored = await mutateStore(cwd, (current) => {
        recordSent(current, {
          kind: 'explain',
          preview: term,
          chars: String(body.sentence || '').length + String(body.paragraph || '').length,
        })
        const concept = addOccurrence(current, existing.id, body)
        if (needsContext && note) {
          if (!Array.isArray(concept.contexts)) concept.contexts = []
          if (!concept.contexts.some((entry) => entry.docKey === body.docKey)) {
            concept.contexts.push({
              docKey: body.docKey,
              note,
              quote: String(body.quote || '').slice(0, 200),
              at: Date.now(),
            })
            if (concept.contexts.length > 5) concept.contexts = concept.contexts.slice(-5)
          }
        }
        return current
      })
      return { concept: stored.concepts[existing.id], reused: true, route: 'cached', store: stored }
    }
    return { concept: existing, reused: true, route: 'cached' }
  }

  const quick = depth === 'quick'
  const { system, user } = quick
    ? buildQuickExplainPrompt({ term, sentence, docTitle: body?.docTitle })
    : buildExplainPrompt({ term, sentence, paragraph, docTitle: body?.docTitle })
  const quickEffort = quick ? await pickEffort(ctx, model.provider, model.model, 'low') : null
  // Single-flight: two readers explaining the same term share one model call.
  const inflightKey = `${cwd}|${key}|${depth}`
  let pending = inflightExplains.get(inflightKey)
  if (!pending) {
    pending = complete(ctx, {
      system,
      user,
      maxTokens: quick ? 260 : 700,
      provider: model.provider,
      model: model.model,
      ...(quickEffort ? { reasoningEffort: quickEffort } : {}),
    }).then((reply) => parseExplanation(reply))
    inflightExplains.set(inflightKey, pending)
    pending.finally(() => inflightExplains.delete(inflightKey)).catch(() => {})
  }
  const parsed = await pending
  const concept = {
    id: randomUUID(),
    term,
    aliases: [],
    ...parsed,
    parentId: typeof body?.parentId === 'string' && body.parentId ? body.parentId : null,
    evidence: {
      docKey: typeof body?.docKey === 'string' ? body.docKey : null,
      quote: String(body?.quote || '').slice(0, 300),
      sentence: String(body?.sentence || '').slice(0, 500),
    },
    depth,
    qa: [],
    status: 'ready',
    source: 'agent',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  // Merge against the latest store under the per-workspace write queue: two
  // explanations finishing together must not overwrite each other.
  const stored = await mutateStore(cwd, (current) => {
    recordSent(current, {
      kind: 'explain',
      preview: term,
      chars: String(body?.sentence || '').length + String(body?.paragraph || '').length,
    })
    const found = Object.values(current.concepts).find((item) => normalizeTerm(item.term) === key)
    if (found) {
      if (body?.docKey) addOccurrence(current, found.id, body)
      return current
    }
    current.concepts[concept.id] = { ...concept, occurrences: [] }
    if (body?.docKey) addOccurrence(current, concept.id, body)
    return current
  })
  const finalConcept =
    stored.concepts[concept.id] ||
    Object.values(stored.concepts).find((item) => normalizeTerm(item.term) === key) ||
    concept
  return { concept: finalConcept, route: depth, store: stored }
}

function send(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(value))
}

function handleRouteError(res, error) {
  const status = typeof error?.status === 'number' ? error.status : 400
  send(res, status, { error: String(error?.message || error) })
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw httpError(413, 'body too large')
    chunks.push(chunk)
  }
  return size > 0 ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}
}

async function storeRoute(ctx, req, res) {
  try {
    const url = new URL(req.url, 'http://local')
    const cwd = await workspaceFor(ctx, url.searchParams.get('sessionId'))
    if (req.method !== 'GET') {
      send(res, 405, { error: 'method not allowed' })
      return
    }
    send(res, 200, { store: await readStore(cwd) })
  } catch (error) {
    handleRouteError(res, error)
  }
}

function docOf(store, docKey) {
  if (!store.docs || typeof store.docs !== 'object') store.docs = {}
  if (!store.docs[docKey]) {
    store.docs[docKey] = { path: '', size: 0, mtime: 0, annotations: [], positions: {} }
  }
  const doc = store.docs[docKey]
  if (!Array.isArray(doc.annotations)) doc.annotations = []
  if (!doc.positions || typeof doc.positions !== 'object') doc.positions = {}
  return doc
}

function applyPrefs(store, patch) {
  if (!patch || typeof patch !== 'object') throw httpError(400, 'invalid prefs')
  const next = { ...(store.prefs || {}) }
  if ('fontSize' in patch) {
    const value = Number(patch.fontSize)
    if (!Number.isFinite(value) || value < 14 || value > 26) throw httpError(400, 'invalid fontSize')
    next.fontSize = value
  }
  if ('lineHeight' in patch) {
    const value = Number(patch.lineHeight)
    if (!Number.isFinite(value) || value < 1.2 || value > 2.4) throw httpError(400, 'invalid lineHeight')
    next.lineHeight = value
  }
  if ('hoverDelay' in patch) {
    const value = Number(patch.hoverDelay)
    if (!Number.isFinite(value) || value < 80 || value > 600) throw httpError(400, 'invalid hoverDelay')
    next.hoverDelay = value
  }
  if ('cardTrigger' in patch) {
    if (!['hover', 'click', 'off'].includes(patch.cardTrigger)) throw httpError(400, 'invalid cardTrigger')
    next.cardTrigger = patch.cardTrigger
  }
  if ('model' in patch) {
    if (patch.model === null || patch.model === undefined) {
      next.model = null
    } else if (
      typeof patch.model === 'object' &&
      typeof patch.model.provider === 'string' &&
      patch.model.provider &&
      typeof patch.model.model === 'string' &&
      patch.model.model
    ) {
      next.model = { provider: patch.model.provider.slice(0, 120), model: patch.model.model.slice(0, 120) }
    } else {
      throw httpError(400, 'invalid model')
    }
  }
  if ('guideDepth' in patch) {
    if (!['quick', 'standard'].includes(patch.guideDepth)) throw httpError(400, 'invalid guideDepth')
    next.guideDepth = patch.guideDepth
  }
  if ('translateTo' in patch) {
    if (!['zh', 'en', 'ja'].includes(patch.translateTo)) throw httpError(400, 'invalid translateTo')
    next.translateTo = patch.translateTo
  }
  if ('pageKeys' in patch) {
    if (!['arrows', 'jk'].includes(patch.pageKeys)) throw httpError(400, 'invalid pageKeys')
    next.pageKeys = patch.pageKeys
  }
  if ('pdfSpread' in patch) {
    next.pdfSpread = Boolean(patch.pdfSpread)
  }
  if ('theme' in patch) {
    if (!['system', 'light', 'dark', 'sepia'].includes(patch.theme)) throw httpError(400, 'invalid theme')
    next.theme = patch.theme
  }
  store.prefs = next
  return store
}

function applyMutation(store, body) {
  const op = body?.op
  if (op === 'concept/upsert') {
    const concept = body.concept
    if (!concept || typeof concept !== 'object' || typeof concept.id !== 'string' || typeof concept.term !== 'string') {
      throw httpError(400, 'invalid concept')
    }
    store.concepts[concept.id] = { ...(store.concepts[concept.id] || {}), ...concept }
    return store
  }
  if (op === 'concept/delete') {
    if (typeof body.id !== 'string') throw httpError(400, 'invalid id')
    delete store.concepts[body.id]
    return store
  }
  if (op === 'prefs/set') {
    return applyPrefs(store, body.prefs)
  }
  if (op === 'concept/merge') {
    const { fromId, toId } = body
    if (typeof fromId !== 'string' || typeof toId !== 'string' || fromId === toId) {
      throw httpError(400, 'invalid merge')
    }
    const source = store.concepts[fromId]
    const target = store.concepts[toId]
    if (!source || !target) throw httpError(400, 'unknown concept')
    const unique = (list) => [...new Set(list.filter(Boolean))]
    target.aliases = unique([...(target.aliases || []), source.term, ...(source.aliases || [])]).filter(
      (alias) => alias !== target.term,
    )
    target.related = unique([...(target.related || []), ...(source.related || [])])
    const occKey = (item) => `${item.docKey}|${item.quote}|${item.chapter || 0}|${item.page || 0}|${item.occurrence || 0}`
    const occurrences = new Map()
    for (const item of [...(target.occurrences || []), ...(source.occurrences || [])]) occurrences.set(occKey(item), item)
    target.occurrences = [...occurrences.values()]
    const contexts = new Map()
    for (const item of [...(target.contexts || []), ...(source.contexts || [])]) contexts.set(item.docKey, item)
    target.contexts = [...contexts.values()].slice(-5)
    target.qa = [...(target.qa || []), ...(source.qa || [])].slice(-20)
    target.updatedAt = Date.now()
    delete store.concepts[fromId]
    return store
  }
  if (op === 'doc/relink') {
    const { fromKey, toKey } = body
    if (typeof fromKey !== 'string' || typeof toKey !== 'string' || fromKey === toKey) {
      throw httpError(400, 'invalid relink')
    }
    const source = store.docs && store.docs[fromKey]
    if (!source) throw httpError(400, 'unknown doc')
    const target = docOf(store, toKey)
    if (!target.path && source.path) target.path = source.path
    const seen = new Set(target.annotations.map((item) => item && item.id))
    for (const annotation of source.annotations || []) {
      if (annotation && annotation.id && !seen.has(annotation.id)) target.annotations.push(annotation)
    }
    if (!target.guide && source.guide) target.guide = source.guide
    if (!target.positions || Object.keys(target.positions).length === 0) target.positions = source.positions || {}
    delete store.docs[fromKey]
    return store
  }
  if (op === 'occurrence/add') {
    if (typeof body.conceptId !== 'string') throw httpError(400, 'invalid concept')
    addOccurrence(store, body.conceptId, body.occurrence)
    return store
  }
  if (op === 'doc/upsert') {
    const { docKey, path, size, mtime } = body
    if (typeof docKey !== 'string' || !docKey) throw httpError(400, 'invalid docKey')
    upsertDoc(store, { docKey, path, size, mtime })
    return store
  }
  if (op === 'annotation/add' || op === 'annotation/update') {
    const { docKey, annotation } = body
    if (typeof docKey !== 'string' || !annotation || typeof annotation.id !== 'string') {
      throw httpError(400, 'invalid annotation')
    }
    const doc = docOf(store, docKey)
    const index = doc.annotations.findIndex((item) => item && item.id === annotation.id)
    if (index >= 0) doc.annotations[index] = { ...doc.annotations[index], ...annotation }
    else doc.annotations.push(annotation)
    return store
  }
  if (op === 'annotation/remove') {
    const { docKey } = body
    if (typeof docKey !== 'string' || typeof body.id !== 'string') throw httpError(400, 'invalid annotation')
    const doc = docOf(store, docKey)
    doc.annotations = doc.annotations.filter((item) => item && item.id !== body.id)
    return store
  }
  if (op === 'position/set') {
    const { docKey, position } = body
    if (typeof docKey !== 'string' || !position || typeof position !== 'object') throw httpError(400, 'invalid position')
    docOf(store, docKey).positions = position
    return store
  }
  throw httpError(400, 'unknown op')
}

async function mutateRoute(ctx, req, res) {
  try {
    const url = new URL(req.url, 'http://local')
    const cwd = await workspaceFor(ctx, url.searchParams.get('sessionId'))
    const body = await readBody(req)
    const store = await mutateStore(cwd, (current) => applyMutation(current, body))
    send(res, 200, { store })
  } catch (error) {
    handleRouteError(res, error)
  }
}

async function explainRoute(ctx, req, res) {
  try {
    const url = new URL(req.url, 'http://local')
    const cwd = await workspaceFor(ctx, url.searchParams.get('sessionId'))
    const body = await readBody(req)
    send(res, 200, await explainConcept(ctx, cwd, body))
  } catch (error) {
    handleRouteError(res, error)
  }
}

async function guideRoute(ctx, req, res) {
  const url = new URL(req.url, 'http://local')
  const streaming = url.searchParams.get('stream') === '1'
  let finished = false
  const controller = new AbortController()
  const writeEvent = (event) => {
    if (!streaming) return
    try {
      res.write(`${JSON.stringify(event)}\n`)
    } catch {
      /* client went away */
    }
  }
  try {
    if (typeof res.on === 'function') {
      res.on('close', () => {
        if (!finished) controller.abort()
      })
    }
    const cwd = await workspaceFor(ctx, url.searchParams.get('sessionId'))
    const body = await readBody(req)
    const docKey = String(body?.docKey || '')
    const inputSections = Array.isArray(body?.sections) ? body.sections : []
    const inputParts = Array.isArray(body?.parts) && body.parts.length > 0 ? body.parts : null
    if (!docKey || inputSections.length === 0) throw httpError(400, 'docKey and sections required')
    if (inputSections.length > 96) throw httpError(400, 'too many sections')
    if (inputParts) {
      if (inputParts.length > 32) throw httpError(400, 'too many parts')
      const sectionIds = new Set(inputSections.map((section) => String(section?.id || '')))
      for (const part of inputParts) {
        if (!part || typeof part.id !== 'string' || !part.id) throw httpError(400, 'part id required')
        if (!Array.isArray(part.sectionIds) || part.sectionIds.length === 0) throw httpError(400, 'part sections required')
        for (const id of part.sectionIds) {
          if (!sectionIds.has(String(id))) throw httpError(400, 'part references an unknown section')
        }
      }
    }
    let totalChars = 0
    for (const input of inputSections) {
      const length = String(input?.text || '').length
      if (length > 8000) throw httpError(400, 'section too large')
      totalChars += length
    }
    if (totalChars > 400000) throw httpError(400, 'document too large')

    const store = await readStore(cwd)
    if (!store.docs || !store.docs[docKey]) throw httpError(400, 'unknown docKey')
    const previous = store.docs[docKey].guide
    const previousById = new Map(((previous && previous.sections) || []).map((section) => [section.id, section]))
    const previousParts = new Map(((previous && previous.parts) || []).map((part) => [part.id, part]))

    if (streaming) {
      res.writeHead(200, {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'cache-control': 'no-store',
      })
    }

    const model = pluginModel(store, ctx)
    const sectionEffort = await pickEffort(ctx, model.provider, model.model, 'low')
    const overviewEffort = await pickEffort(ctx, model.provider, model.model, 'medium')
    const summaries = []
    let generated = 0
    let reused = 0
    for (const input of inputSections) {
      const id = String(input?.id || '')
      if (!id) throw httpError(400, 'section id required')
      const text = String(input.text || '')
      const hash = sectionHash(text)
      const cached = previousById.get(id)
      if (cached && cached.hash === hash && cached.summary) {
        summaries.push({
          id,
          title: String(input.title || cached.title || ''),
          level: Number.isFinite(input.level) ? input.level : cached.level || 1,
          ...(Number.isFinite(input.page) ? { page: input.page } : Number.isFinite(cached.page) ? { page: cached.page } : {}),
          ...(Number.isFinite(input.chapter) ? { chapter: input.chapter } : Number.isFinite(cached.chapter) ? { chapter: cached.chapter } : {}),
          hash,
          summary: cached.summary,
          keyPoints: cached.keyPoints || [],
        })
        reused += 1
      } else {
        const prompt = buildSectionPrompt({ title: input.title, text })
        let parsed = parseSectionReply(
          await complete(ctx, {
            ...prompt,
            maxTokens: 900,
            signal: controller.signal,
            provider: model.provider,
            model: model.model,
            reasoningEffort: sectionEffort,
          }),
        )
        if (!parsed.summary) {
          parsed = parseSectionReply(
            await complete(ctx, {
            ...prompt,
            maxTokens: 900,
            signal: controller.signal,
            provider: model.provider,
            model: model.model,
            reasoningEffort: sectionEffort,
          }),
          )
        }
        if (!parsed.summary) throw httpError(502, 'empty guide section')
        summaries.push({
          id,
          title: String(input.title || ''),
          level: Number.isFinite(input.level) ? input.level : 1,
          ...(Number.isFinite(input.page) ? { page: input.page } : {}),
          ...(Number.isFinite(input.chapter) ? { chapter: input.chapter } : {}),
          hash,
          ...parsed,
        })
        generated += 1
      }
      writeEvent({
        type: 'progress',
        phase: 'section',
        done: summaries.length,
        total: inputSections.length,
        title: String(input.title || ''),
      })
    }

    const summaryById = new Map(summaries.map((section) => [section.id, section]))
    let partSummaries = []
    let partsGenerated = 0
    if (inputParts) {
      for (const [index, part] of inputParts.entries()) {
        const members = part.sectionIds.map((id) => summaryById.get(String(id))).filter(Boolean)
        if (members.length === 0) continue
        const hash = sectionHash(members.map((member) => `${member.title}:${member.hash}`).join('|'))
        if (members.length === 1) {
          const member = members[0]
          partSummaries.push({
            id: part.id,
            title: String(part.title || member.title || ''),
            sectionIds: part.sectionIds.map(String),
            hash,
            summary: member.summary,
            keyPoints: member.keyPoints || [],
            reuseSection: true,
          })
          writeEvent({ type: 'progress', phase: 'part', done: index + 1, total: inputParts.length, title: String(part.title || '') })
          continue
        }
        const cached = previousParts.get(part.id)
        if (cached && cached.hash === hash && cached.summary) {
          partSummaries.push({
            id: part.id,
            title: String(part.title || cached.title || ''),
            sectionIds: part.sectionIds.map(String),
            hash,
            summary: cached.summary,
            keyPoints: cached.keyPoints || [],
          })
        } else {
          const prompt = buildPartPrompt({ title: part.title, sections: members })
          let parsed = parsePartReply(
            await complete(ctx, {
            ...prompt,
            maxTokens: 800,
            signal: controller.signal,
            provider: model.provider,
            model: model.model,
            reasoningEffort: sectionEffort,
          }),
          )
          if (!parsed.summary) {
            parsed = parsePartReply(
              await complete(ctx, {
            ...prompt,
            maxTokens: 800,
            signal: controller.signal,
            provider: model.provider,
            model: model.model,
            reasoningEffort: sectionEffort,
          }),
            )
          }
          if (!parsed.summary) throw httpError(502, 'empty guide part')
          partSummaries.push({
            id: part.id,
            title: String(part.title || ''),
            sectionIds: part.sectionIds.map(String),
            hash,
            ...parsed,
          })
          partsGenerated += 1
        }
        writeEvent({
          type: 'progress',
          phase: 'part',
          done: index + 1,
          total: inputParts.length,
          title: String(part.title || ''),
        })
      }
    }

    let synopsis = (previous && previous.synopsis) || ''
    let questions = (previous && previous.questions) || []
    const overviewInput = partSummaries.length > 0 ? partSummaries : summaries
    if (generated > 0 || partsGenerated > 0 || !synopsis) {
      const reply = await complete(ctx, {
        ...buildOverviewPrompt(overviewInput),
        maxTokens: 900,
        signal: controller.signal,
        provider: model.provider,
        model: model.model,
        reasoningEffort: overviewEffort,
      })
      const parsed = parseOverviewReply(reply)
      synopsis = parsed.synopsis
      questions = parsed.questions
    }

    const guide = {
      generatedAt: Date.now(),
      synopsis,
      questions,
      ...(partSummaries.length > 0 ? { parts: partSummaries } : {}),
      sections: summaries,
    }
    const stored = await mutateStore(cwd, (current) => {
      docOf(current, docKey).guide = guide
      recordSent(current, { kind: 'guide', preview: String(body?.title || docKey), chars: totalChars })
      return current
    })
    if (streaming) {
      res.write(`${JSON.stringify({ type: 'done', guide, reused, generated, partsGenerated, store: stored })}\n`)
      finished = true
      res.end()
    } else {
      finished = true
      send(res, 200, { guide, reused, generated, partsGenerated, store: stored })
    }
  } catch (error) {
    if (streaming) {
      try {
        res.write(`${JSON.stringify({ type: 'error', error: String(error?.message || error) })}\n`)
        res.end()
      } catch {
        /* socket already closed */
      }
      return
    }
    handleRouteError(res, error)
  }
}

async function searchForAsk(ctx, query, provider) {
  const web = typeof ctx.get === 'function' ? ctx.get('web') : null
  if (!web || typeof web.search !== 'function') return { used: false, error: 'web search unavailable' }
  try {
    if (typeof web.searchReady === 'function') {
      const ready = await web.searchReady(provider)
      if (!ready) return { used: false, error: 'web search not configured' }
    }
    const result = await web.search({ query: String(query).slice(0, 200), maxResults: 5, llmProvider: provider })
    const sources = (result.sources || []).slice(0, 5).map((source) => ({
      title: source.title || source.url,
      url: source.url,
      snippet: String(source.snippet || source.summary || '').slice(0, 200),
    }))
    return { used: true, content: String(result.content || '').slice(0, 1500), sources }
  } catch (error) {
    return { used: false, error: String(error?.message || error) }
  }
}

async function askRoute(ctx, req, res) {
  try {
    const url = new URL(req.url, 'http://local')
    const cwd = await workspaceFor(ctx, url.searchParams.get('sessionId'))
    const body = await readBody(req)
    const conceptId = String(body?.conceptId || '')
    const question = String(body?.question || '').trim()
    if (!conceptId) throw httpError(400, 'conceptId required')
    if (!question) throw httpError(400, 'question required')
    if (question.length > 500) throw httpError(400, 'question too long')
    const store = await readStore(cwd)
    const concept = store.concepts[conceptId]
    if (!concept) throw httpError(400, 'unknown concept')

    const related = (Array.isArray(concept.related) ? concept.related : [])
      .map((term) => Object.values(store.concepts).find((item) => item.term === term))
      .filter(Boolean)
      .slice(0, 3)
    const model = pluginModel(store, ctx)
    const wantsWeb = body?.web === true
    const web = wantsWeb ? await searchForAsk(ctx, `${concept.term || ''} ${question}`, model.provider) : null
    const prompt = buildAskPrompt({ concept, question, related, web })
    const answer = (await complete(ctx, { ...prompt, maxTokens: 420, provider: model.provider, model: model.model })).trim().slice(0, 800)
    const webInfo = web
      ? { used: Boolean(web.used), error: web.error || null, sources: web.used ? web.sources || [] : [] }
      : null

    const stored = await mutateStore(cwd, (current) => {
      recordSent(current, { kind: 'ask', preview: question, chars: question.length })
      const target = current.concepts[conceptId]
      if (!target) throw httpError(400, 'unknown concept')
      if (!Array.isArray(target.qa)) target.qa = []
      target.qa.push({ q: question, a: answer, at: Date.now(), ...(webInfo ? { web: webInfo } : {}) })
      if (target.qa.length > 20) target.qa = target.qa.slice(-20)
      return current
    })
    send(res, 200, { answer, web: webInfo, store: stored })
  } catch (error) {
    handleRouteError(res, error)
  }
}

async function exportRoute(ctx, req, res) {
  try {
    const url = new URL(req.url, 'http://local')
    const cwd = await workspaceFor(ctx, url.searchParams.get('sessionId'))
    const store = await readStore(cwd)
    const payload = JSON.stringify({ version: 2, exportedAt: Date.now(), store }, null, 2)
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="dsh-reader-export.json"',
      'cache-control': 'no-store',
    })
    res.end(payload)
  } catch (error) {
    handleRouteError(res, error)
  }
}

async function importRoute(ctx, req, res) {
  try {
    const url = new URL(req.url, 'http://local')
    const cwd = await workspaceFor(ctx, url.searchParams.get('sessionId'))
    const body = await readBody(req)
    const incoming = body?.store || body
    if (
      !incoming ||
      typeof incoming !== 'object' ||
      incoming.version !== 2 ||
      typeof incoming.concepts !== 'object' ||
      typeof incoming.docs !== 'object'
    ) {
      throw httpError(400, 'invalid store')
    }
    const stored = await mutateStore(cwd, () => incoming)
    send(res, 200, { store: stored })
  } catch (error) {
    handleRouteError(res, error)
  }
}

async function translateRoute(ctx, req, res) {
  try {
    const url = new URL(req.url, 'http://local')
    const cwd = await workspaceFor(ctx, url.searchParams.get('sessionId'))
    const body = await readBody(req)
    const target = String(body?.target || 'zh')
    if (!TRANSLATE_LANGUAGES.includes(target)) throw httpError(400, 'invalid target language')
    const docKey = typeof body?.docKey === 'string' ? body.docKey : ''
    const segments = Array.isArray(body?.segments) ? body.segments : []
    if (segments.length === 0) throw httpError(400, 'segments required')
    if (segments.length > 40) throw httpError(400, 'too many segments')
    let total = 0
    for (const segment of segments) {
      if (!segment || typeof segment.id !== 'string' || !segment.id) throw httpError(400, 'segment id required')
      const text = String(segment.text || '')
      if (text.length > 4000) throw httpError(400, 'segment too large')
      total += text.length
    }
    if (total > 20000) throw httpError(400, 'translation request too large')

    const store = await readStore(cwd)
    const existing = docKey && store.docs?.[docKey]?.translations?.[target]
      ? store.docs[docKey].translations[target]
      : {}
    const model = pluginModel(store, ctx)
    const result = {}
    const pending = []
    let cached = 0
    for (const segment of segments) {
      const hash = blockHash(segment.text)
      if (existing[hash]) {
        result[segment.id] = existing[hash]
        cached += 1
      } else {
        pending.push({ id: segment.id, hash, text: String(segment.text) })
      }
    }

    let generated = 0
    const persisted = {}
    const batches = []
    let batch = []
    let batchChars = 0
    for (const segment of pending) {
      if (batch.length >= 8 || batchChars + segment.text.length > 3500) {
        if (batch.length > 0) batches.push(batch)
        batch = []
        batchChars = 0
      }
      batch.push(segment)
      batchChars += segment.text.length
    }
    if (batch.length > 0) batches.push(batch)

    const effort = pending.length > 0 ? await pickEffort(ctx, model.provider, model.model, 'low') : null
    for (const group of batches) {
      const prompt = buildTranslatePrompt({
        target,
        segments: group.map((segment) => ({ id: segment.id, text: segment.text })),
      })
      const chars = group.reduce((sum, segment) => sum + segment.text.length, 0)
      const reply = await complete(ctx, {
        ...prompt,
        maxTokens: Math.min(2400, Math.max(400, chars * 2)),
        provider: model.provider,
        model: model.model,
        ...(effort ? { reasoningEffort: effort } : {}),
      })
      const parsed = parseTranslationReply(reply, group.map((segment) => segment.id))
      for (const segment of group) {
        if (!parsed[segment.id]) continue
        result[segment.id] = parsed[segment.id]
        persisted[segment.hash] = parsed[segment.id]
        generated += 1
      }
    }

    let stored = null
    if (docKey && Object.keys(persisted).length > 0) {
      stored = await mutateStore(cwd, (current) => {
        const doc = docOf(current, docKey)
        if (!isRecordObject(doc.translations)) doc.translations = {}
        if (!isRecordObject(doc.translations[target])) doc.translations[target] = {}
        Object.assign(doc.translations[target], persisted)
        const keys = Object.keys(doc.translations[target])
        if (keys.length > 2000) {
          for (const key of keys.slice(0, keys.length - 2000)) delete doc.translations[target][key]
        }
        recordSent(current, {
          kind: 'translate',
          preview: `${target} ${String(segments[0].text || '').slice(0, 60)}`,
          chars: total,
        })
        return current
      })
    }

    send(res, 200, { translations: result, cached, generated, target, ...(stored ? { store: stored } : {}) })
  } catch (error) {
    handleRouteError(res, error)
  }
}

async function modelsRoute(ctx, req, res) {
  try {
    const listProviders = ctx.llm?.listProviders
    const providers = typeof listProviders === 'function' ? await listProviders.call(ctx.llm) : []
    const catalog = []
    for (const provider of providers.slice(0, 12)) {
      let models = []
      try {
        models = await ctx.llm.listModels(provider.id)
      } catch {
        models = []
      }
      catalog.push({
        id: provider.id,
        name: provider.name || provider.id,
        models: models
          .filter((model) => model && model.id)
          .map((model) => ({ id: model.id, name: model.name || model.id })),
      })
    }
    send(res, 200, { current: ctx.agentDefaultModel?.currentSelection?.() || null, providers: catalog })
  } catch (error) {
    handleRouteError(res, error)
  }
}

async function backupsRoute(ctx, req, res) {
  try {
    const url = new URL(req.url, 'http://local')
    const cwd = await workspaceFor(ctx, url.searchParams.get('sessionId'))
    if (req.method !== 'GET') {
      send(res, 405, { error: 'method not allowed' })
      return
    }
    send(res, 200, { backups: await listBackups(cwd) })
  } catch (error) {
    handleRouteError(res, error)
  }
}

async function restoreRoute(ctx, req, res) {
  try {
    const url = new URL(req.url, 'http://local')
    const cwd = await workspaceFor(ctx, url.searchParams.get('sessionId'))
    const restored = await restoreLatestBackup(cwd)
    if (!restored) throw httpError(404, 'no readable backup')
    send(res, 200, restored)
  } catch (error) {
    handleRouteError(res, error)
  }
}

async function handleGet(ctx, request) {
  const url = new URL(request.url, 'http://local')
  const pathname = url.pathname
  try {
    const cwd = await workspaceFor(ctx, url.searchParams.get('sessionId'))
    if (pathname === `${ROOT}/api/session`) return json({ cwd })
    if (pathname === `${ROOT}/api/list`) return await listDir(cwd, url.searchParams.get('dir'))
    if (pathname === `${ROOT}/api/file`) return await readFile(cwd, url.searchParams.get('path'))
    return json({ error: 'not found' }, 404)
  } catch (error) {
    const status = typeof error?.status === 'number' ? error.status : 500
    return json({ error: String(error?.message || error) }, status)
  }
}

function assetRoute(request) {
  const pathname = new URL(request.url, 'http://local').pathname
  return serveAsset(pathname.slice(`${ROOT}/assets/`.length))
}

export function apply(ctx) {
  const disposers = []
  const add = (route) => disposers.push(ctx.webServer.register(route))
  add({ kind: 'prefix', path: `${ROOT}/assets`, resource: (request) => assetRoute(request) })
  for (const name of ['session', 'list', 'file']) {
    add({ kind: 'exact', path: `${ROOT}/api/${name}`, resource: (request) => handleGet(ctx, request) })
  }
  add({ kind: 'exact', path: `${ROOT}/api/store`, handler: (req, res) => storeRoute(ctx, req, res) })
  add({ kind: 'exact', path: `${ROOT}/api/mutate`, handler: (req, res) => mutateRoute(ctx, req, res) })
  add({ kind: 'exact', path: `${ROOT}/api/explain`, handler: (req, res) => explainRoute(ctx, req, res) })
  add({ kind: 'exact', path: `${ROOT}/api/guide`, handler: (req, res) => guideRoute(ctx, req, res) })
  add({ kind: 'exact', path: `${ROOT}/api/concept/ask`, handler: (req, res) => askRoute(ctx, req, res) })
  add({ kind: 'exact', path: `${ROOT}/api/export`, handler: (req, res) => exportRoute(ctx, req, res) })
  add({ kind: 'exact', path: `${ROOT}/api/import`, handler: (req, res) => importRoute(ctx, req, res) })
  add({ kind: 'exact', path: `${ROOT}/api/models`, handler: (req, res) => modelsRoute(ctx, req, res) })
  add({ kind: 'exact', path: `${ROOT}/api/translate`, handler: (req, res) => translateRoute(ctx, req, res) })
  add({ kind: 'exact', path: `${ROOT}/api/backups`, handler: (req, res) => backupsRoute(ctx, req, res) })
  add({ kind: 'exact', path: `${ROOT}/api/restore`, handler: (req, res) => restoreRoute(ctx, req, res) })
  let released = false
  const release = () => {
    if (released) return
    released = true
    for (const dispose of disposers) {
      try {
        dispose()
      } catch {
        /* already released */
      }
    }
  }
  // Own the registrations on this plugin's fiber as well as on unload.
  ctx.effect(() => release)
  return release
}
