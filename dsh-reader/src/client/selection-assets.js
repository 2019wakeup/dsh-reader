/**
 * Rich assets inside a reading selection.
 *
 * The composer quote itself is text, so a selection that only says "请看这里"
 * loses the figure or formula it pointed at. This module reads the selected
 * DOM range, describes images / inline SVG / math markup, and turns them into
 * browser Files the conversation controller can attach to the draft.
 *
 * Kept DOM-only (no React, no plugin context) so node --test can exercise it.
 */

/** Media types the DSH attachment store accepts as prompt images. */
const PROMPT_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const SVG_TYPE = 'image/svg+xml'
const MAX_SVG_CHARS = 160_000
const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const MAX_ASSETS = 8

const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

function intersects(range, node) {
  try {
    return typeof range.intersectsNode === 'function' ? range.intersectsNode(node) : false
  } catch {
    return false
  }
}

function trimmedText(value, limit = 80) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function guessedImageType(src) {
  const match = String(src || '').match(/^data:([^;,]+)[;,]/i) || String(src || '').match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i)
  if (!match) return ''
  if (match[1] && match[1].includes('/')) return match[1].toLowerCase()
  const extension = match[1] ? match[1].toLowerCase() : ''
  return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' }[extension] || ''
}

function captionOf(element) {
  const figure = element.closest ? element.closest('figure') : null
  const caption = figure ? figure.querySelector('figcaption') : null
  return caption ? trimmedText(caption.textContent, 100) : ''
}

/**
 * Walk the selected range and describe its rich content.
 * @param {Range|null} range
 * @param {Element|null} root content root that owns the rendered document
 * @returns {Array<{kind: 'image'|'svg'|'formula', src?: string, markup?: string, tex?: string, alt?: string, caption?: string}>}
 */
export function collectSelectionAssets(range, root) {
  if (!range || !root || typeof root.querySelectorAll !== 'function') return []
  const assets = []
  const seen = new Set()
  const push = (asset) => {
    if (assets.length >= MAX_ASSETS) return
    const key = `${asset.kind}:${asset.src || asset.markup || asset.tex}`
    if (!key || seen.has(key)) return
    seen.add(key)
    assets.push(asset)
  }

  for (const image of root.querySelectorAll('img')) {
    if (!intersects(range, image)) continue
    const src = image.currentSrc || image.getAttribute('src') || ''
    if (!src) continue
    push({
      kind: 'image',
      src,
      alt: trimmedText(image.getAttribute('alt'), 80),
      caption: captionOf(image),
      width: image.naturalWidth || 0,
      height: image.naturalHeight || 0,
    })
  }

  for (const svg of root.querySelectorAll('svg')) {
    if (!intersects(range, svg)) continue
    const markup = String(svg.outerHTML || '')
    if (!markup || markup.length > MAX_SVG_CHARS) continue
    push({ kind: 'svg', markup, alt: trimmedText(svg.getAttribute('aria-label'), 80), caption: captionOf(svg) })
  }

  for (const math of root.querySelectorAll('math')) {
    if (!intersects(range, math)) continue
    const annotated = math.querySelector('annotation[encoding="application/x-tex"]')
    const tex = annotated ? trimmedText(annotated.textContent, 600) : ''
    if (tex) push({ kind: 'formula', tex })
  }

  return assets
}

/** Human-safe attachment name, with a stable extension for the media type. */
export function attachmentNameFor(asset, index, mediaType) {
  const extension = EXTENSIONS[mediaType] || 'png'
  const base = trimmedText(asset.alt || asset.caption, 60).replace(/[\\/:*?"<>|]+/g, ' ') || `选中图形${index + 1}`
  return `${base}.${extension}`
}

function toFile(parts, name, type) {
  try {
    return new File(parts, name, { type })
  } catch {
    return null
  }
}

/**
 * Fetch the bytes behind selected images and serialize inline SVG into Files.
 * Images that cannot be read are dropped here; their labels still reach the
 * model through the quote text.
 * @param {Array<object>} assets
 * @param {{fetchImpl?: typeof fetch}} [options]
 * @returns {Promise<File[]>}
 */
export async function prepareSelectionFiles(assets, options = {}) {
  const fetchImpl = typeof options.fetchImpl === 'function' ? options.fetchImpl : typeof fetch === 'function' ? fetch : null
  const files = []
  for (const [index, asset] of (assets || []).entries()) {
    if (!asset || typeof asset !== 'object') continue
    if (asset.kind === 'svg') {
      if (asset.markup) {
        const file = toFile([asset.markup], attachmentNameFor(asset, index, SVG_TYPE), SVG_TYPE)
        if (file) files.push(file)
      }
      continue
    }
    if (asset.kind !== 'image' || !asset.src || !fetchImpl) continue
    try {
      const response = await fetchImpl(asset.src)
      if (!response || response.ok === false) continue
      const blob = await response.blob()
      if (!blob || !blob.size || blob.size > MAX_IMAGE_BYTES) continue
      const type = blob.type || guessedImageType(asset.src)
      if (!type) continue
      const name = attachmentNameFor(asset, index, type)
      if (PROMPT_IMAGE_TYPES.has(type)) {
        const file = toFile([blob], name, type)
        if (file) files.push(file)
      } else if (type === SVG_TYPE) {
        // `<img src="...svg">` is not a prompt image; attach it as a document.
        const file = toFile([blob], name, type)
        if (file) files.push(file)
      }
    } catch {
      /* a broken image URL falls back to the text label */
    }
  }
  return files
}

/**
 * Short description appended to the quote so the model knows the passage's
 * figures/formulas exist even when their bytes cannot cross the composer.
 * @param {Array<object>} assets
 * @param {(key: string) => string} t
 */
export function buildAssetQuoteSuffix(assets, t) {
  const list = Array.isArray(assets) ? assets : []
  const lines = []
  const visuals = list.filter((asset) => asset && (asset.kind === 'image' || asset.kind === 'svg'))
  const formulas = list.filter((asset) => asset && asset.kind === 'formula' && asset.tex)
  if (visuals.length > 0) {
    const label = (asset, index) => trimmedText(asset.alt || asset.caption, 40) || `${index + 1}`
    lines.push(`${t('label.selectionAssetsNote')}：${visuals.map(label).join('、')}`)
  }
  for (const formula of formulas) lines.push(`$${formula.tex}$`)
  return lines.length > 0 ? `\n\n${lines.join('\n')}` : ''
}
