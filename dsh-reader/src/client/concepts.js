function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function conceptChain(concepts, id) {
  const chain = []
  let current = concepts[id]
  let guard = 0
  while (current && guard < 8) {
    chain.push(current)
    current = current.parentId ? concepts[current.parentId] : null
    guard += 1
  }
  return chain.reverse()
}

const ASCII = /^[\x00-\x7F]+$/

/**
 * Build one alternation over every concept term. Latin terms match only at
 * word boundaries and single letters are ignored, so `AI` never splits
 * `EMAIL`; CJK terms match anywhere.
 * @param {Array<{id: string, term: string, aliases?: string[]}>} concepts
 */
export function conceptMatcher(concepts) {
  const byTerm = new Map()
  for (const concept of concepts) {
    for (const term of [concept.term, ...(concept.aliases || [])]) {
      const clean = String(term || '').trim().toLowerCase()
      if (!clean) continue
      if (ASCII.test(clean) && clean.length < 2) continue
      byTerm.set(clean, concept.id)
    }
  }
  if (byTerm.size === 0) return null
  const pattern = Array.from(byTerm.keys())
    .sort((a, b) => b.length - a.length)
    .map((term) =>
      ASCII.test(term) ? `(?<![A-Za-z0-9])${escapeRegExp(term)}(?![A-Za-z0-9])` : escapeRegExp(term),
    )
    .join('|')
  return { matcher: new RegExp(pattern, 'gi'), byTerm }
}

/** Concepts that were read/explained in one document. */
export function conceptsForDoc(concepts, docKey) {
  if (!docKey) return []
  return (concepts || []).filter(
    (concept) =>
      (concept.occurrences || []).some((occurrence) => occurrence.docKey === docKey) ||
      (concept.evidence && concept.evidence.docKey === docKey),
  )
}

/** Stable signature of the term set currently marked in the DOM. */
export function conceptSignature(concepts) {
  return (concepts || [])
    .map((concept) => `${concept.id}:${concept.term}:${(concept.aliases || []).join(',')}`)
    .sort()
    .join('|')
}

/** Stable signature of the text highlights for one chapter. */
export function annotationSignature(annotations, chapter) {
  return (annotations || [])
    .filter((annotation) => annotation.kind !== 'pdf')
    .filter((annotation) => String(annotation.chapter) === String(chapter))
    .map((annotation) => `${annotation.id}:${annotation.quote}:${annotation.occurrence || 0}:${annotation.color || ''}`)
    .sort()
    .join('|')
}

/**
 * Wrap every known concept term in the rendered text with a hoverable span.
 * @param {HTMLElement} root reading container
 * @param {Array<{id: string, term: string, aliases?: string[]}>} concepts known concepts
 */
export function markTerms(root, concepts) {
  for (const element of Array.from(root.querySelectorAll('.rd-term'))) {
    const parent = element.parentNode
    if (!parent) continue
    parent.replaceChild(document.createTextNode(element.textContent || ''), element)
    parent.normalize()
  }
  const built = conceptMatcher(concepts)
  if (!built) return
  const { matcher, byTerm } = built

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  for (const node of nodes) {
    const text = node.nodeValue
    const parent = node.parentElement
    if (!text || !text.trim() || !parent || parent.closest('.rd-card, .rd-trans')) continue
    matcher.lastIndex = 0
    if (!matcher.test(text)) continue
    matcher.lastIndex = 0
    const fragment = document.createDocumentFragment()
    let last = 0
    let match
    while ((match = matcher.exec(text))) {
      if (match.index < last) continue
      if (match.index > last) fragment.appendChild(document.createTextNode(text.slice(last, match.index)))
      const span = document.createElement('span')
      span.className = 'rd-term'
      span.dataset.id = byTerm.get(match[0].toLowerCase()) || ''
      span.tabIndex = 0
      span.setAttribute('role', 'button')
      span.textContent = match[0]
      fragment.appendChild(span)
      last = match.index + match[0].length
      if (matcher.lastIndex === match.index) matcher.lastIndex += 1
    }
    if (last < text.length) fragment.appendChild(document.createTextNode(text.slice(last)))
    node.parentNode.replaceChild(fragment, node)
  }
}
