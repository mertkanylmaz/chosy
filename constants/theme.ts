import { Platform } from 'react-native';

import { Colors } from './Colors';

/**
 * Chosy.ai tasarım sistemi sabitleri.
 * Spacing, borderRadius, tipografi ve gölge değerlerini tek noktadan yönetir.
 */
export const Theme = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 100,
  },
  typography: {
    h1: { fontSize: 32, fontFamily: 'PlayfairDisplay_700Bold', color: Colors.textWhite },
    h2: { fontSize: 24, fontFamily: 'PlayfairDisplay_700Bold', color: Colors.textWhite },
    h3: { fontSize: 18, fontFamily: 'PlayfairDisplay_700Bold', color: Colors.textWhite },
    body: { fontSize: 16, color: Colors.textWhite },
    bodyGrey: { fontSize: 14, color: Colors.textGrey },
    caption: { fontSize: 12, color: Colors.textGrey },
    gold: { color: Colors.gold },
    goldBold: { fontSize: 16, fontWeight: '700' as const, color: Colors.gold },
  },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    glow: {
      shadowColor: Colors.gold,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 8,
    },
  },
};

// ─── Geriye dönük uyumluluk ───────────────────────────────────────────────────
// Eski ekranlarda kullanılan named export'lar. Yeni ekranlarda Theme.xxx kullan.

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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  button: {
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  light: {
    shadowColor: '#000',
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

/** @deprecated Use Theme.typography */
export const Typography = {
  displayFont: 'PlayfairDisplay_700Bold',
  displayBoldFont: 'PlayfairDisplay_900Black',
  bodyFont: Platform.select({ ios: 'System', android: 'sans-serif', default: undefined }),
} as const;
