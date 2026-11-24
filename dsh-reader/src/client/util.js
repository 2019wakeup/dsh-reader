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

export const READABLE = new Set(['.md', '.markdown', '.txt', '.epub', '.pdf'])

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
