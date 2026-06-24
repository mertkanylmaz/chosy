/**
 * WatchlistCard stilleri.
 * CARD_WIDTH + sabitleri SessionAccordion tarafından da kullanılır.
 */
import { Dimensions, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

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
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
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
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  matchBadgeText: {
    fontSize: Theme.typography.micro.fontSize,
    fontWeight: '700',
    color: Colors.textWhite,
    letterSpacing: 0.2,
  },

  /** Film adı kaldırıldı — sadece yıl·tür */
  cardMeta: {
    fontSize: Theme.typography.caption.fontSize,
    color: Colors.textGrey,
    marginTop: 6,
    lineHeight: Theme.typography.caption.lineHeight,
  },
});
