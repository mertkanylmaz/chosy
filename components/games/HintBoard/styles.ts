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
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.textLightGrey,
  },
  creditChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.goldDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.full,
  },
  creditText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.gold,
  },
  prompt: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textGrey,
  },

  // ── Kart listesi ──
  list: {
    gap: Theme.spacing.xs,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: Colors.white05,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    minHeight: 48,
  },
  cardRevealed: {
    backgroundColor: Colors.white10,
    borderColor: Colors.goldDim,
  },
  /** Kredi varken kilitli kart — dokunulabilir oldugu belli olsun */
  cardUnlockable: {
    borderColor: Colors.goldDim,
    backgroundColor: Colors.white10,
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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Colors.textGrey,
  },
  content: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textWhite,
  },
  lockedLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textGrey,
  },
});
