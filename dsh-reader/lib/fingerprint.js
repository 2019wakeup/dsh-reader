import { createHash } from 'node:crypto'

/**
 * Stable document identity from cheap content sampling: size plus the first
 * and last 4 KiB. Survives renames and moves.
 * @param {Uint8Array|ArrayBuffer} bytes document bytes
 */
export function docFingerprint(bytes) {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const hash = createHash('sha256')
  hash.update(String(buffer.length))
  hash.update(buffer.subarray(0, 4096))
  hash.update(buffer.subarray(Math.max(0, buffer.length - 4096)))
  return hash.digest('hex')
}
