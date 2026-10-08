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

/** Kare 16:9 (`backdrop_url` film karesi). Kısa ekranda (SE/mini) küçülür. */
const FRAME_WIDTH = 160;
const FRAME_WIDTH_COMPACT = 128;

/** Kilidin bulanık kare üstünde okunması için hafif örtü. */
const FRAME_DIM = withAlpha(color.surface.base, 0.35);

export const LOCK_ICON_SIZE = size.iconAction;

export const styles = StyleSheet.create({
  /**
   * W1: bekleyiş dilinin kutusu — `charcoal` yüzey, `graphite` kenar (nötr,
   * K-62). Yalnız yerleşim; içerik (kare + kilit + metin) aynı.
   */
  root: {
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'stretch',
    padding: space.md,
    borderRadius: radius.surface,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    backgroundColor: color.surface.raised,
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
  frameCompact: {
    width: FRAME_WIDTH_COMPACT,
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
