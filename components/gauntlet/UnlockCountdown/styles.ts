/**
 * UnlockCountdown stilleri — sayılar/meta → Martian Mono `meta` (Design OS §3.3).
 * `tabular-nums`: rakam genişlikleri sabit, sayaç her saniye yatay titremez.
 */
import { StyleSheet } from 'react-native';

import { color, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  countdown: {
    ...type.meta,
    color: color.text.primary,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
