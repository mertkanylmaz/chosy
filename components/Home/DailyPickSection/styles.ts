import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    marginTop: Theme.spacing.sm,
  },
  sectionHeader: {
    marginHorizontal: Theme.spacing.lg,
    marginBottom: Theme.spacing.sm,
  },
  sectionLabel: {
    fontSize: Theme.typography.body.fontSize,
    fontWeight: '600',
    color: Colors.textTertiary,
    letterSpacing: 1.5,
  },
  /**
   * DailyMatchCard'in varsayilan aspectRatio: 3/4'tür.
   * Home icin daha kisa (2.5:4) — scroll alanini korumak icin.
   * aspectRatio override via cardWrapper.
   */
  cardWrapper: {
    marginHorizontal: Theme.spacing.lg,
    aspectRatio: 2.5 / 4,
    overflow: 'hidden',
    borderRadius: Theme.borderRadius.lg,
  },
});
