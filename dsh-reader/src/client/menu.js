function asElement(target) {
  return target && typeof target.closest === 'function' ? target : null
}

/** True when the pointer landed on the selection toolbar itself. */
export function isToolbarTarget(target) {
  const element = asElement(target)
  return Boolean(element && element.closest('.rd-mini'))
}

/** True when a pointerdown should close the toolbar, concept card and selection. */
export function shouldDismissOnPointerDown(target) {
  const element = asElement(target)
  if (!element) return true
  return !element.closest('.rd-mini, .rd-card')
}

/** Drop the current text selection without touching the document. */
export function dismissSelection(win) {
  try {
    win.getSelection()?.removeAllRanges()
  } catch {
    /* a window without a selection is already dismissed */
  }
}
