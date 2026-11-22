import test from 'node:test'
import assert from 'node:assert/strict'
import { unzip, inflate, zipText } from '../src/client/epub.js'

function buildStoredZip(name, text) {
  const enc = new TextEncoder()
  const nameBytes = enc.encode(name)
  const data = enc.encode(text)
  const local = new Uint8Array(30 + nameBytes.length + data.length)
  const lv = new DataView(local.buffer)
  lv.setUint32(0, 0x04034b50, true)
  lv.setUint16(4, 20, true)
  lv.setUint16(8, 0, true)
  lv.setUint32(18, data.length, true)
  lv.setUint32(22, data.length, true)
  lv.setUint16(26, nameBytes.length, true)
  local.set(nameBytes, 30)
  local.set(data, 30 + nameBytes.length)

  const central = new Uint8Array(46 + nameBytes.length)
  const cv = new DataView(central.buffer)
  cv.setUint32(0, 0x02014b50, true)
  cv.setUint16(4, 20, true)
  cv.setUint16(6, 20, true)
  cv.setUint32(20, data.length, true)
  cv.setUint32(24, data.length, true)
  cv.setUint16(28, nameBytes.length, true)
  central.set(nameBytes, 46)

  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, 1, true)
  ev.setUint16(10, 1, true)
  ev.setUint32(12, central.length, true)
  ev.setUint32(16, local.length, true)

  const out = new Uint8Array(local.length + central.length + eocd.length)
  out.set(local, 0)
  out.set(central, local.length)
  out.set(eocd, local.length + central.length)
  return out
}

test('reads a stored zip entry', async () => {
  const files = await unzip(buildStoredZip('a.txt', 'hello'))
  assert.ok(files.has('a.txt'))
  assert.equal(new TextDecoder().decode(await inflate(files.get('a.txt'))), 'hello')
})

test('decodes zip text through zipText', async () => {
  const files = await unzip(buildStoredZip('dir/b.txt', '世界'))
  assert.equal(await zipText(files, 'dir/b.txt'), '世界')
})

test('rejects a non-zip buffer', async () => {
  await assert.rejects(() => unzip(new Uint8Array([1, 2, 3, 4])), /not a zip/)
})
