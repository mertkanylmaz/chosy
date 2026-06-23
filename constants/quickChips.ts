/**
 * Quick Mood Chips — Home ve Discover tab'da kullanilan hizli mood chip'leri.
 * DRY: Tek kaynak, iki ekranda da ayni data.
 */

export interface QuickChip {
  id: string;
  labelKey: string;
  /** Mood text'i olarak Discover'a gonderilecek (EN) */
  prompt: string;
}

export const QUICK_CHIPS: QuickChip[] = [
  { id: 'thriller', labelKey: 'home.quickThrill', prompt: 'edge-of-seat thriller' },
  { id: 'romantic', labelKey: 'home.quickRomantic', prompt: 'romantic and heartfelt' },
  { id: 'mindbend', labelKey: 'home.quickMindBending', prompt: 'mind-bending and thought-provoking' },
  { id: 'feelgood', labelKey: 'home.quickFeelGood', prompt: 'feel-good and uplifting' },
  { id: 'melancholy', labelKey: 'home.quickMelancholy', prompt: 'melancholic and emotional' },
  { id: 'adventure', labelKey: 'home.quickAdventure', prompt: 'epic adventure' },
  { id: 'comedy', labelKey: 'home.quickComedy', prompt: 'laugh-out-loud comedy' },
  { id: 'documentary', labelKey: 'home.quickDocumentary', prompt: 'eye-opening documentary' },
  { id: 'arthouse', labelKey: 'home.quickArthouse', prompt: 'artistic and unconventional cinema' },
  { id: 'nostalgia', labelKey: 'home.quickNostalgia', prompt: 'nostalgic and timeless classic' },
];

/**
 * Discover tab'daki oyun kartlari icin game definition'lar.
 * Games Hub'daki GAME_DEFINITIONS ile eslesir.
 */
export interface GameCardDef {
  gameType: string;
  route: string;
  titleKey: string;
  descriptionKey: string;
  icon: string;
}

export const DISCOVER_GAMES: GameCardDef[] = [
  {
    gameType: 'fadein',
    route: '/games/fadein',
    titleKey: 'games.fadein.title',
    descriptionKey: 'games.fadein.description',
    icon: 'image',
  },
  {
    gameType: 'imposter',
    route: '/games/imposter',
    titleKey: 'games.imposter.title',
    descriptionKey: 'games.imposter.description',
    icon: 'people',
  },
  {
    gameType: 'logline',
    route: '/games/logline',
    titleKey: 'games.logline.title',
    descriptionKey: 'games.logline.description',
    icon: 'bulb',
  },
  {
    gameType: 'quoted',
    route: '/games/quoted',
    titleKey: 'games.quoted.title',
    descriptionKey: 'games.quoted.description',
    icon: 'chatbubble-ellipses',
  },
];
