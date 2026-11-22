const BASE = '/dsh-reader-live'

async function request(path, init) {
  const res = await fetch(BASE + path, init)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error((data && data.error) || 'HTTP ' + res.status)
  return data
}

export const api = {
  list(sessionId, dir) {
    return request(`/api/list?sessionId=${encodeURIComponent(sessionId || '')}&dir=${encodeURIComponent(dir || '.')}`)
  },
  session(sessionId) {
    return request(`/api/session?sessionId=${encodeURIComponent(sessionId || '')}`)
  },
  fetchBytes(sessionId, path) {
    const url = `${BASE}/api/file?sessionId=${encodeURIComponent(sessionId || '')}&path=${encodeURIComponent(path)}`
    return fetch(url).then(async (res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const bytes = await res.arrayBuffer()
      return { bytes, fingerprint: res.headers.get('x-doc-fingerprint') || '' }
    })
  },
  fileUrl(sessionId, path) {
    return `${BASE}/api/file?sessionId=${encodeURIComponent(sessionId || '')}&path=${encodeURIComponent(path)}`
  },
  getStore(sessionId) {
    return request(`/api/store?sessionId=${encodeURIComponent(sessionId || '')}`)
  },
  saveStore(sessionId, store) {
    return request(`/api/store?sessionId=${encodeURIComponent(sessionId || '')}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ store }),
    })
  },
  guide(sessionId, payload) {
    return request(`/api/guide?sessionId=${encodeURIComponent(sessionId || '')}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  async guideStream(sessionId, payload, options = {}) {
    const url = `${BASE}/api/guide?sessionId=${encodeURIComponent(sessionId || '')}&stream=1`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: options.signal,
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error((data && data.error) || 'HTTP ' + res.status)
    }
    const type = (res.headers && res.headers.get && res.headers.get('content-type')) || ''
    if (!type.includes('ndjson')) return res.json()
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let result = null
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let index
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).trim()
        buffer = buffer.slice(index + 1)
        if (!line) continue
        const event = JSON.parse(line)
        if (event.type === 'progress' && options.onProgress) options.onProgress(event)
        else if (event.type === 'done') result = event
        else if (event.type === 'error') throw new Error(event.error)
      }
    }
    if (!result) throw new Error('guide stream ended without a result')
    return result
  },
  ask(sessionId, payload) {
    return request(`/api/concept/ask?sessionId=${encodeURIComponent(sessionId || '')}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  exportStore(sessionId) {
    const url = `${BASE}/api/export?sessionId=${encodeURIComponent(sessionId || '')}`
    return fetch(url).then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return res.blob()
    })
  },
  importStore(sessionId, store) {
    return request(`/api/import?sessionId=${encodeURIComponent(sessionId || '')}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ store }),
    })
  },
  translate(sessionId, payload) {
    return request(`/api/translate?sessionId=${encodeURIComponent(sessionId || '')}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  models(sessionId) {
    return request(`/api/models?sessionId=${encodeURIComponent(sessionId || '')}`)
  },
  backups(sessionId) {
    return request(`/api/backups?sessionId=${encodeURIComponent(sessionId || '')}`)
  },
  restore(sessionId) {
    return request(`/api/restore?sessionId=${encodeURIComponent(sessionId || '')}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
  },
  mutate(sessionId, op) {
    return request(`/api/mutate?sessionId=${encodeURIComponent(sessionId || '')}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(op),
    })
  },
  explain(sessionId, payload) {
    return request(`/api/explain?sessionId=${encodeURIComponent(sessionId || '')}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
}
