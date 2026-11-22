/**
 * Human-readable export of every annotation and concept, for pasting into a
 * notes app. JSON export remains the lossless format.
 */
export function annotationsMarkdown(store, now = Date.now()) {
  const lines = ['# 阅读标注导出', '', `> 导出时间：${new Date(now).toISOString()}`, '']
  const docs = Object.entries(store?.docs || {})
  const marked = docs.filter(([, doc]) => (doc?.annotations || []).length > 0)
  if (marked.length === 0) lines.push('（没有标注）', '')
  for (const [key, doc] of marked) {
    lines.push(`## ${doc.path || key}`, '')
    for (const annotation of doc.annotations) {
      lines.push(`- “${String(annotation.quote || '').slice(0, 200)}”`)
      const where = []
      if (Number.isFinite(annotation.page)) where.push(`第 ${annotation.page} 页`)
      else if (Number.isFinite(annotation.chapter)) where.push(`第 ${annotation.chapter + 1} 章`)
      if (where.length) lines.push(`  - 位置：${where.join(' ')}`)
      if (annotation.note) lines.push(`  - 笔记：${annotation.note}`)
    }
    lines.push('')
  }

  const concepts = Object.values(store?.concepts || {})
  if (concepts.length > 0) {
    lines.push('## 概念库', '')
    for (const concept of concepts) {
      lines.push(`### ${concept.term || concept.id}`)
      if (concept.definition) lines.push('', concept.definition)
      if (Array.isArray(concept.aliases) && concept.aliases.length > 0) {
        lines.push('', `别名：${concept.aliases.join('、')}`)
      }
      if (Array.isArray(concept.occurrences) && concept.occurrences.length > 0) {
        lines.push('', `出现位置：${concept.occurrences.length} 处`)
      }
      lines.push('')
    }
  }
  return `${lines.join('\n').trimEnd()}\n`
}
