/**
 * Mood arama girdisi + sunucu hata kodu → kullanıcı mesajı eşlemesi (MONEY-1C). Saf mantık.
 *
 * Sunucu `parse-mood` kırpılmış girdiyi 2 karakterin altında reddeder (400 INVALID_INPUT,
 * `_shared/moodInput.ts`). İstemci aynı sınırı baştan uygular ki geçersiz istek ağa
 * çıkmasın. `mood_offer_enabled` KAPALIYKEN eski sınır (1) geçerlidir.
 */

/** Sunucudaki `MIN_INPUT_CHARS` ile aynı tutulur. */
export const MOOD_MIN_CHARS = 2;
/** Bayrak kapalıyken bugünkü kural: boş olmayan her şey. */
const LEGACY_MIN_CHARS = 1;

export function minMoodChars(offerEnabled: boolean): number {
  return offerEnabled ? MOOD_MIN_CHARS : LEGACY_MIN_CHARS;
}

export function isMoodInputSubmittable(text: string, offerEnabled: boolean): boolean {
  return text.trim().length >= minMoodChars(offerEnabled);
}

/**
 * Edge hata kodu için çevrilmiş mesaj anahtarı; eşleşme yoksa null (çağıran mevcut
 * mesajı kullanır). Bayrak kapalıyken HER ZAMAN null: bugünkü mesajlar değişmez.
 * 503 kodları "tekrar dene" mesajıdır — paywall gösterilmez, kota tüketilmemiştir.
 */
export function moodErrorMessageKey(code: string, offerEnabled: boolean): string | null {
  if (!offerEnabled) return null;
  switch (code) {
    case 'QUOTA_UNAVAILABLE':
    case 'TIER_NOT_CONFIGURED':
      return 'moodOffer.errorQuotaUnavailable';
    case 'INVALID_INPUT':
      return 'moodOffer.errorInvalidInput';
    default:
      return null;
  }
}
