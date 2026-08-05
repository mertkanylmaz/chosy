import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';

/**
 * GlassSurface stilleri — iki node pattern'i.
 *
 * `overflow: 'hidden'` ile gölge aynı düğümde çalışmadığı için katmanlar ayrık:
 * dış node yuvarlatma/kenarlık/gölge taşır, iç node bulanıklığı kırpar.
 * Radius değerleri component'te runtime'da atanır (concentric kuralı).
 */
export const styles = StyleSheet.create({
  /** Dış node — radius, kenarlık ve gölgenin sahibi */
  outer: {
    overflow: 'visible',
  },
  /** Cam altına düşen gölge — kontrolü içerikten ayıran spatial depth */
  shadow: {
    shadowColor: Colors.shadowBlack,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  /** İç node — bulanıklığı kırpar, camın kendi kalınlığını taşır */
  inner: {
    overflow: 'hidden',
    backgroundColor: Colors.chromeGlassSurface,
  },
  /** BlurView desteklenmediğinde: opak zemin */
  innerSolid: {
    backgroundColor: Colors.chromeGlassFallback,
  },
});
