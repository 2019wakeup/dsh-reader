import fs from 'node:fs/promises'
import path from 'node:path'
import { migrateV1 } from './migrate.js'
import { defaultPrefs } from './prefs.js'

const DATA_DIR = '.dsh-reader'
const STORE_FILE = 'store.json'
const BACKUP_DIR = 'backups'
const BACKUP_KEEP = 5

let backupSequence = 0

export function emptyStore() {
  return { version: 2, revision: 0, prefs: defaultPrefs(), concepts: {}, docs: {}, debug: { lastSent: [] } }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizePrefs(raw) {
  const base = defaultPrefs()
  if (!isRecord(raw)) return base
  const number = (value, fallback, min, max) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
  }
  return {
    fontSize: number(raw.fontSize, base.fontSize, 14, 26),
    lineHeight: number(raw.lineHeight, base.lineHeight, 1.2, 2.4),
    theme: ['system', 'light', 'dark', 'sepia'].includes(raw.theme) ? raw.theme : base.theme,
    hoverDelay: number(raw.hoverDelay, base.hoverDelay, 80, 600),
    cardTrigger: ['hover', 'click', 'off'].includes(raw.cardTrigger) ? raw.cardTrigger : base.cardTrigger,
    pdfSpread: typeof raw.pdfSpread === 'boolean' ? raw.pdfSpread : base.pdfSpread,
    pageKeys: ['arrows', 'jk'].includes(raw.pageKeys) ? raw.pageKeys : base.pageKeys,
    model:
      raw.model && typeof raw.model === 'object' && typeof raw.model.provider === 'string' && typeof raw.model.model === 'string'
        ? { provider: raw.model.provider.slice(0, 120), model: raw.model.model.slice(0, 120) }
        : null,
    translateTo: ['zh', 'en', 'ja'].includes(raw.translateTo) ? raw.translateTo : base.translateTo,
    guideDepth: ['quick', 'standard'].includes(raw.guideDepth) ? raw.guideDepth : base.guideDepth,
  }
}

function normalizeTranslations(raw) {
  const out = {}
  for (const language of ['zh', 'en', 'ja']) {
    const map = raw[language]
    if (!isRecord(map)) continue
    const entries = Object.entries(map)
      .filter(([, value]) => typeof value === 'string' && value.trim())
      .slice(-2000)
    if (entries.length > 0) out[language] = Object.fromEntries(entries)
  }
  return out
}

function normalizeDocs(raw) {
  if (!isRecord(raw)) return {}
  const docs = {}
  for (const [key, doc] of Object.entries(raw)) {
    if (!isRecord(doc)) continue
    docs[key] = {
      path: typeof doc.path === 'string' ? doc.path : '',
      size: Number.isFinite(doc.size) ? doc.size : 0,
      mtime: Number.isFinite(doc.mtime) ? doc.mtime : 0,
      annotations: Array.isArray(doc.annotations)
        ? doc.annotations.filter((item) => isRecord(item))
        : [],
      positions: isRecord(doc.positions) ? doc.positions : {},
      ...(isRecord(doc.translations) && Object.keys(doc.translations).length
        ? { translations: normalizeTranslations(doc.translations) }
        : {}),
      ...(isRecord(doc.guide) && Array.isArray(doc.guide.sections)
        ? {
            guide: {
              ...doc.guide,
              sections: doc.guide.sections.filter((section) => isRecord(section)),
              questions: Array.isArray(doc.guide.questions) ? doc.guide.questions : [],
            },
          }
        : {}),
    }
  }
  return docs
}

function normalizeDebug(raw) {
  const lastSent = raw && Array.isArray(raw.lastSent)
    ? raw.lastSent
        .filter((item) => isRecord(item) && typeof item.preview === 'string')
        .slice(-10)
        .map((item) => ({
          at: Number.isFinite(item.at) ? item.at : 0,
          kind: typeof item.kind === 'string' ? item.kind : 'explain',
          preview: item.preview.slice(0, 120),
          chars: Number.isFinite(item.chars) ? item.chars : 0,
        }))
    : []
  return { lastSent }
}

function normalizeV2(raw) {
  const base = emptyStore()
  return {
    version: 2,
    revision: Number.isFinite(raw.revision) ? raw.revision : 0,
    prefs: normalizePrefs(raw.prefs),
    concepts: isRecord(raw.concepts) ? raw.concepts : base.concepts,
    docs: normalizeDocs(raw.docs),
    debug: normalizeDebug(raw.debug),
  }
}

export function storePath(cwd) {
  return path.join(cwd, DATA_DIR, STORE_FILE)
}

export function backupDir(cwd) {
  return path.join(cwd, DATA_DIR, BACKUP_DIR)
}

/**
 * Keep the previous store on disk before a write or migration.
 * The newest five snapshots are retained.
 */
export async function backupStore(cwd) {
  let raw
  try {
    raw = await fs.readFile(storePath(cwd))
  } catch {
    return null
  }
  const dir = backupDir(cwd)
  await fs.mkdir(dir, { recursive: true })
  backupSequence += 1
  const name = `store-${Date.now()}-${backupSequence}.json`
  await fs.writeFile(path.join(dir, name), raw)
  const entries = (await fs.readdir(dir)).filter((entry) => /^store-.*\.json$/.test(entry)).sort()
  for (const stale of entries.slice(0, Math.max(0, entries.length - BACKUP_KEEP))) {
    await fs.rm(path.join(dir, stale), { force: true })
  }
  return name
}

export async function listBackups(cwd) {
  let entries
  try {
    entries = await fs.readdir(backupDir(cwd))
  } catch {
    return []
  }
  const files = entries.filter((entry) => /^store-.*\.json$/.test(entry)).sort()
  const out = []
  for (const name of files) {
    try {
      const stat = await fs.stat(path.join(backupDir(cwd), name))
      out.push({ name, size: stat.size, at: stat.mtimeMs })
    } catch {
      /* skip unreadable snapshot */
    }
  }
  return out
}

async function newestReadableBackup(cwd) {
  const backups = await listBackups(cwd)
  for (const backup of backups.reverse()) {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(backupDir(cwd), backup.name), 'utf8'))
      if (!raw || typeof raw !== 'object') continue
      if (raw.version === 2) return normalizeV2(raw)
      if (raw.version === 1) return await migrateV1(cwd, raw)
    } catch {
      /* try the next snapshot */
    }
  }
  return null
}

/**
 * Read the workspace store. A corrupt file falls back to the newest readable
 * backup instead of looking like an empty library.
 * @param {string} cwd workspace directory
 */
export async function readStore(cwd) {
  let raw
  try {
    raw = JSON.parse(await fs.readFile(storePath(cwd), 'utf8'))
  } catch (error) {
    if (error && error.code === 'ENOENT') return emptyStore()
    return (await newestReadableBackup(cwd)) || emptyStore()
  }
  if (!raw || typeof raw !== 'object') return (await newestReadableBackup(cwd)) || emptyStore()
  if (raw.version === 2) return normalizeV2(raw)
  if (raw.version === 1) {
    const migrated = await migrateV1(cwd, raw)
    await backupStore(cwd)
    await writeStore(cwd, migrated, { backup: false })
    return migrated
  }
  return normalizeV2(raw)
}

export async function writeStore(cwd, store, options = {}) {
  if (options.backup !== false) await backupStore(cwd)
  const dir = path.join(cwd, DATA_DIR)
  await fs.mkdir(dir, { recursive: true })
  const file = storePath(cwd)
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`
  await fs.writeFile(tmp, JSON.stringify(normalizeV2(store), null, 2), 'utf8')
  await fs.rename(tmp, file)
}

const writeQueues = new Map()

/**
 * Serialize one read-modify-write per workspace so concurrent edits merge
 * instead of overwriting each other.
 * @param {string} cwd workspace directory
 * @param {(store: object) => object | Promise<object>} mutate applied to the latest store
 */
export function mutateStore(cwd, mutate) {
  const key = path.resolve(cwd)
  const previous = writeQueues.get(key) || Promise.resolve()
  const run = previous.then(async () => {
    const store = await readStore(cwd)
    const next = (await mutate(store)) || store
    next.revision = (Number(store.revision) || 0) + 1
    await writeStore(cwd, next)
    return next
  })
  writeQueues.set(key, run.then(() => undefined, () => undefined))
  return run
}

/** Restore the newest readable backup into the live store. */
export async function restoreLatestBackup(cwd) {
  const backups = await listBackups(cwd)
  for (const backup of backups.reverse()) {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(backupDir(cwd), backup.name), 'utf8'))
      let store
      if (raw && raw.version === 2) store = normalizeV2(raw)
      else if (raw && raw.version === 1) store = await migrateV1(cwd, raw)
      else continue
      await writeStore(cwd, store)
      return { store, name: backup.name }
    } catch {
      /* try the next snapshot */
    }
  }
  return null
}

/** Create or refresh one document entry without touching its annotations. */
export function upsertDoc(store, input) {
  if (!isRecord(store.docs)) store.docs = {}
  const docKey = input.docKey
  const current = store.docs[docKey] || {
    path: '',
    size: 0,
    mtime: 0,
    annotations: [],
    positions: {},
  }
  store.docs[docKey] = {
    ...current,
    path: input.path || current.path,
    size: Number.isFinite(input.size) ? input.size : current.size,
    mtime: Number.isFinite(input.mtime) ? input.mtime : current.mtime,
    annotations: Array.isArray(input.annotations) ? input.annotations : current.annotations,
    positions: isRecord(input.positions) ? input.positions : current.positions,
  }
  return store.docs[docKey]
}
