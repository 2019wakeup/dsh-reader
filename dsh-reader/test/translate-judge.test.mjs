import test from 'node:test'
import assert from 'node:assert/strict'
import {
  aggregateJudge,
  buildJudgePrompt,
  calibrationAgreement,
  compareJudge,
  judgeGate,
  judgePass,
  parseJudgeReply,
} from '../eval/translate/judge.mjs'

test('judge prompt carries source, reference, candidate and glossary', () => {
  const { system, user } = buildJudgePrompt({
    source: 'CAP is hard.',
    reference: 'CAP 定理很难。',
    candidate: 'CAP 很难。',
    target: 'zh',
    glossary: [{ term: 'CAP', translation: 'CAP 定理' }],
  })
  assert.match(system, /strict JSON/)
  assert.match(user, /CAP is hard/)
  assert.match(user, /CAP 定理很难/)
  assert.match(user, /CAP => CAP 定理/)
})

test('judge reply accepts strict and fenced JSON and rejects invalid scores', () => {
  const strict = parseJudgeReply('{"adequacy":4,"fluency":5,"terminology":5,"structure":"pass","reason":"ok"}')
  assert.deepEqual(strict, { adequacy: 4, fluency: 5, terminology: 5, structure: 'pass', reason: 'ok' })
  assert.ok(parseJudgeReply('```json\n{"adequacy":4,"fluency":4,"terminology":4,"structure":"pass"}\n```'))
  assert.equal(parseJudgeReply('{"adequacy":6,"fluency":4,"terminology":4,"structure":"pass"}'), null)
  assert.equal(parseJudgeReply('not json'), null)
  assert.equal(parseJudgeReply('{"adequacy":4,"fluency":4,"terminology":4,"structure":"maybe"}'), null)
})

test('aggregate, pass and compare use the same thresholds', () => {
  const rows = [
    { scores: { adequacy: 5, fluency: 5, terminology: 5, structure: 'pass' } },
    { scores: { adequacy: 3, fluency: 4, terminology: 4, structure: 'pass' } },
  ]
  const aggregate = aggregateJudge(rows)
  assert.equal(aggregate.count, 2)
  assert.equal(aggregate.adequacy, 4)
  assert.equal(aggregate.passRate, 0.5)
  assert.equal(judgePass(rows[0].scores), true)
  assert.equal(judgePass(rows[1].scores), false)
  const compare = compareJudge(
    [{ adequacy: 3, fluency: 3, terminology: 3 }, { adequacy: 4, fluency: 4, terminology: 4 }],
    [{ adequacy: 4, fluency: 4, terminology: 4 }, { adequacy: 3, fluency: 3, terminology: 3 }],
  )
  assert.equal(compare.wins, 1)
  assert.equal(compare.losses, 1)
  assert.equal(compare.winRate, 0.5)
})

test('calibration reports within-one agreement and kappa', () => {
  const rows = [
    { human: { adequacy: 5, fluency: 4, terminology: 5, structure: 'pass' }, judge: { adequacy: 4, fluency: 4, terminology: 5, structure: 'pass' } },
    { human: { adequacy: 3, fluency: 3, terminology: 3, structure: 'pass' }, judge: { adequacy: 3, fluency: 3, terminology: 3, structure: 'pass' } },
  ]
  const result = calibrationAgreement(rows)
  assert.equal(result.count, 2)
  assert.equal(result.withinOne, 1)
  assert.ok(result.kappa >= 0.9)
})

test('judge gate fails on a low metric and passes on a healthy report', () => {
  const healthy = { adequacy: 4.5, fluency: 4.4, terminology: 4.7, passRate: 0.97 }
  assert.equal(judgeGate(healthy, { winRate: 0.7, lossRate: 0.1 }, { ...healthy, winRate: 0.6, lossRate: 0.15 }).pass, true)
  const bad = judgeGate({ ...healthy, adequacy: 4.1 }, {}, { adequacy: 4.3, fluency: 4.2, terminology: 4.5, passRate: 0.95, winRate: 0.6, lossRate: 0.15 })
  assert.equal(bad.pass, false)
  assert.ok(bad.failures.some((item) => item.startsWith('adequacy')))
})
