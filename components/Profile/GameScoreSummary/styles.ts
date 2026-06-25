/**
 * GameScoreSummary stilleri — 2x2 oyun skor grid'i.
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    gap: 10,
  },

  /** 2x2 grid */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  /** Tek oyun karti */
  card: {
    width: '48%',
    backgroundColor: Colors.cardSolid,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    gap: 6,
    flexGrow: 1,
  },

  /** Emoji + oyun adi satiri */
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emoji: {
    fontSize: 22,
  },
  gameName: {
    flex: 1,
    color: Colors.textWhite,
    fontSize: Theme.typography.body.fontSize,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  /** Streak satiri */
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakText: {
    color: Colors.gold,
    fontSize: Theme.typography.caption.fontSize,
    fontWeight: '700',
  },

  /** En uzun streak */
  longestText: {
    color: Colors.textGrey,
    fontSize: Theme.typography.micro.fontSize,
    letterSpacing: 0.1,
  },

  /** Oynamadiysa — CTA */
  notPlayedText: {
    color: Colors.textGrey,
    fontSize: Theme.typography.caption.fontSize,
    fontStyle: 'italic',
  },
  playCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  playCta: {
    color: Colors.accentPrimary,
    fontSize: Theme.typography.caption.fontSize,
    fontWeight: '700',
  },

  /** Skeleton */
  skeletonCard: {
    width: '48%',
    height: 100,
    flexGrow: 1,
  },
});
