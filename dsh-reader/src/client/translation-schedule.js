/** Translation batching and viewport helpers, kept pure for tests/eval. */

/** Take the next batch from an insertion-ordered translation queue. */
export function takeTranslationBatch(entries, options = {}) {
  const maxSegments = Number.isFinite(options.maxSegments) ? options.maxSegments : 8
  const maxChars = Number.isFinite(options.maxChars) ? options.maxChars : 3200
  const batch = []
  let chars = 0
  for (const [id, text] of entries) {
    if (batch.length >= maxSegments) break
    const value = String(text || '')
    if (chars > 0 && chars + value.length > maxChars) break
    batch.push({ id, text: value })
    chars += value.length
  }
  return batch
}

/** True when a block rect is inside (or near) the reading viewport. */
export function isNearViewport(rect, viewport, margin = 200) {
  if (!rect || !viewport) return false
  return rect.bottom > viewport.top - margin && rect.top < viewport.bottom + margin
}
