/**
 * Offline-testable judge contract for L2 translation eval.
 * The live route builds the same prompt and parses the same shape.
 */

export const JUDGE_RUBRIC_VERSION = 'v1'

export function buildJudgePrompt({ source, reference, candidate, target = 'zh', glossary = [] }) {
  const glossaryLines = (glossary || []).map((term) => `${term.term} => ${term.translation}`)
  const system = [
    'You are a bilingual translation reviewer.',
    `Score the candidate translation into ${target} on four dimensions, each 1-5:`,
    '- adequacy: meaning preserved, no omission, addition or mistranslation',
    '- fluency: natural and readable in the target language',
    '- terminology: glossary terms used exactly and consistently',
    '- structure: numbers, units, names, code, URLs and placeholders preserved',
    'Return strict JSON only:',
    '{"adequacy":4,"fluency":5,"terminology":5,"structure":"pass","reason":"short reason"}',
    'Do not explain outside the JSON. Do not reward literal word-for-word copying.',
    'Reference is for adequacy only; judge fluency independently.',
  ].join('\n')
  const user = [
    '<source>',
    String(source || ''),
    '</source>',
    '<reference>',
    String(reference || ''),
    '</reference>',
    '<candidate>',
    String(candidate || ''),
    '</candidate>',
    glossaryLines.length ? `<glossary>\n${glossaryLines.join('\n')}\n</glossary>` : '',
  ]
    .filter(Boolean)
    .join('\n')
  return { system, user }
}

export function parseJudgeReply(reply) {
  const raw = String(reply || '')
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : raw.slice(Math.max(0, raw.indexOf('{')), raw.lastIndexOf('}') + 1)
  let parsed
  try {
    parsed = JSON.parse(candidate)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const score = (value) => {
    const number = Number(value)
    return Number.isInteger(number) && number >= 1 && number <= 5 ? number : 0
  }
  const adequacy = score(parsed.adequacy)
  const fluency = score(parsed.fluency)
  const terminology = score(parsed.terminology)
  const structure = parsed.structure === 'pass' ? 'pass' : parsed.structure === 'fail' ? 'fail' : ''
  if (!adequacy || !fluency || !terminology || !structure) return null
  return {
    adequacy,
    fluency,
    terminology,
    structure,
    reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 300) : '',
  }
}

export function judgePass(score) {
  return Boolean(score && score.adequacy >= 4 && score.fluency >= 3 && score.terminology >= 4 && score.structure === 'pass')
}

export function aggregateJudge(cases) {
  const rows = (cases || [])
    .map((item) => {
      const scores = item && item.scores ? item.scores : item
      if (!scores || !Number.isFinite(Number(scores.adequacy))) return null
      return { scores: scores }
    })
    .filter(Boolean)
  if (rows.length === 0) {
    return { count: 0, adequacy: 0, fluency: 0, terminology: 0, passRate: 0 }
  }
  const mean = (key) => rows.reduce((sum, item) => sum + item.scores[key], 0) / rows.length
  return {
    count: rows.length,
    adequacy: Number(mean('adequacy').toFixed(2)),
    fluency: Number(mean('fluency').toFixed(2)),
    terminology: Number(mean('terminology').toFixed(2)),
    passRate: Number((rows.filter((item) => judgePass(item.scores)).length / rows.length).toFixed(3)),
  }
}

export function compareJudge(baseline, candidate) {
  let wins = 0
  let losses = 0
  let ties = 0
  for (let index = 0; index < candidate.length; index += 1) {
    const left = baseline[index]
    const right = candidate[index]
    if (!left || !right) continue
    const delta = right.adequacy + right.fluency + right.terminology - (left.adequacy + left.fluency + left.terminology)
    if (delta > 0) wins += 1
    else if (delta < 0) losses += 1
    else ties += 1
  }
  const total = wins + losses
  return { wins, losses, ties, winRate: total ? Number((wins / total).toFixed(3)) : 0 }
}

export function calibrationAgreement(rows) {
  const pairs = (rows || []).filter((row) => row && row.human && row.judge)
  if (pairs.length === 0) return { count: 0, withinOne: 0, kappa: 0 }
  const dims = ['adequacy', 'fluency', 'terminology']
  let within = 0
  let total = 0
  for (const row of pairs) {
    for (const dim of dims) {
      total += 1
      if (Math.abs(row.human[dim] - row.judge[dim]) <= 1) within += 1
    }
  }
  const humanPass = pairs.map((row) => judgePass(row.human))
  const judgePassed = pairs.map((row) => judgePass(row.judge))
  const observed = humanPass.filter((value, index) => value === judgePassed[index]).length / pairs.length
  const pYes = (humanPass.filter(Boolean).length + judgePassed.filter(Boolean).length) / (pairs.length * 2)
  const expected = pYes * pYes + (1 - pYes) * (1 - pYes)
  const kappa = expected === 1 ? 0 : (observed - expected) / (1 - expected)
  return {
    count: pairs.length,
    withinOne: Number((within / total).toFixed(3)),
    kappa: Number(Math.max(-1, Math.min(1, kappa)).toFixed(3)),
  }
}

export const DEFAULT_THRESHOLDS = {
  adequacy: 4.3,
  fluency: 4.2,
  terminology: 4.5,
  passRate: 0.95,
  winRate: 0.6,
  lossRate: 0.15,
  humanAgreement: 0.85,
  humanKappa: 0.6,
}

export function judgeGate(aggregate, extra = {}, thresholds = DEFAULT_THRESHOLDS) {
  const failures = []
  const check = (name, value, minimum) => {
    if (!(Number(value) >= minimum)) failures.push(`${name} ${value} < ${minimum}`)
  }
  check('adequacy', aggregate.adequacy, thresholds.adequacy)
  check('fluency', aggregate.fluency, thresholds.fluency)
  check('terminology', aggregate.terminology, thresholds.terminology)
  check('passRate', aggregate.passRate, thresholds.passRate)
  if (extra.winRate !== undefined) check('winRate', extra.winRate, thresholds.winRate)
  if (extra.lossRate !== undefined && extra.lossRate > thresholds.lossRate) failures.push(`lossRate ${extra.lossRate} > ${thresholds.lossRate}`)
  if (extra.humanAgreement !== undefined) check('humanAgreement', extra.humanAgreement, thresholds.humanAgreement)
  if (extra.humanKappa !== undefined) check('humanKappa', extra.humanKappa, thresholds.humanKappa)
  return { pass: failures.length === 0, failures }
}
