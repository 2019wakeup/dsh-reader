import test from 'node:test'
import assert from 'node:assert/strict'
import { activeGlossary, glossaryHash, matchGlossary, normalizeGlossary } from '../lib/glossary.js'

const terms = normalizeGlossary({
  terms: [
    { term: 'consistent hashing', translation: '一致性哈希', scope: 'global' },
    { term: 'CAP', translation: 'CAP 定理', scope: 'global' },
    { term: 'book term', translation: '本书术语', scope: 'fp1' },
  ],
}).terms

test('normalizes and scopes glossary terms', () => {
  assert.equal(terms.length, 3)
  assert.deepEqual(
    activeGlossary({ terms }, 'fp1').map((term) => term.term).sort(),
    ['CAP', 'book term', 'consistent hashing'],
  )
  assert.deepEqual(
    activeGlossary({ terms }, 'fp2').map((term) => term.term).sort(),
    ['CAP', 'consistent hashing'],
  )
})

test('longest matching term wins and latin words respect boundaries', () => {
  const matched = matchGlossary('CAP and consistent hashing; CAPTAIN is not CAP.', terms)
  assert.deepEqual(matched.map((term) => term.term).sort(), ['CAP', 'consistent hashing'])
  assert.equal(matchGlossary('cap', terms).length, 1, 'case-insensitive by default')
})

test('the glossary hash changes when a used translation changes', () => {
  const first = glossaryHash(matchGlossary('CAP', terms))
  const changed = glossaryHash(matchGlossary('CAP', normalizeGlossary({
    terms: [{ term: 'CAP', translation: '一致性、可用性、分区容忍', scope: 'global' }],
  }).terms))
  assert.notEqual(first, changed)
  assert.equal(glossaryHash([]), 'none')
})
