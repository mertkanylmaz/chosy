/**
 * WatchlistCard stilleri.
 * CARD_WIDTH + sabitleri SessionAccordion tarafından da kullanılır.
 */
import { Dimensions, StyleSheet } from 'react-native';

import { color, radius, size, space, type } from '@/constants/design/semantic';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const GRID_H_PAD = 20;
export const GRID_COL_GAP = 12;
/** Ana grid kart genişliği (flat 2-sütunlu watchlist için) */
export const CARD_WIDTH = (SCREEN_WIDTH - GRID_H_PAD * 2 - GRID_COL_GAP) / 2;

export default StyleSheet.create({
  card: {
    flex: 1,
  },

  /** Poster + rozet için kapsayıcı */
  posterContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 2 / 3,
  },

  poster: {
    width: '100%',
    height: '100%',
    borderRadius: radius.poster,
    backgroundColor: color.surface.raised,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  /** Film adı kaldırıldı — sadece yıl·tür */
  cardMeta: {
    ...type.caption,
    color: color.text.secondary,
    marginTop: space.sm - 2,
  },
});
