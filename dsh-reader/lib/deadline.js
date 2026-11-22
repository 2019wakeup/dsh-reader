/**
 * One abort deadline for one outbound model call.
 *
 * The reader calls the model from a plain HTTP handler, not from an agent turn,
 * so nothing upstream bounds the call: a provider stream that stops producing
 * chunks without finishing or erroring leaves the `for await` loop waiting
 * forever, the route never replies, and the reader's pending card spins with no
 * way out. A deadline turns that state into an error the caller can report.
 *
 * The signal fires on whichever comes first — the caller's own abort (a closed
 * tab, a streamed response the client dropped) or our timeout — and
 * `timedOut` remembers which one, so the caller can tell "we gave up" apart
 * from "the caller went away".
 *
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {{ signal: AbortSignal, readonly timedOut: boolean, dispose: () => void }}
 */
export function createDeadline({ timeoutMs = 0, signal: parent } = {}) {
  const controller = new AbortController()
  let timedOut = false
  let timer = null

  const forward = () => controller.abort(parent?.reason)
  if (parent) {
    if (parent.aborted) forward()
    else parent.addEventListener('abort', forward, { once: true })
  }

  if (timeoutMs > 0) {
    timer = setTimeout(() => {
      timedOut = true
      controller.abort(new Error(`model call timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  }

  return {
    signal: controller.signal,
    get timedOut() {
      return timedOut
    },
    dispose() {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      if (parent) parent.removeEventListener('abort', forward)
    },
  }
}
