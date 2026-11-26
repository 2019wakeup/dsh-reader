import test from 'node:test'
import assert from 'node:assert/strict'
import {
  detectLanguage,
  languageName,
  looksLikeLanguage,
  TRANSLATE_LANGUAGES,
  TRANSLATE_SOURCES,
} from '../lib/translate.js'

const SAMPLES = {
  en: 'Consistency in distributed systems means that every replica sees the same history at the same time, and the system behaves as if there is only one copy of the data for every client that reads it.',
  fr: 'La cohérence dans les systèmes distribués signifie que chaque réplique voit la même histoire au même moment, et que le système se comporte comme si il avait une seule copie des données pour chaque client qui lit.',
  de: 'Konsistenz in verteilten Systemen bedeutet, dass jede Replik die gleiche Historie zur gleichen Zeit sieht, und dass sich das System so verhält als gäbe es für jeden lesenden Client nur eine einzige Kopie der Daten.',
  es: 'La coherencia en los sistemas distribuidos significa que cada réplica ve la misma historia al mismo tiempo, y que el sistema se comporta como si solo hubiera una copia de los datos para cada cliente que lee.',
  pt: 'A consistência em sistemas distribuídos significa que cada réplica vê a mesma história ao mesmo tempo, e que o sistema se comporta como se houvesse apenas uma cópia dos dados para cada cliente que lê.',
  zh: '分布式系统的一致性模型要求所有副本在同一时刻看到同一份历史，系统就像只有一份数据。',
  ja: '分散システムの一貫性モデルでは、すべてのレプリカが同じ履歴を参照し、システムはデータが一つのコピーしかないかのように振る舞います。',
  ko: '분산 시스템의 일관성 모델은 모든 복제본이 같은 기록을 보도록 요구하며, 시스템은 데이터 사본이 하나뿐인 것처럼 동작합니다.',
  ru: 'Согласованность в распределённых системах требует, чтобы все реплики видели одну и ту же историю, и система ведёт себя так, будто копия данных одна.',
}

test('the shared table covers nine targets and ten sources', () => {
  assert.deepEqual(TRANSLATE_LANGUAGES, ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru', 'pt'])
  assert.deepEqual(TRANSLATE_SOURCES, ['auto', ...TRANSLATE_LANGUAGES])
  for (const language of TRANSLATE_LANGUAGES) {
    assert.ok(languageName(language), `name for ${language}`)
  }
  assert.equal(languageName('auto'), '自动检测')
})

test('detects each supported language from a paragraph', () => {
  for (const [language, text] of Object.entries(SAMPLES)) {
    const detected = detectLanguage(text)
    assert.equal(detected.language, language, `${language}: ${JSON.stringify(text.slice(0, 40))}`)
    assert.ok(detected.confidence > 0, `${language} confidence`)
  }
})

test('script-only evidence is confident enough to skip', () => {
  for (const language of ['zh', 'ja', 'ko', 'ru']) {
    assert.ok(looksLikeLanguage(SAMPLES[language], language), language)
    assert.equal(looksLikeLanguage(SAMPLES[language], 'en'), false, `${language} is not en`)
  }
})

test('short or ambiguous text reports unknown instead of guessing', () => {
  assert.deepEqual(detectLanguage(''), { language: 'auto', confidence: 0 })
  assert.equal(detectLanguage('你好').language, 'auto', 'two characters is not a sample')
  assert.equal(detectLanguage('这是中文段落').language, 'zh')
  assert.equal(detectLanguage('hi').language, 'auto')
  assert.equal(detectLanguage('12.5% — 3 items').language, 'auto')
  assert.equal(looksLikeLanguage('hi', 'en'), false)
  assert.equal(looksLikeLanguage(SAMPLES.zh, 'auto'), false)
})

test('markup, placeholders and urls do not count as language evidence', () => {
  const detected = detectLanguage('{RD:3} <p>https://example.com/a</p>')
  assert.equal(detected.language, 'auto')
})
