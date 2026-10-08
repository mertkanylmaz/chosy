/**
 * UnlockCountdown stilleri — F2: champion ekranında tek satır, ikincil renk.
 * `tabular-nums`: rakam genişlikleri sabit, sayaç yatay titremez.
 */
import { StyleSheet } from 'react-native';

import { color, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  /** `type.caption` = 13/18 (iOS footnote ölçüsü), ikincil metin rengi. */
  inline: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
