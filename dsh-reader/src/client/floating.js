/**
 * Place a floating panel next to an anchor without leaving the reader surface.
 * Bounds come from the reader root, not the window, because DSH chrome and
 * side panels can shrink the reading area.
 *
 * @param {{anchor: {left:number,top:number,right?:number,bottom?:number,width?:number,height?:number},
 *          width?: number, height?: number,
 *          bounds: {left:number,top:number,right:number,bottom:number,width?:number,height?:number},
 *          margin?: number, gap?: number, topOffset?: number}} input
 */
export function panelPosition(input) {
  const margin = input.margin || 8
  const gap = input.gap || 10
  const topOffset = input.topOffset || 52
  const bounds = input.bounds
  const anchor = input.anchor
  const anchorWidth = Number.isFinite(anchor.width) ? anchor.width : (anchor.right || anchor.left) - anchor.left
  const anchorHeight = Number.isFinite(anchor.height) ? anchor.height : (anchor.bottom || anchor.top) - anchor.top
  const availableWidth = Math.max(160, bounds.right - bounds.left - margin * 2)
  const width = Math.min(input.width || 330, availableWidth)
  const height = Math.min(input.height || 260, Math.max(140, bounds.bottom - bounds.top - topOffset - margin))

  const anchorRight = Number.isFinite(anchor.right) ? anchor.right : anchor.left + anchorWidth
  const anchorBottom = Number.isFinite(anchor.bottom) ? anchor.bottom : anchor.top + anchorHeight
  let left = anchorRight + gap
  if (left + width > bounds.right - margin) {
    left = anchor.left - width - gap
  }
  if (left < bounds.left + margin) {
    left = anchor.left + anchorWidth / 2 - width / 2
  }
  left = Math.min(Math.max(left, bounds.left + margin), bounds.right - margin - width)

  const belowTop = anchorBottom + gap
  const aboveTop = anchor.top - height - gap
  let top = bounds.bottom - margin - height >= belowTop ? belowTop : aboveTop
  top = Math.min(Math.max(top, bounds.top + topOffset), bounds.bottom - margin - height)

  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(width),
    height: Math.round(height),
    maxHeight: Math.round(height),
  }
}
