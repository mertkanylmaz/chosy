/**
 * PosterTile stilleri — DESIGN_OS §4.2 (radius-poster), §4.3 (poster gölgesi
 * istisnası), §2.3 (seçili kenar).
 */
import { StyleSheet } from 'react-native';

import { color, radius, space, type } from '@/constants/design/semantic';

/**
 * V-3 Tur G1 (G3): başlık her zaman 2 satırlık yer kaplar — tek satırlık
 * başlıklı poster ile iki satırlık komşusu arasında meta ve soru hizası
 * kaymaz.
 */
const TITLE_MIN_HEIGHT = type.filmTitle.lineHeight * 2;

/**
 * Poster altındaki metin bloğunun toplam yüksekliği (başlık 2 satır + meta).
 * Yükleme iskeleti bu payı ayırır — veri gelince düzen kaymaz.
 */
export const POSTER_META_BLOCK_HEIGHT =
  space.sm + TITLE_MIN_HEIGHT + space.xs + type.meta.lineHeight;

export const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  posterWrapper: {
    aspectRatio: 2 / 3,
    borderRadius: radius.poster,
    overflow: 'hidden',
    backgroundColor: color.surface.raised,
    // DESIGN_OS §4.3 — drop shadow yasak, TEK istisna poster altı gölge.
    shadowColor: color.surface.base,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 8,
  },
  posterWrapperSelected: {
    borderWidth: 2,
    borderColor: color.accent.edge,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  /** Yükleme durumu — graphite iskelet, spinner YOK (§10.1, §14) */
  skeleton: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: color.surface.border,
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.raised,
    gap: space.xs,
  },
  placeholderText: {
    ...type.caption,
    color: color.text.secondary,
  },
  /** V-3 Tur G1: `gap` 2 (sabit) → `space.xs`; toplam `POSTER_META_BLOCK_HEIGHT`. */
  meta: {
    marginTop: space.sm,
    gap: space.xs,
  },
  title: {
    ...type.filmTitle,
    color: color.text.primary,
    textAlign: 'center',
    minHeight: TITLE_MIN_HEIGHT,
  },
  metaLine: {
    ...type.meta,
    color: color.text.secondary,
    textAlign: 'center',
  },
});
