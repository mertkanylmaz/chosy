/**
 * WaitingChampion stilleri — bekleyiş perdesi + son seçimin kartı.
 * Perde Profil header perdesinin aynı dili (blur + `ink` örtü + alt geçiş).
 */
import { StyleSheet } from 'react-native';

import { color, radius, space, type } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';

/** Bulanıklık posteri tanınmaz kılar, renk dokusu kalır (Profil ile aynı). */
export const CURTAIN_BLUR = 28;
/** Perde örtüsü — metin kontrastı için Profil'den koyu (tam ekran, metin ortada). */
export const CURTAIN_DIM = withAlpha(color.surface.base, 0.7);
export const CURTAIN_FADE_TOP = withAlpha(color.surface.base, 0);

/** Afiş 2:3 — tur ekranı afişinden küçük, "dün" ikincil. Kısa ekranda daha küçük. */
const POSTER_WIDTH = 96;
const POSTER_WIDTH_COMPACT = 72;

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
  /** W1: poster solda, etiket + başlık sağda (satır). Bölüm aralığını WaitingView verir. */
  card: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.base,
  },
  poster: {
    width: POSTER_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: radius.poster,
    backgroundColor: color.surface.border,
  },
  posterCompact: {
    width: POSTER_WIDTH_COMPACT,
  },
  /** `flex: 1` + `flexShrink`: uzun başlık ve AX5'te metin sarar, kırpılmaz. */
  texts: {
    flex: 1,
    flexShrink: 1,
    gap: space.xs,
  },
  label: {
    ...type['label-caps'],
    color: color.text.secondary,
    textTransform: 'uppercase',
  },
  /** Serif yalnız film adında (V3-D1) */
  title: {
    ...type.filmTitle,
    color: color.text.primary,
  },
});
