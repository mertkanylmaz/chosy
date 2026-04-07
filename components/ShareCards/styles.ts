import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

/** RN render boyutu — 3x scale ile 1080x1350 PNG */
export const CARD_WIDTH = 360;
export const CARD_HEIGHT = 450;

export const styles = StyleSheet.create({
  // ── Offscreen container ─────────────────────────────────────────────────────
  offscreen: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    opacity: 0,
  },

  // ── Film Share Card ─────────────────────────────────────────────────────────
  filmCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: Colors.background,
    borderRadius: Theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 32,
    overflow: 'hidden',
  },
  posterBlurBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: CARD_HEIGHT * 0.3,
    opacity: 0.15,
  },
  posterGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: CARD_HEIGHT * 0.35,
  },
  poster: {
    width: 240,
    height: 320,
    borderRadius: Theme.borderRadius.lg,
    alignSelf: 'center',
    ...Theme.shadow.card,
  },
  posterPlaceholder: {
    width: 240,
    height: 320,
    borderRadius: Theme.borderRadius.lg,
    alignSelf: 'center',
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterPlaceholderEmoji: {
    fontSize: 48,
  },
  filmTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 20,
  },
  filmMeta: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  divider: {
    width: 200,
    height: 1,
    backgroundColor: Colors.bgSubtle,
    alignSelf: 'center',
    marginTop: 20,
  },
  moodQuote: {
    marginTop: 16,
    alignItems: 'center',
  },
  quoteOpen: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    color: Colors.gold,
  },
  moodText: {
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginHorizontal: 16,
  },
  quoteClose: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    color: Colors.gold,
    alignSelf: 'flex-end',
    marginRight: 32,
  },
  branding: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  brandText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: Colors.accentPrimary,
  },
  tagline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 6,
  },

  // ── Mood Share Card ─────────────────────────────────────────────────────────
  moodCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: Theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.12)',
    padding: 32,
    overflow: 'hidden',
  },
  particles: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 60,
    alignItems: 'center',
  },
  particle: {
    fontSize: 10,
    color: Colors.gold,
    opacity: 0.3,
  },
  todayLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: Theme.spacing.lg,
  },
  moodCardQuote: {
    marginTop: Theme.spacing.md,
    alignItems: 'center',
  },
  moodCardText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 26,
    marginHorizontal: 8,
  },
  profileSummary: {
    marginTop: Theme.spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.bgSubtle,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  profileSummaryText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
