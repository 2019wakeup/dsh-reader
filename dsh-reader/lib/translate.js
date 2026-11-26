/**
 * One language table for the whole plugin.
 *
 * Host (`index.js`, `lib/store.js`, `lib/prefs.js`) and client
 * (`src/client/app.js`) all read it from here, so adding or renaming a
 * language is a single edit. The client copy arrives through
 * `scripts/build-client.mjs`, which pastes this file into the bundle.
 */
export const TRANSLATE_LANGUAGES = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru', 'pt']
export const TRANSLATE_SOURCES = ['auto', ...TRANSLATE_LANGUAGES]

const LANGUAGE_NAMES = {
  auto: '自动检测',
  zh: '简体中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  ru: 'Русский',
  pt: 'Português',
}

export function languageName(language) {
  return LANGUAGE_NAMES[language] || language
}

/* ------------------------------------------------------------------ *
 * Language detection
 *
 * Used for two things only: showing "detected: X" next to the source
 * selector, and skipping a translation when the source already is the
 * target. A wrong skip costs the user a silently untranslated page, so
 * the Latin-script branch stays conservative and answers `auto` unless
 * the evidence is clear.
 * ------------------------------------------------------------------ */

const KANA = /[\u3040-\u30ff]/g
const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g
const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/g
const CYRILLIC = /[\u0400-\u04ff]/g
const LATIN = /[A-Za-z\u00c0-\u024f\u1e00-\u1eff]/g
// Letters that only one of the Latin-script targets uses in practice.
const LATIN_MARKS = {
  fr: /[àâçéèêëîïôûùüÿœæ]/gi,
  de: /[äöüß]/gi,
  es: /[ñáíóú¿¡]/gi,
  pt: /[ãõáâêôç]/gi,
}
const LATIN_STOPWORDS = {
  en: ['the', 'and', 'of', 'to', 'is', 'are', 'for', 'with', 'that', 'not', 'this', 'from'],
  fr: ['le', 'la', 'les', 'des', 'une', 'est', 'que', 'pour', 'dans', 'avec', 'pas', 'sur'],
  de: ['der', 'die', 'das', 'und', 'ist', 'nicht', 'ein', 'eine', 'mit', 'für', 'auf', 'sich'],
  es: ['el', 'los', 'las', 'una', 'es', 'que', 'para', 'con', 'por', 'del', 'como', 'pero'],
  pt: ['os', 'as', 'um', 'uma', 'que', 'para', 'com', 'não', 'por', 'do', 'da', 'como'],
}

function countMatches(text, pattern) {
  return (text.match(pattern) || []).length
}

function sampleForDetection(text) {
  return String(text || '')
    .replace(/\{\{RD:\d+\}\}/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .slice(0, 4000)
}

function detectLatinLanguage(sample) {
  const words = sample.toLowerCase().match(/[a-z\u00c0-\u024f\u1e00-\u1eff]{2,}/g) || []
  // A word or two is not enough signal; short snippets are better reported as
  // "unknown" than skipped on a guess.
  if (words.length < 8) return null
  const scores = {}
  for (const code of ['en', 'fr', 'de', 'es', 'pt']) {
    const stopwords = new Set(LATIN_STOPWORDS[code])
    let hits = 0
    for (const word of words) if (stopwords.has(word)) hits += 1
    const marks = LATIN_MARKS[code] ? countMatches(sample, LATIN_MARKS[code]) : 0
    scores[code] = (hits / words.length) * 100 + Math.min(6, marks) * 1.5
  }
  const ranked = Object.entries(scores).sort((left, right) => right[1] - left[1])
  const [best, bestScore] = ranked[0]
  const secondScore = ranked[1] ? ranked[1][1] : 0
  if (bestScore < 8 || bestScore - secondScore < 3) return null
  // 12 points of margin reads as full confidence; below ~0.6 the caller is
  // told the language but should not skip a translation on it.
  return { language: best, confidence: Math.min(1, Number(((bestScore - secondScore) / 12).toFixed(2))) }
}

/**
 * @param {string} text
 * @returns {{ language: string, confidence: number }} `auto` means "no confident answer".
 */
export function detectLanguage(text) {
  const sample = sampleForDetection(text)
  const letters = countMatches(sample, /[\p{L}]/gu)
  if (letters < 4) return { language: 'auto', confidence: 0 }
  const kana = countMatches(sample, KANA)
  const han = countMatches(sample, HAN)
  const hangul = countMatches(sample, HANGUL)
  const cyrillic = countMatches(sample, CYRILLIC)
  const latin = countMatches(sample, LATIN)
  const cjk = kana + han

  // Decide by the share of letters, not by absolute counts: a Chinese page can
  // still carry English code samples or an English footnote, and requiring
  // "han >= 2x latin" made such pages undetectable.
  const share = (count) => count / letters
  if (share(kana) >= 0.15) {
    return { language: 'ja', confidence: 1 }
  }
  if (share(han) >= 0.25 && share(kana) < 0.05) {
    return { language: 'zh', confidence: 1 }
  }
  if (share(hangul) >= 0.2) {
    return { language: 'ko', confidence: 1 }
  }
  if (share(cyrillic) >= 0.2) {
    return { language: 'ru', confidence: 1 }
  }
  if (share(latin) >= 0.6) {
    const latinGuess = detectLatinLanguage(sample)
    if (latinGuess) return latinGuess
  }
  return { language: 'auto', confidence: 0 }
}

/**
 * True only when the text is confidently the given language; used to skip a
 * model call. `auto`/unsupported never match.
 */
export function looksLikeLanguage(text, language) {
  if (!language || language === 'auto') return false
  const detected = detectLanguage(text)
  return detected.confidence >= 0.6 && detected.language === language
}

export function buildTranslatePrompt({ target, from = 'auto', segments }) {
  const source = from === 'auto' ? '源语言自动判断。' : `源语言：${languageName(from)}。`
  const system = [
    `你是专业翻译。${source}把每个段落准确翻译成${languageName(target)}，保留术语、数字与专有名词。`,
    `如果原文已经是${languageName(target)}，原样返回。`,
    '只输出一个 JSON 对象：{"translations":{"<id>":"<译文>"}}，不要输出其他文字。',
    '逐段对应，不要合并或拆分段落。',
    '保留 {{RD:n}} 占位符原样、顺序不变；不要翻译或增删占位符里的内容。',
    '不要给译文加“译文：”之类的前缀。',
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
