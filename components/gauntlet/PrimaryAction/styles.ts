/**
 * PrimaryAction stilleri — C.9b-UI L-2 / Design OS v4.1 §17.1.
 *
 * `beam@12%` dolgu (`accent.fill`) + `@40%` kenar (`accent.edgeStrong`).
 * ⚠️ `accent.edge` (0.24) DEĞİL — o ikincil yüzeylerin sessiz kenarı
 * (PosterTile seçili durumu) ve bu vurguyu taşımaz. İkisini karıştırmak
 * tip hatası vermeyen görsel bir regresyon üretir.
 *
 * Drop shadow YOK (§4.3). Dokunma hedefi ≥44pt (K-54).
 */
import { StyleSheet } from 'react-native';

import { color, radius, space, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: color.accent.fill,
    borderWidth: 1,
    borderColor: color.accent.edgeStrong,
  },
  /**
   * Devre dışı: buton KAYBOLMAZ, yalnız sönükleşir. Yer tutmaya devam eder
   * ki hazır olduğunda düzen zıplamasın (C2e "pop-in yok").
   */
  buttonDisabled: {
    opacity: 0.45,
  },
  label: {
    ...type['body-strong'],
    color: color.text.primary,
    textAlign: 'center',
  },
});
