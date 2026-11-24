const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'
const RING_CLASS = 'rd-jump-ring'
const RING_STATIC_CLASS = 'rd-jump-ring-static'
const TRACK_MS = 600
const ratio = (value) => `${Math.round(Math.min(0.85, Math.max(0.15, value)) * 100)}%`

function rectOf(value) {
  if (!value) return { left: 0, top: 0, width: 0, height: 0 }
  return { left: value.left || 0, top: value.top || 0, width: value.width || 0, height: value.height || 0 }
}

export function prefersReducedMotion(media) {
  if (media && typeof media.matches === 'boolean') return media.matches
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && Boolean(window.matchMedia(REDUCE_QUERY).matches)
  } catch {
    return false
  }
}

export function motionEnabled(prefs, media) {
  return (!prefs || prefs.motion !== 'off') && !prefersReducedMotion(media)
}

export function anchorOrigin(anchor, panel) {
  const a = rectOf(anchor)
  const p = rectOf(panel)
  return {
    x: ratio(p.width > 0 ? (a.left + a.width / 2 - p.left) / p.width : 0.5),
    y: ratio(p.height > 0 ? (a.top + a.height / 2 - p.top) / p.height : 0.5),
  }
}

export function edgeOrigin(anchor, panel, side = 'above') {
  return { ...anchorOrigin(anchor, panel), y: side === 'above' ? '100%' : '0%' }
}

export function originVars(origin) {
  return { '--rd-origin-x': (origin && origin.x) || '50%', '--rd-origin-y': (origin && origin.y) || '50%' }
}

export function staggerDelay(index, step = 6, max = 140) {
  return Math.min(Math.max(0, Number(step) || 0) * Math.max(0, Number(index) || 0), Math.max(0, Number(max) || 0))
}

export function drawerWidthMotion(doc, maxBytes = 200 * 1024) {
  if (!doc) return true
  if (doc.ext === '.pdf') return false
  return (Number(doc.size ?? (doc.bytes && doc.bytes.byteLength)) || 0) <= maxBytes
}

export function markMotionIn(element, options = {}) {
  if (!element || !element.dataset) return null
  if (options.enabled === false || element.dataset.motion === 'in') return element
  if (options.origin && element.style) {
    for (const [name, value] of Object.entries(originVars(options.origin))) element.style.setProperty(name, value)
  }
  if (options.side) element.dataset.side = options.side
  element.dataset.motion = 'in'
  return element
}

function removeNode(node) {
  if (node && node.parentNode) node.parentNode.removeChild(node)
}

function ringDoc(doc) {
  return doc || (typeof document !== 'undefined' ? document : null)
}

function ringScope(doc, root) {
  if (root && root.querySelectorAll) return root
  return doc && doc.querySelector ? doc.querySelector('.rd-root') : null
}

export function clearJumpRing(doc, root) {
  const scope = ringScope(ringDoc(doc), root)
  if (!scope || !scope.querySelectorAll) return 0
  const nodes = [...scope.querySelectorAll(`.${RING_CLASS}`)]
  for (const node of nodes) removeNode(node)
  return nodes.length
}

function rectOfTarget(target) {
  if (!target || typeof target.getBoundingClientRect !== 'function') return null
  return rectOf(target.getBoundingClientRect())
}

function positionRing(ring, rect, padding) {
  ring.style.left = `${Math.round(rect.left - padding)}px`
  ring.style.top = `${Math.round(rect.top - padding)}px`
  ring.style.width = `${Math.round(Math.max(8, rect.width) + padding * 2)}px`
  ring.style.height = `${Math.round(Math.max(8, rect.height) + padding * 2)}px`
}

// enabled:false = reduced-motion static outline (no animation, staticMs cleanup).
export function pulseTarget(target, options = {}) {
  const doc = ringDoc(options.doc)
  if (!doc || !target) return null
  const root = ringScope(doc, options.root)
  if (!root || !root.appendChild) return null
  const enabled = options.enabled === undefined ? motionEnabled(null, options.media) : Boolean(options.enabled)
  clearJumpRing(doc, root)
  const first = rectOfTarget(target)
  if (!first) return null
  const padding = options.padding ?? 4
  const ring = doc.createElement('div')
  ring.className = enabled ? RING_CLASS : `${RING_CLASS} ${RING_STATIC_CLASS}`
  ring.setAttribute('aria-hidden', 'true')
  positionRing(ring, first, padding)
  root.appendChild(ring)
  let disposed = false
  const cleanup = () => {
    if (disposed) return
    disposed = true
    removeNode(ring)
  }
  if (!enabled) {
    setTimeout(cleanup, options.staticMs || 600)
    return ring
  }
  ring.addEventListener('animationend', cleanup, { once: true })
  setTimeout(cleanup, options.timeoutMs || 900)
  const win = doc.defaultView
  const frame = win && typeof win.requestAnimationFrame === 'function' ? win.requestAnimationFrame.bind(win) : null
  if (options.track !== false && frame) {
    const started = Date.now()
    let previous = ''
    let stable = 0
    const step = () => {
      if (disposed || Date.now() - started > TRACK_MS) return
      const next = rectOfTarget(target)
      if (next) {
        const signature = [next.left, next.top, next.width, next.height].map((value) => Math.round(value)).join(':')
        positionRing(ring, next, padding)
        stable = signature === previous ? stable + 1 : 0
        previous = signature
        if (stable >= 2) return
      }
      frame(step)
    }
    frame(step)
  }
  return ring
}

export const pulseRange = pulseTarget
export const pulseElement = pulseTarget
