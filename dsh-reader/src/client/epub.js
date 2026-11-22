const decoder = new TextDecoder()

function u16(dv, offset) {
  return dv.getUint16(offset, true)
}

function u32(dv, offset) {
  return dv.getUint32(offset, true)
}

/**
 * Read a ZIP archive into a name -> {method, raw} map.
 * @param {ArrayBuffer|Uint8Array} bytes archive bytes
 */
export async function unzip(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
  let eocd = -1
  const floor = Math.max(0, u8.length - 65557)
  for (let i = u8.length - 22; i >= floor; i -= 1) {
    if (u32(dv, i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('not a zip archive')
  const count = u16(dv, eocd + 10)
  const cdOffset = u32(dv, eocd + 16)
  const files = new Map()
  let p = cdOffset
  for (let i = 0; i < count; i += 1) {
    if (u32(dv, p) !== 0x02014b50) break
    const method = u16(dv, p + 10)
    const compSize = u32(dv, p + 20)
    const nameLen = u16(dv, p + 28)
    const extraLen = u16(dv, p + 30)
    const commentLen = u16(dv, p + 32)
    const localOffset = u32(dv, p + 42)
    const name = decoder.decode(u8.subarray(p + 46, p + 46 + nameLen))
    const localNameLen = u16(dv, localOffset + 26)
    const localExtraLen = u16(dv, localOffset + 28)
    const dataStart = localOffset + 30 + localNameLen + localExtraLen
    files.set(name, { method, raw: u8.subarray(dataStart, dataStart + compSize) })
    p += 46 + nameLen + extraLen + commentLen
  }
  return files
}

const MAX_ENTRY_BYTES = 40 * 1024 * 1024

export async function inflate(entry) {
  let out
  if (entry.method === 0) out = entry.raw
  else if (entry.method === 8) {
    const stream = new Blob([entry.raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    out = new Uint8Array(await new Response(stream).arrayBuffer())
  } else {
    throw new Error('unsupported zip compression ' + entry.method)
  }
  if (out.length > MAX_ENTRY_BYTES) throw new Error('zip entry too large')
  return out
}

export async function zipText(files, name) {
  const entry = files.get(name)
  if (!entry) throw new Error('missing zip entry ' + name)
  return decoder.decode(await inflate(entry))
}

function joinPath(dir, rel) {
  if (!rel) return dir
  if (rel.startsWith('/')) return rel.slice(1)
  const parts = (dir ? dir.split('/') : []).concat(rel.split('/'))
  const out = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return out.join('/')
}

function parseXml(text) {
  return new DOMParser().parseFromString(text, 'application/xml')
}

function findFirst(root, name) {
  const wanted = name.toLowerCase()
  for (const element of Array.from(root.children || [])) {
    const tag = String(element.tagName || '').toLowerCase()
    const local = String(element.localName || '').toLowerCase()
    if (tag === wanted || local === wanted || tag.endsWith(':' + wanted)) return element
    const nested = findFirst(element, name)
    if (nested) return nested
  }
  return null
}

function mimeFor(name) {
  if (/\.png$/i.test(name)) return 'image/png'
  if (/\.jpe?g$/i.test(name)) return 'image/jpeg'
  if (/\.gif$/i.test(name)) return 'image/gif'
  if (/\.webp$/i.test(name)) return 'image/webp'
  if (/\.svg$/i.test(name)) return 'image/svg+xml'
  return 'application/octet-stream'
}

function collectNavPoints(node, out) {
  for (const point of Array.from(node.children || [])) {
    if (point.tagName === 'navPoint') {
      const label = point.querySelector('navLabel > text')?.textContent?.trim() || ''
      const src = point.querySelector('content')?.getAttribute('src') || ''
      if (src) out.push({ label, href: src.split('#')[0] })
      collectNavPoints(point, out)
    }
  }
  return out
}

function collectNavLinks(doc) {
  const out = []
  const nav = doc.querySelector('nav[epub\\:type="toc"], nav#toc, nav')
  const root = nav || doc
  for (const a of Array.from(root.querySelectorAll('a[href]'))) {
    const href = a.getAttribute('href') || ''
    if (!href || href.startsWith('http')) continue
    out.push({ label: a.textContent.trim(), href: href.split('#')[0] })
  }
  return out
}

/**
 * Open an EPUB archive and produce rendered chapter HTML.
 * @param {ArrayBuffer|Uint8Array} bytes epub bytes
 */
export async function epubOpen(bytes) {
  const files = await unzip(bytes)
  const container = parseXml(await zipText(files, 'META-INF/container.xml'))
  const rootfile = container.querySelector('rootfile')
  if (!rootfile) throw new Error('container.xml has no rootfile')
  const opfPath = rootfile.getAttribute('full-path')
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : ''
  const opf = parseXml(await zipText(files, opfPath))
  const metadata = opf.querySelector('metadata') || opf
  const title = findFirst(metadata, 'title')?.textContent?.trim() || ''

  const manifest = {}
  for (const item of Array.from(opf.querySelectorAll('manifest > item'))) {
    manifest[item.getAttribute('id')] = {
      href: item.getAttribute('href'),
      type: item.getAttribute('media-type') || '',
      properties: item.getAttribute('properties') || '',
    }
  }
  const spine = Array.from(opf.querySelectorAll('spine > itemref')).map((x) => x.getAttribute('idref'))
  const layoutMeta = Array.from(opf.querySelectorAll('meta')).find(
    (item) => item.getAttribute('property') === 'rendition:layout',
  )
  const fixedLayout = Boolean(layoutMeta && layoutMeta.textContent.trim() === 'pre-paginated')

  let toc = []
  const navItem = Object.values(manifest).find((item) => item.properties.includes('nav'))
  if (navItem && files.has(joinPath(opfDir, navItem.href))) {
    toc = collectNavLinks(parseXml(await zipText(files, joinPath(opfDir, navItem.href))))
  } else {
    const ncx = Object.values(manifest).find((item) => item.type.includes('dtbncx'))
    if (ncx && files.has(joinPath(opfDir, ncx.href))) {
      toc = collectNavPoints(parseXml(await zipText(files, joinPath(opfDir, ncx.href))), [])
    }
  }

  const assets = new Map()
  const assetUrls = []
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    for (const [name, entry] of files) {
      if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) {
        try {
          const url = URL.createObjectURL(new Blob([await inflate(entry)], { type: mimeFor(name) }))
          assets.set(name, url)
          assetUrls.push(url)
        } catch {
          /* skip a broken image */
        }
      }
    }
  }

  const chapters = []
  for (const idref of spine) {
    const item = manifest[idref]
    if (!item || !item.href) continue
    const path = joinPath(opfDir, item.href)
    let raw = ''
    try {
      raw = await zipText(files, path)
    } catch {
      continue
    }
    const label =
      toc.find((entry) => entry.href && path.endsWith(entry.href.replace(/^\.\//, '')))?.label ||
      `${chapters.length + 1}`
    const chapterDir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
    const html = sanitizeHtml(raw, (src) => {
      if (/^data:image\//i.test(src)) return src
      if (/^(https?:|blob:)/i.test(src)) return null
      return assets.get(joinPath(chapterDir, src)) || null
    })
    chapters.push({ path, label, html })
  }
  return { title, chapters, assetUrls, fixedLayout }
}
