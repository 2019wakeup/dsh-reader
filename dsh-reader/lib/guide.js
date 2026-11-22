import { createHash } from 'node:crypto'

/** Stable per-section cache key. */
export function sectionHash(text) {
  return createHash('sha1').update(String(text || '')).digest('hex')
}

export function buildSectionPrompt({ title, text }) {
  const system = [
    '你是阅读助手。根据一个章节的原文，输出一个 JSON 对象，不要输出其他文字。',
    '字段：summary（该章摘要，3 句以内）；keyPoints（2-3 条要点，短句）。',
    '只依据原文，不编造。',
  ].join('')
  const user = `章节标题：${String(title || '').slice(0, 120)}\n章节正文：${String(text || '').slice(0, 6000)}`
  return { system, user }
}

export function buildPartPrompt({ title, sections }) {
  const system = [
    '你是阅读助手。根据一个篇章下各节的摘要，输出一个 JSON 对象，不要输出其他文字。',
    '字段：summary（该篇章摘要，2-3 句）；keyPoints（2-3 条要点，短句）。',
    '只依据给出的摘要，不编造。',
  ].join('')
  const user = `篇章标题：${String(title || '').slice(0, 120)}\n各节摘要：\n${sections
    .map((section) => `- ${section.title}：${section.summary}`)
    .join('\n')
    .slice(0, 8000)}`
  return { system, user }
}

export function buildOverviewPrompt(sections) {
  const system = [
    '你是阅读助手。根据全书各章摘要，输出一个 JSON 对象，不要输出其他文字。',
    '字段：synopsis（全书主旨，不超过 200 字）；questions（3 个读完这本书应该能回答的核心问题）。',
  ].join('')
  const user = sections
    .map((section) => `- ${section.title}：${section.summary}`)
    .join('\n')
    .slice(0, 12000)
  return { system, user }
}

/** Parse a JSON object out of a model reply, tolerating fences and prose. */
export function extractJson(reply) {
  const raw = String(reply || '')
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced
    ? fenced[1].trim()
    : raw.slice(Math.max(0, raw.indexOf('{')), raw.lastIndexOf('}') + 1)
  try {
    const parsed = JSON.parse(candidate)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function parseSectionReply(reply) {
  const parsed = extractJson(reply)
  const plain = String(reply || '')
    .replace(/```[\s\S]*?```/g, '')
    .trim()
  return {
    summary: String(parsed?.summary || (parsed ? '' : plain) || '').trim().slice(0, 600),
    keyPoints: Array.isArray(parsed?.keyPoints)
      ? parsed.keyPoints.filter((item) => typeof item === 'string' && item.trim()).slice(0, 3)
      : [],
  }
}

export function parsePartReply(reply) {
  const parsed = extractJson(reply)
  const plain = String(reply || '')
    .replace(/```[\s\S]*?```/g, '')
    .trim()
  return {
    summary: String(parsed?.summary || (parsed ? '' : plain) || '').trim().slice(0, 600),
    keyPoints: Array.isArray(parsed?.keyPoints)
      ? parsed.keyPoints.filter((item) => typeof item === 'string' && item.trim()).slice(0, 3)
      : [],
  }
}

export function parseOverviewReply(reply) {
  const parsed = extractJson(reply)
  return {
    synopsis: String(parsed?.synopsis || '').trim().slice(0, 400),
    questions: Array.isArray(parsed?.questions)
      ? parsed.questions.filter((item) => typeof item === 'string' && item.trim()).slice(0, 3)
      : [],
  }
}
