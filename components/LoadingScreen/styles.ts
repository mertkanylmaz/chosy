/**
 * LoadingScreen — Premium animated splash screen styles.
 * Matte black background with cream/champagne accents.
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';

/** Matte background — matches app background */
const BG_MATTE = Colors.background;

export const styles = StyleSheet.create({
  // ─── Container ────────────────────────────────────────────────────────────────
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG_MATTE,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },

  // ─── Content wrapper — vertically centered group ──────────────────────────────
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Film strip icon wrapper ──────────────────────────────────────────────────
  iconWrapper: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /** Radial glow behind the rotating icon */
  glowCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.accentDim,
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 50,
    elevation: 12,
  },

  // ─── Text section — static, never animated ───────────────────────────────────
  textSection: {
    alignItems: 'center',
  },

  /** "chosy.ai" — premium serif */
  brandName: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 36,
    color: Colors.textPrimary,
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  /** "AI FILM RECOMMENDER" — spaced uppercase */
  subtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
});
