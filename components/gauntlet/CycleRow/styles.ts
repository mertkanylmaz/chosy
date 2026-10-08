/**
 * CycleRow stilleri — token'lardan; hardcoded renk/ölçü yok.
 * "Remind me" dokunma hedefi ≥ `size.touchTarget` (44pt).
 */
import { StyleSheet } from 'react-native';

import { color, size, space, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  container: {
    marginTop: space.base,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
  /** Sayaç + "Remind me" yan yana; dar ekranda alta sarar. */
  countingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: space.sm,
  },
  /** Buton tam genişlik (OutlineAction `flex: 1` bekler). */
  buttonSlot: {
    alignSelf: 'stretch',
    flexDirection: 'row',
  },
  status: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
  },
  error: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
    marginTop: space.sm,
  },
  /** 44pt hedef: yükseklik + yatay dolgu; metin sayaçla aynı ölçüde. */
  remind: {
    minHeight: size.touchTarget,
    minWidth: size.touchTarget,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remindText: {
    ...type.caption,
    color: color.text.primary,
    fontWeight: '600',
  },
});
