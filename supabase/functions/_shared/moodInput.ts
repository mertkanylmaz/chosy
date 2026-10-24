/**
 * parse-mood girdi doğrulaması (MONEY-1C). Saf fonksiyon — kota, ağ, DB yok;
 * handler bunu kota tüketiminden ÖNCE çağırır.
 *
 * Yalnız boş / çok kısa / çok uzun / string olmayan girdi reddedilir. İçerik
 * yargılanmaz: "😭" ya da tek kelime geçerli bir moddur.
 */

/** Kırpılmış girdinin alt sınırı. Tek karakter ("a", "?") bir mood değildir. */
export const MIN_INPUT_CHARS = 2
/** Ham (kırpılmamış) girdinin üst sınırı; `mood_searches.mood_text` da 500'e keser. */
export const MAX_INPUT_CHARS = 500

/** Geçerliyse ham metni, değilse `null` döner. */
export function validateRawInput(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (value.trim().length < MIN_INPUT_CHARS) return null
  if (value.length > MAX_INPUT_CHARS) return null
  return value
}
