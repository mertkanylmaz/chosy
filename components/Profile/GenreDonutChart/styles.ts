import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const DONUT_SIZE = 180;
export const DONUT_STROKE = 40;
export const DONUT_INNER = DONUT_SIZE - DONUT_STROKE * 2;

/** Dilim renk paleti — yuzde buyuklugune gore atanir */
export const SLICE_COLORS = [
  Colors.accentPrimary, // #8B5CF6 — violet
  Colors.gold,          // #D4A843
  Colors.success,       // #22C55E
  '#3B82F6',            // blue (swipeDown)
  '#F59E0B',            // warning/amber
  Colors.bgSubtle,      // #3F3F46 — "Other"
] as const;

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

  // ── Donut ───────────────────────────────────────────────────────────────────
  donutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: DONUT_SIZE,
  },
  centerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCount: {
    ...Theme.typography.h2,
    color: Colors.textPrimary,
  },
  centerLabel: {
    ...Theme.typography.caption,
    color: Colors.textTertiary,
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
    width: '50%',
    marginBottom: Theme.spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendName: {
    ...Theme.typography.body,
    color: Colors.textPrimary,
    marginLeft: Theme.spacing.sm,
  },
  legendPercent: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
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

  // ── Skeleton ────────────────────────────────────────────────────────────────
  skeletonContainer: {
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
});
