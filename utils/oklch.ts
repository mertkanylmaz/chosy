/**
 * OKLCH → sRGB dönüşümü. DESIGN_OS §5 ışık sızmasının istemci ayağı.
 *
 * `scripts/compute-dominant-colors.ts` renk zincirini İLERİ yönde çalıştırır
 * (sRGB → OKLab → OKLCH) ve sonucu `films.dominant_color`'a yazar. Burada AYNI
 * matrislerin analitik tersi çalışır. Björn Ottosson'un OKLab tanımı; kütüphane
 * eklenmez — üçüncü bir renk uzayı kaynağı doğmasın diye tek dosyada toplanır.
 *
 * ⚠️ Burada BLEED_CONSTRAINTS (maxLightness 0.22 / maxChroma 0.08) YENİDEN
 * UYGULANMAZ. Sınırlar migration 084+085'in CHECK kısıtıyla DB'de garanti
 * altında; istemcide tekrar kırpmak iki ayrı doğruluk kaynağı üretirdi.
 * Aşağıdaki tek kırpma sayısaldır: ters matris kayan nokta hatasıyla kanalı
 * [0,1] dışına 1e-6 taşırabilir, bu bir renk kararı değil taşma koruması.
 */

import type { OklchColor } from '@/types/gauntlet';

/** Ters gamma: linear sRGB kanalı → 0-255 sRGB. */
function linearToSrgb255(channel: number): number {
  const clamped = channel < 0 ? 0 : channel > 1 ? 1 : channel;
  const encoded = clamped <= 0.0031308
    ? clamped * 12.92
    : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
}

function toHexPair(value: number): string {
  return value.toString(16).padStart(2, '0');
}

/**
 * OKLCH {l, c, h} → `#rrggbb`.
 *
 * `h` derece cinsindendir (085 kısıtı: 0 ≤ h < 360). Dönüş her zaman OPAK bir
 * hex'tir — alfa bu fonksiyonun işi değil, sızma katmanının opaklığı ayrı
 * uygulanır (`BLEED_ALPHA`).
 */
export function oklchToHex(color: OklchColor): string {
  const hueRad = color.h * (Math.PI / 180);
  const a = color.c * Math.cos(hueRad);
  const b = color.c * Math.sin(hueRad);

  // OKLab → LMS' (compute-dominant-colors.ts'teki ileri matrisin tersi)
  const l_ = color.l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = color.l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = color.l - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS → linear sRGB
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  return `#${toHexPair(linearToSrgb255(r))}${toHexPair(linearToSrgb255(g))}${
    toHexPair(linearToSrgb255(bl))
  }`;
}

/**
 * WCAG 2.x bağıl parlaklık. Girdi `#rrggbb`.
 * Kompozit rengin metinle kontrastını ölçmek için kullanılır (§5.3).
 */
export function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/**
 * `over` rengini `under` üzerine `alpha` opaklığıyla bindirir, sonucu hex döner.
 *
 * ⚠️ Karışım LINEAR uzayda DEĞİL, sRGB kodlanmış uzayda yapılır. Fiziksel
 * olarak "doğru" olan linear karışımdır, ama RN/GPU varsayılan alfa karışımını
 * gamma-kodlu değerler üzerinde yapar. Amaç ekranda gerçekte oluşan pikseli
 * ölçmek olduğu için compositor'ın yaptığı taklit edilir; linear karışım burada
 * kontrastı YANLIŞ tahmin ederdi.
 */
export function compositeOver(under: string, over: string, alpha: number): string {
  const mix = (offset: number): number => {
    const u = parseInt(under.slice(offset, offset + 2), 16);
    const o = parseInt(over.slice(offset, offset + 2), 16);
    return Math.round((1 - alpha) * u + alpha * o);
  };
  return `#${toHexPair(mix(1))}${toHexPair(mix(3))}${toHexPair(mix(5))}`;
}

/** WCAG kontrast oranı. Sıra önemsiz — açık/koyu kendi içinde çözülür. */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
