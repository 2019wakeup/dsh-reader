export function uid() {
  return 'x' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function extOf(name) {
  const m = /\.([A-Za-z0-9]+)$/.exec(String(name || ''))
  return m ? '.' + m[1].toLowerCase() : ''
}

/**
 * Normalize a workspace-relative path to POSIX separators. Windows hosts can
 * hand over `sub\\book.md`; every client-side path consumer expects `/`.
 * @param {string} value
 */
export function normalizeRelPath(value) {
  return String(value || '').replace(/\\/g, '/')
}

export function basename(file) {
  const parts = normalizeRelPath(file).split('/')
  return parts[parts.length - 1] || file
}

export function dirname(file) {
  const parts = normalizeRelPath(file).split('/')
  parts.pop()
  return parts.join('/') || '.'
}

export function normalizeTerm(value) {
  return String(value || '').trim().toLowerCase()
}

export const READABLE = new Set(['.md', '.markdown', '.txt', '.epub', '.pdf', '.docx'])

export function debounce(fn, wait) {
  let timer = null
  return (...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}

/**
 * Modifier key shown in help text for the current platform.
 * @returns {string} `⌘` on Apple platforms, `Ctrl` elsewhere
 */
export function modifierLabel() {
  const platform =
    (typeof navigator !== 'undefined' && (navigator.userAgentData?.platform || navigator.platform)) || ''
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? '⌘' : 'Ctrl'
}

/** Undo/redo hint that matches the platform modifier. */
export function undoLabel() {
  return modifierLabel() === '⌘' ? '⌘Z / ⌘⇧Z' : 'Ctrl+Z / Ctrl+Shift+Z'
}

/**
 * True while a keyboard event belongs to an IME composition.
 *
 * Pressing Enter to pick a Chinese/Japanese/Korean candidate fires `keydown`
 * with `isComposing === true` (Chrome/macOS) or `keyCode === 229` (Safari and
 * some Windows IMEs) before the composition is committed. Enter handlers that
 * submit on `key === 'Enter'` must ignore that event, otherwise the first
 * candidate keypress submits half-typed pinyin as if the user pressed Enter.
 */
export function isImeComposing(event) {
  if (!event) return false
  // React's synthetic keydown event does not expose `isComposing`, so read the
  // native event as well; plain DOM listeners carry the flag on the event itself.
  const native = event.nativeEvent || null
  const composing = event.isComposing || (native && native.isComposing)
  const code = event.keyCode || (native && native.keyCode)
  return Boolean(composing || code === 229)
}
