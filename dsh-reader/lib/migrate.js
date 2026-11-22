import fs from 'node:fs/promises'
import { resolveInWorkspace } from './paths.js'
import { docFingerprint } from './fingerprint.js'
import { defaultPrefs } from './prefs.js'

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Turn a v1 store ({annotations, positions} keyed by path) into v2
 * ({docs} keyed by content fingerprint). Files that no longer exist keep
 * their data under a `missing:<path>` key so nothing is dropped.
 */
export async function migrateV1(cwd, v1) {
  const store = { version: 2, prefs: defaultPrefs(), concepts: {}, docs: {} }

  for (const [id, concept] of Object.entries(v1.concepts || {})) {
    if (!concept || typeof concept !== 'object') continue
    store.concepts[id] = {
      aliases: [],
      occurrences: [],
      qa: [],
      ...concept,
    }
  }

  const paths = new Set([
    ...Object.keys(v1.annotations || {}),
    ...Object.keys(v1.positions || {}),
  ])
  for (const rel of paths) {
    if (!rel || rel.startsWith('__')) continue
    let key = `missing:${rel}`
    let size = 0
    let mtime = 0
    const target = resolveInWorkspace(cwd, rel)
    if (target.ok) {
      try {
        const bytes = await fs.readFile(target.abs)
        const stat = await fs.stat(target.abs)
        key = docFingerprint(bytes)
        size = stat.size
        mtime = stat.mtimeMs
      } catch {
        /* keep the missing key */
      }
    }
    store.docs[key] = {
      path: rel,
      size,
      mtime,
      annotations: Array.isArray(v1.annotations?.[rel]) ? v1.annotations[rel] : [],
      positions: isRecord(v1.positions?.[rel]) ? v1.positions[rel] : {},
    }
  }

  return store
}
