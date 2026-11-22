function asElement(target) {
  if (!target) return null
  if (target.nodeType === 3) return target.parentElement || null
  return typeof target.closest === 'function' ? target : null
}

/** The stored annotation id under a pointer target, scoped to the reader root. */
export function annotationIdAt(target, root) {
  const element = asElement(target)
  if (!element || !root || !root.contains(element)) return null
  const hit = element.closest('[data-anno]')
  if (!hit || !root.contains(hit)) return null
  return hit.getAttribute('data-anno') || null
}

/** Only a collapsed selection means a click, not a new selection gesture. */
export function shouldOpenEditor(target, root, selectionCollapsed) {
  if (!selectionCollapsed) return null
  return annotationIdAt(target, root)
}
