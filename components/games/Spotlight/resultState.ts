/**
 * Spotlight sonuç ekranı durumu — saf (React/RN importu yok).
 *
 * Girdi YALNIZCA {won, attempts, maxAttempts}. Harf verisi (denenmiş harfler,
 * açılmış pozisyonlar) bu fonksiyona parametre olarak GİREMEZ: etiket harf
 * sayısına bağlı olamaz. `NoLetterData` bunu tip düzeyinde kapatır — nesne
 * literali ile harf alanı geçmek derleme hatasıdır.
 *
 * ── Invariant (sunucu semantiği, DEĞİŞMEZ) ──────────────────────────────────
 * `supabase/functions/submit-guess/index.ts:677` — `const newAttempts =
 * scoreRow.attempts + 1`: doğru film tahmini de `attempts`'a eklenir. Yani
 * kazanılan oyunda `attempts` = (kaçırılan haklar) + 1. İstemci türetmesi:
 *
 *   won  → misses = attempts - 1;  chancesLeft = maxAttempts - misses
 *   lost → chancesLeft = 0
 *
 * ── FLAWLESS tanımı (CTO kararı) ────────────────────────────────────────────
 * FLAWLESS = doğru film tahmininden ÖNCE sıfır hak kaybı. Sıfır harf seçimi
 * DEMEK DEĞİLDİR; doğru harfler hak harcamaz ve etiketi etkilemez.
 * `chancesLeft === maxAttempts` → flawless, aksi halde found.
 *
 * ── Anomaliler ──────────────────────────────────────────────────────────────
 * maxAttempts <= 0 (ya da tam sayı değil), attempts negatif/tam sayı değil,
 * attempts > maxAttempts, won && attempts < 1 → `ok:false`. SESSİZ CLAMP YOK:
 * çağıran hak satırını çizmez ve olayı Sentry'ye yazar.
 *
 * Test: `tests/games/spotlightResultState.test.ts`.
 */

/** Harf verisinin bu fonksiyona girmesini tip düzeyinde engeller. */
type NoLetterData = {
  triedLetters?: never;
  revealed?: never;
  revealedMap?: never;
  letters?: never;
};

export type ResultStateInput = {
  readonly won: boolean;
  /** Sunucudaki `game_scores.attempts` — kazanılan oyunda doğru tahmin DAHİL */
  readonly attempts: number;
  /** Sunucudaki `puzzle.max_attempts` */
  readonly maxAttempts: number;
} & NoLetterData;

export type ResultVariant = 'flawless' | 'found' | 'lost';

export type ResultStateReason =
  | 'invalid_max_attempts'
  | 'invalid_attempts'
  | 'attempts_exceed_max'
  | 'won_without_attempt';

export type ResultState =
  | {
      ok: true;
      variant: ResultVariant;
      chancesLeft: number;
      total: number;
    }
  | {
      ok: false;
      reason: ResultStateReason;
    };

export function resultState({ won, attempts, maxAttempts }: ResultStateInput): ResultState {
  if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
    return { ok: false, reason: 'invalid_max_attempts' };
  }
  if (!Number.isInteger(attempts) || attempts < 0) {
    return { ok: false, reason: 'invalid_attempts' };
  }
  if (attempts > maxAttempts) {
    return { ok: false, reason: 'attempts_exceed_max' };
  }
  if (won && attempts < 1) {
    return { ok: false, reason: 'won_without_attempt' };
  }

  if (!won) {
    return { ok: true, variant: 'lost', chancesLeft: 0, total: maxAttempts };
  }

  const misses = attempts - 1;
  const chancesLeft = maxAttempts - misses;
  return {
    ok: true,
    variant: chancesLeft === maxAttempts ? 'flawless' : 'found',
    chancesLeft,
    total: maxAttempts,
  };
}
