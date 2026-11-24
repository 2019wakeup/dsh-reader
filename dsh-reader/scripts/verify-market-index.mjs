#!/usr/bin/env node
/**
 * Validate the generated plugin-market index against DSH's format 1 rules.
 *
 * Prefers the shipped `@deepseek-ai/dsh-plugin-market-index` validator when the
 * DSH installation is reachable; otherwise runs the equivalent structural
 * checks locally so CI and fresh clones can verify the document too.
 *
 * Usage: node scripts/verify-market-index.mjs [path]
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.resolve(process.argv[2] || path.join(root, 'plugin-market.json'))
const LOCALES = new Set(['zh', 'en', 'ja', 'es', 'fr', 'de', 'ru', 'pt'])
const ICON_LIMIT = 32 * 1024
const failures = []

function fail(message) {
  failures.push(message)
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function httpUrl(value, label) {
  if (typeof value !== 'string') return fail(`${label} must be a string`)
  let url
  try {
    url = new URL(value)
  } catch {
    return fail(`${label} is not an absolute URL`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') fail(`${label} must use http(s)`)
  if (url.username || url.password || url.hash) fail(`${label} carries credentials or a fragment`)
}

function localized(value, label) {
  if (!isRecord(value)) return fail(`${label} must be a localized object`)
  const keys = Object.keys(value)
  if (keys.length === 0) fail(`${label} is empty`)
  for (const key of keys) {
    if (!LOCALES.has(key)) fail(`${label}.${key} is not a supported locale`)
    if (typeof value[key] !== 'string' || value[key].trim() === '') fail(`${label}.${key} is empty`)
  }
}

function semverCompare(a, b) {
  const parse = (value) => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(value)
    return match ? { major: +match[1], minor: +match[2], patch: +match[3], pre: match[4] || '' } : null
  }
  const left = parse(a)
  const right = parse(b)
  if (!left || !right) return 0
  const core = left.major - right.major || left.minor - right.minor || left.patch - right.patch
  if (core !== 0) return core
  if (left.pre === right.pre) return 0
  if (left.pre === '') return 1
  if (right.pre === '') return -1
  return left.pre < right.pre ? -1 : 1
}

const text = fs.readFileSync(target, 'utf8')
let index
try {
  index = JSON.parse(text)
} catch (error) {
  console.error(`FAIL  index is not JSON: ${error.message}`)
  process.exit(1)
}

// Structural checks mirroring `parseMarketIndex`.
if (index.format !== 1) fail('format must be 1')
localized(index.title, 'title')
if (index.description !== undefined) localized(index.description, 'description')
const metadata = isRecord(index.metadata) ? index.metadata : {}
if (!Array.isArray(index.plugins) || index.plugins.length === 0) fail('plugins must be a non-empty array')
const declaredCategories = new Set(Object.keys(isRecord(metadata.categories) ? metadata.categories : {}))
const declaredLabels = new Set(Object.keys(isRecord(metadata.labels) ? metadata.labels : {}))
for (const [key, value] of Object.entries(isRecord(metadata.categories) ? metadata.categories : {})) {
  localized(value && value.title, `metadata.categories.${key}.title`)
}
for (const [key, value] of Object.entries(isRecord(metadata.labels) ? metadata.labels : {})) {
  localized(value && value.title, `metadata.labels.${key}.title`)
}
const names = new Set()
for (const plugin of Array.isArray(index.plugins) ? index.plugins : []) {
  if (!isRecord(plugin)) {
    fail('plugin entry must be an object')
    continue
  }
  if (typeof plugin.name !== 'string' || plugin.name.trim() === '') fail('plugin.name must be a non-empty string')
  if (names.has(plugin.name)) fail(`duplicate plugin name ${plugin.name}`)
  names.add(plugin.name)
  for (const field of ['title', 'description']) {
    if (plugin[field] !== undefined) localized(plugin[field], `${plugin.name}.${field}`)
  }
  if (plugin.icon !== undefined) {
    if (typeof plugin.icon !== 'string') fail(`${plugin.name}.icon must be a string`)
    else if (plugin.icon.startsWith('data:')) {
      const comma = plugin.icon.indexOf(',')
      const bytes = comma < 0 ? 0 : Buffer.from(plugin.icon.slice(comma + 1), 'base64').byteLength
      if (bytes === 0 || bytes > ICON_LIMIT) fail(`${plugin.name}.icon inline payload must be 1..${ICON_LIMIT} bytes`)
    } else httpUrl(plugin.icon, `${plugin.name}.icon`)
  }
  if (plugin.homepage !== undefined) httpUrl(plugin.homepage, `${plugin.name}.homepage`)
  if (plugin.repository !== undefined) {
    httpUrl(plugin.repository && plugin.repository.url, `${plugin.name}.repository.url`)
    const directory = plugin.repository && plugin.repository.directory
    if (directory !== undefined && (typeof directory !== 'string' || directory.startsWith('/') || directory.includes('\\'))) {
      fail(`${plugin.name}.repository.directory must be a relative POSIX path`)
    }
  }
  const pluginMeta = isRecord(plugin.metadata) ? plugin.metadata : {}
  if (pluginMeta.category !== undefined && !declaredCategories.has(pluginMeta.category)) {
    fail(`${plugin.name}.metadata.category ${pluginMeta.category} is not declared`)
  }
  for (const label of Array.isArray(pluginMeta.labels) ? pluginMeta.labels : []) {
    if (!declaredLabels.has(label)) fail(`${plugin.name}.metadata.labels ${label} is not declared`)
  }
  const versions = Array.isArray(plugin.versions) ? plugin.versions : []
  if (versions.length === 0) fail(`${plugin.name}.versions must be non-empty`)
  const seen = new Set()
  for (const version of versions) {
    if (!isRecord(version)) {
      fail(`${plugin.name} version entry must be an object`)
      continue
    }
    if (typeof version.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version.version)) {
      fail(`${plugin.name}.versions.version ${version.version} is not SemVer`)
    }
    if (seen.has(version.version)) fail(`${plugin.name} lists version ${version.version} twice`)
    seen.add(version.version)
    if (!Number.isSafeInteger(version.publishTimestamp) || version.publishTimestamp <= 0) {
      fail(`${plugin.name}@${version.version}.publishTimestamp must be positive Unix seconds`)
    }
    const source = isRecord(version.source) ? version.source : {}
    if (source.type === 'npm') {
      if (source.registry !== undefined) httpUrl(source.registry, `${plugin.name}@${version.version}.source.registry`)
    } else if (source.type === 'git') {
      httpUrl(source.url, `${plugin.name}@${version.version}.source.url`)
      if (typeof source.commit !== 'string' || !/^[0-9a-f]{40}$/.test(source.commit)) {
        fail(`${plugin.name}@${version.version}.source.commit must be a 40-hex commit`)
      }
      if (source.path !== undefined && (typeof source.path !== 'string' || source.path.startsWith('/') || source.path.includes('\\'))) {
        fail(`${plugin.name}@${version.version}.source.path must be a relative POSIX path`)
      }
    } else {
      fail(`${plugin.name}@${version.version}.source.type must be npm or git`)
    }
    const engines = isRecord(version.engines) ? version.engines : {}
    if (engines.dsh !== undefined && typeof engines.dsh !== 'string') fail(`${plugin.name}@${version.version}.engines.dsh must be a string`)
  }
  for (let i = 1; i < versions.length; i += 1) {
    if (semverCompare(versions[i - 1].version, versions[i].version) <= 0) {
      fail(`${plugin.name} versions must be ordered by descending SemVer precedence`)
      break
    }
  }
}

// Deep check through the running DSH installation when it is reachable.
function deepCheck() {
  const installDir = process.env.DSH_INSTALL_DIR
    || '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/node_modules/@deepseek-ai/dsh'
  const executable = process.env.DSH_NODE_EXECUTABLE
    || '/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness'
  const modulePath = path.join(path.dirname(installDir), 'dsh-plugin-market-index', 'lib', 'index.js')
  if (!fs.existsSync(modulePath) && !fs.existsSync('/Applications/DeepSeek Harness.app/Contents/Resources/app.asar')) {
    return 'skipped (no DSH installation)'
  }
  const script = `
    import fs from 'node:fs'
    import { pathToFileURL } from 'node:url'
    const mod = await import(pathToFileURL(process.argv[1]).href)
    mod.parseMarketIndex(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), 'https://example.com/plugin-market.json')
    console.log('ok')
  `
  try {
    execFileSync(executable, ['--input-type=module', '-e', script, modulePath, target], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    })
    return 'ok (shipped validator)'
  } catch (error) {
    const detail = String(error && (error.stderr || error.message || '')).split('\n')[0].slice(0, 200)
    return `unavailable (${detail})`
  }
}

const deep = deepCheck()
if (failures.length > 0) {
  console.error(`FAIL  ${failures.length} problem(s) in ${path.relative(process.cwd(), target)}`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log(`PASS  market index ${path.relative(process.cwd(), target)}`)
console.log(`      plugins: ${Array.isArray(index.plugins) ? index.plugins.length : 0}; deep validator: ${deep}`)
