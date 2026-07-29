/**
 * HubHero stilleri — Festival Layer.
 *
 * Anatomi: selamlama eyebrow → serif rank adi → ilerleme · sagda DNA amblemi
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

/** DNA amblemi capi — festival rozeti olcegi */
const EMBLEM_SIZE = 76;

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.lg,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  greeting: {
    ...Theme.typography.eyebrow,
  },
  rankName: {
    ...Theme.typography.serifTitle,
    color: Colors.gold,
  },
  identityTitle: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
  },

  // ─── Rank ilerlemesi ──────────────────────────────────────────────────────
  progressBlock: {
    marginTop: Theme.spacing.sm,
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

  // ─── DNA amblemi ──────────────────────────────────────────────────────────
  emblem: {
    width: EMBLEM_SIZE,
    height: EMBLEM_SIZE,
    borderRadius: EMBLEM_SIZE / 2,
    borderWidth: 1,
    borderColor: Colors.goldHairline,
    backgroundColor: Colors.goldSeal,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  emblemScore: {
    ...Theme.typography.stat,
    fontSize: 24,
    lineHeight: 28,
    color: Colors.gold,
  },
  emblemLabel: {
    ...Theme.typography.eyebrow,
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: 1.2,
    color: Colors.textTertiary,
  },

  // ─── Streak satiri ────────────────────────────────────────────────────────
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...Theme.typography.micro,
    color: Colors.textSecondary,
  },
});
