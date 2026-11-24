import React from 'react'

/**
 * Attachment presentation for the in-reader conversation panel.
 *
 * The reader panel projects the platform ChatSnapshot itself, so it never gets
 * the native message-image slot. Durable image refs are resolved here through
 * the same client Session API the native transcript uses
 * (`sessions.binding(sessionId).session.readAttachment(ref)`), and cached as
 * browser object URLs for the life of the view.
 *
 * Kept free of DOM access at import time: node --test imports this module.
 */

const attachmentEl = React.createElement
const ATTACHABLE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const ATTACHMENT_ID_PATTERN = /^sha256:[0-9a-f]{64}$/

function safeAttachmentName(value) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 120) : ''
}

/** Validate one durable image reference from a session message part. */
export function normalizeImageRef(value) {
  if (!value || typeof value !== 'object') return null
  const attachmentId = typeof value.attachmentId === 'string' ? value.attachmentId : ''
  if (!ATTACHMENT_ID_PATTERN.test(attachmentId)) return null
  const mediaType = ATTACHABLE_IMAGE_TYPES.has(value.mediaType) ? value.mediaType : 'image/png'
  const number = (candidate) => (Number.isFinite(candidate) && candidate > 0 ? Math.round(candidate) : 0)
  const name = safeAttachmentName(value.name)
  return {
    attachmentId,
    mediaType,
    bytes: number(value.bytes),
    width: number(value.width),
    height: number(value.height),
    ...(name ? { name } : {}),
  }
}

/** Validate one durable generic file reference from a session message part. */
export function normalizeFileRef(value) {
  if (!value || typeof value !== 'object') return null
  const attachmentId = typeof value.attachmentId === 'string' ? value.attachmentId : ''
  const name = safeAttachmentName(value.name)
  if (!ATTACHMENT_ID_PATTERN.test(attachmentId) || !name) return null
  const bytes = Number.isFinite(value.bytes) && value.bytes > 0 ? Math.round(value.bytes) : 0
  return { attachmentId, name, bytes }
}

function attachmentBytesToDataUrl(mediaType, bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const base64 = typeof btoa === 'function' ? btoa(binary) : ''
  return `data:${mediaType};base64,${base64}`
}

/**
 * Per-view image resolver: one object URL per attachment, revoked on dispose.
 * @param {{binding?: (id: string) => {session?: {readAttachment?: Function}}}|null} sessions
 * @param {string} sessionId
 */
export function createAttachmentResolver(sessions, sessionId) {
  const entries = new Map()
  const urls = new Set()

  const toUrl = (mediaType, data) => {
    const bytes = data instanceof Uint8Array ? data : Uint8Array.from(data || [])
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof Blob === 'function') {
      try {
        const url = URL.createObjectURL(new Blob([bytes], { type: mediaType }))
        urls.add(url)
        return url
      } catch {
        /* fall through to a data URL */
      }
    }
    return attachmentBytesToDataUrl(mediaType, bytes)
  }

  const sessionFor = () => {
    if (!sessions || typeof sessions.binding !== 'function' || !sessionId) return null
    try {
      const binding = sessions.binding(sessionId)
      return binding && binding.session && typeof binding.session.readAttachment === 'function' ? binding.session : null
    } catch {
      return null
    }
  }

  const load = (attachment) => {
    const ref = normalizeImageRef(attachment)
    if (!ref) return Promise.reject(new Error('invalid image attachment'))
    const existing = entries.get(ref.attachmentId)
    if (existing) return existing.promise
    const entry = { url: '', promise: null }
    entry.promise = (async () => {
      const session = sessionFor()
      if (!session) throw new Error('image attachments are unavailable in this view')
      const result = await session.readAttachment(ref)
      if (!result || result.ok !== true) {
        throw new Error(String((result && result.error && result.error.message) || 'image read failed'))
      }
      const stored = result.value || {}
      const storedRef = stored.attachment || {}
      const mediaType = ATTACHABLE_IMAGE_TYPES.has(storedRef.mediaType) ? storedRef.mediaType : ref.mediaType
      const url = toUrl(mediaType, stored.data)
      entry.url = url
      return url
    })().catch((error) => {
      entries.delete(ref.attachmentId)
      throw error
    })
    entries.set(ref.attachmentId, entry)
    return entry.promise
  }

  return {
    /** Already-resolved URL for this attachment, when available synchronously. */
    peek: (attachment) => {
      const ref = normalizeImageRef(attachment)
      return (ref && entries.get(ref.attachmentId) && entries.get(ref.attachmentId).url) || ''
    },
    load,
    dispose: () => {
      for (const url of urls) {
        try {
          URL.revokeObjectURL(url)
        } catch {
          /* already revoked */
        }
      }
      urls.clear()
      entries.clear()
    },
  }
}

/**
 * One durable image. Shows a quiet placeholder while the bytes load and a name
 * chip if the attachment cannot be resolved (expired session, old profile).
 */
export function AttachmentImage(props) {
  const attachment = normalizeImageRef(props && props.attachment)
  const resolver = (props && props.resolver) || null
  const [src, setSrc] = React.useState(() => (attachment && resolver ? resolver.peek(attachment) : ''))
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => {
    if (!attachment || !resolver) {
      setFailed(true)
      return undefined
    }
    const cached = resolver.peek(attachment)
    if (cached) {
      setSrc(cached)
      return undefined
    }
    let live = true
    resolver
      .load(attachment)
      .then((url) => {
        if (live) setSrc(url)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [attachment && attachment.attachmentId, resolver])
  const label = (props && props.alt) || (attachment && attachment.name) || 'image'
  if (failed) return attachmentEl('span', { className: 'rd-chat-image-failed', title: label }, label)
  if (!src) return attachmentEl('span', { className: 'rd-chat-image-loading', 'aria-label': label })
  return attachmentEl(
    'a',
    { className: 'rd-chat-image', href: src, target: '_blank', rel: 'noreferrer', title: label },
    attachmentEl('img', { src, alt: label, loading: 'lazy', decoding: 'async', draggable: false }),
  )
}

/** Human file size for attachment cards. */
export function formatBytes(value) {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function attachmentFileExtension(name) {
  const match = String(name || '').match(/\.([a-z0-9]{1,6})$/i)
  return match ? match[1].toUpperCase() : ''
}

/**
 * Generic file attachment card. Files are not read into the browser by the
 * Session API, so the card reports name, type and size and leaves the bytes to
 * the native conversation page.
 */
export function AttachmentFileCard(props) {
  const file = normalizeFileRef(props && props.file)
  if (!file) return null
  return attachmentEl(
    'div',
    { className: 'rd-chat-file', title: file.name },
    attachmentEl('span', { className: 'rd-chat-file-ext', 'aria-hidden': 'true' }, attachmentFileExtension(file.name) || 'FILE'),
    attachmentEl('span', { className: 'rd-chat-file-name' }, file.name),
    attachmentEl('span', { className: 'rd-chat-file-size' }, formatBytes(file.bytes)),
  )
}
