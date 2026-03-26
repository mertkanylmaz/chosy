import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardSolid,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Theme.spacing.md,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  title: {
    color: Colors.textWhite,
    fontSize: 15,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 0.2,
  },

  // ── Insight kartı ──
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Theme.borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
    marginBottom: 8,
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightText: {
    color: Colors.textWhite,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },

  // ── Boş durum ──
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  emptyText: {
    color: Colors.textGrey,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },

  // ── Progress bar ──
  progressContainer: {
    width: '100%',
    marginTop: 10,
    gap: 6,
  },
  progressTrack: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.white10,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
  progressLabel: {
    color: Colors.textGrey,
    fontSize: 11,
    textAlign: 'center',
  },

  // ── Skeleton ──
  skeletonRow: {
    marginBottom: 8,
  },
});
