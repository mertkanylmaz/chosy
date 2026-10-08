/**
 * WaitingChampion stilleri — bekleyiş perdesi + son seçimin kartı.
 * Perde Profil header perdesinin aynı dili (blur + `ink` örtü + alt geçiş).
 */
import { StyleSheet } from 'react-native';

import {
  ROW_GAP,
  ROW_PADDING_X,
} from '@/components/gauntlet/WaitingView/styles';
import { color, space, type } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';
import { Theme } from '@/constants/theme';

/** Bulanıklık posteri tanınmaz kılar, renk dokusu kalır (Profil ile aynı). */
export const CURTAIN_BLUR = 28;
/** Perde örtüsü — metin kontrastı için Profil'den koyu (tam ekran, metin ortada). */
export const CURTAIN_DIM = withAlpha(color.surface.base, 0.7);
export const CURTAIN_FADE_TOP = withAlpha(color.surface.base, 0);

/**
 * Last Pick satırındaki afiş — 2:3, yerel sabit boyut (≈48x72). Satır
 * yüksekliğini (72 + dikey dolgu) belirler; Dynamic Type'la ölçeklenmez,
 * metin sütunu ölçeklenir.
 */
const POSTER_WIDTH = 48;
const POSTER_HEIGHT = 72;

export const styles = StyleSheet.create({
  curtain: {
    ...StyleSheet.absoluteFillObject,
  },
  /** Blur kenarlarda şeffaf halka bırakır — hafif büyütme onu taşar */
  curtainImage: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: 1.15 }],
  },
  /** Reduce Transparency (§6) — bulanık poster yerine düz `charcoal` */
  curtainFlat: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: color.surface.raised,
  },
  curtainDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CURTAIN_DIM,
  },
  curtainFade: {
    ...StyleSheet.absoluteFillObject,
  },
  /** W1.1: grup üstü etiket — caption, ikincil, sentence case, harf aralığı YOK. */
  label: {
    ...type.caption,
    color: color.text.secondary,
    paddingHorizontal: ROW_PADDING_X,
    paddingBottom: space.sm,
  },
  /** Tüm satır dokunulabilir: poster + başlık + caret. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ROW_PADDING_X,
    paddingVertical: space.sm,
    gap: ROW_GAP,
  },
  rowPressed: {
    backgroundColor: color.surface.border,
  },
  /** Poster + başlık. Büyük yazıda (`fontScale` eşiği) alt alta. */
  content: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
  },
  contentStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  poster: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: color.surface.border,
  },
  /** `flex: 1` + `flexShrink`: uzun başlık ve AX5'te metin sarar, kırpılmaz. */
  title: {
    ...type.filmTitle,
    flexShrink: 1,
    color: color.text.primary,
  },
});
