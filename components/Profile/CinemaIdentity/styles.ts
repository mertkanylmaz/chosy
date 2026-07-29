/**
 * CinemaIdentity stilleri — Festival Layer.
 *
 * Profilin oyun kimligi bolumu: serif kimlik adi, rank ilerlemesi,
 * DNA radari. Kart = duz bgCard + altin sac teli.
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.goldHairline,
    padding: Theme.spacing.md,
    marginHorizontal: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  eyebrow: {
    ...Theme.typography.eyebrow,
  },

  // ─── Kimlik basligi ───────────────────────────────────────────────────────
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  identityTitle: {
    ...Theme.typography.serifTitle,
    fontSize: 22,
    lineHeight: 28,
  },
  rankName: {
    ...Theme.typography.eyebrow,
    color: Colors.gold,
  },
  /** Sagdaki DNA amblemi — Hub hero'suyla ayni dil */
  emblem: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.goldHairline,
    backgroundColor: Colors.goldSeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemScore: {
    ...Theme.typography.stat,
    fontSize: 20,
    lineHeight: 24,
    color: Colors.gold,
  },
  emblemLabel: {
    ...Theme.typography.eyebrow,
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: 1.2,
  },

  // ─── Rank ilerlemesi ──────────────────────────────────────────────────────
  progressBlock: {
    gap: 6,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.white05,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.gold,
  },
  progressHint: {
    ...Theme.typography.micro,
    color: Colors.textTertiary,
  },

  // ─── Radar ────────────────────────────────────────────────────────────────
  radarWrap: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  radarLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendLabel: {
    ...Theme.typography.micro,
    color: Colors.textTertiary,
  },
  legendValue: {
    ...Theme.typography.micro,
    color: Colors.gold,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // ─── Bos durum ────────────────────────────────────────────────────────────
  emptyText: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
  },
});
