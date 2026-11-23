function asElement(target) {
  return target && typeof target.closest === 'function' ? target : null
}

// Overlays float above the reading surface and must not be dismissed by
// scrolling inside themselves: a note field or a long card scrolling its own
// content is not the page moving under the anchor.
const OWN_SCROLL_SURFACE = '.rd-mini, .rd-card, .rd-trans-card'
// Editable fields scroll as the caret moves (and while an IME composes), which
// happens constantly while typing; closing the panel on that would make the
// editor unusable.
const EDITABLE_TARGET = 'textarea, input, select, [contenteditable="true"]'

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

/**
 * True when a scroll should close the floating panels. A window-level event
 * (no element target) always counts as the reading surface moving; a scroll
 * that originates inside a panel or an editable field does not.
 */
export function shouldDismissOnScroll(target) {
  const element = asElement(target)
  if (!element) return true
  if (element.closest(EDITABLE_TARGET)) return false
  return !element.closest(OWN_SCROLL_SURFACE)
}

/** Drop the current text selection without touching the document. */
export function dismissSelection(win) {
  try {
    win.getSelection()?.removeAllRanges()
  } catch {
    /* a window without a selection is already dismissed */
  }
}
