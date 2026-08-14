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
    secondary: palette.smoke,
  },
  accent: {
    edge: withAlpha(palette.beam, 0.24),
    fill: withAlpha(palette.beam, 0.12),
    focus: withAlpha(palette.beam, 0.6),
    active: palette.beam,
  },
  reward: {
    primary: palette.marquee,
  },
} as const;

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

  meta: { fontFamily: 'MartianMono_400Regular', fontSize: 12, lineHeight: 16, letterSpacing: 2 },
  'meta-strong': { fontFamily: 'MartianMono_600SemiBold', fontSize: 12, lineHeight: 16, letterSpacing: 2 },
} as const;
