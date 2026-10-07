/**
 * SpotlightTeaser stilleri — P-5 (K-62).
 *
 * Sütun düzeni: AX5'te satır düzeni metni karenin yanında ezer; sütunda
 * metin tam genişliği kullanır ve before_18 kaydırması taşmayı karşılar.
 *
 * Kenar NÖTR (`surface.border`), champion ekranındaki bonus kartıyla aynı:
 * oyun rengi (altın) yalnız Spotlight oynanış ekranındadır.
 * Cam YOK, gölge YOK (§4.3).
 */
import { StyleSheet } from 'react-native';

import { color, radius, size, space, type } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';

/** Kare 16:9 (`backdrop_url` film karesi) — son şampiyon afişiyle (120pt) dengeli. */
const FRAME_WIDTH = 160;

/** Kilidin bulanık kare üstünde okunması için hafif örtü. */
const FRAME_DIM = withAlpha(color.surface.base, 0.35);

export const LOCK_ICON_SIZE = size.iconAction;

export const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'stretch',
  },
  frame: {
    width: FRAME_WIDTH,
    aspectRatio: 16 / 9,
    borderRadius: radius.poster,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    overflow: 'hidden',
    backgroundColor: color.surface.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameImage: {
    ...StyleSheet.absoluteFillObject,
  },
  frameDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: FRAME_DIM,
  },
  text: {
    ...type.callout,
    color: color.text.secondary,
    textAlign: 'center',
  },
});
