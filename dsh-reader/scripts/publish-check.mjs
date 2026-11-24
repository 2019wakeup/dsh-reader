#!/usr/bin/env node
/**
 * Pre-publish gate for the npm package and the market index.
 *
 * Checks the manifest the way DSH and npm read it, inspects the packed file list
 * with `npm pack --dry-run`, and verifies the generated `plugin-market.json`
 * agrees with this package. Exit code 1 blocks publishing.
 *
 * Usage: node scripts/publish-check.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const problems = []
const notes = []

function need(condition, message) {
  if (!condition) problems.push(message)
}

function has(command, args) {
  try {
    return execFileSync(command, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 }).trim()
  } catch {
    return null
  }
}

// 1. Manifest fields npm and DSH require.
need(typeof pkg.name === 'string' && pkg.name.includes('/'), 'package name must be a scoped name (@scope/name)')
need(pkg.private !== true, 'package.json must not be private')
need(typeof pkg.version === 'string' && /^\d+\.\d+\.\d+/.test(pkg.version), 'version must be SemVer')
need(pkg.license === 'MIT', 'license must be declared (MIT)')
need(Boolean(pkg.repository && pkg.repository.url), 'repository.url is required for provenance')
need(Boolean(pkg.homepage), 'homepage is required for the market entry')
need(Boolean(pkg.engines && pkg.engines.dsh), 'engines.dsh is required for DSH compatibility checks')
need(Boolean(pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch), 'dsh.bundle.patch is required')
need(Boolean(pkg.dsh && pkg.dsh.client), 'dsh.client is required for the browser half')
need(pkg.publishConfig && pkg.publishConfig.access === 'public', 'publishConfig.access must be public for a scoped package')
need(fs.existsSync(path.join(root, 'LICENSE')), 'LICENSE file is missing')
need(pkg.files.includes('client.js'), 'files must ship the built client.js')
need(pkg.files.includes('docs/DETAIL.md'), 'files must ship docs/DETAIL.md for the market detail page')

// 2. Packed file list.
const packed = has('npm', ['pack', '--dry-run', '--json'])
if (packed === null) {
  problems.push('npm pack --dry-run failed')
} else {
  let files = []
  try {
    const parsed = JSON.parse(packed)
    const entry = parsed[pkg.name] || Object.values(parsed)[0] || {}
    files = (entry.files || []).map((file) => file.path)
  } catch {
    problems.push('could not parse npm pack output')
  }
  const present = new Set(files)
  for (const required of ['index.js', 'client.js', 'lib/reader-context.js', 'cordis.patch.yml', 'docs/DETAIL.md', 'LICENSE', 'icon.svg', 'locale/zh.json', 'locale/en.json']) {
    need(present.has(required), `packed package is missing ${required}`)
  }
  for (const file of files) {
    if (/^(src|test|eval|scripts|docs\/superpowers)\//.test(file) || file.startsWith('node_modules/')) {
      problems.push(`packed package must not ship ${file}`)
    }
  }
  notes.push(`packed files: ${files.length}`)
}

// 3. Version availability on the registry.
const published = has('npm', ['view', `${pkg.name}@${pkg.version}`, 'version'])
if (published !== null) problems.push(`${pkg.name}@${pkg.version} is already published; bump the version first`)
else notes.push(`${pkg.name}@${pkg.version} is available on the registry`)

// 4. The market index must describe this exact package.
const indexPath = path.join(root, 'plugin-market.json')
if (!fs.existsSync(indexPath)) {
  problems.push('plugin-market.json is missing; run node scripts/build-market-index.mjs')
} else {
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  const entry = (index.plugins || []).find((plugin) => plugin.name === pkg.name)
  need(Boolean(entry), 'market index does not list this package name')
  if (entry) {
    need(entry.versions && entry.versions.some((version) => version.version === pkg.version), 'market index does not list this version')
    const version = (entry.versions || []).find((item) => item.version === pkg.version)
    if (version && version.source.type === 'npm') notes.push('market index installs this version from npm')
    if (version && version.source.type === 'git') {
      const head = has('git', ['rev-parse', 'HEAD'])
      if (version.source.commit !== head) notes.push('market index pins a Git commit that is not HEAD; regenerate before publishing')
    }
  }
}

if (problems.length > 0) {
  console.error(`FAIL  ${problems.length} publish blocker(s)`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log('PASS  publish gate')
for (const note of notes) console.log(`      ${note}`)
console.log('      next: npm login && npm publish --access public')
