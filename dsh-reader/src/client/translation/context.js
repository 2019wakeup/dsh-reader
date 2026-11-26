/**
 * Build the per-chapter translation context from data the reader already has:
 * guide sections and concept terms. No extra model call is made; without a
 * guide we still provide the book/chapter title.
 */
export function buildTranslationContext({ doc, docKey, chapter = 0, store = {} }) {
  if (!doc) return { title: '', chapter: '', chapterSnapshot: '' }
  const chapters = (doc.epub && doc.epub.chapters) || (doc.docx && doc.docx.chapters) || []
  const guide = store.docs?.[docKey]?.guide
  const section = guide?.sections?.[chapter]
  const chapterTitle = String(
    (chapters[chapter] && chapters[chapter].title) || section?.title || '',
  ).trim()
  const concepts = Object.values(store.concepts || {})
    .filter((concept) => {
      const occurrences = Array.isArray(concept?.occurrences) ? concept.occurrences : []
      return occurrences.some((occurrence) => occurrence && occurrence.docKey === docKey)
    })
    .map((concept) => String(concept.term || '').trim())
    .filter(Boolean)
    .slice(0, 12)
  const bits = []
  if (section?.summary) bits.push(String(section.summary))
  if (Array.isArray(section?.keyPoints)) bits.push(...section.keyPoints.slice(0, 6).map(String))
  if (concepts.length > 0) bits.push(`术语：${concepts.join('、')}`)
  return {
    title: String(doc.name || ''),
    chapter: chapterTitle,
    chapterSnapshot: bits.join('；').slice(0, 400),
  }
}
