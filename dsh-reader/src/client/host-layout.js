/**
 * Size the reader surface to the space the host actually grants it.
 *
 * `styles.js` gives the root `height: 100%`, which only resolves when every
 * ancestor has a definite height. DSH renders `conversation.view` slot content
 * inside a content-sized wrapper, so that percentage collapses to `auto`; the
 * root then grows to its content height and every `overflow: auto` pane inside
 * it (main text, drawer body) stops being a scroll container. Measuring the
 * nearest clipping / scroll ancestor and pinning the root to that box keeps the
 * internal layout intact without touching host CSS.
 *
 * @param {HTMLElement | null} node
 * @param {number} [viewportHeight]
 * @returns {number} height in CSS pixels available to `node`, 0 when unknown
 */
function bottomOverlay(scroller, node) {
  if (!scroller) return 0
  const scrollerRect = scroller.getBoundingClientRect()
  let reserve = 0
  for (const child of scroller.children) {
    if (child === node || child.contains(node)) continue
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(child) : null
    if (!style) continue
    if (style.position !== 'sticky' && style.position !== 'fixed') continue
    if (style.display === 'none' || style.visibility === 'hidden') continue
    const rect = child.getBoundingClientRect()
    if (rect.height <= 0) continue
    // Only reserve elements anchored to the visible bottom of the scroller
    // (DSH's sticky composer seat lives there and would otherwise add a
    // second, outer scrollbar on top of the reader's own panes).
    if (rect.bottom >= scrollerRect.bottom - 8 && rect.bottom <= scrollerRect.bottom + 8) {
      reserve = Math.max(reserve, rect.height)
    }
  }
  return reserve
}

export function hostAvailableHeight(node, viewportHeight) {
  if (!node || typeof node.getBoundingClientRect !== 'function') return 0
  const viewport = Number.isFinite(viewportHeight)
    ? viewportHeight
    : typeof window !== 'undefined' && Number.isFinite(window.innerHeight)
      ? window.innerHeight
      : 0
  let bottom = viewport
  let scroller = null
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(parent) : null
    if (!style) break
    const overflowY = style.overflowY || ''
    const overflowX = style.overflowX || ''
    const clips = overflowY !== 'visible' || overflowX !== 'visible'
    if (clips) {
      const rect = parent.getBoundingClientRect()
      const padBottom = parseFloat(style.paddingBottom) || 0
      const scrollbar = Math.max(0, (parent.offsetHeight || 0) - (parent.clientHeight || 0))
      const candidate = rect.bottom - padBottom - scrollbar
      if (candidate > 0 && candidate < bottom) bottom = candidate
      // The nearest scroll container already bounds everything above it.
      if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
        scroller = parent
        break
      }
    }
  }
  const top = node.getBoundingClientRect().top
  return Math.max(0, Math.floor(bottom - top - bottomOverlay(scroller, node)))
}

/**
 * Pin `node` to the height measured by `hostAvailableHeight`, leaving it alone
 * when it already agrees (so a host that does hand out a definite height is not
 * overridden with a stale pixel value).
 *
 * @param {HTMLElement | null} node
 * @param {number} [viewportHeight]
 * @returns {number} applied height, 0 when nothing was applied
 */
export function fitHostHeight(node, viewportHeight) {
  const available = hostAvailableHeight(node, viewportHeight)
  if (!available) return 0
  const current = node.getBoundingClientRect().height
  if (node.style.height === `${available}px`) return available
  if (Math.abs(current - available) <= 1 && node.style.height) return available
  node.style.height = `${available}px`
  return available
}
