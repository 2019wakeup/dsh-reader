import { JSDOM } from 'jsdom'
import { buildTranslatePrompt, parseTranslationReply } from '../../lib/translate.js'
import { translateCacheKey, evictTranslationCache } from '../../lib/translation-cache.js'
import { activeGlossary, glossaryHash, matchGlossary, normalizeGlossary } from '../../lib/glossary.js'
import { extractUnits, buildTranslatedOnlyHtml, renderUnitFragment } from '../../src/client/translation/units.js'
import { partitionTranslationBatch } from '../../src/client/translation-schedule.js'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
globalThis.document = dom.window.document
globalThis.Node = dom.window.Node

const glossary = normalizeGlossary({
  terms: [
    { term: 'CAP', translation: 'CAP 定理', scope: 'global' },
    { term: 'consistent hashing', translation: '一致性哈希', scope: 'global' },
  ],
}).terms

function mount(html) {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export const contractCases = [
  { name: 'prompt.target', run() { const { system } = buildTranslatePrompt({ target: 'zh', segments: [{ id: 'a', text: 'x' }] }); assert(system.includes('简体中文'), 'target missing') } },
  { name: 'prompt.source', run() { const { system } = buildTranslatePrompt({ target: 'zh', from: 'en', segments: [{ id: 'a', text: 'x' }] }); assert(system.includes('English'), 'source missing') } },
  { name: 'prompt.glossary', run() { const { user } = buildTranslatePrompt({ target: 'zh', glossary, segments: [{ id: 'a', text: 'CAP' }] }); assert(user.includes('CAP => CAP 定理'), 'glossary missing') } },
  { name: 'prompt.context', run() { const { user } = buildTranslatePrompt({ target: 'zh', context: { title: '书', chapter: '第一章', chapterSnapshot: '摘要' }, segments: [{ id: 'a', text: 'x' }] }); assert(user.includes('chapter: 第一章') && user.includes('context: 摘要'), 'context missing') } },
  { name: 'prompt.placeholder', run() { const { system } = buildTranslatePrompt({ target: 'zh', segments: [{ id: 'a', text: '{{RD:0}}' }] }); assert(system.includes('{{RD:n}}'), 'placeholder rule missing') } },
  { name: 'prompt.no-prefix', run() { const { system } = buildTranslatePrompt({ target: 'zh', segments: [{ id: 'a', text: 'x' }] }); assert(system.includes('译文：'), 'prefix rule missing') } },
  { name: 'prompt.auto', run() { const { system } = buildTranslatePrompt({ target: 'zh', segments: [{ id: 'a', text: 'x' }] }); assert(system.includes('自动判断') || system.includes('自动检测'), 'auto rule missing') } },
  { name: 'prompt.json', run() { const { system } = buildTranslatePrompt({ target: 'zh', segments: [{ id: 'a', text: 'x' }] }); assert(system.includes('JSON'), 'json rule missing') } },
  { name: 'parse.complete', run() { const out = parseTranslationReply('{"translations":{"a":"A","b":"B"}}', ['a', 'b']); assert(out.a === 'A' && out.b === 'B', 'complete parse failed') } },
  { name: 'parse.fence', run() { const out = parseTranslationReply('```json\n{"translations":{"a":"A"}}\n```', ['a']); assert(out.a === 'A', 'fence parse failed') } },
  { name: 'parse.missing', run() { const out = parseTranslationReply('{"translations":{"a":"A"}}', ['a', 'b']); assert(out.a === 'A' && !out.b, 'missing id handling failed') } },
  { name: 'parse.extra', run() { const out = parseTranslationReply('{"translations":{"a":"A","x":"X"}}', ['a']); assert(out.a === 'A' && !out.x, 'extra id leaked') } },
  { name: 'parse.blank', run() { const out = parseTranslationReply('{"translations":{"a":"  "}}', ['a']); assert(!out.a, 'blank accepted') } },
  { name: 'parse.malformed', run() { const out = parseTranslationReply('not json', ['a']); assert(Object.keys(out).length === 0, 'malformed accepted') } },
  { name: 'parse.prefix', run() { const out = parseTranslationReply('Here: {"translations":{"a":"A"}} ok', ['a']); assert(out.a === 'A', 'prefix parse failed') } },
  { name: 'parse.emptyids', run() { const out = parseTranslationReply('{"translations":{}}', []); assert(Object.keys(out).length === 0, 'empty ids failed') } },
  { name: 'parse.unicode', run() { const out = parseTranslationReply('{"translations":{"a":"分布式"}}', ['a']); assert(out.a === '分布式', 'unicode failed') } },
  { name: 'cache.target', run() { const base = { target: 'zh', from: 'en', promptVersion: 2, glossaryHash: 'none', contentHash: 'h' }; assert(translateCacheKey(base) !== translateCacheKey({ ...base, target: 'ja' }), 'target not keyed') } },
  { name: 'cache.from', run() { const base = { target: 'zh', from: 'en', promptVersion: 2, glossaryHash: 'none', contentHash: 'h' }; assert(translateCacheKey(base) !== translateCacheKey({ ...base, from: 'auto' }), 'from not keyed') } },
  { name: 'cache.prompt', run() { const base = { target: 'zh', from: 'en', promptVersion: 2, glossaryHash: 'none', contentHash: 'h' }; assert(translateCacheKey(base) !== translateCacheKey({ ...base, promptVersion: 3 }), 'prompt not keyed') } },
  { name: 'cache.glossary', run() { const base = { target: 'zh', from: 'en', promptVersion: 2, glossaryHash: 'g1', contentHash: 'h' }; assert(translateCacheKey(base) !== translateCacheKey({ ...base, glossaryHash: 'g2' }), 'glossary not keyed') } },
  { name: 'cache.content', run() { const base = { target: 'zh', from: 'en', promptVersion: 2, glossaryHash: 'none', contentHash: 'h1' }; assert(translateCacheKey(base) !== translateCacheKey({ ...base, contentHash: 'h2' }), 'content not keyed') } },
  { name: 'cache.stable', run() { const base = { target: 'zh', from: 'en', promptVersion: 2, glossaryHash: 'none', contentHash: 'h' }; assert(translateCacheKey(base) === translateCacheKey(base), 'key unstable') } },
  { name: 'cache.evict-language', run() { const doc = { translations: { zh: { a: 'A', b: 'B', c: 'C' } }, translationMeta: { zh: { a: { at: 1 }, b: { at: 3 }, c: { at: 2 } } } }; evictTranslationCache(doc, { maxPerLanguage: 2, maxPerDoc: 9 }); assert(!doc.translations.zh.a && Object.keys(doc.translations.zh).length === 2, 'language eviction failed') } },
  { name: 'cache.evict-doc', run() { const doc = { translations: { zh: { a: 'A', b: 'B' }, en: { c: 'C', d: 'D' } }, translationMeta: { zh: { a: { at: 1 }, b: { at: 4 } }, en: { c: { at: 2 }, d: { at: 3 } } } }; evictTranslationCache(doc, { maxPerLanguage: 9, maxPerDoc: 2 }); assert(Object.keys(doc.translations.zh).length + Object.keys(doc.translations.en).length === 2, 'doc eviction failed') } },
  { name: 'glossary.normalize', run() { const terms = normalizeGlossary({ terms: [{ term: 'A', translation: '甲' }, { term: '', translation: 'x' }] }).terms; assert(terms.length === 1 && terms[0].translation === '甲', 'normalize failed') } },
  { name: 'glossary.scope', run() { assert(activeGlossary({ terms: [...glossary, { term: 'B', translation: '乙', scope: 'doc1' }] }, 'doc1').length === 3, 'scope failed') } },
  { name: 'glossary.longest', run() { const matched = matchGlossary('CAP and consistent hashing', glossary); assert(matched.length === 2, 'longest match failed') } },
  { name: 'glossary.boundary', run() { assert(matchGlossary('CAPTAIN', glossary).length === 0 && matchGlossary('a CAP.', glossary).length === 1, 'boundary failed') } },
  { name: 'glossary.hash', run() { const a = glossaryHash(matchGlossary('CAP', glossary)); const b = glossaryHash(normalizeGlossary({ terms: [{ term: 'CAP', translation: '新译法' }] }).terms); assert(a !== b, 'hash did not change') } },
  { name: 'glossary.hash-empty', run() { assert(glossaryHash([]) === 'none', 'empty hash') } },
  { name: 'units.h1', run() { const host = mount('<h1 id="t">标题 <code>npm</code></h1>'); const unit = extractUnits(host)[0]; assert(unit.role === 'heading' && unit.text.includes('{{RD:0}}'), 'h1 unit failed'); host.remove() } },
  { name: 'units.nested', run() { const host = mount('<ul><li><p>嵌套</p></li></ul>'); const units = extractUnits(host); assert(units.length === 1 && units[0].node.tagName === 'P', 'nested unit failed'); host.remove() } },
  { name: 'units.duplicate', run() { const host = mount('<p>重复</p><p>重复</p>'); const units = extractUnits(host); assert(units.length === 2 && units[0].hash === units[1].hash && units[0].key !== units[1].key, 'duplicate key failed'); host.remove() } },
  { name: 'units.placeholder', run() { const host = mount('<p>文本 <a href="/x">链接</a></p>'); const unit = extractUnits(host)[0]; assert(unit.protected.length === 1 && unit.text.includes('{{RD:0}}'), 'placeholder failed'); host.remove() } },
  { name: 'render.only', run() { const host = mount('<h1 id="t">标题 <code>npm</code></h1>'); const unit = extractUnits(host)[0]; const html = buildTranslatedOnlyHtml(host.innerHTML, () => '标题译文 {{RD:0}}'); const out = mount(html); assert(out.querySelector('h1').id === 't' && out.querySelector('code').textContent === 'npm', 'only render failed'); out.remove(); host.remove() } },
  { name: 'render.missing', run() { const host = mount('<p>原文 <code>x</code></p>'); const unit = extractUnits(host)[0]; assert(renderUnitFragment(unit, '没有占位符') === null, 'missing placeholder accepted'); host.remove() } },
  { name: 'render.xss', run() { const host = mount('<p>原文</p>'); const html = buildTranslatedOnlyHtml(host.innerHTML, () => '<script>alert(1)</script>'); const out = mount(html); assert(!out.querySelector('script') && out.querySelector('p').textContent.includes('<script>'), 'xss accepted'); out.remove(); host.remove() } },
  { name: 'partition.partial', run() { const { done, failed } = partitionTranslationBatch([{ id: 'a' }, { id: 'b' }], { translations: { a: 'A' } }); assert(done.length === 1 && failed.length === 1 && failed[0].id === 'b', 'partition failed') } },
  { name: 'partition.empty', run() { const { failed } = partitionTranslationBatch([{ id: 'a' }], null); assert(failed.length === 1, 'empty partition failed') } },
]
