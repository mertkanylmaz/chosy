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
