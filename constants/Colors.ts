/**
 * MoodFlix — Design Token Palette
 * Direction: "Warm Premium" (cream/beige + zinc + gold)
 *
 * Migration v3 — 2026-04-24
 * - Primary accent: violet-500 (#8B5CF6) → warm cream (#EADBC6)
 * - textOnAccent: white → dark (#1A1212) — readability on cream bg
 * - All opacity variants updated to rgba(234,219,198,...)
 */

export const Colors = {
  // ─── Backgrounds (Zinc Scale) ────────────────────────────────────────────────
  /** App background — zinc-950 */
  background: '#0A0A0A',
  /** @deprecated Use bgCard instead — kept for backward compat */
  backgroundGradient: '#0A0A0A',
  /** Card surface — zinc-900, semi-transparent */
  card: 'rgba(24,24,27,0.8)',
  /** Card surface — zinc-900, opaque */
  cardSolid: '#18181B',
  /** Card border — subtle cream tint */
  cardBorder: 'rgba(234,219,198,0.15)',

  // Named bg tokens (new — prefer these)
  bgPrimary: '#0A0A0A',
  bgCard: '#18181B',
  bgElevated: '#27272A',
  bgSubtle: '#3F3F46',

  // ─── Accent: Cream (Primary) ─────────────────────────────────────────────────
  /** Primary CTA, active tabs, main interactions — warm cream */
  accentPrimary: '#EADBC6',
  /** Pressed / hover state — cream-dark */
  accentHover: '#D4C4AE',
  /** Muted cream for backgrounds — 12% opacity */
  accentDim: 'rgba(234,219,198,0.12)',

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

  // ─── Text (Zinc Scale) ──────────────────────────────────────────────────────
  /** Primary text — zinc-50 */
  textWhite: '#FAFAFA',
  /** Secondary text / meta — zinc-400 */
  textGrey: '#A1A1AA',
  /** Tertiary text / hints — zinc-500 */
  textLightGrey: '#71717A',
  /** Text on accent backgrounds (cream buttons) — dark for contrast */
  textOnAccent: '#1A1212',

  // Named text tokens (new — prefer these)
  textPrimary: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textTertiary: '#71717A',

  // ─── Semantic ───────────────────────────────────────────────────────────────
  /** Success / confirmations */
  success: '#22C55E',
  /** Error / destructive */
  error: '#EF4444',
  /** Warning / alerts */
  warning: '#F59E0B',
  /** Pink — romantic/decorative accent */
  pink: '#EC4899',

  // ─── Swipe Semantic ─────────────────────────────────────────────────────────
  /** Swipe right → watchlist add */
  swipeRight: '#22C55E',
  /** Swipe left → skip */
  swipeLeft: '#EF4444',
  /** Swipe down → watched/seen */
  swipeDown: '#3B82F6',

  // ─── IMDb ───────────────────────────────────────────────────────────────────
  /** IMDb badge yellow */
  imdbYellow: '#F5C518',

  // ─── Tab Bar ────────────────────────────────────────────────────────────────
  /** Tab bar background — zinc-950 with opacity */
  tabBarBg: 'rgba(10,10,10,0.95)',
  /** Tab active icon — warm cream */
  tabActive: '#EADBC6',
  /** Tab inactive icon — zinc-500 */
  tabInactive: '#71717A',

  // ─── Chips ──────────────────────────────────────────────────────────────────
  /** Active chip bg — cream filled */
  chipActiveBg: '#EADBC6',
  /** Active chip text — dark for contrast on cream */
  chipActiveText: '#1A1212',
  /** Inactive chip border — zinc-500 */
  chipInactiveBorder: '#71717A',
  /** Inactive chip text — zinc-500 */
  chipInactiveText: '#71717A',

  // ─── Input ──────────────────────────────────────────────────────────────────
  /** Input field background */
  inputBg: 'rgba(24,24,27,0.5)',
  /** Input field border — subtle cream */
  inputBorder: 'rgba(234,219,198,0.3)',

  // ─── Overlays & Utilities ───────────────────────────────────────────────────
  /** Modal/overlay background */
  overlay: 'rgba(10,10,10,0.95)',
  /** 10% white — fine borders / surfaces */
  white10: 'rgba(255,255,255,0.1)',
  /** 5% white — very subtle surfaces */
  white05: 'rgba(255,255,255,0.05)',

  // ─── Profile Gradients ──────────────────────────────────────────────────────
  /** Profile header gradient start — cream tint */
  profileHeaderStart: 'rgba(234,219,198,0.25)',
  /** Profile header gradient end — transparent */
  profileHeaderEnd: 'rgba(10,10,10,0.0)',

  // ─── Card Gradients ─────────────────────────────────────────────────────────
  /** Card poster gradient top — transparent */
  cardGradientTop: 'rgba(10,10,10,0.0)',
  /** Card poster gradient bottom — solid bg */
  cardGradientBottom: 'rgba(10,10,10,0.97)',

  // ─── AI / Animation ─────────────────────────────────────────────────────────
  /** AI processing glow — cream */
  aiGlow: 'rgba(234,219,198,0.35)',
} as const;

// ─── Backward Compatibility ─────────────────────────────────────────────────
// @react-navigation ThemeProvider expects this shape.
// New screens should use Colors.xxx directly.
export default {
  light: {
    text: Colors.background,
    background: '#FFFFFF',
    tint: Colors.accentPrimary,
    tabIconDefault: '#CCCCCC',
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
