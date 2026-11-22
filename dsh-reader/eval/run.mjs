import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cases } from './cases.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const results = []

for (const testCase of cases) {
  const started = performance.now()
  try {
    const metric = await testCase.run()
    results.push({ name: testCase.name, pass: true, ms: Number((performance.now() - started).toFixed(1)), metric })
  } catch (error) {
    results.push({ name: testCase.name, pass: false, ms: Number((performance.now() - started).toFixed(1)), error: String(error?.message || error) })
  }
}

const width = Math.max(...results.map((result) => result.name.length))
for (const result of results) {
  const mark = result.pass ? 'PASS' : 'FAIL'
  const detail = result.pass ? JSON.stringify(result.metric) : result.error
  console.log(`${mark}  ${result.name.padEnd(width)}  ${String(result.ms).padStart(6)}ms  ${detail}`)
}

const failed = results.filter((result) => !result.pass)
const report = { at: new Date().toISOString(), total: results.length, failed: failed.length, results }
await fs.writeFile(path.join(here, 'last-report.json'), JSON.stringify(report, null, 2))
console.log(`\n${results.length - failed.length}/${results.length} eval cases passed`)
process.exit(failed.length === 0 ? 0 : 1)
