import { Dimensions, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** SwipeCard ile aynı değer — tab bar yüksekliği dahil */
export const TAB_BAR_HEIGHT = 83;
export const CARD_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT;
export { SCREEN_WIDTH };

export default StyleSheet.create({
  // ─── Container ─────────────────────────────────────────────────────────────
  container: {
    width: SCREEN_WIDTH,
    height: CARD_HEIGHT,
  },

  // ─── Flip sarmalayıcı (unexpected) ─────────────────────────────────────────
  flipWrapper: {
    width: SCREEN_WIDTH,
    height: CARD_HEIGHT,
  },

  // ─── Mystery yüzü (unexpected, flip öncesi) ────────────────────────────────
  mysteryFace: {
    width: SCREEN_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#0A0E27',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.gold,
  },
  mysteryIcon: {
    fontSize: 80,
    marginBottom: 24,
  },
  mysteryTitle: {
    color: Colors.textWhite,
    fontSize: 26,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  mysterySubtitle: {
    color: Colors.textGrey,
    fontSize: 14,
    letterSpacing: 0.3,
  },

  // ─── Animasyonlu parlayan border (hidden_gem) ───────────────────────────────
  glowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 22,
    elevation: 20,
  },

  // ─── Statik altın border (ai_pick + unexpected reveal) ─────────────────────
  staticBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 12,
  },

  // ─── Badge (sol üst, altın pill) ───────────────────────────────────────────
  badge: {
    position: 'absolute',
    top: 52,
    left: 16,
    backgroundColor: Colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: Colors.goldDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 10,
  },
  badgeText: {
    color: '#0A0E27',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // ─── Büyük match score (sağ üst) ───────────────────────────────────────────
  matchBadge: {
    position: 'absolute',
    top: 44,
    right: 16,
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 2.5,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 14,
  },
  matchScoreText: {
    color: Colors.gold,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  matchLabel: {
    color: Colors.goldLight,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 1,
  },
});
