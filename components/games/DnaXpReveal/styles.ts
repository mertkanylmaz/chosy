/**
 * DnaXpReveal stilleri — Festival Layer.
 *
 * Eskiden DNA cubuklari ve etiketleri mavi (Colors.info) idi; tek altin
 * kurali geregi altina cevrildi. Artis gostergesi yesil kaldi — o bir
 * geri bildirim ani, yuzey rengi degil.
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  xpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.goldHairline,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: Theme.borderRadius.full,
  },
  xpText: {
    ...Theme.typography.micro,
    color: Colors.gold,
    fontWeight: '700',
  },

  // ── Chip fallback (legacy) ──
  dnaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: Theme.borderRadius.full,
  },
  dnaSignalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dnaText: {
    ...Theme.typography.micro,
    color: Colors.textSecondary,
  },
  dnaDelta: {
    ...Theme.typography.micro,
    color: Colors.greenSoft,
    fontWeight: '700',
  },

  // ── Before/After Bars ──
  barsContainer: {
    alignSelf: 'stretch',
    gap: 6,
    paddingHorizontal: 4,
  },
  dimRow: {
    gap: 3,
  },
  dimLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dimLabel: {
    ...Theme.typography.eyebrow,
    fontSize: 10,
    lineHeight: 13,
  },
  dimValue: {
    ...Theme.typography.micro,
    color: Colors.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  dimDelta: {
    ...Theme.typography.micro,
    fontSize: 10,
    color: Colors.greenSoft,
    fontWeight: '700',
  },
  barBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.white05,
    overflow: 'hidden',
  },
  barFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gold,
  },
  /** "Once" isareti — artisin nereden basladigini gosterir */
  barMarker: {
    position: 'absolute',
    top: -1,
    width: 2,
    height: 6,
    borderRadius: 1,
    backgroundColor: Colors.white10,
  },

  // ── Rank Progress ──
  rankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
  },
  rankChipCelebrate: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldSeal,
  },
  rankText: {
    ...Theme.typography.micro,
    color: Colors.textSecondary,
  },
  rankTextCelebrate: {
    ...Theme.typography.micro,
    color: Colors.gold,
    fontWeight: '700',
  },
});
