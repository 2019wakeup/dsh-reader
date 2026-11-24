import { normalizeBlockText, blockHash } from '../../lib/block-hash.js'

export { normalizeBlockText, blockHash }

/**
 * Render a translation-only variant of the reading HTML: block text is
 * replaced in place, inline markup stays, and unknown blocks keep the source.
 */
export function buildTranslatedHtml(html, resolve) {
  const container = document.createElement('div')
  container.innerHTML = String(html || '')
  for (const node of container.querySelectorAll('p, li, blockquote, h2, h3, h4, pre')) {
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
