/**
 * ArchetypeReveal styles
 */

import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
  },

  gradient: {
    ...StyleSheet.absoluteFillObject,
  },

  particle: {
    position: 'absolute',
  },

  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  glowRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
  },

  emojiCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },

  emojiText: {
    fontSize: 56,
  },

  archetypeName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: Theme.spacing.lg,
  },

  archetypeDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    marginTop: Theme.spacing.sm,
    lineHeight: 24,
  },

  ctaWrap: {
    width: '100%',
    paddingBottom: 8,
  },

  ctaBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    height: 56,
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },

  ctaBtnDisabled: {
    opacity: 0.5,
  },

  ctaGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  ctaText: {
    color: Colors.textOnAccent,
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.4,
  },

  ctaStar: {
    color: Colors.textOnAccent,
    fontSize: 16,
    marginLeft: 8,
  },

  // ─── Aha Moment ─────────────────────────────────────────────────────────────

  ahaSection: {
    marginTop: 24,
    alignItems: 'center',
  },

  ahaTitle: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  ahaRow: {
    flexDirection: 'row',
    gap: 8,
  },

  /** Today's Pick hint — poster altinda */
  todayPickHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
    maxWidth: 260,
    lineHeight: 17,
  },

  /** Tek poster kart — 72×108 rounded */
  ahaCard: {
    width: 72,
    height: 108,
    borderRadius: 8,
    backgroundColor: Colors.bgCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
