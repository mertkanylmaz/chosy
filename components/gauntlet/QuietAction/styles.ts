/**
 * QuietAction stilleri — DESIGN_OS §10.1. Metin bağlantısı, buton DEĞİL.
 */
import { StyleSheet } from 'react-native';

import { color, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  /**
   * V-2 Tur C: enabled halde opaklık YOK. Eskiden `smoke@0.7` ink üstünde
   * 3.50:1 veriyordu — eşiğin (4.5:1) altında, cihazda disabled gibi
   * görünüyordu. Tam `smoke`: ink 6.13:1 · charcoal 5.57:1 · graphite 4.73:1.
   */
  text: {
    ...type.caption,
    color: color.text.secondary,
  },
  /** Disabled (Tur A): 0.35 → ink üstünde 1.69:1, enabled'dan belirgin ayrı. */
  disabled: {
    opacity: 0.35,
  },
});
