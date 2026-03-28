import { Platform } from 'react-native';

import { Colors } from './Colors';

/**
 * MoodFlix — Design System Constants
 *
 * Migration v2 — 2026-03-27
 * - Spacing: aligned with DESIGN_SYSTEM.md (md:16, lg:24, xl:32)
 * - Typography: Inter is workhorse, PlayfairDisplay ONLY for display + rating
 * - Shadows: violet glow replaces gold glow
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
  // Rule: Inter is the workhorse. PlayfairDisplay is the "premium sprinkle"
  // — ONLY for film detail titles (display) and rating numbers.
  // Never for buttons, labels, or body text.
  typography: {
    /** Film detail title, special headings — PlayfairDisplay Bold 28-32 */
    display: {
      fontSize: 30,
      fontFamily: FONT_DISPLAY,
      color: Colors.textPrimary,
    },
    /** Screen titles — Inter Bold 24 */
    h1: {
      fontSize: 24,
      fontWeight: '700' as const,
      fontFamily: FONT_INTER,
      color: Colors.textPrimary,
    },
    /** Section headers — Inter SemiBold 20 */
    h2: {
      fontSize: 20,
      fontWeight: '600' as const,
      fontFamily: FONT_INTER,
      color: Colors.textPrimary,
    },
    /** Card titles, list headers — Inter SemiBold 16 */
    h3: {
      fontSize: 16,
      fontWeight: '600' as const,
      fontFamily: FONT_INTER,
      color: Colors.textPrimary,
    },
    /** Main content — Inter Regular 14 */
    body: {
      fontSize: 14,
      fontFamily: FONT_INTER,
      color: Colors.textPrimary,
    },
    /** Meta info, timestamps — Inter Regular 12 */
    caption: {
      fontSize: 12,
      fontFamily: FONT_INTER,
      color: Colors.textSecondary,
    },
    /** Active tab label — Inter Bold 11 */
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
      fontSize: 14,
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
    /** Violet glow — for primary CTA and highlighted elements */
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