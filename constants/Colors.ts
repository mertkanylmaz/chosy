/**
 * MoodFlix — Design Token Palette
 * Direction: "Cinematic Dark" — warm deep backgrounds + amber-gold accent
 *
 * Migration v4 — 2026-06-23
 * - Backgrounds: flat black → warm deep (#0A0A0F)
 * - Accent: cream (#EADBC6) → cinematic amber (#E8A838)
 * - Text: pure white → soft off-white (#F0F0F5)
 * - Borders: shadow-first → border-first (2026 trend)
 */

export const Colors = {
  // ─── Backgrounds (Warm Deep) ────────────────────────────────────────────────
  /** App background — warm deep */
  background: '#0A0A0F',
  /** @deprecated Use bgCard instead — kept for backward compat */
  backgroundGradient: '#0A0A0F',
  /** Card surface — semi-transparent */
  card: 'rgba(18,18,26,0.8)',
  /** Card surface — opaque */
  cardSolid: '#12121A',
  /** Card border — subtle white tint */
  cardBorder: 'rgba(255,255,255,0.10)',

  // Named bg tokens (new — prefer these)
  bgPrimary: '#0A0A0F',
  bgCard: '#12121A',
  bgElevated: '#1A1A24',
  bgSubtle: '#22222E',

  // ─── Accent: Amber (Primary) ────────────────────────────────────────────────
  /** Primary CTA, active tabs, main interactions — cinematic amber */
  accentPrimary: '#E8A838',
  /** Pressed / hover state — amber dark */
  accentHover: '#C48820',
  /** Muted amber for backgrounds — 15% opacity */
  accentDim: 'rgba(232,168,56,0.15)',

  // ─── Accent: Gold (Secondary / Premium) ──────────────────────────────────────
  /** Ratings, premium badges, special highlights */
  gold: '#D4A843',
  /** Gold pressed state */
  goldDark: '#B8922E',
  /** Light gold — decorative */
  goldLight: '#F0D78C',
  /** Mid gold — gold ile goldDark arası */
  goldMid: '#C8A050',
  /** Subtle gold background — chips, badges */
  goldDim: 'rgba(212,168,67,0.12)',
  /** Gold glow — overlay and blur backgrounds */
  goldGlow: 'rgba(212,168,67,0.18)',
  /** Festival katmanı: kart kenarlığı — altın saç teli çizgi (gölge yerine) */
  goldHairline: 'rgba(212,168,67,0.22)',
  /** Festival katmanı: tamamlandı mührü zemini */
  goldSeal: 'rgba(212,168,67,0.10)',

  // ─── Text (Warm Scale) ──────────────────────────────────────────────────────
  /** Primary text — soft off-white */
  textWhite: '#F0F0F5',
  /** Secondary text / meta — muted lavender */
  textGrey: '#8888A0',
  /** Tertiary text / hints — deep muted */
  textLightGrey: '#55556A',
  /** Text on accent backgrounds (amber buttons) — dark for contrast */
  textOnAccent: '#0A0A0F',

  // Named text tokens (new — prefer these)
  textPrimary: '#F0F0F5',
  textSecondary: '#8888A0',
  textTertiary: '#55556A',

  // ─── Semantic ───────────────────────────────────────────────────────────────
  /** Success / confirmations */
  success: '#34D399',
  /** Error / destructive */
  error: '#EF4444',
  /** Warning / alerts */
  warning: '#FBBF24',
  /** Info — informational highlights */
  info: '#60A5FA',
  /** Pink — romantic/decorative accent */
  pink: '#EC4899',

  // ─── Swipe Semantic ─────────────────────────────────────────────────────────
  /** Swipe right → watchlist add */
  swipeRight: '#34D399',
  /** Swipe left → skip */
  swipeLeft: '#EF4444',
  /** Swipe down → watched/seen */
  swipeDown: '#3B82F6',

  // ─── IMDb ───────────────────────────────────────────────────────────────────
  /** IMDb badge yellow */
  imdbYellow: '#F5C518',

  // ─── Oyun vurgu renkleri ────────────────────────────────────────────────────
  // Oyun ekranlarında hardcoded hex bırakılmaz. Aşağıdaki değerler mevcut
  // görünümü birebir korur — iki ayrı teal tonu bilinçli olarak ayrı tutuldu
  // (Detective koyu, keşif kartı parlak); birleştirme kararı görsel QA sonrası.
  /** Saf beyaz — kontrast gerektiren küçük etiketler (textWhite kırık beyazdır) */
  white: '#FFFFFF',
  /** Detective vurgusu — koyu teal */
  tealDeep: '#0D9488',
  /** Keşif kartı vurgusu — parlak teal */
  teal: '#2DD4BF',
  /** Spotlight vurgusu */
  violet: '#8B5CF6',
  /** Doğru cevap rozeti — success'ten daha doygun yeşil */
  greenBright: '#22C55E',
  /** DNA artış göstergesi — yumuşak yeşil */
  greenSoft: '#4ADE80',
  /** Gölge rengi — iOS shadowColor için */
  shadowBlack: '#000000',

  // ─── Tab Bar ────────────────────────────────────────────────────────────────
  /** Tab bar background — warm deep with opacity */
  tabBarBg: 'rgba(10,10,15,0.95)',
  /** Tab active icon — cinematic amber */
  tabActive: '#E8A838',
  /** Tab inactive icon — deep muted */
  tabInactive: '#55556A',

  // ─── Chips ──────────────────────────────────────────────────────────────────
  /** Active chip bg — amber filled */
  chipActiveBg: '#E8A838',
  /** Active chip text — dark for contrast on amber */
  chipActiveText: '#0A0A0F',
  /** Inactive chip border — deep muted */
  chipInactiveBorder: '#55556A',
  /** Inactive chip text — deep muted */
  chipInactiveText: '#55556A',

  // ─── Input ──────────────────────────────────────────────────────────────────
  /** Input field background */
  inputBg: 'rgba(34,34,46,0.5)',
  /** Input field border — subtle amber */
  inputBorder: 'rgba(232,168,56,0.30)',

  // ─── Overlays & Utilities ───────────────────────────────────────────────────
  /** Modal/overlay background */
  overlay: 'rgba(10,10,15,0.95)',
  /** Afiş/backdrop üstü metin okunurluğu — festival katmanı */
  scrim: 'rgba(10,10,15,0.72)',
  /** 10% white — fine borders / surfaces */
  white10: 'rgba(255,255,255,0.10)',
  /** 5% white — very subtle surfaces */
  white05: 'rgba(255,255,255,0.06)',

  // ─── Borders (2026 trend: shadow → border) ─────────────────────────────────
  /** Standard border — subtle white */
  border: 'rgba(255,255,255,0.10)',
  /** Very subtle border */
  borderSubtle: 'rgba(255,255,255,0.06)',
  /** Accent border — amber tint */
  borderAccent: 'rgba(232,168,56,0.30)',

  // ─── Profile Gradients ──────────────────────────────────────────────────────
  /** Profile header gradient start — amber tint */
  profileHeaderStart: 'rgba(232,168,56,0.25)',
  /** Profile header gradient end — transparent */
  profileHeaderEnd: 'rgba(10,10,15,0.0)',

  // ─── Card Gradients ─────────────────────────────────────────────────────────
  /** Card poster gradient top — transparent */
  cardGradientTop: 'rgba(10,10,15,0.0)',
  /** Card poster gradient bottom — solid bg */
  cardGradientBottom: 'rgba(10,10,15,0.97)',

  // ─── AI / Animation ─────────────────────────────────────────────────────────
  /** AI processing glow — amber */
  aiGlow: 'rgba(232,168,56,0.35)',
} as const;

// ─── Mood Card Gradient System ──────────────────────────────────────────────
// Each mood card gets a unique amber-family gradient pair.
// All tones are derived from the amber base (#E8A838) and harmonize with
// Colors.background (#0A0A0F). Subtle and dark — never saturated.

export interface MoodCardGradient {
  /** Two-stop LinearGradient colors (135 deg) */
  gradient: readonly [string, string];
  /** Soft radial glow behind the emoji */
  glow: string;
  /** Card-specific accent — used for border tint */
  accent: string;
}

export const MoodCardGradients: Record<string, MoodCardGradient> = {
  rainyDay: {
    gradient: ['#14141A', '#1A2A36'],       // card-dark → blue-grey (cool, rainy)
    glow: 'rgba(140,170,200,0.12)',
    accent: '#7A9AB8',
  },
  dateNight: {
    gradient: ['#1A1216', '#3A1620'],       // card-dark → deep burgundy (warm, romantic)
    glow: 'rgba(216,90,110,0.14)',
    accent: '#D85A6E',
  },
  adrenaline: {
    gradient: ['#1A1410', '#3A2210'],       // card-dark → burnt orange (fiery)
    glow: 'rgba(232,130,56,0.15)',
    accent: '#E88238',
  },
  needLaugh: {
    gradient: ['#1A180E', '#32290E'],       // card-dark → warm yellow-amber (bright)
    glow: 'rgba(232,200,60,0.14)',
    accent: '#E8C83C',
  },
  mindBending: {
    gradient: ['#14121E', '#26163A'],       // card-dark → deep purple (mysterious)
    glow: 'rgba(160,100,220,0.12)',
    accent: '#A064DC',
  },
  nostalgia: {
    gradient: ['#1A1610', '#302214'],       // card-dark → warm sepia (vintage)
    glow: 'rgba(200,150,90,0.12)',
    accent: '#C8965A',
  },
  cozyNight: {
    gradient: ['#1A1610', '#2E1E0E'],       // card-dark → golden-brown (cozy)
    glow: 'rgba(220,160,70,0.12)',
    accent: '#DCA046',
  },
  emotional: {
    gradient: ['#12141C', '#162036'],       // card-dark → steel-blue indigo (melancholic)
    glow: 'rgba(100,130,190,0.12)',
    accent: '#6482BE',
  },
} as const;

// ─── Backward Compatibility ─────────────────────────────────────────────────
// @react-navigation ThemeProvider expects this shape.
// New screens should use Colors.xxx directly.
export default {
  light: {
    text: Colors.background,
    background: '#F0F0F5',
    tint: Colors.accentPrimary,
    tabIconDefault: '#8888A0',
    tabIconSelected: Colors.accentPrimary,
  },
  dark: {
    text: Colors.textWhite,
    background: Colors.background,
    tint: Colors.accentPrimary,
    tabIconDefault: Colors.tabInactive,
    tabIconSelected: Colors.accentPrimary,
  },
};
