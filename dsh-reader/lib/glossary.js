/**
 * Glossary normalization, matching and a stable version hash.
 * A translation cache must change when the terms that apply to a segment
 * change; hashing only the text would keep stale terminology forever.
 */

const MAX_TERMS = 500
const MAX_TERM_CHARS = 120

function text(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export function normalizeGlossaryTerm(raw, fallbackId = '') {
  if (!raw || typeof raw !== 'object') return null
  const term = text(raw.term).slice(0, MAX_TERM_CHARS)
  const translation = text(raw.translation).slice(0, MAX_TERM_CHARS)
  if (!term || !translation) return null
  const scope = typeof raw.scope === 'string' && raw.scope ? raw.scope.slice(0, 200) : 'global'
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 120) : fallbackId || `g-${hashString(`${scope}:${term}`)}`,
    term,
    translation,
    scope,
    caseSensitive: raw.caseSensitive === true,
    note: text(raw.note).slice(0, 240),
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
  }
}

export function normalizeGlossary(raw) {
  const list = Array.isArray(raw?.terms) ? raw.terms : Array.isArray(raw) ? raw : []
  const seen = new Set()
  const terms = []
  for (const item of list) {
    const term = normalizeGlossaryTerm(item)
    if (!term) continue
    const key = `${term.scope}\u0000${term.caseSensitive ? '1' : '0'}\u0000${term.term.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    terms.push(term)
    if (terms.length >= MAX_TERMS) break
  }
  return { version: 1, terms }
}

export function activeGlossary(glossary, docKey) {
  const terms = Array.isArray(glossary?.terms) ? glossary.terms : []
  return terms.filter((term) => term && (term.scope === 'global' || (docKey && term.scope === docKey)))
}

function isWordChar(char) {
  return Boolean(char) && /[\p{L}\p{N}_]/u.test(char)
}

/** Longest-match terms present in `source`; links/code placeholders are ignored. */
export function matchGlossary(source, terms) {
  const haystack = String(source || '')
  const found = []
  const ordered = (terms || [])
    .filter((term) => term && term.term && term.translation)
    .sort((left, right) => right.term.length - left.term.length)
  for (const term of ordered) {
    const needle = term.caseSensitive ? term.term : term.term.toLowerCase()
    const hay = term.caseSensitive ? haystack : haystack.toLowerCase()
    let from = 0
    while (from <= hay.length - needle.length) {
      const index = hay.indexOf(needle, from)
      if (index < 0) break
      const before = haystack[index - 1]
      const after = haystack[index + term.term.length]
      const latin = /^[A-Za-z\u00c0-\u024f]/.test(term.term)
      if (!latin || (!isWordChar(before) && !isWordChar(after))) {
        found.push(term)
        break
      }
      from = index + needle.length
    }
  }
  return found
}

function hashString(value) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export function glossaryHash(terms) {
  if (!terms || terms.length === 0) return 'none'
  const canonical = [...terms]
    .map((term) => `${term.term}\u0000${term.translation}\u0000${term.caseSensitive ? 1 : 0}`)
    .sort()
    .join('\u0001')
  return hashString(canonical)
}

export function glossaryPromptLines(terms) {
  return (terms || []).map((term) => `${term.term} => ${term.translation}`)
}
