import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import {
  attachmentNameFor,
  buildAssetQuoteSuffix,
  collectSelectionAssets,
  prepareSelectionFiles,
} from '../src/client/selection-assets.js'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost' })
const document = dom.window.document

function contentFixture() {
  const root = document.createElement('div')
  root.innerHTML = [
    '<p>选区之前的段落</p>',
    '<div id="body">正文里有一张图',
    '<figure><img src="/dsh-reader-live/api/file?sessionId=s1&path=arch.png" alt="架构图"><figcaption>图 1 系统架构</figcaption></figure>',
    '<svg aria-label="箭头示意"><rect width="12" height="12"></rect></svg>',
    '<math><mi>x</mi><annotation encoding="application/x-tex">x^2+y^2</annotation></math>',
    '</div>',
    '<p>选区之后的段落</p>',
  ].join('')
  document.body.appendChild(root)
  return root
}

function selectAllOf(element) {
  const range = document.createRange()
  range.selectNodeContents(element)
  return range
}

test('选区内的图片、SVG 与公式被识别，选区外的不算', () => {
  const root = contentFixture()
  const body = root.querySelector('#body')
  const assets = collectSelectionAssets(selectAllOf(body), root)
  const kinds = assets.map((asset) => asset.kind)
  assert.deepEqual(kinds, ['image', 'svg', 'formula'])
  const image = assets.find((asset) => asset.kind === 'image')
  assert.match(image.src, /arch\.png/)
  assert.equal(image.alt, '架构图')
  assert.equal(image.caption, '图 1 系统架构')
  const formula = assets.find((asset) => asset.kind === 'formula')
  assert.equal(formula.tex, 'x^2+y^2')
  const svg = assets.find((asset) => asset.kind === 'svg')
  assert.match(svg.markup, /<rect/)
})

test('图像被 fetch 成 File，内联 SVG 直接序列化为文件', async () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const fetchImpl = async (url) => {
    assert.match(String(url), /arch\.png/)
    return { ok: true, blob: async () => new Blob([png], { type: 'image/png' }) }
  }
  const files = await prepareSelectionFiles(
    [
      { kind: 'image', src: '/dsh-reader-live/api/file?path=arch.png', alt: '架构图' },
      { kind: 'svg', markup: '<svg><rect></rect></svg>', alt: '箭头示意' },
      { kind: 'formula', tex: 'x^2' },
    ],
    { fetchImpl },
  )
  assert.equal(files.length, 2, 'formula has no bytes to attach')
  assert.equal(files[0].type, 'image/png')
  assert.match(files[0].name, /^架构图.*\.png$/)
  assert.equal(files[1].type, 'image/svg+xml')
  assert.match(files[1].name, /^箭头示意.*\.svg$/)
})

test('无法读取的图片被跳过，不会抛错', async () => {
  const fetchImpl = async () => {
    throw new Error('network down')
  }
  const files = await prepareSelectionFiles([{ kind: 'image', src: 'https://x/y.png', alt: '坏图' }], { fetchImpl })
  assert.deepEqual(files, [])
})

test('引用后缀描述图形并内嵌公式源码', () => {
  const suffix = buildAssetQuoteSuffix(
    [
      { kind: 'image', alt: '架构图' },
      { kind: 'svg', alt: '箭头示意' },
      { kind: 'formula', tex: 'x^2+y^2' },
    ],
    (key) => `[${key}]`,
  )
  assert.match(suffix, /\[label\.selectionAssetsNote\]：架构图、箭头示意/)
  assert.match(suffix, /\$x\^2\+y\^2\$/)
  assert.equal(buildAssetQuoteSuffix([], (key) => key), '')
  assert.equal(buildAssetQuoteSuffix([{ kind: 'formula', tex: '' }], (key) => key), '')
})

test('附件文件名带安全扩展名且不含路径字符', () => {
  assert.match(attachmentNameFor({ alt: 'a/b:c' }, 0, 'image/png'), /^a b c.*\.png$/)
  assert.match(attachmentNameFor({ caption: '' }, 3, 'image/svg+xml'), /^选中图形4\.svg$/)
})
