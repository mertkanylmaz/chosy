/**
 * Spotlight V3 stilleri — Festival Layer.
 *
 * Tek gorsel + harf harf acilan baslik. Gorsel ekranin kahramani
 * (Kural 4), altinda harf kutulari, en altta klavye.
 */
import { Dimensions, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { withAlpha, type GameTheme } from '@/constants/gameThemes';
import { Theme } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

export const STILL_W = SCREEN_W - Theme.spacing.md * 2;

// STILL_H KALDIRILDI (Kural 7): yukseklik artik modul sabiti degil,
// index.tsx'te olculen alandan pay biciliyor.

/** Klavye tus olcusu — en genis sira 10 sutun */
const KEY_GAP = 4;
/** Aksiyon barinin ic boslugu — tus genisligi hesabinin girdisi */
const ACTION_BAR_PADDING = Theme.spacing.sm;
const KEY_W = Math.floor(
  (STILL_W - ACTION_BAR_PADDING * 2 - KEY_GAP * 9) / 10,
);

/** Aksiyon barinin dis yaricapi — tus yaricapi bundan concentric turetilir */
const ACTION_BAR_RADIUS = Theme.borderRadius.xl;

export { SCREEN_W };

export const createStyles = (theme: GameTheme) => {
  /** Accent'in hairline hali — %22 alfa, altin hairline ile ayni siddet */
  const accentHairline = withAlpha(theme.accent, 0.22);

  return StyleSheet.create({
  /** Tek sayfa kabi — ScrollView YOK (Festival Layer Kural 7) */
  screen: {
    flex: 1,
    gap: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
  },
  /** Esnek bosluk — aksiyon barini dibe iter */
  spacer: {
    flex: 1,
    minHeight: 0,
  },

  // ─── Gorsel ───────────────────────────────────────────────────────────────
  stillWrap: {
    width: STILL_W,
    // height runtime'da: olculen alandan pay biciliyor (index.tsx)
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: accentHairline,
    backgroundColor: Colors.bgCard,
    marginTop: Theme.spacing.sm,
  },
  still: {
    width: '100%',
    height: '100%',
  },
  /**
   * Kalan hak rozeti — gorselin sag ustunde yuzen kontrol, yani chrome.
   * Konumlandirma GlassSurface'in DIS node'una gider; yuzey/kenarlik
   * component'ten gelir, burada tanimlanmaz.
   */
  attemptsBadge: {
    position: 'absolute',
    top: Theme.spacing.sm,
    right: Theme.spacing.sm,
  },
  /** GlassSurface'in IC node'u — rozetin ic nefesi */
  attemptsBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  attemptsText: {
    ...Theme.typography.eyebrow,
    color: Colors.textPrimary,
  },

  // ─── Baslik maskesi ───────────────────────────────────────────────────────
  maskLabel: {
    ...Theme.typography.eyebrow,
    textAlign: 'center',
  },
  maskRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Theme.spacing.sm,
  },
  /** Tahmin edilecek karakter kutusu */
  slot: {
    minWidth: 22,
    height: 32,
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderBottomWidth: 2,
    borderBottomColor: accentHairline,
  },
  slotRevealed: {
    borderBottomColor: theme.accent,
  },
  slotText: {
    ...Theme.typography.serifTitle,
    fontSize: 20,
    lineHeight: 24,
    color: theme.accent,
  },
  /** Bosluk / noktalama — gorunur ayrac */
  separator: {
    minWidth: 10,
    height: 32,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  separatorText: {
    ...Theme.typography.serifTitle,
    fontSize: 20,
    lineHeight: 24,
    color: Colors.textTertiary,
  },

  // ─── Aksiyon bari (chrome — cam) ──────────────────────────────────────────
  /**
   * Aksiyon bari — artik YUZMUYOR, normal akista ekranin dibinde.
   * Ekran kaymadigi icin altindan gececek icerik yok; cam orada Kural 5'in
   * derinlik testini gecmezdi.
   */
  actionBar: {
    gap: Theme.spacing.sm,
    paddingHorizontal: ACTION_BAR_PADDING,
  },

  // ─── Klavye ───────────────────────────────────────────────────────────────
  keyboard: {
    gap: KEY_GAP,
    alignItems: 'center',
  },
  keyboardRow: {
    flexDirection: 'row',
    gap: KEY_GAP,
    justifyContent: 'center',
  },
  /**
   * Concentric: aksiyon barinin yaricapi ACTION_BAR_RADIUS, ic boslugu
   * ACTION_BAR_PADDING → tusun yaricapi aradaki farktan turetilir.
   */
  key: {
    width: KEY_W,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Theme.concentric(ACTION_BAR_RADIUS, ACTION_BAR_PADDING),
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  /** Baslikta cikan harf */
  keyHit: {
    borderColor: theme.accent,
    backgroundColor: theme.accentDim,
  },
  /** Baslikta olmayan harf — sonuk, tekrar denenemez */
  keyMiss: {
    borderColor: 'transparent',
    opacity: 0.35,
  },
  keyText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  keyTextHit: {
    color: theme.accent,
  },

  // ─── Tahmin alani ─────────────────────────────────────────────────────────
  guessArea: {
    gap: Theme.spacing.sm,
  },
  guessLabel: {
    ...Theme.typography.eyebrow,
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  errorText: {
    flex: 1,
    ...Theme.typography.caption,
    color: Colors.textSecondary,
  },

  completedContainer: {
    paddingBottom: Theme.spacing.xl,
  },
  });
};
