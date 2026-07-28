/**
 * Imposter güven bahsi (confidence betting) — saf hesap fonksiyonları.
 *
 * Oyuncu her round'da %50/%75/%100 güven yatırır. Yüksek güven doğruda
 * ödülü, yanlışta cezayı büyütür. Nötr bahis (%50) her iki durumda ×1.0
 * olduğu için bahis yapmayan oyuncunun XP'si değişmez.
 *
 * Katsayılar app_config'ten gelir — burada hardcode edilmez.
 */

/** app_config: imposter_confidence_config */
export interface ImposterConfidenceConfig {
  levels: number[]
  correct_factor: Record<string, number>
  wrong_factor: Record<string, number>
}

/** Ortalamaya girecek minimum round bilgisi */
export interface RoundFactorLike {
  xp_factor?: number
}

/**
 * Nötr config — app_config okunamazsa kullanılır.
 * Tüm çarpanlar 1.0 olduğu için skorlama bahis öncesi davranışa döner;
 * oyun 500 vermek yerine çalışmaya devam eder. Kullanan taraf durumu
 * Sentry'ye bildirmekle yükümlüdür (sessiz fallback yasağı).
 */
export const NEUTRAL_CONFIDENCE_CONFIG: ImposterConfidenceConfig = {
  levels: [50],
  correct_factor: { '50': 1.0 },
  wrong_factor: { '50': 1.0 },
}

/**
 * Verilen güven ve round sonucuna karşılık gelen XP çarpanını döner.
 * Config'te tanımsız bir seviye gelirse nötr (1) döner — XP kaybı yaşanmaz.
 */
export function resolveXpFactor(
  config: ImposterConfidenceConfig,
  confidence: number,
  correct: boolean,
): number {
  const key = String(confidence)
  const factor = correct ? config.correct_factor[key] : config.wrong_factor[key]
  return typeof factor === 'number' ? factor : 1
}

/** Güven seviyesi config'te tanımlı mı */
export function isValidConfidence(
  config: ImposterConfidenceConfig,
  confidence: number,
): boolean {
  return config.levels.includes(confidence)
}

/**
 * Oyunun toplam güven çarpanı — round çarpanlarının ortalaması.
 * xp_factor taşımayan eski kayıtlar nötr (1) sayılır.
 */
export function meanXpFactor(rounds: RoundFactorLike[]): number {
  if (rounds.length === 0) return 1
  const total = rounds.reduce((sum, r) => sum + (r.xp_factor ?? 1), 0)
  return total / rounds.length
}

/**
 * Baz XP'ye güven çarpanını uygular.
 * Streak çarpanı BUNDAN SONRA uygulanır.
 */
export function applyConfidenceFactor(baseXp: number, factor: number): number {
  return Math.round(baseXp * factor)
}

/**
 * FadeIn ipucu kredisi: her yanlış tahmin 1 ipucu hakkı verir.
 * Sunucu otoritesi — istemci sayacına güvenilmez.
 */
export function hasHintCredit(revealedCount: number, guessCount: number): boolean {
  return revealedCount < guessCount
}
