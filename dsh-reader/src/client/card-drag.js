/**
 * Clamp a dragged card to the reader surface.
 *
 * The card keeps its full rendered height inside the bounds; using the max
 * height instead would confine short cards to the upper half.
 */
export function clampCardPosition({ left, top, width, height }, bounds, options = {}) {
  const margin = Number.isFinite(options.margin) ? options.margin : 8
  const topOffset = Number.isFinite(options.topOffset) ? options.topOffset : 52
  const edge = Number.isFinite(options.edge) ? options.edge : 4
  const minLeft = bounds.left + edge
  const maxLeft = Math.max(minLeft, bounds.right - width - margin)
  const minTop = bounds.top + topOffset
  const maxTop = Math.max(minTop, bounds.bottom - height - margin)
  return {
    left: Math.min(Math.max(left, minLeft), maxLeft),
    top: Math.min(Math.max(top, minTop), maxTop),
  }
}
