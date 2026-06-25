import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardSolid,
    borderRadius: Theme.borderRadius.lg,
    borderTopWidth: 2,
    borderTopColor: Colors.gold,
    borderLeftWidth: 1,
    borderLeftColor: Colors.cardBorder,
    borderRightWidth: 1,
    borderRightColor: Colors.cardBorder,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    padding: Theme.spacing.md,
    gap: 12,
    /** Kompakt versiyon — sadece genre + duygu + ozet */
    minHeight: 100,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerDna: {
    width: 24,
    height: 24,
  },
  headerTitle: {
    color: Colors.gold,
    fontSize: 15,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 0.2,
  },

  // ── Archetype Banner ──
  archetypeBanner: {
    borderRadius: Theme.borderRadius.md,
    borderLeftWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  archetypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  archetypeIcon: {
    fontSize: 28,
  },
  archetypeTextBlock: {
    flex: 1,
    gap: 2,
  },
  archetypeName: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  archetypeDesc: {
    color: Colors.textGrey,
    fontSize: 12,
    lineHeight: 16,
  },

  // ── Section label ──
  sectionLabel: {
    color: Colors.textGrey,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  // ── Dominant emotion (compact) ──
  dominantEmotionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  dominantEmotionText: {
    color: Colors.textLightGrey,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // ── Emotion bars ──
  emotionsBlock: {
    gap: 8,
  },
  emotionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emotionEmoji: {
    width: 20,
    height: 20,
  },
  emotionName: {
    color: Colors.textLightGrey,
    fontSize: 12,
    width: 76,
    textTransform: 'capitalize',
  },
  barTrack: {
    flex: 1,
    height: 22,
    backgroundColor: Colors.white05,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 6,
    minWidth: 28,
  },
  inBarPercent: {
    color: Colors.textWhite,
    fontSize: 10,
    fontWeight: '700',
  },

  // ── Genre chips ──
  genresBlock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  genreChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Theme.borderRadius.pill,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.white05,
  },
  genreChipText: {
    color: Colors.textLightGrey,
    fontSize: 12,
    fontWeight: '500',
  },

  // ── Energy indicator ──
  energyBlock: {
    gap: 6,
  },
  energyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  energyLabel: {
    color: Colors.textGrey,
    fontSize: 11,
    width: 32,
  },
  energyTrack: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.white05,
    borderRadius: 4,
    overflow: 'hidden',
  },
  energyFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.gold,
  },
  energyLabelRight: {
    color: Colors.textGrey,
    fontSize: 11,
    width: 32,
    textAlign: 'right',
  },

  // ── Pace indicator ──
  paceBlock: {
    flexDirection: 'row',
    gap: 8,
  },
  paceOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.white10,
    backgroundColor: Colors.white05,
    gap: 4,
  },
  paceOptionActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldDim,
  },
  paceOptionText: {
    color: Colors.textGrey,
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  paceOptionTextActive: {
    color: Colors.gold,
  },

  // ── AI summary ──
  summary: {
    color: Colors.textGrey,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },

  // ── Skeleton ──
  skeletonRow: {
    gap: 8,
  },
});
