/**
 * Yükleme iskeletinin minimum görünür süresi (Faz 2-9a): sonuç çok hızlı gelirse iskelet bir an
 * görünüp kaybolmasın. Saf fonksiyon — RN/zamanlayıcı yok, deno ile test edilir.
 * Yapay gecikme DEĞİL: yalnız iskelet ZATEN ekrandayken, görünür kalması gereken kalan süre.
 */
export function remainingLoadingHold(shownAt: number, now: number, minVisibleMs: number): number {
  if (shownAt <= 0) return 0; // yükleme hiç gösterilmediyse (ör. doğrudan hata) bekletme yok
  return Math.max(0, minVisibleMs - Math.max(0, now - shownAt));
}
