export const TRANSLATE_LANGUAGES = ['zh', 'en', 'ja']

function targetName(language) {
  return { zh: '简体中文', en: 'English', ja: '日本語' }[language] || language
}

export function buildTranslatePrompt({ target, segments }) {
  const system = [
    `你是专业翻译。把每个段落准确翻译成${targetName(target)}，保留术语、数字与专有名词。`,
    '只输出一个 JSON 对象：{"translations":{"<id>":"<译文>"}}，不要输出其他文字。',
    '逐段对应，不要合并或拆分段落。',
  ].join('')
  const user = segments.map((segment) => `[${segment.id}] ${segment.text}`).join('\n').slice(0, 12000)
  return { system, user }
}

export function parseTranslationReply(reply, ids) {
  const raw = String(reply || '')
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : raw.slice(Math.max(0, raw.indexOf('{')), raw.lastIndexOf('}') + 1)
  const out = {}
  try {
    const parsed = JSON.parse(candidate)
    const map = parsed && parsed.translations && typeof parsed.translations === 'object' ? parsed.translations : parsed
    if (map && typeof map === 'object') {
      for (const id of ids) {
        if (typeof map[id] === 'string' && map[id].trim()) out[id] = map[id].trim()
      }
    }
  } catch {
    /* no usable json */
  }
  return out
}
