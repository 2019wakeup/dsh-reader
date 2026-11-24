import { normalizeRelPath } from './util.js'

/**
 * Find a stale document entry that shares the current path but has a different
 * fingerprint and still carries annotations to migrate.
 * @param {Record<string, {path?: string, annotations?: unknown[]}>} docs
 * @param {string} path current document path
 * @param {string} key current fingerprint
 */
export function staleDocFor(docs, path, key) {
  for (const [docKey, doc] of Object.entries(docs || {})) {
    if (docKey === key) continue
    if (!doc || normalizeRelPath(doc.path) !== normalizeRelPath(path)) continue
    if (Array.isArray(doc.annotations) && doc.annotations.length > 0) {
      return { fromKey: docKey, count: doc.annotations.length }
    }
  }
  return null
}
