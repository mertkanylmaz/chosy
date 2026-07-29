/**
 * GameStateView stilleri — Festival Layer.
 * Hata ekrani da kuratoryal: eyebrow + serif baslik + sakin retry.
 */
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
    ...Theme.typography.serifTitle,
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
  },
  subtitle: {
    ...Theme.typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: Colors.goldHairline,
  },
  retryText: {
    ...Theme.typography.eyebrow,
    color: Colors.gold,
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
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  skeletonLineWide: {
    width: '70%',
    height: 14,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Colors.bgCard,
  },
  skeletonLineNarrow: {
    width: '45%',
    height: 10,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Colors.bgCard,
  },
});
