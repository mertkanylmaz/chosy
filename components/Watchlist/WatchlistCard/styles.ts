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

  /** Poster + rozet için kapsayıcı */
  posterContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 2 / 3,
  },

  poster: {
    width: '100%',
    height: '100%',
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

  /**
   * Match Score Rozeti — glassmorphism tarzı, posterin sağ alt köşesi.
   * Yarı şeffaf arka plan + blur benzeri kenarlık.
   */
  matchBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(10,10,10,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textWhite,
    letterSpacing: 0.2,
  },

  /** Film adı kaldırıldı — sadece yıl·tür */
  cardMeta: {
    fontSize: 12,
    color: Colors.textGrey,
    marginTop: 6,
    lineHeight: 16,
  },
});
