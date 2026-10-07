/**
 * Spotlight'ın oyun ekranı DIŞINDA da okunan sabitleri — tek kaynak.
 *
 * Saf modül: React/RN import YOK.
 */

/**
 * En yüksek bulanıklık — hiç harf açılmamışken. Oyun ekranı bunu açılan
 * harf oranıyla azaltır; şampiyon ekranındaki bonus kartı (S-2) bugünün
 * karesini tam bu değerde gösterir, oyunun başladığı görüntüyle aynı.
 */
// KALİBRASYON DÜĞMESİ (07.10.2026: 40 → 24) — kurucu cihazda 5 bulmacayla ayarlar.
// Tek yer burası: oyun, teaser ve bonus kartı hep bunu okur.
export const SPOTLIGHT_MAX_BLUR = 24;

/**
 * Tuş basış geri bildirimi — ince, yaylanmasız (spring/bounce yok). Süre token
 * (`REDUCED_MOTION_DURATION.crossFade`), easing `EASE_OUT_QUART`. Reduce Motion'da
 * ölçek uygulanmaz, yalnız opaklık.
 */
export const SPOTLIGHT_KEY_PRESS = {
  scale: 0.98,
  opacity: 0.7,
} as const;

/**
 * Odak katmanı yükleme bekleme sınırı (ms) — gelen katın `onLoad`'u bu sürede
 * gelmezse kat yine de öne alınır (FocusStill). Varsayım: expo-image yalnız
 * `blurRadius` değişince `onLoad`'u yeniden tetikler. Cihazda doğrulanana
 * kadar görsel eski düzeyde sıkışmasın diye emniyet.
 */
export const SPOTLIGHT_STILL_LOAD_TIMEOUT_MS = 1200;
