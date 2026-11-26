import test from 'node:test'
import assert from 'node:assert/strict'
import { translationErrorInfo, translationRetryDelay } from '../src/client/translation-errors.js'

const t = (key) => key

test('classifies model, rate limit, timeout and storage failures', () => {
  assert.equal(translationErrorInfo({ status: 503 }, t).code, 'no_model')
  assert.equal(translationErrorInfo({ status: 503 }, t).retryable, false)
  assert.equal(translationErrorInfo({ status: 429 }, t).code, 'rate_limited')
  assert.equal(translationErrorInfo({ status: 429 }, t).retryable, true)
  assert.equal(translationErrorInfo({ code: 'timeout' }, t).code, 'timeout')
  assert.equal(translationErrorInfo({ status: 423 }, t).code, 'store_locked')
  assert.equal(translationErrorInfo({ status: 423 }, t).retryable, false)
  assert.equal(translationErrorInfo({ status: 500 }, t).code, 'network')
})

test('retry delay backs off and honors rate limits', () => {
  assert.equal(translationRetryDelay('network', 1), 800)
  assert.equal(translationRetryDelay('network', 2), 2000)
  assert.equal(translationRetryDelay('rate_limited', 1), 1500)
  assert.equal(translationRetryDelay('rate_limited', 2), 4000)
})
