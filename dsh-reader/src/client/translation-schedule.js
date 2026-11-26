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

/**
 * Split one sent batch into translated and failed segments.
 *
 * A missing/blank translation is a failure even when the Host returned 200:
 * deleting the whole batch would leave a permanent hole in the page.
 */
export function partitionTranslationBatch(segments, result) {
  const translations = result && typeof result.translations === 'object' ? result.translations : {}
  const done = []
  const failed = []
  for (const segment of segments || []) {
    if (!segment || typeof segment.id !== 'string') continue
    const text = translations[segment.id]
    if (typeof text === 'string' && text.trim()) done.push(segment)
    else failed.push(segment)
  }
  return { done, failed }
}

/**
 * PDF pages are denser than reflowable HTML. Four formula-heavy blocks are a
 * safer unit than eight: a model that drops the first ids of a large batch
 * leaves the whole page blank.
 */
export function partitionPdfUnits(units, options = {}) {
  const maxSegments = Number.isFinite(options.maxSegments) ? options.maxSegments : 4
  const maxChars = Number.isFinite(options.maxChars) ? options.maxChars : 1200
  const batches = []
  let batch = []
  let chars = 0
  for (const unit of units || []) {
    if (!unit || typeof unit.text !== 'string') continue
    if (batch.length > 0 && (batch.length >= maxSegments || chars + unit.text.length > maxChars)) {
      batches.push(batch)
      batch = []
      chars = 0
    }
    batch.push(unit)
    chars += unit.text.length
  }
  if (batch.length > 0) batches.push(batch)
  return batches
}
