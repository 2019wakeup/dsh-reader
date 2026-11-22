/**
 * Structure-aware reading units for long books.
 *
 * The guide pipeline needs three things from any document:
 *  - `toc`     a navigable outline (title + level + page/section anchor)
 *  - `parts`   chapter-level groups used as the reduce tier
 *  - `sections` leaf text units that are summarized one by one
 *
 * PDFs use the embedded outline when present (page ranges from bookmarks),
 * falling back to equal page groups. Markdown/EPUB use their heading/chapter
 * structure. Everything is bounded by a section budget so a 500-page book
 * still costs a predictable number of model calls.
 */

export function flattenOutline(items, level = 1, out = []) {
  for (const item of items || []) {
    if (!item || typeof item.title !== 'string' || !item.title.trim()) continue
    out.push({ title: item.title.trim().slice(0, 160), level, dest: item.dest })
    if (Array.isArray(item.items) && item.items.length > 0) flattenOutline(item.items, level + 1, out)
  }
  return out
}

/** Resolve one pdf.js outline destination to a 1-based page number. */
export async function destinationPage(pdf, dest) {
  let target = dest
  try {
    if (typeof dest === 'string') target = await pdf.doc.getDestination(dest)
  } catch {
    return null
  }
  if (!Array.isArray(target) || target.length === 0) return null
  const ref = target[0]
  try {
    if (ref && typeof ref === 'object') {
      const index = await pdf.doc.getPageIndex(ref)
      return Number.isFinite(index) ? index + 1 : null
    }
    if (typeof ref === 'number' && Number.isFinite(ref)) return ref + 1
  } catch {
    return null
  }
  return null
}

/** Full PDF outline with resolved page numbers (empty when the file has none). */
export async function pdfOutlineToc(pdf) {
  let outline = null
  try {
    outline = await pdf.doc.getOutline()
  } catch {
    return []
  }
  if (!Array.isArray(outline) || outline.length === 0) return []
  const flat = flattenOutline(outline)
  const toc = []
  for (const entry of flat) {
    const page = await destinationPage(pdf, entry.dest)
    toc.push({ id: `t${toc.length}`, title: entry.title, level: entry.level, page })
  }
  return toc
}

/** Keep a representative head/tail when a section exceeds the per-call budget. */
export function sampleText(text, max = 6000) {
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (clean.length <= max) return clean
  const marker = ' …（中间省略）… '
  if (max <= marker.length + 2) return clean.slice(0, max)
  const room = max - marker.length
  const head = Math.ceil(room * 0.6)
  const tail = room - head
  return `${clean.slice(0, head)}${marker}${tail > 0 ? clean.slice(-tail) : ''}`
}

function mergeAdjacentChapters(chapters, factor) {
  if (factor <= 1) return chapters
  const merged = []
  for (const chapter of chapters) {
    const last = merged[merged.length - 1]
    if (last && last.members.length < factor) {
      last.members.push(chapter)
      last.end = chapter.end
      last.fallback = Boolean(last.fallback || chapter.fallback)
      last.title = last.fallback
        ? `${last.members[0].page}-${last.end}`
        : `${last.members[0].title} … ${chapter.title}`
    } else {
      merged.push({ ...chapter, members: [chapter] })
    }
  }
  return merged
}

/**
 * Broken PDFs exist: one real book had 26 bookmarks where most pointed at the
 * same page. Treat an outline as unreliable when pages are mostly duplicated
 * or out of order, and fall back to page groups instead of lying.
 */
export function outlineReliable(toc, numPages) {
  const entries = (toc || []).filter((entry) => entry.page)
  if (entries.length < 2) return false
  const pages = entries.map((entry) => entry.page)
  const unique = new Set(pages).size
  if (unique / pages.length < 0.35) return false
  let backwards = 0
  for (let index = 1; index < pages.length; index += 1) {
    if (pages[index] < pages[index - 1]) backwards += 1
  }
  if (backwards / pages.length > 0.2) return false
  return pages[pages.length - 1] <= numPages + 1
}

/** Chapters from an outline; `null` when the outline has no usable hierarchy. */
export function chaptersFromToc(toc, numPages) {
  for (const level of [1, 2, 3]) {
    const entries = (toc || []).filter((entry) => entry.level === level && entry.page)
    if (entries.length >= 2) {
      return entries.map((entry, index) => ({
        id: `ch${index}`,
        title: entry.title,
        page: entry.page,
        end: index + 1 < entries.length ? Math.max(entry.page, entries[index + 1].page - 1) : numPages,
      }))
    }
  }
  return null
}

/**
 * Recover chapters from typography when the bookmark tree is broken: a line
 * clearly larger than the page's body text is a heading candidate.
 */
export async function detectPdfChapters(pdf, numPages = pdf.numPages) {
  const candidates = []
  for (let pageNumber = 1; pageNumber <= numPages; pageNumber += 1) {
    let content
    try {
      const page = await pdf.doc.getPage(pageNumber)
      content = await page.getTextContent()
    } catch {
      continue
    }
    const lines = new Map()
    for (const item of content.items || []) {
      const value = String(item.str || '').trim()
      if (!value) continue
      const height = Math.hypot(item.transform[2], item.transform[3])
      const key = Math.round(item.transform[5] / 2)
      const line = lines.get(key) || { text: '', height: 0 }
      line.text += value
      line.height = Math.max(line.height, height)
      lines.set(key, line)
    }
    const all = [...lines.values()].filter((line) => line.text.trim())
    if (all.length < 3) continue
    const heights = all.map((line) => line.height).sort((a, b) => a - b)
    const median = heights[Math.floor(heights.length / 2)] || 0
    const body = all.filter((line) => line.height <= median * 1.05).map((line) => line.text).join('')
    let heading = null
    for (const line of all) {
      const value = line.text.trim()
      if (value.length < 2 || value.length > 48) continue
      if (/^[0-9\s.．-]+$/.test(value)) continue
      if (/^(图|表|资料来源|数据来源)/.test(value)) continue
      if (line.height >= Math.max(median * 1.18, median + 2)) {
        heading = value
        break
      }
    }
    if (heading && body.length >= 12) candidates.push({ title: heading, page: pageNumber })
  }
  const chapters = []
  for (const candidate of candidates) {
    const last = chapters[chapters.length - 1]
    if (last && (last.title === candidate.title || last.page === candidate.page)) continue
    chapters.push({ id: `d${chapters.length}`, title: candidate.title, page: candidate.page, end: 0 })
  }
  if (chapters.length < 4) return null
  return chapters
}

/**
 * Build leaf sections for a bounded page budget. Leading chapter titles are
 * preserved, and chapters longer than the average are split into parts.
 */
export function planPdfSections(chapters, numPages, options = {}) {
  const budget = Math.max(4, options.maxSections || 48)
  const maxParts = Math.max(2, options.maxParts || 24)
  let working = chapters
  if (working.length > maxParts) {
    working = mergeAdjacentChapters(working, Math.ceil(working.length / maxParts))
  }
  const build = (size) => {
    const plan = []
    for (const chapter of working) {
      const pages = chapter.end - chapter.page + 1
      let index = 0
      const step = options.oneSectionPerPart ? pages : size
      for (let start = chapter.page; start <= chapter.end; start += step) {
        const end = Math.min(chapter.end, start + step - 1)
        plan.push({
          partId: chapter.id,
          partTitle: chapter.title,
          title: chapter.fallback ? `${start}-${end}` : pages > size ? `${chapter.title}（${start}-${end}）` : chapter.title,
          page: start,
          end,
          level: 1,
          first: index === 0,
        })
        index += 1
      }
    }
    return plan
  }
  let size = Math.max(1, Math.ceil(numPages / Math.max(1, budget - working.length + 1)))
  let plan = build(size)
  while (plan.length > budget && size < numPages) {
    size += 1
    plan = build(size)
  }
  return plan
}

/** Equal page groups used when a PDF has no outline. */
export function pageGroupChapters(numPages, groupSize) {
  const size = Math.max(1, groupSize || 10)
  const chapters = []
  for (let start = 1; start <= numPages; start += size) {
    const end = Math.min(numPages, start + size - 1)
    chapters.push({ id: `pg${start}`, title: `${start}-${end}`, page: start, end, fallback: true })
  }
  return chapters
}

/**
 * Fetch text for each planned section and attach parts.
 * @returns {{toc: Array<object>, parts: Array<{id,title,summary?,sectionIds}>, sections: Array<object>, coverage: {from:number,to:number,total:number}}}
 */
export async function pdfGuideStructure(pdf, options = {}) {
  const toc = await pdfOutlineToc(pdf)
  const numPages = pdf.numPages
  const reliable = outlineReliable(toc, numPages)
  const detected = reliable ? null : await detectPdfChapters(pdf, numPages)
  const chapters =
    (reliable && chaptersFromToc(toc, numPages)) ||
    detected ||
    pageGroupChapters(numPages, options.pagesPerSection || 10)
  for (const chapter of chapters) {
    if (!chapter.end) chapter.end = numPages
  }
  for (let index = 0; index < chapters.length; index += 1) {
    const next = chapters[index + 1]
    if (next) chapters[index].end = Math.max(chapters[index].page, next.page - 1)
  }
  const plan = planPdfSections(chapters, numPages, options)
  const sections = []
  for (const unit of plan) {
    let text = ''
    for (let pageNumber = unit.page; pageNumber <= unit.end; pageNumber += 1) {
      const page = await pdf.doc.getPage(pageNumber)
      const content = await page.getTextContent()
      text += `${content.items.map((item) => item.str).join(' ')}\n`
    }
    const clean = sampleText(text, options.maxChars || 6000)
    if (!clean) continue
    sections.push({
      id: `p${unit.page}-${unit.end}`,
      title: unit.title,
      level: 1,
      page: unit.page,
      text: clean,
      partId: unit.partId,
    })
  }
  const parts = []
  for (const section of sections) {
    let part = parts.find((item) => item.id === section.partId)
    if (!part) {
      part = { id: section.partId, title: section.partTitle || section.title.split('（')[0], sectionIds: [] }
      parts.push(part)
    }
    part.sectionIds.push(section.id)
  }
  return {
    toc,
    tocReliable: reliable,
    chapters,
    parts,
    sections,
    coverage: {
      from: sections.length > 0 ? sections[0].page : 1,
      to: sections.length > 0 ? sections[sections.length - 1].page : numPages,
      total: numPages,
    },
  }
}

/** EPUB chapters -> toc/parts/sections with bounded chunking. */
export function epubGuideStructure(book, options = {}) {
  const maxSections = Math.max(4, options.maxSections || 48)
  const maxChars = options.maxChars || 6000
  const parser = new DOMParser()
  const toc = []
  const parts = []
  const sections = []
  let budget = maxSections
  for (const [index, chapter] of (book.chapters || []).entries()) {
    let text = ''
    try {
      const parsed = parser.parseFromString(chapter.html || '', 'text/html')
      text = (parsed.body?.textContent || '').replace(/\s+/g, ' ').trim()
    } catch {
      text = ''
    }
    const title = chapter.label || `${index + 1}`
    toc.push({ id: `e${index}`, title, level: 1, page: null, chapter: index })
    if (!text || budget <= 0) continue
    const pieces = options.oneSectionPerPart ? 1 : Math.max(1, Math.min(Math.ceil(text.length / 6000), budget))
    const partId = `ep${index}`
    const part = { id: partId, title, sectionIds: [] }
    const chunkSize = Math.ceil(text.length / pieces) || 1
    for (let offset = 0; offset < text.length && part.sectionIds.length < pieces; offset += chunkSize) {
      const chunk = sampleText(text.slice(offset, offset + chunkSize), maxChars)
      if (!chunk) continue
      const id = `e${index}-${part.sectionIds.length}`
      sections.push({
        id,
        title: pieces > 1 ? `${title}（${part.sectionIds.length + 1}）` : title,
        level: 1,
        text: chunk,
        partId,
        chapter: index,
      })
      part.sectionIds.push(id)
      budget -= 1
    }
    if (part.sectionIds.length > 0) parts.push(part)
  }
  return { toc, parts, sections, coverage: { from: 0, to: 1, total: 1 } }
}

/** Markdown headings -> toc/parts/sections with the same bounded hierarchy. */
export function markdownGuideStructure(text, options = {}) {
  const maxSections = Math.max(4, options.maxSections || 48)
  const maxChars = options.maxChars || 6000
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

  const toc = raw.map((item, index) => ({ id: `m${index}`, title: item.title, level: item.level, page: null }))
  const parts = []
  const sections = []
  const budget = Math.max(1, Math.ceil(raw.reduce((sum, item) => sum + item.body.length, 0) / Math.max(1, maxSections * 4000)))
  let sectionBudget = maxSections
  for (const [index, item] of raw.entries()) {
    if (sectionBudget <= 0) break
    const pieces = options.oneSectionPerPart ? 1 : Math.max(1, Math.ceil(item.body.length / 6000))
    const allowed = options.oneSectionPerPart ? 1 : Math.max(1, Math.min(pieces, sectionBudget))
    const partId = `part${index}`
    const part = { id: partId, title: item.title, sectionIds: [] }
    const chunkSize = Math.ceil(item.body.length / allowed) || 1
    for (let offset = 0; offset < item.body.length && part.sectionIds.length < allowed; offset += chunkSize) {
      const chunk = sampleText(item.body.slice(offset, offset + chunkSize), maxChars)
      if (!chunk) continue
      const id = `m${index}-${part.sectionIds.length}`
      sections.push({
        id,
        title: allowed > 1 ? `${item.title}（${part.sectionIds.length + 1}）` : item.title,
        level: item.level,
        text: chunk,
        partId,
      })
      part.sectionIds.push(id)
      sectionBudget -= 1
    }
    if (part.sectionIds.length > 0) parts.push(part)
  }
  return {
    toc,
    parts,
    sections,
    coverage: { from: 0, to: 1, total: 1 },
  }
}
