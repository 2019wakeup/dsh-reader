import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// `scripts/build-client.mjs` concatenates the client files and strips the
// import/export lines; it never resolves an identifier. So a helper that is
// called but no longer defined ships as a runtime ReferenceError, and only the
// browser path that hits it notices (`pdfPageFromRange` shipped that way).
// This guard pins the invariant for the per-format helper namespaces, which is
// where the calls and the definitions live in different files.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const FORMAT_HELPER = /\b((?:pdf|docx|epub)[A-Z][A-Za-z0-9]*)\s*\(/g

function bundleFiles() {
  const build = fs.readFileSync(path.join(root, 'scripts', 'build-client.mjs'), 'utf8')
  return [...build.matchAll(/'((?:src|lib)\/[^']+\.js)'/g)].map((match) => match[1])
}

function exportedNames() {
  const names = new Set()
  for (const file of bundleFiles()) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)|export\s+(?:const|let)\s+([A-Za-z0-9_$]+)/g)) {
      names.add(match[1] || match[2])
    }
  }
  return names
}

test('the client bundle exports every format helper the reader calls', () => {
  const app = fs.readFileSync(path.join(root, 'src', 'client', 'app.js'), 'utf8')
  const called = new Set([...app.matchAll(FORMAT_HELPER)].map((match) => match[1]))
  assert.ok(called.size >= 6, `expected the reader to call format helpers, found ${called.size}`)
  const available = exportedNames()
  const missing = [...called].filter((name) => !available.has(name)).sort()
  assert.deepEqual(missing, [], `called but never exported by a bundled module: ${missing.join(', ')}`)
})

test('the bundle file list covers the client sources that define those helpers', () => {
  const files = bundleFiles()
  assert.ok(files.length >= 20, `unexpected bundle size: ${files.length} files`)
  assert.ok(files.includes('src/client/app.js'), 'app.js must ship in the bundle')
  assert.ok(files.includes('src/client/pdf.js'), 'pdf.js must ship in the bundle')
  // Every source file the README/build claims to ship should exist on disk.
  for (const file of files) assert.ok(fs.existsSync(path.join(root, file)), `${file} is listed in the build but missing`)
})
