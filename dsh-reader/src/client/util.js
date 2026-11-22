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

export function basename(file) {
  const parts = String(file || '').split('/')
  return parts[parts.length - 1] || file
}

export function dirname(file) {
  const parts = String(file || '').split('/')
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
