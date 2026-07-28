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
  containerUnlocked: {
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
    flexShrink: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  titleLocked: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  progressTextUnlocked: {
    color: Colors.gold,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  dotFilled: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  themeLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.gold,
  },
  filmStrip: {
    gap: Theme.spacing.sm,
    paddingRight: Theme.spacing.sm,
  },
  filmCard: {
    width: 84,
    gap: 4,
  },
  poster: {
    width: 84,
    height: 126,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Colors.bgSubtle,
  },
  filmTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textWhite,
  },
  filmGame: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  errorText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  retryButton: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Colors.bgSubtle,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gold,
  },
});
