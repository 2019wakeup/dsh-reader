import { execSync } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readStore, writeStore, emptyStore, upsertDoc } from '../lib/store.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const results = []

function command(label, cmd) {
  try {
    execSync(cmd, { cwd: root, stdio: 'pipe', encoding: 'utf8' })
    return { label, detail: 'ok' }
  } catch (error) {
    const output = `${error.stdout || ''}${error.stderr || ''}`.trim().split('\n').slice(-6).join(' | ')
    throw new Error(`${label} failed: ${output || error.message}`)
  }
}

async function check(name, fn) {
  const started = Date.now()
  try {
    const detail = await fn()
    results.push({ name, pass: true, ms: Date.now() - started, detail })
    console.log(`PASS  ${name.padEnd(28)} ${String(Date.now() - started).padStart(6)}ms  ${detail}`)
  } catch (error) {
    results.push({ name, pass: false, ms: Date.now() - started, error: String(error?.message || error) })
    console.log(`FAIL  ${name.padEnd(28)} ${String(Date.now() - started).padStart(6)}ms  ${error?.message || error}`)
  }
}

await check('version consistent', async () => {
  const client = fs.readFileSync(path.join(root, 'client.js'), 'utf8')
  if (!client.includes(`READER_VERSION = '${pkg.version}'`)) {
    throw new Error(`client.js does not carry version ${pkg.version}`)
  }
  return pkg.version
})

await check('unit + DOM tests', async () => {
  command('tests', 'node --test test/*.test.mjs')
  return 'all green'
})

await check('eval pipeline', async () => {
  command('eval', 'node eval/run.mjs')
  return '10/10'
})

await check('visual pipeline', async () => {
  command('visual', 'node eval/visual.mjs')
  return '97 checks + baselines'
})

await check('host layout probe', async () => {
  command('layout', 'node eval/layout-host.mjs')
  return '6/6 probes'
})

await check('migration rehearsal x3', async () => {
  command('rehearsal', 'node scripts/migrate-rehearsal.mjs')
  return '3/3'
})

await check('export/import round-trip', async () => {
  const source = await fsp.mkdtemp(path.join(os.tmpdir(), 'reader-release-src-'))
  const target = await fsp.mkdtemp(path.join(os.tmpdir(), 'reader-release-dst-'))
  const store = emptyStore()
  upsertDoc(store, { docKey: 'fp', path: 'a.md' })
  store.docs.fp.annotations = [{ id: 'a1', quote: 'x' }]
  store.concepts.c1 = { id: 'c1', term: 'T', qa: [{ q: 'q', a: 'a', at: 1 }] }
  await writeStore(source, store)
  const exported = JSON.parse(JSON.stringify({ version: 2, store: await readStore(source) }))
  await writeStore(target, exported.store)
  const imported = await readStore(target)
  await fsp.rm(source, { recursive: true, force: true })
  await fsp.rm(target, { recursive: true, force: true })
  if (JSON.stringify(imported) !== JSON.stringify(JSON.parse(JSON.stringify(store)))) {
    throw new Error('round-trip changed the store')
  }
  return 'lossless'
})

await check('pdf.js assets', async () => {
  const required = ['assets/pdf.min.mjs', 'assets/pdf.worker.min.mjs', 'assets/cmaps', 'assets/standard_fonts', 'assets/wasm']
  for (const relative of required) {
    if (!fs.existsSync(path.join(root, relative))) throw new Error(`missing ${relative}`)
  }
  const cmaps = fs.readdirSync(path.join(root, 'assets/cmaps'))
  if (cmaps.length < 10) throw new Error('cmaps incomplete')
  return `${cmaps.length} cmaps`
})

await check('demo fixtures', async () => {
  const epub = fs.readFileSync(path.resolve(root, '../示例-分布式系统.epub'))
  const pdf = fs.readFileSync(path.resolve(root, '../示例-分布式系统.pdf'))
  if (epub.subarray(0, 2).toString() !== 'PK') throw new Error('epub fixture is not a zip')
  if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('pdf fixture is invalid')
  return `epub ${epub.length}B + pdf ${pdf.length}B`
})

await check('docs and metadata', async () => {
  const required = [
    'README.md',
    'docs/DETAIL.md',
    'locale/en.json',
    'locale/zh.json',
    'icon.svg',
    '../docs/PRD-v1.0-阅读工作台.md',
    '../docs/1.0-开发手册.md',
  ]
  for (const relative of required) {
    if (!fs.existsSync(path.join(root, relative))) throw new Error(`missing ${relative}`)
  }
  JSON.parse(fs.readFileSync(path.join(root, 'locale/en.json'), 'utf8'))
  JSON.parse(fs.readFileSync(path.join(root, 'locale/zh.json'), 'utf8'))
  return 'complete'
})

await check('bundle registers reader view', async () => {
  const client = fs.readFileSync(path.join(root, 'client.js'), 'utf8')
  for (const needle of ["id: 'reader'", 'conversation.view', 'dsh-reader']) {
    if (!client.includes(needle)) throw new Error(`bundle lacks ${needle}`)
  }
  return 'reader view registered'
})

const failed = results.filter((result) => !result.pass)
await fsp.writeFile(
  path.join(root, 'eval', 'release-report.json'),
  JSON.stringify({ at: new Date().toISOString(), version: pkg.version, total: results.length, failed: failed.length, results }, null, 2),
)
console.log(`\n${results.length - failed.length}/${results.length} release checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
