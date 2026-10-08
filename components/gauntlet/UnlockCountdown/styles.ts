/**
 * UnlockCountdown stilleri — Martian Mono (DESIGN_OS §3.3), W1'de büyütüldü:
 * `meta-strong` ailesi, `display-m` ölçüsü (22/26). Archivo DEĞİL.
 * `tabular-nums`: rakam genişlikleri sabit, sayaç yatay titremez.
 */
import { StyleSheet } from 'react-native';

import { monoCountdown } from '@/components/gauntlet/WaitingView/styles';
import { color, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  countdown: {
    ...monoCountdown,
    color: color.text.primary,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  /** W1.1 inline: gövde metni gibi — SF caption, ikincil renk, sola hizalı. */
  inline: {
    ...type.caption,
    color: color.text.secondary,
    fontVariant: ['tabular-nums'],
  },
});
