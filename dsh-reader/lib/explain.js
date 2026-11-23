const FENCE = /```(?:json)?\s*([\s\S]*?)```/i

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function strings(value, limit) {
  return Array.isArray(value) ? value.filter((x) => typeof x === 'string' && x.trim()).slice(0, limit) : []
}

const NESTED_RULE =
  '如果「词条」本身就是某个上层概念或它的别名，不要重复该概念已有的定义，改为说明它在这段话里具体指什么、与上层概念的差别。'

/** Ancestors of the card the reader is looking at, farthest first. */
function ancestorLines(ancestors) {
  const list = (Array.isArray(ancestors) ? ancestors : []).filter((item) => item && text(item.term))
  if (list.length === 0) return []
  return [
    '',
    '上层解释（从远到近，读者正在看这些卡片）：',
    ...list.map(
      (item, index) =>
        `${index + 1}. ${text(item.term)}${text(item.definition) ? '：' + text(item.definition).slice(0, 120) : ''}`,
    ),
  ]
}

/** Turn one model reply into concept fields, tolerating fences and prose. */
export function parseExplanation(reply) {
  const raw = String(reply ?? '')
  const fenced = raw.match(FENCE)
  let candidate = fenced ? fenced[1].trim() : ''
  if (!candidate) {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start >= 0 && end > start) candidate = raw.slice(start, end + 1)
  }
  let obj = null
  try {
    obj = JSON.parse(candidate)
  } catch {
    obj = null
  }
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    return {
      definition: text(obj.definition) || text(obj.oneLine),
      intuition: text(obj.intuition),
      context: text(obj.context),
      examples: strings(obj.examples, 3),
      related: strings(obj.related, 3),
    }
  }
  return { definition: raw.trim().slice(0, 400), intuition: '', context: '', examples: [], related: [] }
}

/**
 * Ask how one book uses an already-known concept, without replacing the
 * original explanation.
 */
export function buildContextPrompt({ term, sentence, docTitle }) {
  const system = [
    '你是阅读助手。读者已经有一个概念的解释，现在想知道这本书里它具体怎么用。',
    '只输出一个 JSON 对象：{"note":"结合本书语境的一句话说明，不超过 80 字"}。',
  ].join('')
  const user = [
    `书名：${text(docTitle) || '未知'}`,
    `概念：${text(term)}`,
    `本书中的句子：${text(sentence).slice(0, 300)}`,
  ].join('\n')
  return { system, user }
}

/** Parse the per-book usage note, tolerating plain text. */
export function parseContextNote(reply) {
  const raw = String(reply || '').trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1))
      if (parsed && typeof parsed.note === 'string' && parsed.note.trim()) {
        return { note: parsed.note.trim().slice(0, 200) }
      }
    } catch {
      /* fall through to plain text */
    }
  }
  return { note: raw.slice(0, 200) }
}

/**
 * Build a layered follow-up prompt: book context first, then the model's own
 * general knowledge, then optional web results. Never invent citations.
 */
export function buildAskPrompt({ concept, question, related = [], web = null }) {
  const system = [
    '你是阅读助手。回答读者的追问时按三层组织：',
    '1) 本书资料：优先使用给出的概念、原文与本书语境；',
    '2) 通用知识：书中未展开、但属于你已内化的通识时可以补充，并在句中标注「通用知识」；',
    '3) 联网结果：若提供，优先引用并标注来源编号。',
    '不要编造具体事实或链接；不确定就说明。总字数不超过 250 字。',
  ].join('')
  const lines = [
    `概念：${text(concept.term)}`,
    `定义：${text(concept.definition)}`,
    `直觉：${text(concept.intuition)}`,
    `本书语境：${text(concept.context)}`,
  ]
  if (concept.evidence && concept.evidence.sentence) {
    lines.push(`原文：${text(concept.evidence.sentence).slice(0, 300)}`)
  }
  if (related.length > 0) {
    lines.push(`相关概念：${related.map((item) => `${item.term}：${text(item.definition)}`).join('；')}`)
  }
  if (web && web.used) {
    lines.push('', '联网结果：')
    if (web.content) lines.push(String(web.content).slice(0, 1500))
    for (const [index, source] of web.sources.entries()) {
      lines.push(`[${index + 1}] ${source.title || source.url} ${source.url}`)
    }
  } else if (web && web.error) {
    lines.push('', '（联网搜索不可用；不要引用任何网络来源。）')
  }
  lines.push('', `问题：${question}`)
  return { system, user: lines.join('\n') }
}

/** Compact first-pass explanation: two fields, low latency. */
export function buildQuickExplainPrompt({ term, sentence, docTitle, ancestors = [] }) {
  const layered = ancestorLines(ancestors)
  const system = [
    '你是阅读助手。读者只需要快速理解这个词。',
    '只输出一个 JSON 对象：{"definition":"一句话定义，60 字以内","intuition":"一句话直觉或比喻，40 字以内","examples":["一个短例子"]}。',
    '不要展开长文；不确定就直说。',
    ...(layered.length ? [NESTED_RULE] : []),
  ].join('')
  const user = [
    `书名：${text(docTitle) || '未知'}`,
    `原文：${text(sentence).slice(0, 300)}`,
    `词条：${text(term)}`,
    ...layered,
  ].join('\n')
  return { system, user }
}

/** Build the single-shot explanation prompt; never send more than one paragraph. */
export function buildExplainPrompt({ term, sentence, paragraph, docTitle, ancestors = [] }) {
  const layered = ancestorLines(ancestors)
  const system = [
    '你是阅读助手，帮助读者理解正在读的书里的概念。',
    '只输出一个 JSON 对象，不要输出其他文字。字段：',
    'definition：一句话定义，不超过 60 字，不要复读原句；',
    'intuition：一个直觉或生活化类比，不超过 120 字；',
    'context：结合这本书的语境说明为什么这里用它，不超过 80 字；',
    'examples：0-3 个短例子；related：0-3 个相关概念名。',
    '不确定时用“可能指 A 或 B”表达，禁止编造。',
    ...(layered.length ? [NESTED_RULE] : []),
  ].join('')
  const user = [
    `书名：${text(docTitle) || '未知'}`,
    `概念：${text(term)}`,
    `所在句：${text(sentence).slice(0, 240)}`,
    `所在段落：${text(paragraph).slice(0, 600)}`,
    ...layered,
    '请输出 JSON。',
  ].join('\n')
  return { system, user }
}
