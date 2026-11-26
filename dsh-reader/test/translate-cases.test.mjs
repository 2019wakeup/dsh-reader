import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const corpus = path.join(here, '..', 'eval', 'translate', 'corpus', 'v1')

async function jsonl(name) {
  return (await fs.readFile(path.join(corpus, name), 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

test('translation corpus has 60 segments, references and 12 documents', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(corpus, 'manifest.json'), 'utf8'))
  const segments = await jsonl('segments.jsonl')
  const references = await jsonl('references.jsonl')
  const documents = JSON.parse(await fs.readFile(path.join(corpus, 'documents.json'), 'utf8'))
  assert.equal(manifest.segments, 60)
  assert.equal(segments.length, 60)
  assert.equal(references.length, 60)
  assert.equal(documents.documents.length, 12)
  assert.equal(new Set(segments.map((item) => item.id)).size, 60)
  assert.equal(new Set(references.map((item) => item.id)).size, 60)
  const refIds = new Set(references.map((item) => item.id))
  for (const segment of segments) {
    assert.ok(refIds.has(segment.id), segment.id)
    assert.ok(segment.source.length > 0 && segment.source.length <= 800, segment.id)
    assert.ok(['tune', 'holdout'].includes(segment.split), segment.id)
    assert.ok(segment.target === 'zh', segment.id)
  }
  assert.ok(segments.filter((item) => item.split === 'holdout').length >= 10)
  assert.ok(documents.documents.some((item) => item.format === 'pdf'))
  assert.ok(documents.documents.some((item) => item.tags.includes('no-text-layer')))
})
