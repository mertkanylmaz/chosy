/**
 * DailyChest stilleri — Festival Layer.
 *
 * "Lootbox" degil festival odulu: altin sac teli cerceve, eyebrow gorev
 * metni, serif odul adi. Renk dolgusu yerine cizgi ve bosluk.
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  containerComplete: {
    borderColor: Colors.goldHairline,
    backgroundColor: Colors.goldSeal,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  /** Sagdaki sayac grubu */
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eyebrow: {
    ...Theme.typography.eyebrow,
    flexShrink: 1,
  },
  eyebrowComplete: {
    ...Theme.typography.eyebrow,
    color: Colors.gold,
    flexShrink: 1,
  },
  /** Odul adi — serif, sadece tamamlaninca gorunur */
  awardTitle: {
    ...Theme.typography.serifTitle,
    fontSize: 22,
    lineHeight: 28,
  },
  progressText: {
    ...Theme.typography.micro,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  progressTextComplete: {
    color: Colors.gold,
  },

  // ─── Ilerleme: nokta degil segment cubugu (GameShell ile ayni dil) ─────────
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: Theme.spacing.xs,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.white05,
  },
  segmentFilled: {
    backgroundColor: Colors.gold,
  },

  // ─── Odul alani ───────────────────────────────────────────────────────────
  chestCard: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  chestButton: {
    backgroundColor: Colors.gold,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  chestButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.bgPrimary,
  },
  claimedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  claimedText: {
    ...Theme.typography.micro,
    color: Colors.gold,
    fontWeight: '600',
  },
  rewardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
    justifyContent: 'center',
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.goldHairline,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.full,
  },
  rewardText: {
    ...Theme.typography.micro,
    color: Colors.textSecondary,
  },
});
