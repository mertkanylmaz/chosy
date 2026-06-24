import { Platform } from 'react-native';

import { Colors } from './Colors';

/**
 * MoodFlix — Design System Constants
 *
 * Migration v3 — 2026-06-23
 * - Spacing: aligned with DESIGN_SYSTEM.md (md:16, lg:24, xl:32)
 * - Typography: Inter is workhorse, PlayfairDisplay ONLY for display + rating
 * - Shadows: amber glow replaces cream glow
 * - All deprecated exports preserved for backward compat
 */

// ─── Font Family Constants ──────────────────────────────────────────────────
const FONT_INTER = Platform.select({
  ios: 'System',        // San Francisco ≈ Inter on iOS
  android: 'sans-serif', // Roboto ≈ Inter on Android
  default: undefined,
});
const FONT_DISPLAY = 'PlayfairDisplay_700Bold';
const FONT_DISPLAY_BLACK = 'PlayfairDisplay_900Black';

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
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
    /** @deprecated Use 'full' — kept for backward compat */
    pill: 9999,
  },

  // ─── Typography ─────────────────────────────────────────────────────────
  // Rule: System font (SF Pro) is the workhorse. PlayfairDisplay is the
  // "premium sprinkle" — ONLY for film detail titles (display) and ratings.
  // Never for buttons, labels, or body text.
  //
  // Type Scale (v2 — 2026-06-23):
  //   display  32/38  — hero text, archetype reveal
  //   heading  22/28  — section headings
  //   subhead  17/22  — card titles, film names
  //   body     15/22  — main content, AI pitch
  //   caption  13/18  — meta info, year, director
  //   micro    11/14  — badges, chips, tags
  typography: {
    /** Hero text, archetype reveal — PlayfairDisplay Bold 32 */
    display: {
      fontSize: 32,
      lineHeight: 38,
      fontFamily: FONT_DISPLAY,
      fontWeight: '700' as const,
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
      color: Colors.textPrimary,
    },
    /** Main content, descriptions — System Regular 15 */
    body: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '400' as const,
      fontFamily: FONT_INTER,
      color: Colors.textPrimary,
    },
    /** Meta info, timestamps, year, director — System Regular 13 */
    caption: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '400' as const,
      fontFamily: FONT_INTER,
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
    /** Rating numbers — PlayfairDisplay Bold 16, gold */
    rating: {
      fontSize: 16,
      fontFamily: FONT_DISPLAY,
      fontWeight: '700' as const,
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
  fonts: {
    inter: FONT_INTER,
    display: FONT_DISPLAY,
    displayBlack: FONT_DISPLAY_BLACK,
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
  displayBoldFont: FONT_DISPLAY_BLACK,
  bodyFont: FONT_INTER,
} as const;