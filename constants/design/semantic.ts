/**
 * Anlamlı renk ve tipografi tokenları — bileşenler BURADAN okur, primitives.ts'ten değil.
 * Kaynak: docs/os/3_CHOSY_DESIGN_OS.md §2.3, §3.3, §12.2
 */

import { withAlpha } from '../gameThemes'; // ✅ mevcut, yeniden yazma
import { Theme } from '../theme'; // fonts.inter — mevcut SF Pro çözümü, yeniden yazma

import { palette } from './primitives';

export const color = {
  surface: {
    base: palette.ink,
    raised: palette.charcoal,
    border: palette.graphite,
  },
  text: {
    primary: palette.bone,
    /**
     * V-3 Tur G1 (G5): gauntlet sorusunun metni — `bone@80%`. `secondary`
     * (smoke) değil: soru ekranın ana cümlesi, meta kadar geri çekilmez.
     */
    primarySoft: withAlpha(palette.bone, 0.8),
    secondary: palette.smoke,
  },
  accent: {
    edge: withAlpha(palette.beam, 0.24),
    /**
     * Birincil eylemin kenarı — C.9b-UI L-2: `beam@12%` dolgu + **`@40%`
     * kenar**. `edge` (0.24) ikincil yüzeylerin sessiz kenarıdır ve bu
     * vurguyu taşımaz; ikisi KARIŞTIRILMAZ.
     *
     * Bugün tek tüketicisi Champion'ın "Nerede izlenir" birincil eylemi
     * (K-20 activation bridge). Cam DEĞİL — içerik katmanında opak dolgu
     * + kenar (v4.1: cam yalnız navigasyonda).
     */
    edgeStrong: withAlpha(palette.beam, 0.4),
    fill: withAlpha(palette.beam, 0.12),
    focus: withAlpha(palette.beam, 0.6),
    active: palette.beam,
  },
  reward: {
    primary: palette.marquee,
  },
} as const;

/**
 * Işık sızmasının zemindeki opaklığı — DESIGN_OS §5.2 `BLEED_CONSTRAINTS`.
 * Bileşene hardcode EDİLMEZ.
 *
 * 0.10 → 0.30 (CTO kararı 15.08.2026, cihaz testi bulgusu). §5.2'nin özgün
 * 0.10 değeri `ink` (#08090B) zemininde ölçülebilir ama GÖRÜLEMEZ bir sızma
 * üretiyordu: 400 filmlik ölçümde kompozit, zeminden medyan 1/255 ayrışıyordu
 * (%90'ı Δ ≤ 2). Teorik tavanda bile (l=0.22, c=0.08) yalnız Δ5.
 *
 * 0.30, `clamp` modunda yeniden hesaplanmış renklerle **Δ14-16** verir — bu
 * tam olarak sistemin kendi `elev-0 → elev-1` (`ink` → `charcoal`, Δ15)
 * yükseklik adımıdır, yani görünürlüğün sistem içindeki referansı.
 *
 * Erişilebilirlik marjı korunuyor: bu alfada `bone` metin kontrastı 15.7:1,
 * §5.3 eşiği 4.5:1. Kontrol yine de her renk değişiminde çalışır.
 *
 * Renk/parlaklık tavanları (maxChroma 0.08, maxLightness 0.22) DEĞİŞMEDİ ve
 * burada YOK — onlar backend'in işi (migration 084+085), istemci tekrar
 * kırpmaz.
 */
export const BLEED_ALPHA = 0.3;

/**
 * Tipografi ölçeği — DESIGN_OS §3.3. `display-*` → Archivo Expanded,
 * `meta*` → Martian Mono, geri kalanı SF Pro (`Theme.fonts.inter`).
 *
 * Font aile adları `app/_layout.tsx`'teki `useFonts()` anahtarlarıyla
 * birebir eşleşmeli — biri değişirse diğeri kırılır.
 */
export const type = {
  'display-xl': { fontFamily: 'ArchivoExpanded_700Bold', fontSize: 40, lineHeight: 44, letterSpacing: -2 },
  'display-l': { fontFamily: 'ArchivoExpanded_700Bold', fontSize: 30, lineHeight: 34, letterSpacing: -1.5 },
  'display-m': { fontFamily: 'ArchivoExpanded_600SemiBold', fontSize: 22, lineHeight: 26, letterSpacing: -1 },

  title: { fontFamily: Theme.fonts.inter, fontWeight: '600', fontSize: 20, lineHeight: 24, letterSpacing: -0.4 },
  body: { fontFamily: Theme.fonts.inter, fontWeight: '400', fontSize: 17, lineHeight: 24, letterSpacing: -0.2 },
  'body-strong': { fontFamily: Theme.fonts.inter, fontWeight: '600', fontSize: 17, lineHeight: 24, letterSpacing: -0.2 },
  callout: { fontFamily: Theme.fonts.inter, fontWeight: '400', fontSize: 15, lineHeight: 20, letterSpacing: 0 },
  caption: { fontFamily: Theme.fonts.inter, fontWeight: '400', fontSize: 13, lineHeight: 18, letterSpacing: -0.1 },

  /**
   * V-2 Tur C: letterSpacing 2 → 0.24. §3.3 "+2%" bir em oranıdır
   * (12 × 0.02 = 0.24pt); RN `letterSpacing` ise mutlak pt alır. 2pt, zaten
   * geniş olan monospace'te "1994 · 142min"i harf harf dağıtıyordu (cihaz
   * testi). `meta-strong` aynı birim hatasını taşır — bugün tüketicisi yok,
   * bu turun kapsamı dışında bırakıldı.
   */
  meta: { fontFamily: 'MartianMono_400Regular', fontSize: 12, lineHeight: 16, letterSpacing: 0.24 },
  'meta-strong': { fontFamily: 'MartianMono_600SemiBold', fontSize: 12, lineHeight: 16, letterSpacing: 2 },

  /**
   * V-3 Tur G1 (G1): bağlam pill'inin büyük harfli, harf aralıklı özeti.
   * SF Pro — mono DEĞİL (C.9b-UI G2: mono bu uzunlukta cümleyi taşırıyordu).
   * letterSpacing em oranıyla hesaplandı (V-2 Tur C notu): 12 × 0.08 = 0.96pt.
   */
  'label-caps': { fontFamily: Theme.fonts.inter, fontWeight: '600', fontSize: 12, lineHeight: 16, letterSpacing: 0.96 },

  /**
   * V-3 Tur G1, karar V3-D1: serif YALNIZCA film adlarında. Bu rol film adı
   * gösteren yerler dışında KULLANILMAZ — soru, buton, meta, pill dahil.
   * Aile adı `app/_layout.tsx` `useFonts()` anahtarıyla birebir.
   */
  filmTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 17, lineHeight: 22, letterSpacing: 0 },
} as const;

/**
 * Boyut tokenları — boşluk merdiveninde olmayan sabit ölçüler (V-3 Tur G1).
 */
export const size = {
  /** HIG asgari dokunma hedefi — eylem butonları ve bağlam pill'i. */
  touchTarget: 44,
  /** Satır içi ikon (bağlam pill'i: sol ikon + chevron). */
  iconInline: 16,
  /** Tur göstergesi noktası (G2). */
  progressDot: 6,
  /** Kenarlıklı yüzeylerin çizgi kalınlığı. */
  hairline: 1,
} as const;

/**
 * Boşluk merdiveni — DESIGN_OS §4.1. `Theme.spacing`'in xs/xxl adlarıyla
 * KARIŞTIRILMAZ — bu ayrı, gauntlet bileşenlerine özel bir ölçek.
 */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

/**
 * Köşe yarıçapı — DESIGN_OS §4.2. `chrome`, `Theme.borderRadius.xxl` ile
 * aynı değeri taşır (28) — theme.ts değiştirilmez, yalnızca referans verilir.
 */
export const radius = {
  poster: 14,
  surface: 20,
  chrome: Theme.borderRadius.xxl,
  pill: 999,
} as const;
