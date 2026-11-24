import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeText } from '../src/client/text-decode.js'

test('decodes UTF-8 with and without BOM', () => {
  const text = new TextEncoder().encode('你好，世界')
  assert.equal(decodeText(text), '你好，世界')
  const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...text])
  assert.equal(decodeText(bom), '你好，世界')
})

test('decodes UTF-16LE and UTF-16BE with BOM', () => {
  const le = new Uint8Array([0xff, 0xfe, 0x2d, 0x4e, 0x87, 0x65])
  const be = new Uint8Array([0xfe, 0xff, 0x4e, 0x2d, 0x65, 0x87])
  assert.equal(decodeText(le), '中文')
  assert.equal(decodeText(be), '中文')
})

test('falls back to GB18030 for legacy Chinese text', () => {
  const gbk = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4])
  assert.equal(decodeText(gbk), '中文')
})

test('accepts an ArrayBuffer', () => {
  const bytes = new TextEncoder().encode('plain')
  assert.equal(decodeText(bytes.buffer), 'plain')
})
