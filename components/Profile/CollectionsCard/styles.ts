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
    borderColor: Colors.goldHairline,
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
    fontSize: 15,
    lineHeight: 20,
    fontFamily: Theme.fonts.display,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Theme.borderRadius.sm,
    marginLeft: Theme.spacing.xs,
  },
  levelBadgeActive: {
    borderWidth: 1,
    borderColor: Colors.goldHairline,
  },
  levelBadgeMax: {
    borderWidth: 1,
    borderColor: Colors.gold,
    backgroundColor: Colors.goldSeal,
  },
  levelText: {
    ...Theme.typography.micro,
    fontWeight: '700',
  },
  levelTextActive: {
    color: Colors.gold,
  },
  levelTextMax: {
    color: Colors.gold,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 90,
  },
  progressBarBg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.white05,
    marginRight: Theme.spacing.xs + 2,
  },
  progressBarFill: {
    height: 3,
    borderRadius: 2,
  },
  progressBarActive: {
    backgroundColor: Colors.goldDark,
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
