import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHTML } from 'linkedom'
import {
  anchorOrigin,
  edgeOrigin,
  originVars,
  staggerDelay,
  motionEnabled,
  prefersReducedMotion,
  drawerWidthMotion,
  pulseRange,
  pulseElement,
  clearJumpRing,
} from '../src/client/motion.js'

const ROOT_HTML = '<html><body><div class="rd-root"></div></body></html>'

function makeDom() {
  return parseHTML(ROOT_HTML)
}

function rect({ left = 0, top = 0, width = 0, height = 0 } = {}) {
  return { left, top, width, height }
}

/** linkedom has no layout; pass a hand-made Range-like target instead. */
function fakeTarget(box) {
  return { getBoundingClientRect: () => box }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function rings(document) {
  return document.querySelectorAll('.rd-jump-ring')
}

test('anchorOrigin clamps a word at the card top-left corner to 15%', () => {
  const anchor = rect({ left: 0, top: 0, width: 10, height: 10 })
  const panel = rect({ left: 100, top: 100, width: 200, height: 100 })
  assert.deepEqual(anchorOrigin(anchor, panel), { x: '15%', y: '15%' })
})

test('anchorOrigin clamps a word at the card bottom-right corner to 85%', () => {
  const anchor = rect({ left: 290, top: 190, width: 20, height: 20 })
  const panel = rect({ left: 100, top: 100, width: 200, height: 100 })
  assert.deepEqual(anchorOrigin(anchor, panel), { x: '85%', y: '85%' })
})

test('anchorOrigin clamps a word completely outside the panel into 15%-85%', () => {
  // Left of the panel and below it: the raw ratios are negative / above 1.
  const anchor = rect({ left: -200, top: 400, width: 30, height: 20 })
  const panel = rect({ left: 100, top: 100, width: 200, height: 100 })
  assert.deepEqual(anchorOrigin(anchor, panel), { x: '15%', y: '85%' })
  // Right of the panel and above it: the other two out-of-range corners.
  const above = rect({ left: 500, top: -80, width: 30, height: 20 })
  assert.deepEqual(anchorOrigin(above, panel), { x: '85%', y: '15%' })
})

test('anchorOrigin falls back to the centre for a zero-sized panel', () => {
  const anchor = rect({ left: 40, top: 40, width: 10, height: 10 })
  assert.deepEqual(anchorOrigin(anchor, rect()), { x: '50%', y: '50%' })
  assert.deepEqual(anchorOrigin(anchor, rect({ left: 30, top: 30 })), { x: '50%', y: '50%' })
  assert.deepEqual(anchorOrigin(null, null), { x: '50%', y: '50%' })
})

test('edgeOrigin grows from the bottom edge when the panel sits above', () => {
  const anchor = rect({ left: -120, top: 160, width: 10, height: 10 })
  const panel = rect({ left: 100, top: 100, width: 200, height: 80 })
  assert.deepEqual(edgeOrigin(anchor, panel, 'above'), { x: '15%', y: '100%' })
})

test('edgeOrigin grows from the top edge when the panel sits below', () => {
  const anchor = rect({ left: 500, top: 20, width: 10, height: 10 })
  const panel = rect({ left: 100, top: 100, width: 200, height: 80 })
  assert.deepEqual(edgeOrigin(anchor, panel, 'below'), { x: '85%', y: '0%' })
  // Default side is above; an anchor centred in the panel keeps x at 50%.
  const middle = rect({ left: 195, top: 60, width: 10, height: 10 })
  assert.deepEqual(edgeOrigin(middle, panel), { x: '50%', y: '100%' })
})

test('originVars exposes exactly the two CSS custom properties', () => {
  const vars = originVars({ x: '15%', y: '85%' })
  assert.deepEqual(Object.keys(vars), ['--rd-origin-x', '--rd-origin-y'])
  assert.deepEqual(vars, { '--rd-origin-x': '15%', '--rd-origin-y': '85%' })
})

test('originVars defaults both axes to the centre when the origin is missing', () => {
  assert.deepEqual(originVars(), { '--rd-origin-x': '50%', '--rd-origin-y': '50%' })
  assert.deepEqual(originVars(null), { '--rd-origin-x': '50%', '--rd-origin-y': '50%' })
})

test('staggerDelay multiplies the index by the step', () => {
  assert.equal(staggerDelay(0, 6, 140), 0)
  assert.equal(staggerDelay(1, 6, 140), 6)
  assert.equal(staggerDelay(3, 6, 140), 18)
  assert.equal(staggerDelay(10, 6, 140), 60)
})

test('staggerDelay truncates the delay at the maximum', () => {
  assert.equal(staggerDelay(30, 6, 140), 140)
  assert.equal(staggerDelay(1000, 6, 140), 140)
  assert.equal(staggerDelay(100, 6, 60), 60)
  assert.equal(staggerDelay(30, 6), 140)
})

test('staggerDelay keeps index 0 at zero delay', () => {
  assert.equal(staggerDelay(0), 0)
  assert.equal(staggerDelay(0, 6, 140), 0)
  assert.equal(staggerDelay(-3, 6, 140), 0)
})

test('motionEnabled is on by default', () => {
  assert.equal(motionEnabled(), true)
  assert.equal(motionEnabled(null), true)
  assert.equal(motionEnabled({ motion: 'system' }), true)
  assert.equal(motionEnabled({}, { matches: false }), true)
})

test('motionEnabled is off when prefs.motion is off', () => {
  assert.equal(motionEnabled({ motion: 'off' }), false)
  assert.equal(motionEnabled({ motion: 'off' }, { matches: false }), false)
})

test('motionEnabled is off when the OS asks for reduced motion', () => {
  assert.equal(motionEnabled(null, { matches: true }), false)
  assert.equal(motionEnabled({ motion: 'system' }, { matches: true }), false)
  assert.equal(prefersReducedMotion({ matches: true }), true)
})

test('drawerWidthMotion allows the width animation for markdown', () => {
  assert.equal(drawerWidthMotion({ ext: '.md', size: 12 * 1024 }), true)
  assert.equal(drawerWidthMotion({ ext: '.markdown', size: 1024 }), true)
  assert.equal(drawerWidthMotion(null), true)
})

test('drawerWidthMotion skips the width animation for PDFs', () => {
  assert.equal(drawerWidthMotion({ ext: '.pdf', size: 1024 }), false)
  assert.equal(drawerWidthMotion({ ext: '.pdf', size: 300 * 1024 }), false)
})

test('drawerWidthMotion skips the width animation for big documents', () => {
  const maxBytes = 200 * 1024
  assert.equal(drawerWidthMotion({ ext: '.md', size: maxBytes }), true)
  assert.equal(drawerWidthMotion({ ext: '.md', size: maxBytes + 1 }), false)
  assert.equal(drawerWidthMotion({ ext: '.md', size: 2 * 1024 * 1024 }), false)
})

test('pulseRange rings the target rect with a 4px pad', async () => {
  const { document } = makeDom()
  const target = fakeTarget(rect({ left: 100, top: 50, width: 60, height: 20 }))
  const ring = pulseRange(target, { doc: document, timeoutMs: 15, track: false })

  assert.ok(ring, 'a ring is returned')
  assert.equal(document.querySelector('.rd-root .rd-jump-ring'), ring)
  assert.match(ring.className, /(^| )rd-jump-ring( |$)/)
  assert.equal(ring.getAttribute('aria-hidden'), 'true')
  // Position and size are inline; fixed/pointer-events come from the CSS class.
  assert.equal(ring.style.left, '96px')
  assert.equal(ring.style.top, '46px')
  assert.equal(ring.style.width, '68px')
  assert.equal(ring.style.height, '28px')
  assert.equal(ring.style.pointerEvents, '')
  await sleep(40)
  assert.equal(rings(document).length, 0, 'the timeout fallback removed the ring')
})

test('pulseRange keeps only the newest ring on repeated calls', async () => {
  const { document } = makeDom()
  const first = fakeTarget(rect({ left: 100, top: 50, width: 60, height: 20 }))
  const second = fakeTarget(rect({ left: 300, top: 200, width: 40, height: 10 }))
  pulseRange(first, { doc: document, timeoutMs: 15, track: false })
  const ring = pulseRange(second, { doc: document, timeoutMs: 15, track: false })

  assert.equal(rings(document).length, 1)
  assert.equal(document.querySelector('.rd-jump-ring'), ring)
  assert.equal(ring.style.left, '296px')
  assert.equal(ring.style.top, '196px')
  assert.equal(ring.style.width, '48px')
  assert.equal(ring.style.height, '18px')
  await sleep(40)
  assert.equal(rings(document).length, 0)
})

test('pulseRange removes the ring on animationend', async () => {
  const { document, window } = makeDom()
  const target = fakeTarget(rect({ left: 100, top: 50, width: 60, height: 20 }))
  const ring = pulseRange(target, { doc: document, timeoutMs: 15, track: false })
  assert.equal(rings(document).length, 1)

  ring.dispatchEvent(new window.Event('animationend'))
  assert.equal(rings(document).length, 0)
  await sleep(40)
  assert.equal(rings(document).length, 0)
})

test('pulseRange removes the ring by timeout when no animationend fires', async () => {
  const { document } = makeDom()
  const target = fakeTarget(rect({ left: 100, top: 50, width: 60, height: 20 }))
  pulseRange(target, { doc: document, timeoutMs: 15, track: false })

  assert.equal(rings(document).length, 1)
  await sleep(40)
  assert.equal(rings(document).length, 0)
})

test('pulseRange falls back to a static ring when motion is disabled', async () => {
  const { document } = makeDom()
  const target = fakeTarget(rect({ left: 100, top: 50, width: 60, height: 20 }))
  const ring = pulseRange(target, {
    doc: document,
    enabled: false,
    staticMs: 15,
    track: false,
  })

  assert.ok(ring, 'reduced motion still shows the static ring')
  assert.match(ring.className, /(^| )rd-jump-ring-static( |$)/)
  assert.equal(rings(document).length, 1)
  await sleep(40)
  assert.equal(rings(document).length, 0, 'the static branch removes its own ring')
})

test('pulseRange uses the static branch when the OS reports reduced motion', async () => {
  const { document } = makeDom()
  const target = fakeTarget(rect({ left: 100, top: 50, width: 60, height: 20 }))
  const ring = pulseRange(target, {
    doc: document,
    media: { matches: true },
    staticMs: 15,
    track: false,
  })

  assert.ok(ring)
  assert.match(ring.className, /(^| )rd-jump-ring-static( |$)/)
  await sleep(40)
  assert.equal(rings(document).length, 0)
})

test('clearJumpRing removes every ring in the scope', async () => {
  const { document } = makeDom()
  const target = fakeTarget(rect({ left: 100, top: 50, width: 60, height: 20 }))
  pulseRange(target, { doc: document, timeoutMs: 15, track: false })
  const stale = document.createElement('div')
  stale.className = 'rd-jump-ring'
  document.querySelector('.rd-root').appendChild(stale)
  assert.equal(rings(document).length, 2)

  assert.equal(clearJumpRing(document), 2)
  assert.equal(rings(document).length, 0)
  assert.equal(clearJumpRing(document), 0)
  await sleep(40)
})

test('pulseElement rings an element rect', async () => {
  const { document } = makeDom()
  const element = fakeTarget(rect({ left: 20, top: 10, width: 30, height: 40 }))
  const ring = pulseElement(element, { doc: document, timeoutMs: 15, track: false })
  assert.ok(ring)
  assert.equal(ring.style.left, '16px')
  assert.equal(ring.style.top, '6px')
  assert.equal(ring.style.width, '38px')
  assert.equal(ring.style.height, '48px')
  await sleep(40)
})

test('pulseRange returns null without a document or a target', () => {
  const target = fakeTarget(rect({ left: 100, top: 50, width: 60, height: 20 }))
  assert.equal(pulseRange(target), null)
  const { document } = makeDom()
  assert.equal(pulseRange(null, { doc: document }), null)
  assert.equal(pulseTargetWithoutRect(document), null)
})

function pulseTargetWithoutRect(document) {
  // No getBoundingClientRect: nothing to ring, and no stale ring left behind.
  return pulseRange({}, { doc: document, timeoutMs: 15, track: false })
}
