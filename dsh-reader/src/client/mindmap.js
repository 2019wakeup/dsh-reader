export const MAP_NODE_WIDTH = 230
export const MAP_NODE_HEIGHT = 40
export const MAP_ROW_HEIGHT = 54
export const MAP_COLUMN_WIDTH = 250

function baseTitle(value) {
  return String(value || '')
    .replace(/[（(]\s*\d+\s*[）)]\s*$/, '')
    .trim()
}

/** Strip extension and download-site noise from a document name (map root label). */
export function documentTitle(value) {
  const cleaned = String(value || '')
    .replace(/\.(pdf|epub|md|markdown|txt)$/i, '')
    .replace(/\s*\((?:z-library[^)]*|z-lib[^)]*|1lib[^)]*|libgen[^)]*|annas-archive[^)]*)\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return cleaned || '导读'
}

/**
 * Model replies occasionally leak a JSON envelope into a summary; unwrap it so
 * the map/detail/export never show raw JSON.
 */
export function cleanGuideSummary(value) {
  let text = String(value || '').trim()
  if (text.startsWith('{')) {
    const match = text.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/)
    if (match) {
      try {
        text = JSON.parse(`"${match[1]}"`)
      } catch {
        text = match[1].replace(/\\n/g, ' ')
      }
    } else {
      text = text.replace(/[{}"]/g, ' ').replace(/\b(?:summary|keyPoints)\s*:/g, ' ')
    }
  }
  return text.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Copy a guide with summary text cleaned, keeping its shape for every view. */
export function sanitizeGuide(guide) {
  if (!guide || typeof guide !== 'object') return guide
  const cleanList = (points) => (Array.isArray(points) ? points.map(cleanGuideSummary).filter(Boolean) : [])
  const cleanSections = (items) =>
    (Array.isArray(items) ? items : []).map((section) =>
      section && typeof section === 'object'
        ? { ...section, summary: cleanGuideSummary(section.summary), keyPoints: cleanList(section.keyPoints) }
        : section,
    )
  return {
    ...guide,
    synopsis: cleanGuideSummary(guide.synopsis),
    parts: (Array.isArray(guide.parts) ? guide.parts : []).map((part) =>
      part && typeof part === 'object'
        ? { ...part, summary: cleanGuideSummary(part.summary), keyPoints: cleanList(part.keyPoints) }
        : part,
    ),
    sections: cleanSections(guide.sections),
  }
}

function firstClause(value, max = 14) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  const clause = (text.split(/[，,。；;！？!?：:]/)[0] || text).trim()
  const chars = Array.from(clause)
  return chars.length > max ? chars.slice(0, max).join('') + '…' : clause
}

/**
 * Label lines for a chunked section. The chapter title already sits on the
 * parent node, so repeating it here makes every sibling look identical; show
 * the chunk ordinal plus its leading point/summary cluster instead.
 */
export function chunkNodeLines(node, perLine = 17) {
  if (!node) return ['']
  const ordinal = Number(node.chunkIndex) || 0
  const prefix = ordinal ? `（${ordinal}）` : ''
  const detail = firstClause(cleanGuideSummary((node.keyPoints || [])[0] || node.summary || ''))
  const label = `${prefix}${detail || baseTitle(node.title)}`
  return splitNodeTitle(label, perLine)
}

/** Split a long node title into two readable SVG lines. */
export function splitNodeTitle(value, perLine = 17) {
  const chars = Array.from(String(value || ''))
  if (chars.length <= perLine) return [chars.join('')]
  return [
    chars.slice(0, perLine).join(''),
    chars.slice(perLine, perLine * 2 - 1).join('') + (chars.length > perLine * 2 - 1 ? '…' : ''),
  ]
}

/**
 * Turn flat guide sections into a heading-level tree rooted at the document.
 * @param {string} title root label
 * @param {Array<{id: string, title: string, level?: number}>} sections
 */
export function buildTree(title, sections) {
  const root = { id: 'root', title, children: [] }
  const stack = [root]
  for (const section of sections || []) {
    const level = Math.max(1, Math.min(3, Number(section.level) || 1))
    stack.length = Math.min(stack.length, level)
    const parent = stack[level - 1] || root
    const node = {
      id: section.id,
      title: section.title || '',
      summary: section.summary || '',
      page: section.page,
      sections: [],
      children: [],
    }
    parent.children.push(node)
    stack[level] = node
  }
  return root
}

/**
 * Build the guide tree, using the chapter-level parts tier when the guide has
 * one (long books), otherwise the flat section tree.
 */
export function buildGuideTree(title, guide) {
  const sections = (guide && guide.sections) || []
  const parts = guide && Array.isArray(guide.parts) ? guide.parts : []
  if (parts.length === 0) return buildTree(title, sections)
  const byId = new Map(sections.map((section) => [section.id, section]))
  const root = { id: 'root', title, children: [] }
  for (const part of parts) {
    const node = {
      id: part.id,
      title: part.title || '',
      summary: part.summary || '',
      children: [],
    }
    node.keyPoints = part.keyPoints || []
    for (const sectionId of part.sectionIds || []) {
      const section = byId.get(sectionId)
      if (!section) continue
      const suffix = String(section.title || '').match(/[（(]\s*(\d+)\s*[）)]\s*$/)
      node.children.push({
        id: section.id,
        title: section.title || '',
        chunkIndex: suffix ? Number(suffix[1]) : undefined,
        summary: section.summary || '',
        page: section.page,
        chapter: section.chapter,
        keyPoints: section.keyPoints || [],
        children: [],
      })
    }
    // A part with exactly one section has no finer reading unit above page
    // level; keep one node. Longer chapters keep their chunk children so the
    // map can drill down instead of collapsing the detail away.
    if (node.children.length === 1) {
      const first = node.children[0]
      node.page = first.page
      node.chapter = first.chapter
      if (!node.summary) node.summary = first.summary || ''
      if (!node.keyPoints.length) node.keyPoints = first.keyPoints || []
      node.children = []
    }
    root.children.push(node)
  }
  return root
}

/**
 * CSS custom properties for the map's dot grid. The grid is painted on the
 * viewport (not the SVG) so it reads as an infinite canvas: dot spacing scales
 * with zoom and the pattern translate follows the pan 1:1.
 */
export function mapGridVars({ pan = { x: 0, y: 0 }, scale = 1, spacing = 24, offset = 30 } = {}) {
  const step = Math.max(8, Number(spacing) * (Number(scale) || 1))
  const center = step / 2
  const x = (Number(pan.x) || 0) + offset - center
  const y = (Number(pan.y) || 0) + offset - center
  return {
    '--rd-grid-size': `${Number(step.toFixed(2))}px`,
    '--rd-grid-x': `${Number(x.toFixed(2))}px`,
    '--rd-grid-y': `${Number(y.toFixed(2))}px`,
  }
}

/**
 * Position every visible node in a left-to-right tree.
 * @param {{id: string, title: string, children: Array}} tree
 * @param {Set<string>} collapsed ids whose children are hidden
 */
export function layoutTree(tree, collapsed = new Set(), options = {}) {
  const rowHeight = options.rowHeight || MAP_ROW_HEIGHT
  const columnWidth = options.columnWidth || MAP_COLUMN_WIDTH
  const nodes = []
  const edges = []
  let cursor = 0
  let maxDepth = 0

  const place = (node, depth, parentId) => {
    const children = collapsed.has(node.id) ? [] : node.children || []
    maxDepth = Math.max(maxDepth, depth)
    if (children.length === 0) {
      node.y = cursor
      cursor += rowHeight
    } else {
      const start = cursor
      for (const child of children) place(child, depth + 1, node.id)
      node.y = start + (cursor - start - rowHeight) / 2
    }
    node.x = depth * columnWidth
    nodes.push({
      id: node.id,
      title: node.title,
      summary: node.summary,
      keyPoints: node.keyPoints || [],
      label: node.label || '',
      chunkIndex: node.chunkIndex,
      fullTitle: node.title || '',
      page: node.page,
      chapter: node.chapter,
      x: node.x,
      y: node.y,
      depth,
      hasChildren: (node.children || []).length > 0,
      collapsed: collapsed.has(node.id),
    })
    if (parentId) edges.push({ from: parentId, to: node.id })
  }

  place(tree, 0, null)
  return {
    nodes,
    edges,
    width: (maxDepth + 1) * columnWidth,
    nodeWidth: options.nodeWidth || MAP_NODE_WIDTH,
    nodeHeight: options.nodeHeight || MAP_NODE_HEIGHT,
    height: Math.max(cursor, rowHeight),
  }
}

/** Render the guide as a portable Markdown outline. */
export function guideMarkdown({ title, guide }) {
  const lines = [`# ${title || '导读'}`, '']
  if (guide?.synopsis) lines.push('## 全书主旨', '', guide.synopsis, '')
  if (guide?.questions?.length) {
    lines.push('## 核心问题', '')
    for (const question of guide.questions) lines.push(`- ${question}`)
    lines.push('')
  }
  if (guide?.sections?.length) {
    lines.push('## 章节导读', '')
    const parts = Array.isArray(guide.parts) ? guide.parts : []
    if (parts.length > 0) {
      const byId = new Map(guide.sections.map((section) => [section.id, section]))
      for (const part of parts) {
        lines.push(`### ${part.title}`)
        if (part.summary) lines.push('', part.summary)
        lines.push('')
        for (const sectionId of part.sectionIds || []) {
          const section = byId.get(sectionId)
          if (!section) continue
          lines.push(`#### ${section.title}`)
          if (section.summary) lines.push('', section.summary)
          if (section.keyPoints?.length) {
            lines.push('')
            for (const point of section.keyPoints) lines.push(`- ${point}`)
          }
          lines.push('')
        }
      }
    } else {
      for (const section of guide.sections) {
        lines.push(`### ${section.title}`)
        if (section.summary) lines.push('', section.summary)
        if (section.keyPoints?.length) {
          lines.push('')
          for (const point of section.keyPoints) lines.push(`- ${point}`)
        }
        lines.push('')
      }
    }
  }
  return lines.join('\n').trimEnd() + '\n'
}
