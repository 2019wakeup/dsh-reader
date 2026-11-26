/**
 * Map a Host/network failure to a stable code, a user-facing message and a
 * retry policy. Kept pure so the client queue and tests agree on the rules.
 */
export function translationErrorInfo(error, t) {
  const status = Number(error?.status) || 0
  const code = String(error?.code || '')
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { code: 'offline', retryable: true, message: t('label.translateOffline') }
  }
  if (status === 429 || code === 'rate_limited') {
    return { code: 'rate_limited', retryable: true, message: t('label.translateRateLimited') }
  }
  if (status === 503 || code === 'no_model' || /no model/i.test(String(error?.message || ''))) {
    return { code: 'no_model', retryable: false, message: t('label.translateNoModel') }
  }
  if (status === 504 || code === 'timeout' || error?.name === 'AbortError') {
    return { code: 'timeout', retryable: true, message: t('label.translateTimeout') }
  }
  if (status === 423 || code === 'store_locked') {
    return { code: 'store_locked', retryable: false, message: t('label.translateStoreLocked') }
  }
  return { code: 'network', retryable: true, message: t('label.translateError') }
}

/** Backoff for the in-flight batch; attempt is 1-based after increment. */
export function translationRetryDelay(code, attempt) {
  if (code === 'rate_limited') return attempt <= 1 ? 1500 : 4000
  return attempt <= 1 ? 800 : 2000
}
