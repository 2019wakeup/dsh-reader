/**
 * One keyboard mapping for the reader. Editable controls keep their own keys.
 * @param {{key?: string, metaKey?: boolean, ctrlKey?: boolean, altKey?: boolean, shiftKey?: boolean}} event
 * @param {{editable?: boolean, pageKeys?: 'arrows'|'jk'}} [context]
 * @returns {'next'|'prev'|'undo'|'redo'|'help'|null}
 */
export function shortcutFor(event, context = {}) {
  if (!event || context.editable) return null
  const key = String(event.key || '')
  const modifier = Boolean(event.metaKey || event.ctrlKey)
  if (modifier && !event.altKey && key.toLowerCase() === 'z') {
    return event.shiftKey ? 'redo' : 'undo'
  }
  if (modifier && !event.altKey && key.toLowerCase() === 'f') return 'search'
  if (modifier || event.altKey) return null
  if (key === 'ArrowRight' || key === 'PageDown' || key === ' ') return 'next'
  if (key === 'ArrowLeft' || key === 'PageUp') return 'prev'
  if (context.pageKeys === 'jk') {
    if (key === 'j') return 'next'
    if (key === 'k') return 'prev'
  }
  if (key === '?') return 'help'
  return null
}
