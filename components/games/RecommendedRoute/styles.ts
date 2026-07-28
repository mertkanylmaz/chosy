import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scrollContent: {
    gap: Theme.spacing.sm,
  },
  card: {
    width: 150,
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Theme.spacing.sm,
  },
  cardHighlight: {
    borderColor: Colors.borderAccent,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpBadge: {
    backgroundColor: Colors.goldDim,
    borderRadius: Theme.borderRadius.full,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 2,
  },
  xpText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.gold,
  },
  gameName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dimensionHint: {
    fontSize: 11,
    color: Colors.info,
    fontWeight: '500',
  },
});
