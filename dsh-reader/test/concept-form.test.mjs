import test from 'node:test'
import assert from 'node:assert/strict'
import { conceptPatch } from '../src/client/concept-form.js'

test('trims fields and splits examples by line and aliases by comma', () => {
  const result = conceptPatch({
    term: ' 线性一致性 ',
    definition: ' D ',
    intuition: ' I ',
    context: ' C ',
    examples: 'e1\n e2 \n\n',
    aliases: 'LC， 线性, ',
    related: '顺序一致性, CAP',
  })
  assert.equal(result.ok, true)
  assert.equal(result.patch.term, '线性一致性')
  assert.equal(result.patch.definition, 'D')
  assert.deepEqual(result.patch.examples, ['e1', 'e2'])
  assert.deepEqual(result.patch.aliases, ['LC', '线性'])
  assert.deepEqual(result.patch.related, ['顺序一致性', 'CAP'])
})

test('rejects an empty term', () => {
  const result = conceptPatch({ term: '   ', definition: 'D' })
  assert.equal(result.ok, false)
})

test('caps examples and aliases', () => {
  const result = conceptPatch({ term: 'T', examples: '1\n2\n3\n4', aliases: 'a,b,c,d,e,f,g,h,i,j' })
  assert.equal(result.patch.examples.length, 3)
  assert.equal(result.patch.aliases.length, 8)
})
