import { Platform, type TextStyle } from 'react-native';

import { Colors } from './Colors';

/**
 * MoodFlix — Design System Constants
 *
 * Migration v3 — 2026-06-23
 * - Spacing: aligned with DESIGN_SYSTEM.md (md:16, lg:24, xl:32)
 * - Typography: Inter (= SF Pro) is workhorse
 *   (V-1 Tur 7: serif emekli, DESIGN_OS §3.2 — display, serif* ve rating artık SF Pro)
 * - Shadows: amber glow replaces cream glow
 * - All deprecated exports preserved for backward compat
 */

// ─── Font Family Constants ──────────────────────────────────────────────────
/**
 * Sistem fontu. Adı tarihsel bir yanlış anlamadan geliyor — **Inter yüklenmiyor**,
 * repoda Inter TTF yok. iOS'ta bu doğrudan SF Pro'dur, yani
 * `.claude/apple-design-standard-2026.md` §2'nin "SF Pro kullan" maddesi
 * zaten karşılanmış durumda (§6.5, no-op).
 * Adı `Theme.fonts.inter` üzerinden geniş kullanımda olduğu için değiştirilmedi.
 */
const FONT_INTER = Platform.select({
  ios: 'System',        // San Francisco — SF Pro
  android: 'sans-serif', // Roboto
  default: undefined,
});
/**
 * Başlık ailesi — DESIGN_OS §3.3 `title` rolü: SF Pro Display 600.
 *
 * V-1 Tur 7 (D10): eski serif display ailesi emekli (§3.2). Bu token'ların
 * her tüketicisi bir ekran/kart/oyun başlığıdır, hiçbiri §3.4'ün üç "marka anı"ndan biri
 * değildir — o yüzden Archivo Expanded DEĞİL, SF Pro. Marka anları
 * `constants/design/semantic.ts` `type['display-*']`'a doğrudan bağlanır.
 *
 * iOS'ta `System` aile adı ≥20pt'de Display optik kesitini kendisi seçer;
 * ağırlık aile adında değil `fontWeight`'te taşınır — bu token'ı kullanan
 * her stil `fontWeight` vermelidir, yoksa 400'e düşer.
 */
const FONT_DISPLAY = FONT_INTER;

export const Theme = {
  // ─── Spacing (synced with DESIGN_SYSTEM.md) ─────────────────────────────
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // ─── Border Radius (synced with DESIGN_SYSTEM.md) ──────────────────────
  // Not: bağlayıcı olan bu merdiven DEĞİL, aşağıdaki `concentric` kuralıdır.
  // Merdiven yalnız başlangıç değerlerini verir.
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 28,
    full: 9999,
    /** @deprecated Use 'full' — kept for backward compat */
    pill: 9999,
  },

  /**
   * Concentric geometri — Apple 2026 "Harmony" prensibi.
   * İç içe yüzeylerin köşeleri eş merkezli görünmeli: `iç = dış − padding`.
   *
   * Tipik cam kullanımı: dış node radius + 1px kenarlık taşır, iç node
   * `overflow:'hidden'` ile `concentric(dış, 1)` alır.
   *
   * @param outer   Dış container'ın border radius'u
   * @param padding Dış ile iç arasındaki boşluk (padding veya borderWidth)
   * @returns İç elemanın alması gereken radius (asla 0'ın altına inmez)
   *
   * @example Theme.concentric(Theme.borderRadius.lg, Theme.spacing.sm) // 16 − 8 = 8
   */
  concentric: (outer: number, padding: number): number =>
    Math.max(0, outer - padding),

  // ─── Dynamic Type ───────────────────────────────────────────────────────
  fontScale: {
    /**
     * Sabit boyutlu kutudaki metnin `maxFontSizeMultiplier` tavanı — oyun
     * klavyesi tuşu, başlık maskesi slotu, arama input'u. Kutu büyümediği için
     * tavansız metin AX boyutlarında kırpılıyor/taşıyordu (B-1 / Fix 8).
     *
     * YALNIZ sabit kutulara verilir. Etiket ve gövde metni tam ölçeklenir
     * (K-54). Karar: KAPSAM_KILIDI v1.36.
     */
    fixedBoxMax: 1.3,
  },

  // ─── Typography ─────────────────────────────────────────────────────────
  // Rule (V-1 Tur 7, D10 — DESIGN_OS §3.2/§3.3):
  //   Serif emekli (§3.2). Eski "serif = otorite" katmanının token'ları (display,
  //   serifTitle, serifHero, serifQuote, rating) adlarını korur — donmuş oyunlar
  //   bu adlarla okuyor — ama değerleri SF Pro'dur: başlıklar `title` rolü
  //   (600), alıntı gövdesi 400 italik, puan 600 tabular. `serif*` adları
  //   tarihseldir, yeni kodda kullanılmaz; yeni ekran semantic.ts `type`'ı okur.
  //
  //   Ekran anatomisi: eyebrow → başlık → kahraman görsel → aksiyon → meta
  //   Ayrıntı: DESIGN_SYSTEM.md › "Festival Layer — Games"
  //
  // Type Scale (v2 — 2026-06-23):
  //   display  32/38  — hero text, archetype reveal
  //   heading  22/28  — section headings
  //   subhead  17/22  — card titles, film names
  //   body     15/22  — main content, AI pitch
  //   caption  13/18  — meta info, year, director
  //   micro    11/14  — badges, chips, tags
  typography: {
    /** Hero text — SF Pro Display 600, 32 (§3.3 title rolü) */
    display: {
      fontSize: 32,
      lineHeight: 38,
      fontFamily: FONT_DISPLAY,
      fontWeight: '600' as const,
      letterSpacing: -0.5,
      color: Colors.textPrimary,
    },
    /** Screen titles, page headings — System Bold 24 */
    h1: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '700' as const,
      fontFamily: FONT_INTER,
      letterSpacing: -0.3,
      color: Colors.textPrimary,
    },
    /** Section headers ("Son Aramalar", "Watchlist'inden") — System SemiBold 22 */
    h2: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '600' as const,
      fontFamily: FONT_INTER,
      letterSpacing: -0.3,
      color: Colors.textPrimary,
    },
    /** Card titles, film names, list headers — System SemiBold 17 */
    h3: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '600' as const,
      fontFamily: FONT_INTER,
      letterSpacing: -0.4,
      color: Colors.textPrimary,
    },
    /** Main content, descriptions — System Regular 15 */
    body: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '400' as const,
      fontFamily: FONT_INTER,
      letterSpacing: -0.2,
      color: Colors.textPrimary,
    },
    /** Meta info, timestamps, year, director — System Regular 13 */
    caption: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '400' as const,
      fontFamily: FONT_INTER,
      letterSpacing: -0.1,
      color: Colors.textSecondary,
    },
    /** Badges, chips, tags, micro labels — System Medium 11 */
    micro: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '500' as const,
      fontFamily: FONT_INTER,
      letterSpacing: 0.3,
      color: Colors.textSecondary,
    },
    /** Active tab label — System Bold 11 */
    tabLabel: {
      fontSize: 11,
      fontWeight: '700' as const,
      fontFamily: FONT_INTER,
      color: Colors.accentPrimary,
    },
    // ── Festival Layer (oyun ekranları) ──────────────────────────────────
    // Bu beş token yalnız oyun/profil festival katmanında kullanılır.
    // Uygulamanın geri kalanı yukarıdaki ölçeği kullanmaya devam eder.

    /**
     * Bölüm üstü mikro etiket — "TODAY'S THEME", "CLUE 01", "ACTIVE CLUES".
     * Metin `t()` üzerinden zaten büyük harf gelmiyorsa textTransform ile büyütülür.
     */
    eyebrow: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600' as const,
      fontFamily: FONT_INTER,
      letterSpacing: 1.6,
      textTransform: 'uppercase' as const,
      color: Colors.textTertiary,
    },
    /** Oyun adı, dava başlığı — SF Pro Display 600, 26 (ad tarihsel, serif DEĞİL) */
    serifTitle: {
      fontSize: 26,
      lineHeight: 32,
      fontFamily: FONT_DISPLAY,
      fontWeight: '600' as const,
      letterSpacing: -0.2,
      color: Colors.textPrimary,
    },
    /** Tema adı, sonuç anı, film adı — SF Pro Display 600, 34 (ad tarihsel) */
    serifHero: {
      fontSize: 34,
      lineHeight: 40,
      fontFamily: FONT_DISPLAY,
      fontWeight: '600' as const,
      letterSpacing: -0.4,
      color: Colors.textPrimary,
    },
    /** Logline ve alıntı gövdesi — SF Pro 400 italik, 22 (ad tarihsel) */
    serifQuote: {
      fontSize: 22,
      lineHeight: 32,
      fontFamily: FONT_DISPLAY,
      fontWeight: '400' as const,
      fontStyle: 'italic' as const,
      color: Colors.textPrimary,
    },
    /** Skor, DNA, level sayıları — sistem fontu, tabular hizalama */
    stat: {
      fontSize: 28,
      lineHeight: 32,
      fontWeight: '700' as const,
      fontFamily: FONT_INTER,
      // Dosya sonundaki `as const` diziyi readonly yapar ve TextStyle'a atanamaz
      // hâle getirir — açık tip ataması bunu engelliyor.
      fontVariant: ['tabular-nums'] as NonNullable<TextStyle['fontVariant']>,
      letterSpacing: -0.5,
      color: Colors.textPrimary,
    },

    /** Rating numbers — SF Pro 600 tabular, 16, gold (V-1 Tur 7 CTO kararı) */
    rating: {
      fontSize: 16,
      fontFamily: FONT_INTER,
      fontWeight: '600' as const,
      fontVariant: ['tabular-nums'] as NonNullable<TextStyle['fontVariant']>,
      color: Colors.gold,
    },

    // ── Backward compat aliases ──────────────────────────────────────────
    /** @deprecated Use caption */
    bodyGrey: {
      fontSize: 15,
      lineHeight: 22,
      fontFamily: FONT_INTER,
      color: Colors.textSecondary,
    },
    /** @deprecated Use rating */
    gold: { color: Colors.gold },
    /** @deprecated Use rating */
    goldBold: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: Colors.gold,
    },
  },

  // ─── Shadows ────────────────────────────────────────────────────────────
  shadow: {
    /** Standard card shadow */
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    /** Cream glow — for primary CTA and highlighted elements */
    glow: {
      shadowColor: Colors.accentPrimary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 8,
    },
    /** Gold glow — for ratings and premium elements */
    goldGlow: {
      shadowColor: Colors.gold,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
  },

  // ─── Font Family Exports ────────────────────────────────────────────────
  // `displayBlack`/`displayItalic` eski serifin kesitleriydi; aile artık tek
  // (SF Pro) — ağırlık `fontWeight`, italik `fontStyle` ile verilir.
  fonts: {
    inter: FONT_INTER,
    display: FONT_DISPLAY,
    /** @deprecated Eski serif Black kesitiydi — `display` + `fontWeight` kullanın */
    displayBlack: FONT_DISPLAY,
    /** @deprecated Eski serif Italic kesitiydi — `display` + `fontStyle: 'italic'` kullanın */
    displayItalic: FONT_DISPLAY,
  },
} as const;

// ─── Deprecated Named Exports (backward compat) ──────────────────────────
// Eski ekranlarda kullanılıyor. Yeni ekranlarda Theme.xxx tercih edin.

/** @deprecated Use Theme.borderRadius */
export const Radius = {
  card: 16,
  button: 14,
  tag: 20,
  input: 16,
  chip: 10,
  avatar: 40,
} as const;

/** @deprecated Use Theme.shadow */
export const Shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  button: {
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  light: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
} as const;

/** @deprecated Use Theme.spacing */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** @deprecated Use Theme.fonts */
export const Typography = {
  displayFont: FONT_DISPLAY,
  displayBoldFont: FONT_DISPLAY,
  bodyFont: FONT_INTER,
} as const;