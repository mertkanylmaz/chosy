/**
 * WatchlistCard stilleri.
 * CARD_WIDTH + sabitleri SessionAccordion tarafından da kullanılır.
 */
import { Dimensions, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const GRID_H_PAD = 20;
export const GRID_COL_GAP = 12;
/** Ana grid kart genişliği (flat 2-sütunlu watchlist için) */
export const CARD_WIDTH = (SCREEN_WIDTH - GRID_H_PAD * 2 - GRID_COL_GAP) / 2;

export default StyleSheet.create({
  card: {
    flex: 1,
  },
  poster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 14,
    backgroundColor: Colors.cardSolid,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textWhite,
    marginTop: 10,
    lineHeight: 19,
  },
  cardMeta: {
    fontSize: 12,
    color: Colors.textGrey,
    marginTop: 3,
    lineHeight: 16,
  },
});
