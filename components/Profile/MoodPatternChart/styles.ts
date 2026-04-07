import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardSolid,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Theme.spacing.lg,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  headerEmoji: {
    fontSize: 18,
  },
  headerTitle: {
    ...Theme.typography.h3,
    marginLeft: Theme.spacing.sm,
  },

  // ── Bar Row ─────────────────────────────────────────────────────────────────
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  dateLabel: {
    ...Theme.typography.caption,
    color: Colors.textTertiary,
    width: 52,
  },
  barTrack: {
    flex: 1,
    height: 16,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Colors.bgSubtle,
    marginHorizontal: Theme.spacing.sm,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: Theme.borderRadius.sm,
  },
  emotionLabel: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emotionName: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  emotionScore: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    marginLeft: Theme.spacing.xs,
  },

  // ── Legend ──────────────────────────────────────────────────────────────────
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Theme.spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '33%',
    marginBottom: Theme.spacing.xs,
  },
  legendEmoji: {
    fontSize: 14,
  },
  legendText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    marginLeft: Theme.spacing.xs,
  },

  // ── States ──────────────────────────────────────────────────────────────────
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
  },
  emptyText: {
    ...Theme.typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  insufficientText: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Theme.spacing.md,
  },

  // ── Skeleton ────────────────────────────────────────────────────────────────
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
});
