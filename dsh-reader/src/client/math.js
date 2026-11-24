const KATEX_JS = '/dsh-reader-live/assets/katex/katex.min.js'
const KATEX_CSS = '/dsh-reader-live/assets/katex/katex.min.css'

let katexInstance = null
let katexPromise = null

/** The loaded KaTeX instance, or null before the first formula is rendered. */
export function loadedKatex() {
  return katexInstance
}

/** Inline TeX keeps its delimiters tight; this rejects prices like `$5 和 $6`. */
function isInlineMath(tex) {
  return Boolean(tex) && !/^\s/.test(tex) && !/\s$/.test(tex) && !/^\d+(?:[.,]\d+)?$/.test(tex)
}

/** True when the text contains inline or block TeX delimiters. */
export function hasMath(text) {
  return mathParts(String(text || '')).some((part) => part.tex)
}

/**
 * Load KaTeX once, on demand. The CSS is injected first so the fonts resolve
 * relative to the stylesheet (`assets/katex/fonts/*.woff2`).
 * @returns {Promise<object>} window.katex
 */
export function ensureKatex() {
  if (katexInstance) return Promise.resolve(katexInstance)
  if (katexPromise) return katexPromise
  if (typeof document === 'undefined') return Promise.reject(new Error('katex unavailable'))
  katexPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-reader-katex]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = KATEX_CSS
      link.dataset.readerKatex = '1'
      document.head.appendChild(link)
    }
    if (window.katex) {
      katexInstance = window.katex
      resolve(katexInstance)
      return
    }
    const script = document.createElement('script')
    script.src = KATEX_JS
    script.async = true
    script.dataset.readerKatex = '1'
    script.onload = () => {
      if (window.katex) {
        katexInstance = window.katex
        resolve(katexInstance)
      } else {
        reject(new Error('katex unavailable'))
      }
    }
    script.onerror = () => reject(new Error('katex failed to load'))
    document.head.appendChild(script)
  }).catch((error) => {
    katexPromise = null
    throw error
  })
  return katexPromise
}

function mathParts(text) {
  const pattern = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g
  const parts = []
  let last = 0
  let match
  while ((match = pattern.exec(text)) !== null) {
    const display = match[1] !== undefined || match[2] !== undefined
    const tex = match[1] ?? match[2] ?? match[3] ?? match[4] ?? ''
    if (!tex.trim() || (!display && !isInlineMath(tex))) {
      last = match.index + match[0].length
      continue
    }
    if (match.index > last) parts.push({ text: text.slice(last, match.index) })
    parts.push({ tex, display })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

/**
 * Replace TeX delimiters in a sanitized HTML string with KaTeX markup.
 * Code and pre nodes are left untouched.
 * @param {string} html sanitized HTML
 * @param {object} [katex] window.katex (defaults to the loaded instance)
 */
export function renderMathInHtml(html, katex = katexInstance) {
  if (!katex || typeof document === 'undefined') return String(html || '')
  const container = document.createElement('div')
  container.innerHTML = String(html || '')
  const walker = document.createTreeWalker(container, 4)
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  for (const node of nodes) {
    const parent = node.parentElement
    if (!parent || parent.closest('pre, code')) continue
    const parts = mathParts(node.nodeValue || '')
    if (!parts.some((part) => part.tex)) continue
    const fragment = document.createDocumentFragment()
    for (const part of parts) {
      if (part.tex) {
        const span = document.createElement('span')
        span.className = part.display ? 'rd-math-block' : 'rd-math-inline'
        try {
          span.innerHTML = katex.renderToString(part.tex, {
            displayMode: part.display,
            throwOnError: false,
            strict: 'ignore',
          })
        } catch {
          span.textContent = part.tex
        }
        fragment.appendChild(span)
      } else if (part.text) {
        fragment.appendChild(document.createTextNode(part.text))
      }
    }
    parent.replaceChild(fragment, node)
  }
  return container.innerHTML
}
