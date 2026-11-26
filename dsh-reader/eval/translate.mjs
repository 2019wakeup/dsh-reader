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
  const judgeRes = await fetch(`${base}/dsh-reader-live/api/eval/judge?sessionId=${encodeURIComponent(sessionId)}`, {
    method: 'POST',
    headers: judgeHeaders,
    body: JSON.stringify({ items }),
  })
  if (!judgeRes.ok) {
    throw new Error(`judge ${judgeRes.status}: ${(await judgeRes.text()).slice(0, 240)}（设置 DSH_READER_EVAL=1 并重启 DSH 后再跑 --live）`)
  }
  const judged = await judgeRes.json()
  const scores = judged.scores || []
  const aggregate = aggregateJudge(scores)
  const gate = judgeGate(aggregate, {}, DEFAULT_THRESHOLDS)
  const report = {
    at: new Date().toISOString(),
    mode: 'live',
    split,
    model: judged.model || '',
    judgeModel: judged.model || '',
    translated: translations.size,
    judged: scores.length,
    aggregate,
    gate,
    scores,
  }
  await fs.writeFile(path.join(here, 'translate', 'live-report.json'), JSON.stringify(report, null, 2))
  console.log(`\nlive ${split}: ${scores.length}/${items.length} judged`)
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
