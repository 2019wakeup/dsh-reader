/**
 * Unified reading-step helpers for scrolled documents (Markdown / EPUB).
 * One "page" of a scrolled document is 85% of the visible height, so the last
 * lines stay in view while reading on.
 */
export function readingStep(viewHeight) {
  return Math.max(120, Math.round((Number(viewHeight) || 0) * 0.85))
}

/**
 * @returns {{kind:'scroll', top:number}|{kind:'start'}|{kind:'end'}}
 */
export function scrollStepTarget({ scrollTop = 0, scrollHeight = 0, clientHeight = 0 }, direction) {
  const maxTop = Math.max(0, scrollHeight - clientHeight)
  if (direction === 'next') {
    if (scrollTop >= maxTop - 2) return { kind: 'end' }
    return { kind: 'scroll', top: Math.min(maxTop, scrollTop + readingStep(clientHeight)) }
  }
  if (scrollTop <= 2) return { kind: 'start' }
  return { kind: 'scroll', top: Math.max(0, scrollTop - readingStep(clientHeight)) }
}

/** Reading progress in 0..1 for one scroll container. */
export function scrollProgress({ scrollTop = 0, scrollHeight = 0, clientHeight = 0 }) {
  const maxTop = Math.max(0, scrollHeight - clientHeight)
  if (maxTop <= 0) return 0
  return Math.min(1, Math.max(0, scrollTop / maxTop))
}

/** Overall progress for a chaptered document: 0..1 across all chapters. */
export function chapterProgress(chapter, localProgress, totalChapters) {
  const total = Math.max(1, Number(totalChapters) || 1)
  const index = Math.min(total - 1, Math.max(0, Number(chapter) || 0))
  return Math.min(1, (index + Math.min(1, Math.max(0, localProgress))) / total)
}

/** Parse a page-number field into a clamped integer. */
export function parsePageInput(value, total) {
  const parsed = Number.parseInt(String(value || '').trim(), 10)
  if (!Number.isFinite(parsed)) return null
  return Math.min(Math.max(1, total), Math.max(1, parsed))
}
