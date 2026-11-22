import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readStore } from '../lib/store.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const pluginRoot = path.resolve(here, '..')
const workspaceRoot = path.resolve(pluginRoot, '..')
const source = process.argv[2] || path.join(pluginRoot, 'test', 'fixtures', 'store-v1.json')
const documentName = '示例-分布式系统阅读.md'

const v1 = JSON.parse(await fs.readFile(source, 'utf8'))
const failures = []

for (let attempt = 1; attempt <= 3; attempt += 1) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), `reader-rehearsal-${attempt}-`))
  try {
    await fs.copyFile(path.join(workspaceRoot, documentName), path.join(cwd, documentName))
    await fs.mkdir(path.join(cwd, '.dsh-reader'), { recursive: true })
    await fs.writeFile(path.join(cwd, '.dsh-reader', 'store.json'), JSON.stringify(v1))

    const first = await readStore(cwd)
    const second = await readStore(cwd)
    const backups = await fs.readdir(path.join(cwd, '.dsh-reader', 'backups'))
    const docs = Object.values(first.docs)
    const annotations = docs.reduce((sum, doc) => sum + doc.annotations.length, 0)
    const fingerprintKeys = Object.keys(first.docs).filter((key) => !key.startsWith('missing:'))

    const checks = [
      ['version is 2', first.version === 2 && second.version === 2],
      ['all concepts survive', Object.keys(first.concepts).length === 5],
      ['all annotations survive', annotations === 2],
      ['positions survive', docs.some((doc) => doc.positions && Object.keys(doc.positions).length > 0)],
      ['file maps to a fingerprint', fingerprintKeys.length === 1],
      [
        'smoke key dropped',
        Object.keys(first.docs).every((key) => !key.startsWith('__')) &&
          Object.keys(first.concepts).every((key) => key !== '__smoke__'),
      ],
      ['exactly one backup after two reads', backups.length === 1],
    ]
    const failed = checks.filter(([, ok]) => !ok).map(([name]) => name)
    if (failed.length > 0) {
      failures.push(`attempt ${attempt}: ${failed.join(', ')}`)
      console.log(`FAIL  attempt ${attempt}  ${failed.join(', ')}`)
    } else {
      console.log(`PASS  attempt ${attempt}  docs=${docs.length} concepts=${Object.keys(first.concepts).length} annotations=${annotations} backups=${backups.length}`)
    }
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length}/3 rehearsals failed`)
  process.exit(1)
}
console.log('\n3/3 migration rehearsals passed')
