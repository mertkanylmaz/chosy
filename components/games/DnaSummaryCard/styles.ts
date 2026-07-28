import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Theme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rankInfo: {
    flex: 1,
    gap: 2,
  },
  rankName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.gold,
  },
  identityTitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  scoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.goldDim,
  },
  scoreNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.gold,
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dimensionsContainer: {
    gap: Theme.spacing.xs,
    marginTop: Theme.spacing.xs,
  },
  dimensionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  dimensionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
    width: 90,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.bgSubtle,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.info,
  },
  dimensionValue: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textPrimary,
    width: 28,
    textAlign: 'right',
  },
  comingSoonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 3,
  },
  comingSoonText: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
