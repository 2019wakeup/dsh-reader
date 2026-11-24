/**
 * Decode a text file the way Windows users actually save them: UTF-8 (with or
 * without BOM), UTF-16 with BOM, and the GBK/GB18030 family used by older
 * Chinese editors. Falls back to UTF-8 replacement characters when nothing
 * matches, so opening never blocks on encoding.
 * @param {ArrayBuffer|Uint8Array} bytes file bytes
 */
export function decodeText(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (u8.length >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(u8.subarray(3))
  }
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(u8.subarray(2))
  }
  if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(u8.subarray(2))
  }
  // BOM-less UTF-16: ASCII-heavy text has a NUL in every other byte.
  if (u8.length >= 4 && u8[1] === 0 && u8[3] === 0 && u8[0] !== 0) {
    return new TextDecoder('utf-16le').decode(u8)
  }
  if (u8.length >= 4 && u8[0] === 0 && u8[2] === 0 && u8[1] !== 0) {
    return new TextDecoder('utf-16be').decode(u8)
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(u8)
  } catch {
    try {
      return new TextDecoder('gb18030').decode(u8)
    } catch {
      return new TextDecoder('utf-8').decode(u8)
    }
  }
}
