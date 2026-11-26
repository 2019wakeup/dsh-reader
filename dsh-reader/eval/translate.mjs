import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { contractCases } from './translate/contract.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const corpusDir = path.join(here, 'translate', 'corpus', 'v1')
const results = []

function check(name, fn) {
  try {
    const metric = fn()
    results.push({ name, pass: true, metric })
    console.log(`PASS  ${name.padEnd(28)} ${JSON.stringify(metric || {})}`)
  } catch (error) {
    results.push({ name, pass: false, error: String(error?.message || error) })
    console.log(`FAIL  ${name.padEnd(28)} ${error?.message || error}`)
  }
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

async function readJsonl(file) {
  return (await fs.readFile(file, 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

const manifest = await readJson(path.join(corpusDir, 'manifest.json'))
const segments = await readJsonl(path.join(corpusDir, 'segments.jsonl'))
const references = await readJsonl(path.join(corpusDir, 'references.jsonl'))
const documents = await readJson(path.join(corpusDir, 'documents.json'))

check('corpus.segments', () => {
  if (segments.length !== 60) throw new Error(`expected 60 segments, got ${segments.length}`)
  const ids = new Set(segments.map((item) => item.id))
  if (ids.size !== segments.length) throw new Error('duplicate segment ids')
  return { count: segments.length }
})

check('corpus.references', () => {
  const byId = new Map(references.map((item) => [item.id, item]))
  for (const segment of segments) if (!byId.has(segment.id)) throw new Error(`missing reference ${segment.id}`)
  if (references.length !== segments.length) throw new Error('reference count mismatch')
  return { count: references.length }
})

check('corpus.splits', () => {
  const tune = segments.filter((item) => item.split === 'tune').length
  const holdout = segments.filter((item) => item.split === 'holdout').length
  if (tune + holdout !== segments.length) throw new Error('split missing')
  if (holdout < 10) throw new Error('holdout too small')
  return { tune, holdout }
})

check('corpus.documents', () => {
  const list = documents.documents || []
  if (list.length !== 12) throw new Error(`expected 12 documents, got ${list.length}`)
  const formats = new Set(list.map((item) => item.format))
  for (const format of ['md', 'epub', 'docx', 'pdf']) if (!formats.has(format)) throw new Error(`missing ${format}`)
  return { count: list.length }
})

for (const testCase of contractCases) {
  check(`contract.${testCase.name}`, () => testCase.run() || {})
}

const failed = results.filter((result) => !result.pass)
const report = {
  at: new Date().toISOString(),
  corpus: manifest.corpus,
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
}
await fs.writeFile(path.join(here, 'translate', 'last-report.json'), JSON.stringify(report, null, 2))
console.log(`\n${report.passed}/${report.total} translation eval checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
