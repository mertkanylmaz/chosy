/**
 * HintBoard stilleri — Festival Layer.
 *
 * Ipucu paneli bir festival dosyasi gibi okunur: eyebrow baslik,
 * kilitli satirlar sonuk, acilan satir altin kenarlik.
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: Theme.spacing.sm,
  },

  // ── Baslik satiri ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  title: {
    ...Theme.typography.eyebrow,
  },
  creditChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.goldHairline,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Theme.borderRadius.full,
  },
  /** 0 kredi — cip yine gorunur ama sonuk */
  creditChipEmpty: {
    borderColor: Colors.borderSubtle,
  },
  creditText: {
    ...Theme.typography.micro,
    color: Colors.gold,
    fontWeight: '700',
  },
  creditTextEmpty: {
    color: Colors.textTertiary,
  },
  prompt: {
    ...Theme.typography.caption,
    color: Colors.textTertiary,
  },

  // ── Kart listesi ──
  list: {
    gap: Theme.spacing.xs,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    minHeight: 48,
  },
  /** Acilmis ipucu — altin sac teli, hafif muhur zemini */
  cardRevealed: {
    borderColor: Colors.goldHairline,
    backgroundColor: Colors.goldSeal,
  },
  /** Kredi varken kilitli kart — dokunulabilir oldugu belli olsun */
  cardUnlockable: {
    borderColor: Colors.goldHairline,
  },
  cardDisabled: {
    opacity: 0.4,
  },

  iconSlot: {
    width: 22,
    alignItems: 'center',
  },
  textSlot: {
    flex: 1,
    gap: 2,
  },
  typeLabel: {
    ...Theme.typography.eyebrow,
    fontSize: 10,
    lineHeight: 13,
  },
  content: {
    ...Theme.typography.body,
    fontWeight: '600',
  },
  lockedLabel: {
    ...Theme.typography.caption,
    color: Colors.textTertiary,
  },
});
