const BLOCKED = new Set([
  'script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'link', 'meta', 'base', 'style',
  'form', 'input', 'button', 'textarea', 'select', 'audio', 'video', 'source', 'track',
  'animate', 'set', 'foreignobject',
])

const stripControl = (value) => String(value || '').replace(/[\u0000-\u0020]+/g, '')

/**
 * Remove active content from untrusted EPUB HTML and resolve relative resources.
 * @param {string} html untrusted markup
 * @param {(src: string) => string | null} [resolve] relative-src resolver
 */
export function sanitizeHtml(html, resolve) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html')
  const walk = (element) => {
    for (const node of Array.from(element.children)) {
      const tag = String(node.localName || node.tagName || '').toLowerCase()
      if (BLOCKED.has(tag)) {
        node.remove()
        continue
      }
      for (const attr of Array.from(node.attributes)) {
        const name = attr.name.toLowerCase()
        const local = String(attr.localName || name).toLowerCase()
        if (name.startsWith('on') || name === 'srcdoc') {
          node.removeAttribute(attr.name)
          continue
        }
        // The reader owns layout: book classes and inline styles could cover
        // the whole app, so neither survives.
        if (name === 'class' || name === 'style') {
          node.removeAttribute(attr.name)
          continue
        }
        if (name === 'id' && /^rd-/i.test(attr.value)) {
          node.removeAttribute(attr.name)
          continue
        }
        if (name === 'srcset' || name === 'poster') {
          node.removeAttribute(attr.name)
          continue
        }
        if (
          (local === 'href' || local.endsWith(':href') || local === 'src') &&
          /^(javascript|vbscript|data:text\/html)/i.test(stripControl(attr.value))
        ) {
          node.removeAttribute(attr.name)
        }
      }
      if (node.tagName === 'IMG') {
        const src = node.getAttribute('src')
        if (src) {
          const resolved = resolve ? resolve(src) : null
          if (resolved) node.setAttribute('src', resolved)
          else node.removeAttribute('src')
        }
      }
      walk(node)
    }
  }
  walk(doc.body)
  return doc.body.innerHTML
}
