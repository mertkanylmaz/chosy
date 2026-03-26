/** Chosy.ai renk paleti — dark theme */
export const Colors = {
  /** Arka plan: koyu lacivert gradient başlangıcı */
  background: '#0A0E27',
  /** Arka plan: gradient bitiş */
  backgroundGradient: '#0D1B2A',
  /** Kart yüzeyi — yarı şeffaf */
  card: 'rgba(26,31,53,0.8)',
  /** Kart yüzeyi — tam opak */
  cardSolid: '#1A1F35',
  /** Kart kenarlığı — soluk altın */
  cardBorder: 'rgba(212,168,67,0.15)',
  /** Birincil vurgu: altın sarısı */
  gold: '#D4A843',
  /** İkincil vurgu: koyu altın */
  goldDark: '#B8922D',
  /** Açık altın */
  goldLight: '#F0D78C',
  /** Orta altın — gold ile goldDark arası */
  goldMid: '#C8A050',
  /** Soluk altın arka plan — chip, badge bg */
  goldDim: 'rgba(212,168,67,0.12)',
  /** Birincil metin */
  textWhite: '#FFFFFF',
  /** İkincil metin */
  textGrey: '#8A8290',
  /** Açık gri metin */
  textLightGrey: '#B0A8B9',
  /** IMDb badge sarısı */
  imdbYellow: '#F5C518',
  /** Başarı rengi */
  success: '#4ADE80',
  /** Hata rengi */
  error: '#FF4444',
  /** Tab bar arka planı */
  tabBarBg: 'rgba(10,14,39,0.95)',
  /** Tab aktif ikon rengi */
  tabActive: '#D4A843',
  /** Tab pasif ikon rengi */
  tabInactive: '#6A6270',
  /** Modal ve overlay arka planı */
  overlay: 'rgba(10,14,39,0.95)',
  /** Chip aktif arka plan */
  chipActiveBg: '#D4A843',
  /** Chip aktif metin */
  chipActiveText: '#0A0E27',
  /** Chip pasif kenarlık */
  chipInactiveBorder: '#8A8290',
  /** Chip pasif metin */
  chipInactiveText: '#8A8290',
  /** Input alanı arka planı */
  inputBg: 'rgba(26,31,53,0.5)',
  /** Input alanı kenarlığı */
  inputBorder: 'rgba(212,168,67,0.3)',
  /** %10 beyaz — ince kenarlık / yüzey */
  white10: 'rgba(255,255,255,0.1)',
  /** %5 beyaz — çok hafif yüzey */
  white05: 'rgba(255,255,255,0.05)',
  /** Profil header gradient başlangıcı — mavi-mor tonu */
  profileHeaderStart: 'rgba(30,50,90,0.9)',
  /** Profil header gradient bitişi — koyu lacivert */
  profileHeaderEnd: 'rgba(10,14,39,0.0)',
  /** Altın glow — overlay ve blur arkası */
  goldGlow: 'rgba(212,168,67,0.18)',
  /** Kart gradient üst — şeffaf koyu */
  cardGradientTop: 'rgba(10,14,39,0.0)',
  /** Kart gradient alt — koyu lacivert */
  cardGradientBottom: 'rgba(10,14,39,0.97)',
  /** Spiral/AI animasyon içi rengi */
  aiGlow: 'rgba(212,168,67,0.35)',
};

/** Eski export'larla geriye dönük uyumluluk */
export default {
  light: {
    text: Colors.background,
    background: '#fff',
    tint: Colors.gold,
    tabIconDefault: '#ccc',
    tabIconSelected: Colors.gold,
  },
  dark: {
    text: Colors.textWhite,
    background: Colors.background,
    tint: Colors.gold,
    tabIconDefault: Colors.tabInactive,
    tabIconSelected: Colors.gold,
  },
};
