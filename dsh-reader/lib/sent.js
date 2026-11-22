/** Record one outbound model request for the "recently sent" view. */
export function recordSent(store, entry) {
  if (!store.debug || typeof store.debug !== 'object') store.debug = {}
  const list = Array.isArray(store.debug.lastSent) ? store.debug.lastSent : []
  list.push({
    at: Date.now(),
    kind: String(entry.kind || 'explain'),
    preview: String(entry.preview || '').slice(0, 120),
    chars: Number.isFinite(entry.chars) ? entry.chars : 0,
  })
  store.debug.lastSent = list.slice(-10)
  return store
}

export function recentSent(store) {
  return (store && store.debug && Array.isArray(store.debug.lastSent) ? store.debug.lastSent : []).slice(-10).reverse()
}
