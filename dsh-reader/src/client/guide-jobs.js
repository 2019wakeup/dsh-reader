/**
 * Guide jobs outlive the ReaderView.
 *
 * Switching to the conversation page unmounts the reader; aborting the stream
 * there threw away both the model work and the progress UI. A job keeps the
 * fetch alive, stores the latest progress/result, and lets a remounted reader
 * subscribe again.
 */

const jobs = new Map()

/** Latest job for a document, or null. */
export function guideJobFor(key) {
  return jobs.get(key) || null
}

/**
 * Start (or replace) a guide job for one document.
 * @param {string} key document fingerprint
 * @param {(tools: {signal: AbortSignal, report: (progress: object) => void}) => Promise<{guide?: object, store?: object, reused?: number}>} runner
 */
export function startGuideJob(key, runner) {
  const previous = jobs.get(key)
  if (previous && previous.state.busy) previous.abort()

  const listeners = new Set()
  const controller = new AbortController()
  const state = {
    busy: true,
    progress: null,
    error: '',
    cancelled: false,
    guide: null,
    store: null,
    reused: 0,
  }
  const emit = () => {
    for (const listener of [...listeners]) {
      try {
        listener(state)
      } catch {
        /* a listener must not break the job */
      }
    }
  }
  const job = {
    key,
    state,
    subscribe(listener) {
      listeners.add(listener)
      listener(state)
      return () => listeners.delete(listener)
    },
    abort() {
      if (!state.busy) return
      state.cancelled = true
      state.busy = false
      state.progress = null
      controller.abort()
      emit()
    },
  }
  jobs.set(key, job)

  const report = (progress) => {
    if (!state.busy || state.cancelled) return
    state.progress = progress
    emit()
  }

  Promise.resolve(runner({ signal: controller.signal, report }))
    .then((result) => {
      if (state.cancelled) return
      state.busy = false
      state.progress = null
      state.guide = (result && result.guide) || null
      state.store = (result && result.store) || null
      state.reused = Number(result && result.reused) || 0
      emit()
    })
    .catch((error) => {
      if (state.cancelled) return
      state.busy = false
      state.progress = null
      state.error = String((error && error.message) || error)
      emit()
    })

  return job
}
