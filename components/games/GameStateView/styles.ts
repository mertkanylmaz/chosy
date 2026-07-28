import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  iconWrap: {
    marginBottom: Theme.spacing.xs,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Colors.accentPrimary,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textOnAccent,
  },

  // ─── Loading skeleton ──────────────────────────────────────────────────────
  skeletonGroup: {
    width: '100%',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  skeletonPoster: {
    width: 160,
    height: 240,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Colors.bgSubtle,
  },
  skeletonLineWide: {
    width: '70%',
    height: 16,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Colors.bgSubtle,
  },
  skeletonLineNarrow: {
    width: '45%',
    height: 12,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Colors.bgSubtle,
  },
});
