const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch])
}

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  copy: '©',
}

function decodeEntities(value) {
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? Number.parseInt(body.slice(2), 16) : Number(body.slice(1), 10)
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code)
        } catch {
          return match
        }
      }
      return match
    }
    const named = NAMED_ENTITIES[body.toLowerCase()]
    return named === undefined ? match : named
  })
}

function text(value) {
  return escapeHtml(decodeEntities(value))
}

const SAFE_HREF = /^(https?:|mailto:|\/|#)/i
const SAFE_IMAGE = /^(https?:|data:image\/)/i

/** Resolve markdown link/image targets; `resolveImage` may rewrite a relative path. */
function imageSource(src, options) {
  const value = String(src || '').trim()
  if (!value) return null
  if (SAFE_IMAGE.test(value)) return value
  if (value.startsWith('/') || value.startsWith('#')) return null
  if (typeof options.resolveImage === 'function') {
    const resolved = options.resolveImage(value)
    if (resolved) return resolved
  }
  return null
}

function linkTarget(href, options) {
  const value = String(href || '').trim()
  if (!value) return null
  if (SAFE_HREF.test(value)) return value
  if (typeof options.resolveLink === 'function') return options.resolveLink(value)
  return null
}

/**
 * Inline markdown: code spans, images, links, autolinks, emphasis, strike,
 * escapes. Raw HTML is always escaped. Placeholders keep generated HTML out of
 * the escaping pass.
 */
function renderInline(source, options = {}) {
  const tokens = []
  const stash = (html) => `\u0000${tokens.push(html) - 1}\u0000`
  let value = String(source ?? '')

  const escaped = []
  value = value.replace(/\\([\\`*{}\[\]()#+.!_>~|-])/g, (match, ch) => `\u0001${escaped.push(ch) - 1}\u0001`)

  value = value.replace(/(`+)([\s\S]*?)\1/g, (match, fence, body) => {
    let content = body
    if (content.startsWith(' ') && content.endsWith(' ') && content.trim()) content = content.slice(1, -1)
    return stash(`<code>${text(content)}</code>`)
  })

  value = value.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*\)/g, (match, alt, src, title) => {
    const url = imageSource(src, options)
    if (!url) return stash(`<span class="rd-img-alt">${text(alt || 'image')}</span>`)
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
    return stash(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt || '')}" loading="lazy"${titleAttr}>`)
  })

  value = value.replace(/\[([^\]]+)\]\(\s*((?:[^()\s]|\([^()\s]*\))+)(?:\s+"([^"]*)")?\s*\)/g, (match, label, href, title) => {
    const url = linkTarget(href, options)
    if (!url) return stash(renderInline(label, options))
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
    return stash(`<a href="${escapeHtml(url)}"${titleAttr} rel="noopener noreferrer" target="_blank">${renderInline(label, options)}</a>`)
  })

  value = value.replace(/<((?:https?|mailto):[^>\s]+)>/gi, (match, url) => stash(`<a href="${escapeHtml(url)}" rel="noopener noreferrer" target="_blank">${text(url)}</a>`))

  value = text(value)

  value = value.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  value = value.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  value = value.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  value = value.replace(/(^|[^A-Za-z0-9_])__([^_]+)__(?![A-Za-z0-9_])/g, '$1<strong>$2</strong>')
  value = value.replace(/(^|[^A-Za-z0-9_])_([^_]+)_(?![A-Za-z0-9_])/g, '$1<em>$2</em>')

  value = value.replace(/\u0000(\d+)\u0000/g, (match, index) => tokens[Number(index)] || '')
  value = value.replace(/\u0001(\d+)\u0001/g, (match, index) => escapeHtml(escaped[Number(index)]))
  return value
}

function indentOf(line) {
  const match = line.match(/^[ \t]*/)
  return match[0].replace(/\t/g, '    ').length
}

function isBlank(line) {
  return !line || !line.trim()
}

const LIST_ITEM = /^([ \t]*)([-+*]|\d+[.)])[ \t]+(.*)$/

function listInfo(line) {
  const match = line.match(LIST_ITEM)
  if (!match) return null
  const ordered = /^\d/.test(match[2])
  return {
    indent: match[1].replace(/\t/g, '    ').length,
    ordered,
    start: ordered ? Number.parseInt(match[2], 10) : 1,
    content: match[3],
  }
}

function splitTableRow(line) {
  let value = line.trim()
  if (value.startsWith('|')) value = value.slice(1)
  if (value.endsWith('|') && !value.endsWith('\\|')) value = value.slice(0, -1)
  const cells = []
  let buffer = ''
  let code = false
  for (let index = 0; index < value.length; index += 1) {
    const ch = value[index]
    if (ch === '\\' && value[index + 1] === '|') {
      buffer += '|'
      index += 1
      continue
    }
    if (ch === '`') {
      code = !code
      buffer += ch
      continue
    }
    if (ch === '|' && !code) {
      cells.push(buffer.trim())
      buffer = ''
      continue
    }
    buffer += ch
  }
  cells.push(buffer.trim())
  return cells
}

function isTableStart(lines, index) {
  if (index + 1 >= lines.length) return false
  if (!lines[index].includes('|')) return false
  const header = splitTableRow(lines[index])
  const divider = splitTableRow(lines[index + 1])
  if (header.length < 1 || divider.length !== header.length) return false
  return divider.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
}

function renderTable(lines, start, options) {
  const header = splitTableRow(lines[start])
  const divider = splitTableRow(lines[start + 1])
  const align = divider.map((cell) => {
    const left = cell.trim().startsWith(':')
    const right = cell.trim().endsWith(':')
    return left && right ? 'center' : right ? 'right' : left ? 'left' : ''
  })
  const cellHtml = (tag, value, index) => {
    const style = align[index] ? ` style="text-align:${align[index]}"` : ''
    return `<${tag}${style}>${renderInline(value, options)}</${tag}>`
  }
  const head = `<thead><tr>${header.map((cell, index) => cellHtml('th', cell, index)).join('')}</tr></thead>`
  const body = []
  let index = start + 2
  while (index < lines.length && lines[index].includes('|') && !isBlank(lines[index])) {
    const cells = splitTableRow(lines[index])
    body.push(`<tr>${header.map((cell, column) => cellHtml('td', cells[column] || '', column)).join('')}</tr>`)
    index += 1
  }
  return {
    html: `<div class="rd-table-wrap"><table>${head}${body.length ? `<tbody>${body.join('')}</tbody>` : ''}</table></div>`,
    next: index,
  }
}

function stripIndent(line, width) {
  const match = line.match(/^[ \t]*/)
  const raw = match ? match[0] : ''
  let consumed = 0
  let index = 0
  while (index < raw.length && consumed < width) {
    consumed += raw[index] === '\t' ? 4 : 1
    index += 1
  }
  return line.slice(index)
}

function renderList(lines, start, options) {
  const first = listInfo(lines[start])
  const base = first.indent
  const ordered = first.ordered
  const startNumber = first.start
  const items = []
  let loose = false
  let index = start

  while (index < lines.length) {
    const info = listInfo(lines[index])
    if (!info || info.indent !== base || info.ordered !== ordered) break
    const contentLines = [info.content]
    index += 1
    let sawBlank = false
    while (index < lines.length) {
      const line = lines[index]
      if (isBlank(line)) {
        sawBlank = true
        contentLines.push('')
        index += 1
        continue
      }
      const nextItem = listInfo(line)
      if (nextItem && nextItem.indent === base) break
      if (indentOf(line) <= base) break
      if (sawBlank && contentLines.length > 0) loose = true
      contentLines.push(stripIndent(line, base + 2))
      index += 1
    }
    while (contentLines.length > 0 && isBlank(contentLines[contentLines.length - 1])) contentLines.pop()
    if (sawBlank) loose = true

    let task = null
    const firstLine = contentLines[0] || ''
    const checkbox = firstLine.match(/^\[([ xX])\][ \t]+(.*)$/)
    if (checkbox) {
      task = checkbox[1].toLowerCase() === 'x'
      contentLines[0] = checkbox[2]
    }
    let inner = renderBlocks(contentLines, options)
    if (!loose && inner.startsWith('<p>')) {
      const close = inner.indexOf('</p>')
      if (close >= 0) inner = inner.slice(3, close) + inner.slice(close + 4)
    }
    const check = task === null ? '' : `<input type="checkbox" disabled${task ? ' checked' : ''}> `
    items.push(`<li${task === null ? '' : ' class="rd-task"'}>${check}${inner}</li>`)
  }

  const tag = ordered ? 'ol' : 'ul'
  const attrs = ordered && startNumber !== 1 ? ` start="${startNumber}"` : ''
  return { html: `<${tag}${attrs}>${items.join('')}</${tag}>`, next: index }
}

function isFence(line) {
  return /^\s*(`{3,}|~{3,})(.*)$/.test(line)
}

function fenceInfo(line) {
  const match = line.match(/^\s*(`{3,}|~{3,})\s*([^`]*)$/)
  return match ? { marker: match[1], char: match[1][0], length: match[1].length, lang: match[2].trim() } : null
}

function isBlockStarter(lines, index) {
  const line = lines[index]
  if (!line.trim()) return false
  return (
    /^(#{1,6})\s+/.test(line) ||
    isFence(line) ||
    /^>\s?/.test(line) ||
    /^ {0,3}([-*_])(\s*\1){2,}\s*$/.test(line) ||
    Boolean(listInfo(line)) ||
    isTableStart(lines, index)
  )
}

function renderBlocks(lines, options = {}) {
  const out = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (isBlank(line)) {
      index += 1
      continue
    }

    if (isFence(line)) {
      const info = fenceInfo(line)
      const body = []
      index += 1
      const close = new RegExp(`^\\s*${info.char}{${info.length},}\\s*$`)
      while (index < lines.length && !close.test(lines[index])) {
        body.push(lines[index])
        index += 1
      }
      index += 1
      const cls = info.lang ? ` class="language-${escapeHtml(info.lang.split(/\s+/)[0])}"` : ''
      out.push(`<pre><code${cls}>${escapeHtml(body.join('\n'))}</code></pre>`)
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/)
    if (heading) {
      out.push(`<h${heading[1].length}>${renderInline(heading[2], options)}</h${heading[1].length}>`)
      index += 1
      continue
    }

    if (
      index + 1 < lines.length &&
      !isBlank(lines[index + 1]) &&
      /^ {0,3}=+\s*$/.test(lines[index + 1]) &&
      !/^[-*+]\s/.test(line)
    ) {
      out.push(`<h1>${renderInline(line.trim(), options)}</h1>`)
      index += 2
      continue
    }
    if (
      index + 1 < lines.length &&
      !isBlank(lines[index + 1]) &&
      /^ {0,3}-{2,}\s*$/.test(lines[index + 1]) &&
      !isBlank(line) &&
      !/^[-*+]\s/.test(line)
    ) {
      out.push(`<h2>${renderInline(line.trim(), options)}</h2>`)
      index += 2
      continue
    }

    if (/^ {0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push('<hr>')
      index += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const body = []
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        body.push(lines[index].replace(/^>\s?/, ''))
        index += 1
      }
      out.push(`<blockquote>${renderBlocks(body, options)}</blockquote>`)
      continue
    }

    if (isTableStart(lines, index)) {
      const table = renderTable(lines, index, options)
      out.push(table.html)
      index = table.next
      continue
    }

    if (listInfo(line)) {
      const list = renderList(lines, index, options)
      out.push(list.html)
      index = list.next
      continue
    }

    const paragraph = []
    while (
      index < lines.length &&
      !isBlank(lines[index]) &&
      !(paragraph.length > 0 && isBlockStarter(lines, index)) &&
      !(paragraph.length === 0 && isBlockStarter(lines, index))
    ) {
      paragraph.push(lines[index])
      index += 1
    }
    if (paragraph.length === 0) {
      paragraph.push(line)
      index += 1
    }
    const rendered = []
    paragraph.forEach((raw, lineIndex) => {
      const hard = / {2,}$/.test(raw) || /\\$/.test(raw)
      const cleaned = raw.replace(/ {2,}$/, '').replace(/\\$/, '')
      rendered.push(renderInline(cleaned, options))
      if (lineIndex < paragraph.length - 1) rendered.push(hard ? '<br>' : '\n')
    })
    out.push(`<p>${rendered.join('')}</p>`)
  }
  return out.join('')
}

/**
 * Render a practical Markdown subset (GFM-ish): headings, paragraphs, fenced
 * code, blockquotes, nested lists, task lists, tables, images, links,
 * emphasis, strikethrough, rules and escapes. Raw HTML is always escaped.
 * @param {string} source markdown text
 * @param {{resolveImage?: (src: string) => string|null, resolveLink?: (href: string) => string|null}} [options]
 * @returns {string} HTML
 */
export function markdownRender(source, options = {}) {
  const lines = String(source ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
  return renderBlocks(lines, options)
}
