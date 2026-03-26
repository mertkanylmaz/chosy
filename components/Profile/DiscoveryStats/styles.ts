import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardSolid,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Theme.spacing.md,
    gap: 14,
  },

  // ── Başlık ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: Colors.textWhite,
    fontSize: 15,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 0.2,
  },

  // ── 2×2 grid ──
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '47%',
    backgroundColor: Colors.white05,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.white10,
    padding: 14,
    gap: 6,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    color: Colors.gold,
    fontSize: 28,
    fontFamily: 'PlayfairDisplay_700Bold',
    lineHeight: 34,
  },
  statLabel: {
    color: Colors.textGrey,
    fontSize: 11,
    fontWeight: '500',
  },

  // ── Badge bölümü ──
  badgesSection: {
    gap: 8,
  },
  badgesCount: {
    color: Colors.textGrey,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  badgesScrollContent: {
    gap: 8,
    paddingVertical: 2,
  },
  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.pill,
  },
  earnedBadge: {
    backgroundColor: Colors.gold,
  },
  unearnedBadge: {
    backgroundColor: Colors.white05,
    opacity: 0.4,
  },
  badgePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  earnedBadgeText: {
    color: Colors.background,
  },
  unearnedBadgeText: {
    color: Colors.textGrey,
  },

  // ── Boş durum ──
  empty: {
    color: Colors.textGrey,
    fontSize: 13,
    paddingVertical: 8,
    fontStyle: 'italic',
  },

  // ── Skeleton ──
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  skeletonCard: {
    width: '47%',
  },
});
