import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';

export default StyleSheet.create({
  /** Tam ekran overlay — position absolute, koyu lacivert */
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 999,
    backgroundColor: 'rgba(10, 14, 39, 0.97)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /** Spiral container — yükleme animasyonu merkezi */
  spiralContainer: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },

  /** Büyük dış halka */
  ring1: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
    borderColor: 'rgba(212,168,67,0.20)',
  },

  /** Orta halka */
  ring2: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    borderColor: 'rgba(212,168,67,0.40)',
    borderTopColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },

  /** Küçük iç halka */
  ring3: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2.5,
    borderColor: 'rgba(212,168,67,0.55)',
    borderBottomColor: Colors.gold,
    borderLeftColor: 'transparent',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 10,
  },

  /** En içteki enerji dairesi */
  ring4: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: Colors.gold,
    backgroundColor: 'rgba(212,168,67,0.12)',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 12,
  },

  /** Parlak merkez nokta */
  centerDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 14,
  },

  /** "AI Processing" başlığı */
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: Colors.textWhite,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  /** "Analyzing your mood..." metni */
  subtitle: {
    fontSize: 15,
    color: Colors.textGrey,
    textAlign: 'center',
    letterSpacing: 0.3,
    marginTop: 4,
  },

  /** Adımlar dikey liste */
  stepsList: {
    marginTop: 28,
    gap: 14,
    alignItems: 'flex-start',
  },

  /** Tek adım satırı */
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  /** İndicator alanı — spinner veya checkmark */
  indicatorWrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /** Dönen altın yay — aktif adım */
  spinner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.gold,
    borderTopColor: 'transparent',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },

  /** Bekleyen adım için boş yer tutucu */
  spinnerPlaceholder: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  /** Tamamlanan adım için ✓ */
  checkmark: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '700',
    lineHeight: 18,
  },

  /** Adım metni — varsayılan: bekliyor */
  stepText: {
    fontSize: 14,
    color: '#4A4260',
    letterSpacing: 0.2,
  },

  /** Aktif adım metni */
  stepTextActive: {
    color: Colors.textLightGrey,
  },

  /** Tamamlanan adım metni */
  stepTextCompleted: {
    color: Colors.gold,
    fontWeight: '600',
  },
});
