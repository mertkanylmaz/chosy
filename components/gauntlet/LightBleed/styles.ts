/**
 * LightBleed stilleri — DESIGN_OS §5.
 *
 * `bleed` katmanının rengi ve opaklığı çalışma zamanında gelir (renk backend'den,
 * opaklık `BLEED_ALPHA` + animasyon), bu yüzden burada YOKTUR — StyleSheet
 * statik olanı taşır.
 */
import { StyleSheet } from 'react-native';

import { color } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: color.surface.base,
  },
  bleed: {
    ...StyleSheet.absoluteFillObject,
  },
});
