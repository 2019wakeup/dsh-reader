/**
 * One undo/redo stack for the current document. Entries carry the two mutate
 * payloads needed to move the stored annotation in either direction.
 */
export function createHistory(limit = 30) {
  const past = []
  const future = []
  return {
    push(entry) {
      past.push(entry)
      if (past.length > limit) past.shift()
      future.length = 0
    },
    undo() {
      const entry = past.pop()
      if (!entry) return null
      future.push(entry)
      return entry
    },
    redo() {
      const entry = future.pop()
      if (!entry) return null
      past.push(entry)
      return entry
    },
    canUndo() {
      return past.length > 0
    },
    canRedo() {
      return future.length > 0
    },
    clear() {
      past.length = 0
      future.length = 0
    },
  }
}

/** True when a keyboard shortcut belongs to an editable control, not the reader. */
export function isEditableTarget(target) {
  const element = target && target.nodeType === 3 ? target.parentElement : target
  if (!element || typeof element.tagName !== 'string') return false
  const tag = element.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (element.isContentEditable === true) return true
  return typeof element.getAttribute === 'function' && element.getAttribute('contenteditable') === 'true'
}
