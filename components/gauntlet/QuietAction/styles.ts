/**
 * QuietAction stilleri — DESIGN_OS §10.1. Metin bağlantısı, buton DEĞİL.
 */
import { StyleSheet } from 'react-native';

import { color, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  text: {
    ...type.caption,
    color: color.text.secondary,
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.35,
  },
});
