/**
 * Şampiyon hero yüksekliği — F2.3. Saf modül: React/RN import YOK, Deno okur.
 *
 * Hero, ekranın geri kalanına sığdırılır: pencere yüksekliğinden hero'nun
 * ALTINDAKİ içeriğin yüksekliği (başlık bloğu + Watch now satırı + Spotlight
 * kartı + sayaç, `onLayout` ile ölçülür) ve alt pay (tab bar) çıkarılır.
 * Sonuç [HERO_MIN_HEIGHT, pencere × HERO_MAX_RATIO] aralığına sınırlanır:
 * içerik uzadıkça (Dynamic Type, 2 satır başlık) hero 160pt'ye kadar küçülür,
 * ondan sonrası kaydırmadır.
 */

/** Hero'nun en küçük yüksekliği (pt). */
export const HERO_MIN_HEIGHT = 160;

/** Hero'nun pencere yüksekliğindeki en büyük payı. */
export const HERO_MAX_RATIO = 0.42;

/**
 * @param screenH   pencere yüksekliği (pt)
 * @param contentH  hero'nun altındaki içeriğin yüksekliği (pt); henüz
 *                  ölçülmediyse 0 → sonuç üst sınır
 * @param tabInset  alttan örtülen pay: tab bar + güvenli alan (+ kaydırma alt boşluğu)
 */
export function heroHeight(screenH: number, contentH: number, tabInset: number): number {
  const max = Math.round(screenH * HERO_MAX_RATIO);
  const available = screenH - contentH - tabInset;
  return Math.round(Math.min(max, Math.max(HERO_MIN_HEIGHT, available)));
}
