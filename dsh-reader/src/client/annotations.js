function textNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  return nodes
}

export function selectionContext(root) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null
  const text = selection.toString().trim()
  if (!text) return null
  return { range: range.cloneRange(), text, rect: range.getBoundingClientRect() }
}

export function occurrenceBefore(root, range) {
  const head = document.createRange()
  head.selectNodeContents(root)
  head.setEnd(range.startContainer, range.startOffset)
  return head.toString()
}

export function clearHighlights(root) {
  for (const element of Array.from(root.querySelectorAll('.rd-hl'))) {
    const parent = element.parentNode
    if (!parent) continue
    parent.replaceChild(document.createTextNode(element.textContent || ''), element)
    parent.normalize()
  }
}

/**
 * Locate the occurrence-th quote and split it into per-text-node segments.
 * @returns {{range: Range, targets: Array<{node: Text, start: number, end: number}>}|null}
 */
export function findQuoteRange(root, quote, occurrence = 0) {
  if (!root || !quote) return null
  const nodes = textNodes(root)
  const full = nodes.map((node) => node.nodeValue).join('')
  let start = -1
  let from = 0
  for (let i = 0; i <= occurrence; i += 1) {
    start = full.indexOf(quote, from)
    if (start < 0) return null
    from = start + quote.length
  }
  const end = start + quote.length
  let offset = 0
  const targets = []
  for (const node of nodes) {
    const length = node.nodeValue.length
    const nodeStart = offset
    const nodeEnd = offset + length
    offset = nodeEnd
    if (nodeEnd <= start || nodeStart >= end) continue
    targets.push({ node, start: Math.max(0, start - nodeStart), end: Math.min(length, end - nodeStart) })
  }
  if (targets.length === 0) return null
  const first = targets[0]
  const range = document.createRange()
  range.setStart(first.node, first.start)
  range.setEnd(first.node, first.end)
  return { range, targets }
}

/** Find a PDF annotation whose normalized rect contains the point. */
export function hitAnnotationAtPoint(annotations, page, x, y) {
  return (
    (annotations || []).find(
      (annotation) =>
        annotation &&
        annotation.kind === 'pdf' &&
        annotation.page === page &&
        Array.isArray(annotation.rects) &&
        annotation.rects.some(
          (rect) => x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h,
        ),
    ) || null
  )
}

/**
 * Rebuild text highlights for one chapter from stored quote + occurrence anchors.
 * @param {HTMLElement} root reading container
 * @param {Array<object>} annotations stored marks
 * @param {number|string} chapterKey current chapter
 */
function wrapSegment(node, start, end, annotation) {
  const range = document.createRange()
  range.setStart(node, start)
  range.setEnd(node, end)
  const mark = document.createElement('mark')
  mark.className = 'rd-hl'
  mark.dataset.anno = annotation.id
  mark.tabIndex = 0
  mark.setAttribute('role', 'button')
  mark.style.setProperty('--hl', annotation.color || '#f2c94c')
  range.surroundContents(mark)
}



/**
 * Rebuild text highlights for one chapter from stored quote + occurrence anchors.
 * A quote that crosses inline formatting is wrapped segment by segment.
 * @param {HTMLElement} root reading container
 * @param {Array<object>} annotations stored marks
 * @param {number|string} chapterKey current chapter
 * @returns {string[]} ids whose quote could no longer be found
 */
export function applyHighlights(root, annotations, chapterKey) {
  clearHighlights(root)
  const unresolved = []
  for (const annotation of annotations) {
    if (annotation.kind === 'pdf') continue
    if (String(annotation.chapter) !== String(chapterKey)) continue
    if (!annotation.quote) continue
    try {
      const found = findQuoteRange(root, annotation.quote, annotation.occurrence || 0)
      if (!found) {
        unresolved.push(annotation.id)
        continue
      }
      for (const target of found.targets) {
        try {
          wrapSegment(target.node, target.start, target.end, annotation)
        } catch {
          unresolved.push(annotation.id)
          break
        }
      }
    } catch {
      unresolved.push(annotation.id)
    }
  }
  return unresolved
}
