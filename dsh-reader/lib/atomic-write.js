import fs from 'node:fs/promises'
import path from 'node:path'

const RETRY_DELAYS = [50, 150]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Replace `file` with `tmp`, tolerating transient Windows locks.
 *
 * `fs.rename` over a file held by Word, OneDrive or a virus scanner can fail
 * with EPERM/EBUSY. Retry briefly, then fall back to copying the bytes so the
 * user's annotation is not lost.
 * @param {string} tmp temporary file that already holds the new bytes
 * @param {string} file destination file
 */
export async function replaceFile(tmp, file) {
  let lastError
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt += 1) {
    try {
      await fs.rename(tmp, file)
      return
    } catch (error) {
      lastError = error
      if (attempt < RETRY_DELAYS.length) await sleep(RETRY_DELAYS[attempt])
    }
  }
  try {
    await fs.copyFile(tmp, file)
    await fs.rm(tmp, { force: true })
  } catch (error) {
    await fs.rm(tmp, { force: true }).catch(() => {})
    throw lastError || error
  }
}

/**
 * Write a file through a sibling temp file plus `replaceFile`.
 * @param {string} file destination file
 * @param {string} data UTF-8 payload
 */
export async function writeFileAtomic(file, data) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  await fs.mkdir(path.dirname(file), { recursive: true })
  try {
    await fs.writeFile(tmp, data, 'utf8')
  } catch (error) {
    await fs.rm(tmp, { force: true }).catch(() => {})
    throw error
  }
  await replaceFile(tmp, file)
}
