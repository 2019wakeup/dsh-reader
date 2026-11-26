/**
 * Versioned translation cache keys and eviction.
 *
 * A key must change when the prompt, glossary, source or target changes; the
 * content hash alone cannot express that. Legacy 0.15 keys (plain content
 * hash) stay readable for display but are reported as `stale`.
 */

export const TRANSLATE_PROMPT_VERSION = 2

export function translateCacheKey({
  target,
  from = 'auto',
  promptVersion = TRANSLATE_PROMPT_VERSION,
  glossaryHash = 'none',
  contentHash,
}) {
  return `v2:${target}:${from}:${promptVersion}:${glossaryHash}:${contentHash}`
}

export function translationMeta({ from = 'auto', model = '', promptVersion = TRANSLATE_PROMPT_VERSION, glossaryHash = 'none', chars = 0 }) {
  return {
    at: Date.now(),
    model: String(model || ''),
    prompt: promptVersion,
    glossary: glossaryHash,
    from,
    chars: Number(chars) || 0,
  }
}

/**
 * Drop the oldest entries per language, then across the whole document.
 * Entries without metadata are treated as older than any metadata entry.
 */
export function evictTranslationCache(doc, { maxPerLanguage = 2000, maxPerDoc = 8000 } = {}) {
  if (!doc || typeof doc !== 'object') return
  const translations = doc.translations && typeof doc.translations === 'object' ? doc.translations : {}
  const meta = doc.translationMeta && typeof doc.translationMeta === 'object' ? doc.translationMeta : {}
  for (const [lang, map] of Object.entries(translations)) {
    if (!map || typeof map !== 'object') continue
    const langMeta = meta[lang] && typeof meta[lang] === 'object' ? meta[lang] : (meta[lang] = {})
    const keys = Object.keys(map)
    if (keys.length <= maxPerLanguage) continue
    keys.sort((left, right) => (langMeta[left]?.at || 0) - (langMeta[right]?.at || 0))
    for (const key of keys.slice(0, keys.length - maxPerLanguage)) {
      delete map[key]
      delete langMeta[key]
    }
  }
  const all = []
  for (const [lang, map] of Object.entries(translations)) {
    if (!map || typeof map !== 'object') continue
    const langMeta = meta[lang] && typeof meta[lang] === 'object' ? meta[lang] : (meta[lang] = {})
    for (const key of Object.keys(map)) all.push({ lang, key, at: langMeta[key]?.at || 0 })
  }
  if (all.length <= maxPerDoc) return
  all.sort((left, right) => left.at - right.at)
  for (const entry of all.slice(0, all.length - maxPerDoc)) {
    delete translations[entry.lang][entry.key]
    delete meta[entry.lang]?.[entry.key]
  }
}
