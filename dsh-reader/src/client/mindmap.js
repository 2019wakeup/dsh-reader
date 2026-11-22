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
    for (const sectionId of part.sectionIds || []) {
      const section = byId.get(sectionId)
      if (!section) continue
      node.children.push({
        id: section.id,
        title: section.title || '',
        summary: section.summary || '',
        page: section.page,
        chapter: section.chapter,
        children: [],
      })
    }
    if (node.children.length === 1) {
      const only = node.children[0]
      // A single-section part and its section are the same reading unit; keep
      // one node (the part) and inherit the section's jump target.
      node.page = only.page
      node.chapter = only.chapter
      node.children = []
    }
    root.children.push(node)
  }
  return root
}

/**
 * Position every visible node in a left-to-right tree.
 * @param {{id: string, title: string, children: Array}} tree
 * @param {Set<string>} collapsed ids whose children are hidden
 */
export function layoutTree(tree, collapsed = new Set(), options = {}) {
  const rowHeight = options.rowHeight || 40
  const columnWidth = options.columnWidth || 220
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
      page: node.page,
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
