import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    marginHorizontal: Theme.spacing.lg,
    marginTop: Theme.spacing.lg,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Theme.spacing.md,
  },

  // ─── Baslik ────────────────────────────────────────────────────────────────
  titleRow: {
    fontSize: Theme.typography.body.fontSize,
    lineHeight: Theme.typography.body.lineHeight,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Theme.spacing.sm,
  },

  // ─── Mini posterler ────────────────────────────────────────────────────────
  postersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
  },
  posterWrapper: {
    borderRadius: Theme.borderRadius.sm,
    overflow: 'hidden',
  },
  poster: {
    width: 56,
    height: 80,
    borderRadius: Theme.borderRadius.sm,
  },
  posterPlaceholder: {
    width: 56,
    height: 80,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraCount: {
    fontSize: Theme.typography.caption.fontSize,
    color: Colors.textSecondary,
    alignSelf: 'center',
  },

  // ─── CTA satiri ────────────────────────────────────────────────────────────
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Theme.spacing.sm,
  },
  ctaText: {
    fontSize: Theme.typography.body.fontSize,
    fontWeight: '600',
    color: Colors.accentPrimary,
  },
});
