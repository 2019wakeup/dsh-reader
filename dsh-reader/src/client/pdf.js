let pdfjsPromise = null

function loadPdfjs() {
  if (!pdfjsPromise) pdfjsPromise = import('/dsh-reader-live/assets/pdf.min.mjs')
  return pdfjsPromise
}

function transform(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]
}

export async function pdfPrefetch(pdf, pages) {
  const numbers = [...new Set(pages)].filter((number) => number >= 1 && number <= pdf.numPages)
  await Promise.allSettled(numbers.map((number) => pdf.doc.getPage(number)))
}

export async function pdfOpen(bytes) {
  const pdfjs = await loadPdfjs()
  pdfjs.GlobalWorkerOptions.workerSrc = '/dsh-reader-live/assets/pdf.worker.min.mjs'
  const assets = '/dsh-reader-live/assets/'
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useSystemFonts: true,
    cMapUrl: assets + 'cmaps/',
    cMapPacked: true,
    standardFontDataUrl: assets + 'standard_fonts/',
    wasmUrl: assets + 'wasm/',
  }).promise
  return { pdfjs, doc, numPages: doc.numPages }
}

export async function pdfRenderPage(pdf, pageNumber, canvas, layer, scale, onTask) {
  const page = await pdf.doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.floor(viewport.width * dpr)
  canvas.height = Math.floor(viewport.height * dpr)
  canvas.style.width = viewport.width + 'px'
  canvas.style.height = viewport.height + 'px'
  const context = canvas.getContext('2d')
  const task = page.render({
    canvas,
    canvasContext: context,
    viewport,
    transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
  })
  if (onTask) onTask(task)
  await task.promise
  layer.style.width = viewport.width + 'px'
  layer.style.height = viewport.height + 'px'
  layer.innerHTML = ''
  const content = await page.getTextContent()
  for (const item of content.items) {
    if (!item.str) continue
    const tx = transform(viewport.transform, item.transform)
    const height = Math.hypot(tx[2], tx[3])
    const span = document.createElement('span')
    span.textContent = item.str
    span.style.left = tx[4] + 'px'
    span.style.top = tx[5] - height + 'px'
    span.style.fontSize = height + 'px'
    layer.appendChild(span)
    const expected = (item.width || 0) * viewport.scale
    const actual = span.getBoundingClientRect().width
    if (expected > 0 && actual > 0) span.style.transform = `scaleX(${expected / actual})`
  }
  return { width: viewport.width, height: viewport.height, items: content.items.length }
}

/**
 * Group one PDF page's text items into paragraph-ish blocks for translation.
 * Lines are merged while the vertical gap stays within one line height.
 * @returns {Promise<Array<{id: string, text: string}>>}
 */
export async function pdfPageBlocks(pdf, pageNumber) {
  const page = await pdf.doc.getPage(pageNumber)
  const content = await page.getTextContent()
  const lines = []
  for (const item of content.items || []) {
    const str = String(item.str || '')
    if (!str.trim()) continue
    const height = Math.hypot(item.transform[2], item.transform[3]) || 10
    const x = item.transform[4]
    const y = item.transform[5]
    let line = lines.find((candidate) => Math.abs(candidate.y - y) <= Math.max(2, height * 0.35))
    if (!line) {
      line = { y, height, items: [] }
      lines.push(line)
    }
    line.items.push({ x, str })
    line.height = Math.max(line.height, height)
  }
  lines.sort((left, right) => right.y - left.y)
  const paragraphs = []
  let current = null
  for (const line of lines) {
    const text = line.items
      .sort((left, right) => left.x - right.x)
      .map((item) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!text) continue
    if (!current || current.lastY - line.y > line.height * 1.8) {
      if (current) paragraphs.push(current)
      current = { lines: [text], lastY: line.y, height: line.height }
    } else {
      current.lines.push(text)
      current.lastY = line.y
    }
  }
  if (current) paragraphs.push(current)
  return paragraphs
    .map((paragraph) => ({ text: paragraph.lines.join(' ').replace(/\s+/g, ' ').trim() }))
    .filter((block) => block.text.length >= 8)
    .map((block, index) => ({ id: `pg${pageNumber}-${index}`, text: block.text }))
}
