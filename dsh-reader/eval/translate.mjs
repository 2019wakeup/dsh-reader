import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { contractCases } from './translate/contract.mjs'
import { aggregateJudge, judgeGate, DEFAULT_THRESHOLDS } from '../lib/judge.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const corpusDir = path.join(here, 'translate', 'corpus', 'v1')
const args = process.argv.slice(2)
const live = args.includes('--live')
const gateMode = args.includes('--gate')
const splitArg = args.find((arg) => arg.startsWith('--split='))
const split = splitArg ? splitArg.split('=')[1] : 'holdout'

function check(name, fn) {
  try {
    const metric = fn()
    console.log(`PASS  ${name.padEnd(28)} ${JSON.stringify(metric || {})}`)
    return { name, pass: true, metric }
  } catch (error) {
    console.log(`FAIL  ${name.padEnd(28)} ${error?.message || error}`)
    return { name, pass: false, error: String(error?.message || error) }
  }
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

async function readJsonl(file) {
  return (await fs.readFile(file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

function markdownReport(report) {
  const lines = [`# Translation eval — ${report.mode}`, '', `- at: ${report.at}`, `- corpus: ${report.corpus || 'v1'}`]
  if (report.mode === 'live') {
    lines.push(`- split: ${report.split}`, `- translated: ${report.translated}`, `- judged: ${report.judged}`, `- coverage: ${report.coverage ?? ''}`, `- model: ${report.model || ''}`, `- judge: ${report.judgeModel || ''}${report.judgeSameSource ? ' (same source; treat as smoke)' : ''}`, '')
    lines.push('| Metric | Value |', '| --- | --- |')
    for (const key of ['count', 'adequacy', 'fluency', 'terminology', 'passRate']) {
      lines.push(`| ${key} | ${report.aggregate?.[key] ?? ''} |`)
    }
    lines.push('', `Gate: ${report.gate?.pass ? 'PASS' : 'FAIL'}`)
  } else {
    lines.push('', '| Check | Result |', '| --- | --- |')
    for (const result of report.results || []) lines.push(`| ${result.name} | ${result.pass ? 'PASS' : 'FAIL'} |`)
    lines.push('', `Passed: ${report.passed}/${report.total}`)
  }
  return lines.join('\n') + '\n'
}

async function runOffline() {
  const manifest = await readJson(path.join(corpusDir, 'manifest.json'))
  const segments = await readJsonl(path.join(corpusDir, 'segments.jsonl'))
  const references = await readJsonl(path.join(corpusDir, 'references.jsonl'))
  const documents = await readJson(path.join(corpusDir, 'documents.json'))
  const results = []

  results.push(check('corpus.segments', () => {
    if (segments.length !== 60) throw new Error(`expected 60 segments, got ${segments.length}`)
    if (new Set(segments.map((item) => item.id)).size !== segments.length) throw new Error('duplicate segment ids')
    return { count: segments.length }
  }))
  results.push(check('corpus.references', () => {
    const byId = new Set(references.map((item) => item.id))
    for (const segment of segments) if (!byId.has(segment.id)) throw new Error(`missing reference ${segment.id}`)
    if (references.length !== segments.length) throw new Error('reference count mismatch')
    return { count: references.length }
  }))
  results.push(check('corpus.splits', () => {
    const tune = segments.filter((item) => item.split === 'tune').length
    const holdout = segments.filter((item) => item.split === 'holdout').length
    if (tune + holdout !== segments.length) throw new Error('split missing')
    if (holdout < 10) throw new Error('holdout too small')
    return { tune, holdout }
  }))
  results.push(check('corpus.documents', () => {
    const list = documents.documents || []
    if (list.length !== 12) throw new Error(`expected 12 documents, got ${list.length}`)
    for (const format of ['md', 'epub', 'docx', 'pdf']) {
      if (!list.some((item) => item.format === format)) throw new Error(`missing ${format}`)
    }
    return { count: list.length }
  }))
  for (const testCase of contractCases) results.push(check(`contract.${testCase.name}`, () => testCase.run() || {}))

  const failed = results.filter((result) => !result.pass)
  const report = {
    at: new Date().toISOString(),
    mode: 'offline',
    corpus: manifest.corpus,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  }
  await fs.writeFile(path.join(here, 'translate', 'last-report.json'), JSON.stringify(report, null, 2))
  await fs.writeFile(path.join(here, 'translate', 'last-report.md'), markdownReport(report))
  console.log(`\n${report.passed}/${report.total} translation eval checks passed`)
  process.exit(failed.length === 0 ? 0 : 1)
}

function cacheKey(segment) {
  return crypto.createHash('sha1').update(`${segment.id}\n${segment.source}`).digest('hex')
}

async function runLive() {
  const base = (process.env.DSH_WEB_URL || 'http://127.0.0.1:53919').replace(/\/$/, '')
  const sessionId = process.env.DSH_SESSION_ID || ''
  if (!sessionId) throw new Error('DSH_SESSION_ID is required for --live')
  const segments = (await readJsonl(path.join(corpusDir, 'segments.jsonl'))).filter(
    (item) => split === 'all' || item.split === split,
  )
  const references = new Map((await readJsonl(path.join(corpusDir, 'references.jsonl'))).map((item) => [item.id, item.reference]))
  const cacheDir = path.join(here, 'translate', '.cache', 'live', split)
  await fs.mkdir(cacheDir, { recursive: true })
  const translations = new Map()
  let translatorModel = ''

  for (let index = 0; index < segments.length; index += 4) {
    const batch = segments.slice(index, index + 4)
    const missing = []
    for (const segment of batch) {
      const file = path.join(cacheDir, `${cacheKey(segment)}.json`)
      try {
        const cached = await readJson(file)
        if (cached.translation) translations.set(segment.id, cached.translation)
        else missing.push(segment)
      } catch {
        missing.push(segment)
      }
    }
    if (missing.length === 0) continue
    const res = await fetch(`${base}/dsh-reader-live/api/translate?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        docKey: `eval:translate:${split}`,
        target: 'zh',
        from: missing[0].from,
        force: true,
        promptVersion: 2,
        segments: missing.map((item) => ({ id: item.id, text: item.source })),
      }),
    })
    if (!res.ok) throw new Error(`translate ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const body = await res.json()
    if (typeof body.model === 'string' && body.model) translatorModel = body.model
    for (const segment of missing) {
      const translation = body.translations && body.translations[segment.id]
      if (typeof translation === 'string' && translation.trim()) {
        translations.set(segment.id, translation)
        await fs.writeFile(path.join(cacheDir, `${cacheKey(segment)}.json`), JSON.stringify({ id: segment.id, translation }))
      }
    }
  }

  const items = segments
    .filter((segment) => translations.has(segment.id))
    .map((segment) => ({
      id: segment.id,
      source: segment.source,
      reference: references.get(segment.id) || '',
      candidate: translations.get(segment.id),
      target: 'zh',
    }))
  if (items.length === 0) throw new Error('no translations produced')

  const judgeHeaders = { 'content-type': 'application/json' }
  if (process.env.DSH_READER_EVAL_TOKEN) judgeHeaders['x-eval-token'] = process.env.DSH_READER_EVAL_TOKEN
  async function callJudge(batchItems) {
    const scores = []
    const failed = []
    let model = ''
    for (let offset = 0; offset < batchItems.length; offset += 10) {
      const chunk = batchItems.slice(offset, offset + 10)
      const response = await fetch(`${base}/dsh-reader-live/api/eval/judge?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'POST',
        headers: judgeHeaders,
        body: JSON.stringify({ items: chunk }),
      })
      if (!response.ok) {
        throw new Error(`judge ${response.status}: ${(await response.text()).slice(0, 240)}（设置 DSH_READER_EVAL=1 并重启 DSH 后再跑 --live）`)
      }
      const data = await response.json()
      scores.push(...(data.scores || []))
      failed.push(...(data.failed || []))
      if (data.model) model = data.model
    }
    return { scores, failed, model }
  }

  let scores = []
  let judgeFailed = []
  let judged = { scores: [], failed: [], model: '' }
  let pending = items
  for (let attempt = 0; attempt < 3 && pending.length > 0; attempt += 1) {
    judged = await callJudge(pending)
    scores.push(...(judged.scores || []))
    judgeFailed = judged.failed || []
    const failedIds = new Set(judgeFailed.map((item) => item.id))
    pending = pending.filter((item) => failedIds.has(item.id))
    if (pending.length > 0) console.log(`judge retry ${attempt + 1}: ${pending.length} item(s)`)
  }
  const aggregate = aggregateJudge(scores)
  const coverage = items.length ? scores.length / items.length : 0
  const gate = judgeGate(aggregate, {}, DEFAULT_THRESHOLDS)
  if (coverage < 1) gate.failures.push(`judge coverage ${scores.length}/${items.length}`)
  gate.pass = gate.failures.length === 0
  const report = {
    at: new Date().toISOString(),
    mode: 'live',
    split,
    model: translatorModel || judged.model || '',
    judgeModel: judged.model || '',
    judgeSameSource: Boolean(judged.model && (translatorModel || judged.model) === judged.model),
    translated: translations.size,
    judged: scores.length,
    coverage,
    judgeFailed,
    aggregate,
    gate,
    scores,
  }
  await fs.writeFile(path.join(here, 'translate', 'live-report.json'), JSON.stringify(report, null, 2))
  await fs.writeFile(path.join(here, 'translate', 'live-report.md'), markdownReport(report))
  console.log(`\nlive ${split}: ${scores.length}/${items.length} judged`)
  if (report.judgeSameSource) console.log('warning: judge and translator are the same model/source; label this run as smoke, not independent quality proof')
  console.log(JSON.stringify(aggregate, null, 2))
  if (gateMode && !gate.pass) {
    console.error('translation quality gate failed:\n' + gate.failures.join('\n'))
    process.exit(1)
  }
}

if (live) {
  try {
    await runLive()
  } catch (error) {
    console.error(String(error?.message || error))
    process.exit(2)
  }
} else {
  await runOffline()
}
