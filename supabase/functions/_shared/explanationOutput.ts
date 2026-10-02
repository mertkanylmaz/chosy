/**
 * explain-match — dil seçimi ve model çıktısı doğrulaması.
 *
 * Model bazen açıklama yerine reddetme / sistem dili yazıyor
 * ("Unable to generate explanation — film profile data is missing").
 * Böyle bir metin başarılı açıklama gibi kullanıcıya gitmemeli: o film
 * için `null` döner, istemci bölümü gizler.
 */

export type ExplanationLocale = 'en' | 'tr'

/** Alan opsiyonel — eski istemciler göndermez, 'en' varsayılır. */
export function resolveLocale(raw: unknown): ExplanationLocale {
  return raw === 'tr' ? 'tr' : 'en'
}

export const LOCALE_INSTRUCTION: Record<ExplanationLocale, string> = {
  en: 'Write every explanation in English.',
  tr: 'Write every explanation in Turkish (Türkçe), natural and conversational.',
}

/** Bundan kısa metin açıklama sayılmaz. */
export const MIN_EXPLANATION_LENGTH = 20

/**
 * Kelime sınırlı kalıp. JS'in `\b`'si yalnız ASCII'yi harf sayar ("ü" ile
 * başlayan kelimede sınır bulamaz) — Unicode harf lookaround'u kullanılır.
 */
function phrase(source: string): RegExp {
  return new RegExp(`(?<!\\p{L})(?:${source})(?!\\p{L})`, 'u')
}

/**
 * Reddetme / sistem dili kalıpları. Küçük harfe çevrilmiş metinde aranır.
 * Tek kelime değil CÜMLE kalıbı: "you cannot look away", "a missing piece",
 * "eksiksiz bir deneyim" meşru açıklamadır.
 */
const REJECT_PATTERNS: RegExp[] = [
  // Reddetme cümleleri
  phrase('unable to (generate|provide|explain|determine)'),
  phrase('(film|profile) (profile )?data (is|are) missing'),
  phrase('cannot (generate|provide|determine|explain)'),
  phrase('as an ai'),
  phrase("i('m| am) (sorry|unable)"),
  phrase('üretilemiyor'),
  phrase('oluşturulamıyor'),
  phrase('profil verisi eksik'),
  phrase('yapay zeka olarak'),
  // Yapısal: prompt/şema sızıntısı
  phrase('json'),
  phrase('film ?id'),
]

/** Açıklama gösterilebilir mi? Değilse `null`. */
export function validateExplanation(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  if (text.length < MIN_EXPLANATION_LENGTH) return null
  // İki biçim: tr kuralı "AI"yı "aı" yapar (EN kalıbı kaçar), kök kural da
  // "İ"yi "i̇" yapar (TR kalıbı kaçar).
  const forms = [text.toLowerCase(), text.toLocaleLowerCase('tr')]
  if (forms.some((lower) => REJECT_PATTERNS.some((p) => p.test(lower)))) return null
  return text
}

/**
 * İstenen her filmId için doğrulanmış açıklama ya da `null`.
 * Modelin uydurduğu (istenmeyen) filmId'ler atılır.
 */
export function sanitizeExplanations(
  parsed: unknown,
  filmIds: string[],
): { explanations: Record<string, string | null>; rejected: number } {
  const source =
    parsed !== null && typeof parsed === 'object'
      ? (parsed as { explanations?: unknown }).explanations
      : undefined
  const map = source !== null && typeof source === 'object' ? (source as Record<string, unknown>) : {}

  const explanations: Record<string, string | null> = {}
  let rejected = 0
  for (const id of filmIds) {
    const valid = validateExplanation(map[id])
    if (valid === null) rejected++
    explanations[id] = valid
  }
  return { explanations, rejected }
}
