#!/usr/bin/env node
/**
 * Generate the DSH plugin-market index (`plugin-market.json`, format 1).
 *
 * The index lives at the public repository root so users can add one URL in
 * DSH's Discover tab. Source selection is automatic: once the exact version is
 * on npm the entry installs from the registry; before that it falls back to a
 * commit-pinned Git install of this repository's `dsh-reader/` directory.
 *
 * Usage: node scripts/build-market-index.mjs [--out <path>]
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const outIndex = process.argv.indexOf('--out')
const outPath = outIndex >= 0 && process.argv[outIndex + 1]
  ? path.resolve(process.argv[outIndex + 1])
  : path.join(root, 'plugin-market.json')

const REPOSITORY = 'https://github.com/2019wakeup/dsh-reader'
const PACKAGE_DIRECTORY = 'dsh-reader'
const LOCALES = ['zh', 'en', 'ja', 'es', 'fr', 'de', 'ru', 'pt']

function readMeta(locale) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'locale', `${locale}.json`), 'utf8')).meta || {}
  } catch {
    return {}
  }
}

function localized(pick) {
  const out = {}
  for (const locale of LOCALES) {
    const value = pick(readMeta(locale))
    if (typeof value === 'string' && value.trim()) out[locale] = value.trim()
  }
  return Object.keys(out).length > 0 ? out : { en: pkg.name }
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function npm(args) {
  return execFileSync('npm', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20_000 }).trim()
}

function publishedVersion() {
  try {
    const seen = npm(['view', `${pkg.name}@${pkg.version}`, 'version', '--json'])
    return seen.replace(/"/g, '') === pkg.version ? pkg.version : null
  } catch {
    return null
  }
}

function publishedAt() {
  try {
    const time = JSON.parse(npm(['view', pkg.name, 'time', '--json']))
    const iso = time && time[pkg.version]
    const seconds = iso ? Math.floor(Date.parse(iso) / 1000) : Number.NaN
    return Number.isFinite(seconds) ? seconds : null
  } catch {
    return null
  }
}

function iconDataUrl() {
  const bytes = fs.readFileSync(path.join(root, 'icon.svg'))
  if (bytes.byteLength > 32 * 1024) throw new Error('icon.svg exceeds the 32 KiB inline icon limit')
  return `data:image/svg+xml;base64,${bytes.toString('base64')}`
}

function source() {
  const version = publishedVersion()
  if (version !== null) return { type: 'npm' }
  const commit = git(['rev-parse', 'HEAD'])
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`not a full commit SHA: ${commit}`)
  return { type: 'git', url: `${REPOSITORY}.git`, commit, path: PACKAGE_DIRECTORY }
}

const entrySource = source()
const publishTimestamp = publishedAt() ?? Math.floor(Date.now() / 1000)

const index = {
  format: 1,
  title: { zh: '砚读 · DSH 阅读插件', en: 'Yandu · DSH Reader' },
  description: {
    zh: '在 DSH 里读 PDF / EPUB / Markdown，概念卡与原生对话连着读。',
    en: 'Read PDF, EPUB and Markdown in DSH with concept cards and an in-reader conversation panel.',
  },
  metadata: {
    categories: { reading: { title: { zh: '阅读', en: 'Reading' } } },
    labels: {
      bilingual: { title: { zh: '中英双语', en: 'Bilingual' } },
      conversation: { title: { zh: '边读边聊', en: 'Read and chat' } },
    },
    sortKeys: {},
  },
  plugins: [
    {
      name: pkg.name,
      title: localized((meta) => meta.title),
      description: localized((meta) => meta.description),
      icon: iconDataUrl(),
      author: '2019wakeup',
      homepage: REPOSITORY,
      repository: { url: REPOSITORY, directory: PACKAGE_DIRECTORY },
      metadata: {
        category: 'reading',
        keywords: pkg.keywords || [],
        labels: ['bilingual', 'conversation'],
        sortKeys: {},
      },
      versions: [
        {
          version: pkg.version,
          publishTimestamp,
          source: entrySource,
          engines: pkg.engines && pkg.engines.dsh ? { dsh: pkg.engines.dsh } : {},
        },
      ],
    },
  ],
}

fs.writeFileSync(outPath, JSON.stringify(index, null, 2) + '\n')
console.log(`market index written: ${outPath}`)
console.log(`source: ${entrySource.type}${entrySource.type === 'git' ? ` @ ${entrySource.commit.slice(0, 7)}` : ''}`)
console.log(`package: ${pkg.name}@${pkg.version}`)
