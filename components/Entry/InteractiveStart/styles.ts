import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  /** Logo — üst sol, altın */
  logo: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 16,
    color: Colors.gold,
    marginBottom: 28,
  },

  /** Ana başlık */
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 30,
    color: Colors.textWhite,
    marginBottom: 24,
  },

  /** 2x2 Kart grid */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },

  /** Kart dokunma alanı — grid'in %50'si eksi gap */
  cardTouchable: {
    width: '48%',
  },

  /** Mood kartı — default */
  card: {
    height: 120,
    backgroundColor: Colors.cardSolid,
    borderRadius: 16,
    padding: 14,
    justifyContent: 'flex-start',
    borderWidth: 2,
    borderColor: 'transparent',
  },

  /** Seçili kart — altın border + glow */
  cardSelected: {
    borderColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 10,
  },

  cardEmoji: {
    width: 44,
    height: 44,
    marginBottom: 8,
  },

  cardLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 2,
  },

  cardDescription: {
    fontSize: 12,
    color: Colors.textGrey,
  },

  /** OR divider */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  dividerText: {
    fontSize: 12,
    color: Colors.textGrey,
    fontWeight: '600',
    letterSpacing: 1,
  },

  /** Serbest metin giriş alanı */
  textInput: {
    backgroundColor: Colors.cardSolid,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    fontSize: 15,
    color: Colors.textWhite,
    minHeight: 90,
    marginBottom: 20,
  },

  /** Focus durumunda altın border */
  textInputFocused: {
    borderColor: Colors.gold,
  },

  /** CTA buton kapsayıcı */
  ctaTouch: {
    alignSelf: 'stretch',
    marginBottom: 16,
  },

  /** Disabled durumda %50 opaklık */
  ctaDisabled: {
    opacity: 0.5,
  },

  ctaButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },

  /** Skip linki */
  skipLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },

  skipText: {
    fontSize: 13,
    color: Colors.textGrey,
  },
});
