/**
 * Find case-insensitive matches with a short context snippet.
 * @param {string} text haystack
 * @param {string} query needle
 * @param {number} limit maximum results
 */
export function searchText(text, query, limit = 50) {
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return []
  const haystack = String(text || '')
  const lower = haystack.toLowerCase()
  const results = []
  let from = 0
  while (results.length < limit) {
    const index = lower.indexOf(needle, from)
    if (index < 0) break
    const start = Math.max(0, index - 30)
    const end = Math.min(haystack.length, index + needle.length + 30)
    results.push({ index, snippet: haystack.slice(start, end).replace(/\s+/g, ' ') })
    from = index + needle.length
  }
  return results
}
