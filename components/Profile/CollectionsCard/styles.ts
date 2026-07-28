import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    marginTop: Theme.spacing.md,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm + 2,
    height: 48,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.sm + 2,
  },
  nameContainer: {
    flex: 1,
    marginRight: Theme.spacing.sm,
  },
  nameLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    ...Theme.typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Theme.borderRadius.sm,
    marginLeft: Theme.spacing.xs,
  },
  levelBadgeActive: {
    backgroundColor: Colors.goldDim,
  },
  levelBadgeMax: {
    backgroundColor: Colors.accentDim,
  },
  levelText: {
    ...Theme.typography.micro,
    fontWeight: '700',
  },
  levelTextActive: {
    color: Colors.gold,
  },
  levelTextMax: {
    color: Colors.accentPrimary,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 90,
  },
  progressBarBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.bgSubtle,
    marginRight: Theme.spacing.xs + 2,
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
  },
  progressBarActive: {
    backgroundColor: Colors.info,
  },
  progressBarComplete: {
    backgroundColor: Colors.gold,
  },
  countText: {
    ...Theme.typography.micro,
    color: Colors.textSecondary,
    minWidth: 32,
    textAlign: 'right',
  },
});
