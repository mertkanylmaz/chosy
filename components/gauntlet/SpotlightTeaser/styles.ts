/**
 * SpotlightTeaser stilleri — P-5 (K-62), W1.1 satır düzeni.
 *
 * Yüzey (charcoal kutu, kenar, köşe) artık `WaitingView`'in inset grubunda;
 * burası yalnız SATIRIN içi: solda ≈44pt bulanık kare + kilit, sağda başlık
 * ve metin. Büyük yazıda (`fontScale` eşiği) görsel metnin ÜSTÜNE dizilir.
 *
 * Nötr: oyun rengi (altın) yalnız Spotlight oynanış ekranındadır.
 * Cam YOK, gölge YOK (§4.3). Basılı durum YOK — satır dokunulamaz (K-05).
 */
import { StyleSheet } from 'react-native';

import {
  ROW_GAP,
  ROW_ICON_COLUMN,
  ROW_PADDING_X,
} from '@/components/gauntlet/WaitingView/styles';
import { color, size, space, type } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';
import { Theme } from '@/constants/theme';

/** Kilidin bulanık kare üstünde okunması için hafif örtü. */
const FRAME_DIM = withAlpha(color.surface.base, 0.35);

export const LOCK_ICON_SIZE = size.iconAction;

export const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ROW_PADDING_X,
    paddingVertical: space.sm,
    gap: ROW_GAP,
  },
  /** Büyük yazı: görsel üstte, metin altında, sola hizalı. */
  rootStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingVertical: space.md,
  },
  /** ≈44pt kare (`backdrop_url` karesi, bulanık) — ikon sütunuyla aynı genişlik. */
  frame: {
    width: ROW_ICON_COLUMN,
    height: ROW_ICON_COLUMN,
    borderRadius: Theme.borderRadius.sm,
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
  texts: {
    flex: 1,
    flexShrink: 1,
    gap: space.xs,
  },
  textsStacked: {
    flex: 0,
    alignSelf: 'stretch',
  },
  title: {
    ...type.body,
    color: color.text.primary,
  },
  text: {
    ...type.caption,
    color: color.text.secondary,
  },
});
