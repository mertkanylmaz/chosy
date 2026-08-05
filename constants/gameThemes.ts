/**
 * Oyun temaları — TEK KAYNAK.
 *
 * ── KURAL ────────────────────────────────────────────────────────────────
 * *Oynanış oyunun temasıdır, ödül Chosy'nin altınıdır.*
 *
 * Her oyunun bir accent rengi vardır ve yalnız **oynanış** katmanında yaşar:
 * ambiyans, progress, seçim, kart kenarı, aksiyon butonu.
 *
 * **Ödül/prestij katmanı altın kalır** — XP, rank, streak, ResultCard,
 * QuickResult, DnaXpReveal, GameShareCard. Chosy kimliği bu sabitle taşınır;
 * altı oyun ayrışırken uygulama tek bir uygulama kalır.
 *
 * **Mekanik sinyal temadan bağımsızdır.** CineMetrics'in yeşil/altın/gri geri
 * bildirimi ve Detective'in doğru/yanlış işaretleri oyunun dilidir, dekorasyon
 * değil — accent değişse de değişmezler.
 *
 * ── TARİHÇE ──────────────────────────────────────────────────────────────
 * 29 Tem 2026'da yürürlükte olan kural bunun tam tersiydi ("tek altın, oyun
 * başına renk YOK"). 1 Ağu 2026'da Imposter cihazda test edildi: tek altın
 * doktrini altı oyunu birbirinden ayırmıyor, kimliği düzleştiriyordu. Karar
 * tersine çevrildi ve kimlik sabiti renk yerine KATMAN oldu.
 * Gerekçe: `.claude/apple-design-standard-2026.md` §6.4
 *
 * ── KULLANIM ─────────────────────────────────────────────────────────────
 * Ekran içinde ham renk YAZILMAZ:
 *   const theme = useGameTheme();   // components/games/GameShell
 * `GameShell` temayı `gameType` prop'undan çözer ve `GameBackdrop`'u kendisi
 * render eder — oyun ekranı ambiyanstan haberdar değildir.
 */

/**
 * Oyun kimlikleri. Bu union eskiden üç yerde ayrı ayrı yazılıydı
 * (`QuickResult/index.tsx`, `ShareCards/GameShareCard.tsx`, `ResultCard/index.tsx`);
 * tek kaynak burasıdır, diğerleri buradan import eder.
 */
export type GameType =
  | 'cinemetrics'
  | 'detective'
  | 'fadein'
  | 'imposter'
  | 'logline'
  | 'quoted'
  | 'spotlight';

/**
 * Ambiyans geometrisi.
 * - `orbs` — iki köşeye yerleşmiş, ekran dışına taşan parıltı küreleri (varsayılan)
 * - `beam` — üst köşeden aşağı açılan projektör huzmesi (yalnız Spotlight)
 */
export type AmbientVariant = 'orbs' | 'beam';

export interface GameTheme {
  /** Ana vurgu — seçim, aktif kenar, aksiyon butonu */
  accent: string;
  /** Düşük alfa yıkama — çip/rozet zemini, seçili kartın üstüne binen renk */
  accentDim: string;
  /** `shadowColor` — seçim halesi. Yalnız interaktif elemanda. */
  accentGlow: string;
  /**
   * Accent'in ÜSTÜNE gelen metin/ikon rengi.
   *
   * Sabit `Colors.textOnAccent` kullanılamaz: o değer amber (#E8A838) gibi
   * AÇIK bir accent için doğru (koyu metin), ama indigo (#6366F1) veya petrol
   * (#0D9488) gibi KOYU accent'lerde okunmaz hale gelir. Her tema kendi
   * kontrast eşini taşır.
   */
  accentOn: string;
  /** Ekran zemini: yukarıdan aşağı inen üç duraklı gece gradyanı */
  ambientBase: readonly [string, string, string];
  /** Birinci parıltı → şeffaf (orbs: sol üst · beam: huzmenin ağzı) */
  ambientGlowA: readonly [string, string];
  /** İkinci parıltı → şeffaf (orbs: sağ alt · beam: yere düşen ışık havuzu) */
  ambientGlowB: readonly [string, string];
  ambientVariant: AmbientVariant;
  /** Harcanan ilerleme segmentlerinin gradyanı */
  progressGradient: readonly [string, string];
}

/**
 * Varsayılan tema — Chosy'nin altın/base dili.
 *
 * Kimler alır: `Quoted` (havuzu tükendi, `games_enabled` dışında) ve
 * `GameThemeContext` provider'ı olmayan her ağaç. İkinci durumda
 * `useGameTheme()` ayrıca `__DEV__` altında uyarır — sessiz fallback yasak
 * (CLAUDE.md Oyun Sistemi Hard Rule 5).
 */
export const DEFAULT_GAME_THEME: GameTheme = {
  accent: '#E8A838',
  accentOn: '#0A0A0F',
  accentDim: 'rgba(232,168,56,0.15)',
  accentGlow: 'rgba(232,168,56,0.55)',
  ambientBase: ['#12100A', '#0C0B0A', '#07080F'],
  ambientGlowA: ['rgba(232,168,56,0.18)', 'rgba(232,168,56,0)'],
  ambientGlowB: ['rgba(212,168,67,0.12)', 'rgba(212,168,67,0)'],
  ambientVariant: 'orbs',
  progressGradient: ['#D4A843', '#E8A838'],
};

/**
 * Tür kodlu palet — her rengin gerekçesi oyunun sinema türünden gelir.
 * Renkler keyfi atanmaz; yeni bir oyun eklenirse gerekçesi de yazılır.
 */
export const GAME_THEMES: Record<GameType, GameTheme> = {
  /**
   * Noir, sorgulama. Detective tarihsel olarak teal idi ve "tek altın" kuralı
   * gereği altına çevrilmişti — bu, o rengin gerekçesine dönüşü.
   */
  detective: {
    accent: '#0D9488',
    accentOn: '#F0F0F5',
    accentDim: 'rgba(13,148,136,0.14)',
    accentGlow: 'rgba(13,148,136,0.70)',
    ambientBase: ['#04201F', '#061518', '#07080F'],
    ambientGlowA: ['rgba(13,148,136,0.26)', 'rgba(13,148,136,0)'],
    ambientGlowB: ['rgba(45,212,191,0.16)', 'rgba(45,212,191,0)'],
    ambientVariant: 'orbs',
    progressGradient: ['#0D9488', '#2DD4BF'],
  },

  /**
   * Camgöbeği — pilotun kendi dili, birebir taşındı. Bu girdi DEĞİŞMEZ:
   * Imposter'ın oynanış ekranı promosyonun referans noktası, görünümü
   * korunmalı (bkz. doğrulama adımı 3).
   * Kaynak: eski `ImposterPilot/pilotTokens.ts`
   */
  imposter: {
    accent: '#22D3EE',
    accentOn: '#0A0A0F',
    accentDim: 'rgba(34,211,238,0.12)',
    accentGlow: 'rgba(34,211,238,0.75)',
    ambientBase: ['#0B1026', '#0A0C1C', '#07080F'],
    ambientGlowA: ['rgba(139,92,246,0.30)', 'rgba(139,92,246,0)'],
    ambientGlowB: ['rgba(34,211,238,0.20)', 'rgba(34,211,238,0)'],
    ambientVariant: 'orbs',
    progressGradient: ['#8B5CF6', '#EC4899'],
  },

  /**
   * Projektör ışığı — accent base'in kendisi (amber). Ayrışma renkten değil
   * ışıktan gelir: tek oyun `beam` varyantı kullanır, yanal huzme çizer.
   */
  spotlight: {
    accent: '#E8A838',
    accentOn: '#0A0A0F',
    accentDim: 'rgba(232,168,56,0.15)',
    accentGlow: 'rgba(232,168,56,0.60)',
    ambientBase: ['#1A1206', '#0F0C08', '#07080F'],
    ambientGlowA: ['rgba(240,215,140,0.28)', 'rgba(240,215,140,0)'],
    ambientGlowB: ['rgba(232,168,56,0.16)', 'rgba(232,168,56,0)'],
    ambientVariant: 'beam',
    progressGradient: ['#E8A838', '#F0D78C'],
  },

  /** Karanlık oda kırmızısı — banyo lambası, henüz gelişmemiş görüntü */
  fadein: {
    accent: '#FB7185',
    accentOn: '#0A0A0F',
    accentDim: 'rgba(251,113,133,0.14)',
    accentGlow: 'rgba(251,113,133,0.70)',
    ambientBase: ['#240D14', '#160A0F', '#07080F'],
    ambientGlowA: ['rgba(251,113,133,0.26)', 'rgba(251,113,133,0)'],
    ambientGlowB: ['rgba(225,29,72,0.16)', 'rgba(225,29,72,0)'],
    ambientVariant: 'orbs',
    progressGradient: ['#FB7185', '#F0ABFC'],
  },

  /** Senaryo, edebiyat — mürekkep moru */
  logline: {
    accent: '#8B5CF6',
    accentOn: '#F0F0F5',
    accentDim: 'rgba(139,92,246,0.14)',
    accentGlow: 'rgba(139,92,246,0.70)',
    ambientBase: ['#180F2E', '#100C1D', '#07080F'],
    ambientGlowA: ['rgba(139,92,246,0.28)', 'rgba(139,92,246,0)'],
    ambientGlowB: ['rgba(167,139,250,0.16)', 'rgba(167,139,250,0)'],
    ambientVariant: 'orbs',
    progressGradient: ['#8B5CF6', '#A78BFA'],
  },

  /**
   * Veri/analiz — indigo.
   *
   * Zümrütten çevrildi: aynı ekranda `Colors.greenBright` (#22C55E) "doğru
   * bilgi" geri bildirim sinyali. İki yeşil yan yana accent'i mekanik sinyalle
   * karıştırırdı; renk körlüğü açısından da yeşil/yeşil ayrımı riskliydi.
   * İndigo geri bildirim üçlüsünün (yeşil/altın/gri) hiçbirine yakın değil.
   */
  cinemetrics: {
    accent: '#6366F1',
    accentOn: '#F0F0F5',
    accentDim: 'rgba(99,102,241,0.14)',
    accentGlow: 'rgba(99,102,241,0.70)',
    ambientBase: ['#0E1030', '#0A0B1C', '#07080F'],
    ambientGlowA: ['rgba(99,102,241,0.28)', 'rgba(99,102,241,0)'],
    ambientGlowB: ['rgba(129,140,248,0.15)', 'rgba(129,140,248,0)'],
    ambientVariant: 'orbs',
    progressGradient: ['#6366F1', '#818CF8'],
  },

  /**
   * Havuzu tükendi, `games_enabled` dışında — kendi teması yok, base alır.
   * Yeniden açılırsa buraya kendi gerekçeli rengi yazılır.
   */
  quoted: DEFAULT_GAME_THEME,
};

/**
 * Bir hex rengin alfalı `rgba()` karşılığını üretir.
 *
 * Neden gerekli: tema yalnız üç accent değeri taşır (`accent`, `accentDim`,
 * `accentGlow`) ama ekranlar ara tonlara da ihtiyaç duyuyor — en sık
 * "hairline" (%22 alfa kenarlık, altın dilindeki `goldHairline`'ın karşılığı).
 * Bunları temaya ayrı alan olarak eklemek sözleşmeyi altı oyun × N ton kadar
 * şişirirdi; türetmek daha ucuz.
 *
 * @param hex `#RRGGBB` biçiminde renk. Kısa (`#RGB`) biçim desteklenmez.
 * @param alpha 0–1 arası opaklık
 */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Oyun kimliğinden temayı çözer.
 *
 * Bilinmeyen id `DEFAULT_GAME_THEME` döner — `GameType` union'ı dışına çıkan
 * bir değer yalnızca sunucudan gelen `games_enabled` listesi genişlerse
 * oluşabilir, ve o durumda ekranın renksiz kalması değil base dile düşmesi
 * doğrudur.
 *
 * @param gameType Oyun kimliği
 */
export function resolveGameTheme(gameType: string): GameTheme {
  return GAME_THEMES[gameType as GameType] ?? DEFAULT_GAME_THEME;
}
