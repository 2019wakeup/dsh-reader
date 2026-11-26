import { blockHash, normalizeBlockText } from '../../../lib/block-hash.js'

/**
 * The one block model shared by the HTML renderers.
 *
 * `text` is what goes to the model: inline code, formulas, links and anchors
 * are replaced by `{{RD:n}}` placeholders so the model cannot rewrite them.
 * `plainText` stays available for detection/statistics; `protected` keeps the
 * original nodes to restore after translation.
 */

const BLOCK_SELECTOR = 'p, li, blockquote, h1, h2, h3, h4, figcaption, td, th'
const BLOCK_CHILD_SELECTOR = 'p, div, ul, ol, blockquote, pre, table, h1, h2, h3, h4, figure, section'
const PROTECTED_SELECTOR = 'code, kbd, samp, .katex, math, mjx-container, a[href], a[id], a[name], svg, img, picture'

function hasBlockChild(node) {
  for (const child of node.children || []) {
    if (child.matches && child.matches(BLOCK_CHILD_SELECTOR)) return true
  }
  return false
}

function roleFor(node) {
  const tag = String(node.tagName || '').toLowerCase()
  if (/^h[1-4]$/.test(tag)) return 'heading'
  if (tag === 'li') return 'list'
  if (tag === 'blockquote') return 'quote'
  if (tag === 'figcaption') return 'caption'
  if (tag === 'td' || tag === 'th') return 'table-cell'
  return 'body'
}

/**
 * Flatten a block into prompt text, replacing protected inline nodes with
 * placeholders. Non-protected wrappers (strong/em/span) contribute their text
 * and are intentionally flattened for 0.16.0.
 */
function unitFor(node, { chapter = '', order = 0 } = {}) {
  const protectedNodes = []
  let raw = ''
  const walk = (parent) => {
    for (const child of parent.childNodes || []) {
      if (child.nodeType === 3) {
        raw += child.nodeValue || ''
        continue
      }
      if (child.nodeType !== 1) continue
      if (child.matches && child.matches(PROTECTED_SELECTOR)) {
        const token = `{{RD:${protectedNodes.length}}}`
        protectedNodes.push({ token, node: child.cloneNode(true) })
        raw += token
        continue
      }
      walk(child)
    }
  }
  walk(node)
  const text = normalizeBlockText(raw)
  const plainText = normalizeBlockText(node.textContent || '')
  if (text.length < 2) return null
  const hash = blockHash(text)
  return {
    key: `${chapter}:${order}:${hash}`,
    hash,
    contentHash: hash,
    text,
    plainText,
    node,
    role: roleFor(node),
    chapter,
    order,
    protected: protectedNodes,
  }
}

/** Extract leaf blocks in reading order; containers with block children are skipped. */
export function extractUnits(root, { chapter = '', limit = 1000 } = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') return []
  const units = []
  for (const node of root.querySelectorAll(BLOCK_SELECTOR)) {
    if (units.length >= limit) break
    if (node.closest && node.closest('.rd-trans, .rd-card')) continue
    if (hasBlockChild(node)) continue
    const unit = unitFor(node, { chapter, order: units.length })
    if (unit) units.push(unit)
  }
  return units
}

/**
 * Restore placeholders from a translated block. Returns null when the model
 * dropped/duplicated a placeholder; the caller keeps the source block instead
 * of rendering a broken half-translation.
 */
export function renderUnitFragment(unit, translation) {
  if (!unit || typeof translation !== 'string') return null
  const tokens = unit.protected || []
  const document = unit.node.ownerDocument
  if (!document) return null
  const fragment = document.createDocumentFragment()
  const pattern = /\{\{RD:(\d+)\}\}/g
  const used = new Set()
  let last = 0
  let match
  while ((match = pattern.exec(translation)) !== null) {
    const index = Number(match[1])
    if (!Number.isInteger(index) || !tokens[index] || used.has(index)) return null
    used.add(index)
    if (match.index > last) fragment.appendChild(document.createTextNode(translation.slice(last, match.index)))
    fragment.appendChild(tokens[index].node.cloneNode(true))
    last = match.index + match[0].length
  }
  if (used.size !== tokens.length) return null
  if (last < translation.length) fragment.appendChild(document.createTextNode(translation.slice(last)))
  return fragment
}

/** Replace a block's children with the translated fragment; preserve the block attrs/id. */
export function applyUnitTranslation(unit, translation) {
  const fragment = renderUnitFragment(unit, translation)
  if (!fragment) return false
  unit.node.replaceChildren(fragment)
  return true
}

/** Build the translation-only HTML for a chapter while preserving block structure. */
export function buildTranslatedOnlyHtml(html, resolve) {
  if (typeof document === 'undefined') return String(html || '')
  const container = document.createElement('div')
  container.innerHTML = String(html || '')
  for (const unit of extractUnits(container, { limit: 20000 })) {
    const translated = resolve ? resolve(unit.hash) : ''
    if (translated) applyUnitTranslation(unit, translated)
  }
  return container.innerHTML
}

/** A single plain-text unit (selection translation / callers without a DOM block). */
export function unitFromText(text, { role = 'selection', chapter = '', order = 0 } = {}) {
  const value = normalizeBlockText(text)
  if (!value) return null
  const hash = blockHash(value)
  return {
    key: `${chapter}:${order}:${hash}`,
    hash,
    contentHash: hash,
    text: value,
    plainText: value,
    node: null,
    role,
    chapter,
    order,
    protected: [],
  }
}

/** PDF page blocks use the same unit shape without DOM references. */
export function unitsFromPdfBlocks(blocks, { chapter = '' } = {}) {
  return (blocks || [])
    .map((block, order) => unitFromText(block.text, { role: 'body', chapter, order }))
    .filter(Boolean)
}
