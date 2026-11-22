/** Stable cache key for one translated block, shared by client and Host. */
export function normalizeBlockText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function blockHash(text) {
  const value = normalizeBlockText(text)
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `${hash.toString(16).padStart(8, '0')}-${value.length.toString(16)}`
}

/**
 * Render a translation-only variant of the reading HTML: block text is
 * replaced in place, inline markup stays, and unknown blocks keep the source.
 */
export function buildTranslatedHtml(html, resolve) {
  const container = document.createElement('div')
  container.innerHTML = String(html || '')
  for (const node of container.querySelectorAll('p, li, blockquote, h2, h3, h4, td, pre')) {
    if (node.closest('.rd-card, .rd-trans')) continue
    const text = normalizeBlockText(node.textContent)
    if (!text) continue
    const translated = resolve(text)
    if (translated) node.textContent = translated
  }
  return container.innerHTML
}

export function translationFor(translations, hash) {
  if (!translations || typeof translations !== 'object') return ''
  const value = translations[hash]
  return typeof value === 'string' ? value : ''
}
