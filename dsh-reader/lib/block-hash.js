/**
 * Normalize block text before hashing so whitespace-only differences share a
 * translation cache entry.
 * @param {string} text
 */
export function normalizeBlockText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Stable cache key for one translated block, shared by client and Host.
 * @param {string} text
 */
export function blockHash(text) {
  const value = normalizeBlockText(text)
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `${hash.toString(16).padStart(8, '0')}-${value.length.toString(16)}`
}
