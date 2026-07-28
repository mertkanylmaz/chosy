import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  containerComplete: {
    borderColor: Colors.goldDim,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  progressTextComplete: {
    color: Colors.gold,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    alignItems: 'center',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  dotFilled: {
    backgroundColor: Colors.goldDim,
    borderColor: Colors.gold,
  },
  chestCard: {
    backgroundColor: Colors.goldDim,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  chestButton: {
    backgroundColor: Colors.gold,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  chestButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.bgPrimary,
  },
  claimedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  claimedText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.success,
  },
  rewardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
    justifyContent: 'center',
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.bgSubtle,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.full,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
