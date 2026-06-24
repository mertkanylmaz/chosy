import { Dimensions, Platform, StatusBar as RNStatusBar, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export { SCREEN_WIDTH, SCREEN_HEIGHT };

/** Yaklaşık tab bar yüksekliği — güvenli alan dahil */
export const TAB_BAR_HEIGHT = 83;
/** Status bar yüksekliği — iOS sabit, Android dinamik */
export const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : (RNStatusBar.currentHeight ?? 24);
/** Kart yatay kenar boşluğu — tam ekran kart */
export const CARD_HORIZONTAL_MARGIN = 0;
/** Kart genişliği */
export const CARD_WIDTH = SCREEN_WIDTH - CARD_HORIZONTAL_MARGIN * 2;
/** Kart yüksekliği — ekran yüksekliğinden tab bar ve status bar çıkarılır */
export const CARD_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT - STATUS_BAR_HEIGHT;
/** Kart kenar yarıçapı */
export const CARD_RADIUS = 20;
/** Hızlı swipe tetikleme eşiği (px) — |velocity| > VELOCITY_THRESHOLD ise kullanılır */
export const SWIPE_THRESHOLD_FAST = 50;
/** Yavaş swipe tetikleme eşiği (px) */
export const SWIPE_THRESHOLD_SLOW = 65;
/** Velocity sınırı (px/s) — bu değeri geçince hızlı eşik devreye girer */
export const VELOCITY_THRESHOLD = 400;

export default StyleSheet.create({
  // ─── Kart kapsayıcısı ──────────────────────────────────────────────────────
  card: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - TAB_BAR_HEIGHT,
    backgroundColor: Colors.background,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },

  // ─── Poster ────────────────────────────────────────────────────────────────
  poster: {
    ...StyleSheet.absoluteFillObject,
  },
  posterPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterPlaceholderIcon: {
    fontSize: 56,
    marginBottom: 12,
  },
  posterPlaceholderTitle: {
    color: Colors.textTertiary,
    fontSize: Theme.typography.h3.fontSize,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // ─── Swipe glow overlay'ler ────────────────────────────────────────────────
  glowOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  goldGlow: {
    backgroundColor: 'rgba(212,168,67,0.38)',
  },
  greyGlow: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  // ─── Sürpriz kart altın border ─────────────────────────────────────────────
  surpriseBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },

  // ─── Sürpriz badge ─────────────────────────────────────────────────────────
  surpriseBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: Colors.cardBorder,
    borderWidth: 1,
    borderColor: Colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  surpriseBadgeText: {
    color: Colors.gold,
    fontSize: Theme.typography.micro.fontSize,
    fontWeight: '700',
  },

  // ─── Swipe stamp overlay'ler ───────────────────────────────────────────────
  stamp: {
    position: 'absolute',
    top: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 3,
    borderRadius: 8,
    zIndex: 10,
  },
  likeStamp: {
    left: 18,
    borderColor: Colors.success,
    transform: [{ rotate: '-15deg' }],
  },
  passStamp: {
    right: 18,
    borderColor: Colors.error,
    transform: [{ rotate: '15deg' }],
  },
  stampText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  likeStampText: {
    color: Colors.success,
  },
  passStampText: {
    color: Colors.error,
  },

  // ─── Sağ kenar dikey butonlar ──────────────────────────────────────────────
  sideButtons: {
    position: 'absolute',
    right: 14,
    bottom: 160,
    alignItems: 'center',
    gap: 20,
  },
  sideButton: {
    alignItems: 'center',
    gap: 4,
  },
  sideIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(10,10,15,0.58)',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideButtonLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: Theme.typography.micro.fontSize,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // ─── Alt gradient + içerik ─────────────────────────────────────────────────
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 80,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  title: {
    flex: 1,
    color: Colors.textWhite,
    fontSize: Theme.typography.display.fontSize - 6,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 0.2,
    lineHeight: 32,
    marginRight: 12,
  },
  matchCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: Colors.gold,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  matchScoreText: {
    color: Colors.gold,
    fontSize: Theme.typography.body.fontSize,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  moodMatchLabel: {
    color: Colors.gold,
    fontSize: Theme.typography.micro.fontSize,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  whyText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: Theme.typography.caption.fontSize,
    lineHeight: Theme.typography.caption.lineHeight + 1,
    marginRight: 70,
  },
  filmInfoLine: {
    color: Colors.textGrey,
    fontSize: Theme.typography.caption.fontSize,
    lineHeight: Theme.typography.caption.lineHeight,
    marginTop: 8,
  },

  // ─── Mood açıklaması (matchExplanation) ────────────────────────────────────
  explanationText: {
    color: Colors.textGrey,
    fontSize: Theme.typography.caption.fontSize,
    fontStyle: 'italic',
    lineHeight: Theme.typography.caption.lineHeight + 1,
    marginRight: 70,
    marginBottom: 2,
  },
  explanationSkeleton: {
    height: 13,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginRight: 70,
    marginBottom: 4,
  },
  explanationSkeletonShort: {
    width: '55%',
  },
});
