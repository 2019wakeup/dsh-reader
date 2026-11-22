import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const workspace = path.resolve(root, '..')
const source = path.join(workspace, '示例-分布式系统阅读.md')
const target = path.join(workspace, '示例-分布式系统.epub')

const escapeHtml = (value) =>
  String(value).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch])

function inline(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

function markdownToXhtml(markdown) {
  return String(markdown)
    .split(/\n{2,}/)
    .map((block) => {
      const line = block.trim()
      if (!line) return ''
      if (line.startsWith('### ')) return `<h3>${inline(line.slice(4))}</h3>`
      if (line.startsWith('## ')) return `<h2>${inline(line.slice(3))}</h2>`
      if (line.startsWith('# ')) return `<h1>${inline(line.slice(2))}</h1>`
      return `<p>${inline(line).replace(/\n/g, '<br/>')}</p>`
    })
    .join('\n')
}

const text = await fs.readFile(source, 'utf8')
const lines = text.split('\n')
const chapters = []
let title = '分布式系统阅读示例'
let current = { label: title, lines: [] }
for (const line of lines) {
  const heading = line.match(/^##\s+(.*)$/)
  if (heading) {
    chapters.push(current)
    current = { label: heading[1].trim(), lines: [line] }
  } else {
    if (line.startsWith('# ') && !chapters.length) title = line.slice(2).trim()
    current.lines.push(line)
  }
}
chapters.push(current)

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'reader-epub-'))
await fs.mkdir(path.join(temp, 'META-INF'), { recursive: true })
await fs.mkdir(path.join(temp, 'OEBPS'), { recursive: true })
await fs.writeFile(path.join(temp, 'mimetype'), 'application/epub+zip')

await fs.writeFile(
  path.join(temp, 'META-INF', 'container.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
)

const chapterFiles = chapters.map((chapter, index) => ({
  id: `ch${index + 1}`,
  href: `ch${index + 1}.xhtml`,
  label: chapter.label,
}))
for (let index = 0; index < chapters.length; index += 1) {
  const body = markdownToXhtml(chapters[index].lines.join('\n'))
  await fs.writeFile(
    path.join(temp, 'OEBPS', `ch${index + 1}.xhtml`),
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeHtml(chapters[index].label)}</title></head>
<body>${body}</body></html>`,
  )
}

await fs.writeFile(
  path.join(temp, 'OEBPS', 'nav.xhtml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>目录</title></head>
<body><nav epub:type="toc"><ol>${chapterFiles
    .map((file) => `<li><a href="${file.href}">${escapeHtml(file.label)}</a></li>`)
    .join('')}</ol></nav></body></html>`,
)

await fs.writeFile(
  path.join(temp, 'OEBPS', 'content.opf'),
  `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">dsh-reader-demo</dc:identifier>
    <dc:title>${escapeHtml(title)}</dc:title>
    <dc:language>zh-CN</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${chapterFiles
      .map((file) => `<item id="${file.id}" href="${file.href}" media-type="application/xhtml+xml"/>`)
      .join('\n    ')}
  </manifest>
  <spine>${chapterFiles.map((file) => `<itemref idref="${file.id}"/>`).join('')}</spine>
</package>`,
)

execFileSync('/usr/bin/zip', ['-X0', target, 'mimetype'], { cwd: temp })
execFileSync('/usr/bin/zip', ['-Xr9D', target, 'META-INF', 'OEBPS'], { cwd: temp })
await fs.rm(temp, { recursive: true, force: true })
console.log(`EPUB written: ${target} (${chapterFiles.length} chapters)`)
