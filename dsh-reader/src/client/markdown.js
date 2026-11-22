const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch])
}

const SAFE_HREF = /^(https?:|mailto:|\/|#)/i

function renderInline(source) {
  const parts = String(source).split(/(`[^`]*`)/)
  return parts
    .map((part) => {
      if (part.length >= 2 && part.startsWith('`') && part.endsWith('`')) {
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`
      }
      let out = escapeHtml(part)
      out = out.replace(/\[([^\]]+)\]\(([^\s]*)\)/g, (match, label, href) =>
        SAFE_HREF.test(href) ? `<a href="${href}" rel="noopener noreferrer" target="_blank">${label}</a>` : label,
      )
      out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      return out
    })
    .join('')
}

/**
 * Render a practical Markdown subset. The source is escaped first, so raw HTML
 * never reaches the reading area.
 * @param {string} source markdown text
 * @returns {string} HTML
 */
export function markdownRender(source) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i += 1
      continue
    }
    const fence = line.match(/^```(\w*)\s*$/)
    if (fence) {
      const lang = fence[1]
      i += 1
      const body = []
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i])
        i += 1
      }
      i += 1
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : ''
      out.push(`<pre><code${cls}>${escapeHtml(body.join('\n'))}</code></pre>`)
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      out.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`)
      i += 1
      continue
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      out.push('<hr>')
      i += 1
      continue
    }
    if (/^>\s?/.test(line)) {
      const body = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^>\s?/, ''))
        i += 1
      }
      out.push(`<blockquote>${body.map(renderInline).join('<br>')}</blockquote>`)
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      const body = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        body.push(lines[i].replace(/^[-*]\s+/, ''))
        i += 1
      }
      out.push(`<ul>${body.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`)
      continue
    }
    if (/^\d+\.\s+/.test(line)) {
      const body = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        body.push(lines[i].replace(/^\d+\.\s+/, ''))
        i += 1
      }
      out.push(`<ol>${body.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ol>`)
      continue
    }
    const body = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|```|>|[-*]\s|\d+\.\s|---)/.test(lines[i])
    ) {
      body.push(lines[i])
      i += 1
    }
    out.push(`<p>${body.map(renderInline).join('<br>')}</p>`)
  }
  return out.join('')
}
