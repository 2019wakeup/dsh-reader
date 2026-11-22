function chunkText(text, size = 5000) {
  const paragraphs = String(text || '').split(/\n{2,}/)
  const chunks = []
  let buffer = ''
  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph
    if (candidate.length > size && buffer) {
      chunks.push(buffer)
      buffer = paragraph
    } else {
      buffer = candidate
    }
  }
  if (buffer) chunks.push(buffer)
  return chunks.length > 0 ? chunks : ['']
}

/**
 * Split Markdown into heading-based sections, chunking oversized bodies.
 * @param {string} text markdown source
 */
export function markdownSections(text, options = {}) {
  const max = options.max || 60
  const lines = String(text || '').split('\n')
  const raw = []
  let current = { title: '正文', level: 1, body: [] }
  let inFence = false
  const flush = () => {
    const body = current.body.join('\n').trim()
    if (body) raw.push({ title: current.title, level: current.level, body })
  }
  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence
      current.body.push(line)
      continue
    }
    const heading = !inFence && line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      flush()
      current = { title: heading[2].trim(), level: heading[1].length, body: [] }
    } else {
      current.body.push(line)
    }
  }
  flush()

  const sections = []
  raw.forEach((section, index) => {
    const parts = section.body.length > 6000 ? chunkText(section.body) : [section.body]
    parts.forEach((body, part) => {
      sections.push({
        id: `s${index}${part ? `-${part}` : ''}`,
        title: part > 0 ? `${section.title} (${part + 1})` : section.title,
        level: section.level,
        text: body.slice(0, 6000),
      })
    })
  })
  return sections.slice(0, max)
}

/** Strip one EPUB chapter's HTML into a guide section. */
export function epubSections(book, options = {}) {
  const max = options.max || 60
  const parser = new DOMParser()
  return (book.chapters || [])
    .slice(0, max)
    .map((chapter, index) => {
      const parsed = parser.parseFromString(chapter.html || '', 'text/html')
      return {
        id: `c${index}`,
        title: chapter.label || `${index + 1}`,
        level: 1,
        text: (parsed.body.textContent || '').trim().slice(0, 6000),
      }
    })
    .filter((section) => section.text.length > 0)
}

/** Group PDF pages into sections using their text layer. */
export async function pdfSections(pdf, options = {}) {
  const max = options.max || 60
  const group = options.pagesPerSection || 10
  const sections = []
  for (let start = 1; start <= pdf.numPages && sections.length < max; start += group) {
    const end = Math.min(pdf.numPages, start + group - 1)
    let text = ''
    for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
      const page = await pdf.doc.getPage(pageNumber)
      const content = await page.getTextContent()
      text += `${content.items.map((item) => item.str).join(' ')}\n`
    }
    if (text.trim()) {
      sections.push({
        id: `p${start}`,
        title: `${start}-${end}`,
        level: 1,
        page: start,
        text: text.slice(0, 6000),
      })
    }
  }
  return sections
}
