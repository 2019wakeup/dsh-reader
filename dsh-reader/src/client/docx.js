import { unzip, zipText } from './epub.js'

export const MAMMOTH_URL = '/dsh-reader-live/assets/mammoth.browser.min.js'

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'])

let mammothPromise = null

function localName(element) {
  return String((element && (element.localName || element.tagName)) || '')
    .toLowerCase()
    .split(':')
    .pop()
}

function attr(element, name) {
  if (!element) return ''
  return element.getAttribute(name) || element.getAttribute(`w:${name}`) || ''
}

function descendants(root, name) {
  return Array.from(root.getElementsByTagName('*')).filter((element) => localName(element) === name)
}

/**
 * Read paragraph styles that carry a heading level, either through a `heading N`
 * style name or through `w:outlineLvl` (common in Chinese and WPS templates).
 * @param {string} stylesXml contents of word/styles.xml
 * @returns {Array<{styleId: string, name: string, level: number}>}
 */
export function parseStyleOutline(stylesXml) {
  if (!stylesXml || typeof DOMParser === 'undefined') return []
  const parsed = new DOMParser().parseFromString(stylesXml, 'application/xml')
  if (parsed.querySelector('parsererror')) return []
  const styles = []
  for (const style of descendants(parsed, 'style')) {
    if ((attr(style, 'type') || '').toLowerCase() !== 'paragraph') continue
    const styleId = attr(style, 'styleId')
    const nameElement = descendants(style, 'name')[0]
    const name = attr(nameElement, 'val')
    if (!styleId || !name) continue
    const pPr = descendants(style, 'pPr')[0]
    const outlineElement = pPr ? descendants(pPr, 'outlineLvl')[0] : null
    const outline = outlineElement ? Number(attr(outlineElement, 'val')) : NaN
    let level = Number.isFinite(outline) && outline >= 0 && outline <= 5 ? outline + 1 : 0
    if (!level) {
      const match = /^(?:heading|标题)\s*([1-6])$/i.exec(name.trim())
      if (match) level = Number(match[1])
    }
    if (level) styles.push({ styleId, name, level })
  }
  return styles
}

/**
 * Build mammoth style-map entries for the discovered heading styles.
 * @param {Array<{name: string, level: number}>} styles
 */
export function styleMapFor(styles) {
  return (styles || []).map(({ name, level }) => `p[style-name='${String(name).replace(/'/g, "\\'")}'] => h${level}`)
}

function wrapTables(root) {
  for (const table of Array.from(root.querySelectorAll('table'))) {
    if (table.parentElement && table.parentElement.classList.contains('rd-table-wrap')) continue
    const wrap = document.createElement('div')
    wrap.className = 'rd-table-wrap'
    table.parentNode.insertBefore(wrap, table)
    wrap.appendChild(table)
  }
}

function stripTocLeaders(root) {
  for (const paragraph of Array.from(root.querySelectorAll('p'))) {
    const text = String(paragraph.textContent || '').trim()
    if (/^.{0,120}(?:\.{3,}|…{2,}|·{3,})\s*\d+\s*$/.test(text)) paragraph.remove()
  }
}

/**
 * Sanitize mammoth output: mammoth does not sanitize, and Word files are
 * untrusted input. Keep the semantic tags, drop scripts and unsafe URLs.
 * @param {string} html
 */
export function sanitizeDocxHtml(html) {
  if (typeof document === 'undefined') return String(html || '')
  const container = document.createElement('div')
  container.innerHTML = String(html || '')
  for (const node of Array.from(container.querySelectorAll('script,iframe,object,embed,style,link,meta,base,form'))) {
    node.remove()
  }
  for (const element of Array.from(container.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name)
      if (attribute.name === 'href' && !/^(https?:|mailto:|#)/i.test(attribute.value)) element.removeAttribute('href')
      if (attribute.name === 'src' && !/^(https?:|blob:|data:image\/)/i.test(attribute.value)) element.removeAttribute('src')
    }
  }
  return container.innerHTML
}

/**
 * Split mammoth's flat HTML into h1 chapters and build the outline. The split
 * rule is frozen once published: annotations store only the chapter index.
 * @param {string} html sanitized document HTML
 */
export function splitDocxChapters(html) {
  if (typeof document === 'undefined') return { chapters: [], outline: [] }
  const container = document.createElement('div')
  container.innerHTML = String(html || '')
  wrapTables(container)
  stripTocLeaders(container)
  const chapters = []
  const outline = []
  let current = null
  const startChapter = (label) => {
    current = { label: label || '正文', html: '', text: '' }
    chapters.push(current)
  }
  for (const node of Array.from(container.childNodes)) {
    const tag = node.nodeType === 1 ? String(node.tagName || '').toLowerCase() : ''
    if (tag === 'h1') startChapter((node.textContent || '').trim() || `第 ${chapters.length + 1} 章`)
    else if (!current) startChapter('正文')
    if (node.nodeType === 1) {
      current.html += node.outerHTML || ''
      current.text += `${node.textContent || ''}\n`
      if (/^h[1-3]$/.test(tag)) outline.push({ level: Number(tag[1]), label: (node.textContent || '').trim() })
    } else {
      current.html += node.textContent || ''
      current.text += node.textContent || ''
    }
  }
  if (chapters.length === 0) startChapter('正文')
  for (const chapter of chapters) chapter.text = chapter.text.trim()
  return { chapters, outline }
}

/**
 * Load the vendored mammoth bundle once. The bundle is UMD and publishes
 * `window.mammoth`; it is only requested when the user opens a .docx file.
 * @param {string} [src]
 */
export function loadMammoth(src = MAMMOTH_URL) {
  if (typeof window !== 'undefined' && window.mammoth) return Promise.resolve(window.mammoth)
  if (typeof document === 'undefined') return Promise.reject(new Error('docx parser unavailable'))
  if (mammothPromise) return mammothPromise
  mammothPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.readerDocx = '1'
    script.onload = () => {
      if (window.mammoth) resolve(window.mammoth)
      else reject(new Error('docx parser unavailable'))
    }
    script.onerror = () => reject(new Error('docx parser failed to load'))
    document.head.appendChild(script)
  }).catch((error) => {
    mammothPromise = null
    throw error
  })
  return mammothPromise
}

/**
 * Parse a .docx into chapters for the existing HTML reading pipeline.
 * @param {Uint8Array} bytes docx bytes
 * @param {{mammoth?: object, loadMammoth?: () => Promise<object>}} [options]
 */
export async function docxOpen(bytes, options = {}) {
  const files = await unzip(bytes)
  if (files.size > 5000) throw new Error('docx has too many parts')
  if (!files.has('word/document.xml')) throw new Error('docx is missing word/document.xml')
  // Inflating the main part first enforces the 40MB per-entry budget before
  // mammoth expands the whole archive.
  const documentXml = await zipText(files, 'word/document.xml')
  if (documentXml.length > 20 * 1024 * 1024) throw new Error('docx document is too large')
  const styles = files.has('word/styles.xml') ? parseStyleOutline(await zipText(files, 'word/styles.xml')) : []
  const engine = options.mammoth || (await (options.loadMammoth || loadMammoth)())
  if (!engine || typeof engine.convertToHtml !== 'function') throw new Error('docx parser unavailable')
  const assets = []
  const convertImage =
    engine.images && typeof engine.images.imgElement === 'function'
      ? engine.images.imgElement(async (image) => {
          const type = String(image.contentType || '')
          if (!IMAGE_TYPES.has(type) || typeof URL.createObjectURL !== 'function') return { src: '' }
          const buffer = await image.readAsArrayBuffer()
          const url = URL.createObjectURL(new Blob([buffer], { type }))
          assets.push(url)
          return { src: url }
        })
      : undefined
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const result = await engine.convertToHtml({ arrayBuffer }, { styleMap: styleMapFor(styles), convertImage })
  const clean = sanitizeDocxHtml(result && result.value)
  const { chapters, outline } = splitDocxChapters(clean)
  if (chapters.length === 0) throw new Error('empty docx')
  return { chapters, outline, assets }
}
