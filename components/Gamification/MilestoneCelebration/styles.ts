/**
 * MilestoneCelebration stilleri — CDO spec'e uygun.
 * Spec: .claude/specs/GAMIFICATION_UI_SPEC.md — Component 2
 */
import { Dimensions, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_PADDING = Theme.spacing.xl;

export const styles = StyleSheet.create({
  // ─── Overlay ────────────────────────────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },

  // ─── İçerik ─────────────────────────────────────────────────────────────────
  content: {
    alignItems: 'center',
    paddingHorizontal: CONTENT_PADDING,
    width: SCREEN_WIDTH,
  },

  // ─── Konfeti alanı ──────────────────────────────────────────────────────────
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '30%',
    overflow: 'hidden',
  },

  // ─── Flick/Lumi ─────────────────────────────────────────────────────────────
  mascotContainer: {
    marginBottom: Theme.spacing.lg,
  },

  // ─── Milestone Icon ─────────────────────────────────────────────────────────
  milestoneIcon: {
    fontSize: 32,
    marginBottom: Theme.spacing.md,
  },

  // ─── Title ──────────────────────────────────────────────────────────────────
  title: {
    ...Theme.typography.h1,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },

  // ─── Description ────────────────────────────────────────────────────────────
  description: {
    ...Theme.typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: SCREEN_WIDTH - 2 * CONTENT_PADDING,
    marginBottom: Theme.spacing.xl,
  },

  // ─── CTA Button ─────────────────────────────────────────────────────────────
  ctaButton: {
    width: SCREEN_WIDTH - 2 * CONTENT_PADDING,
    height: 52,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadow.glow,
  },
  ctaButtonPressed: {
    backgroundColor: Colors.accentHover,
  },
  ctaText: {
    color: Colors.textOnAccent,
    fontSize: 16,
    fontWeight: '600',
  },
});
