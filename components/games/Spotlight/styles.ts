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

import {
  MASK_FONT_SIZE,
  MASK_GAP,
  MASK_LINE_HEIGHT,
  MASK_SEP_W,
  MASK_SLOT_H,
  MASK_SLOT_W,
  scaled,
  wordSpacing,
} from './maskLayout';
import { stillHeightFor } from './stillLayout';

const { width: SCREEN_W } = Dimensions.get('window');

export const STILL_W = SCREEN_W - Theme.spacing.md * 2;

/** Maske satirinin yatay ic boslugu */
const MASK_ROW_PADDING = Theme.spacing.sm;
/** Maske satirinin kelime dizebilecegi genislik — olcek hesabinin girdisi */
export const MASK_ROW_W = STILL_W - MASK_ROW_PADDING * 2;

/** Kare kutusu kaynakla ayni oranda (16:9) — cover kirpmaz (P-2) */
export const STILL_H = stillHeightFor(STILL_W);

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
  /**
   * Oynanis kabi: ust bolge (kayar) + aksiyon bari (sabit).
   *
   * Festival Layer Kural 7 "tek sayfa, ScrollView YOK" icin Spotlight'a OZEL
   * istisna (KAPSAM_KILIDI v1.36): uzun baslik + acik klavyede icerik ekrana
   * sigmiyor ve tasma aksiyon barini ekran disina itiyordu (B-1 / Fix 8).
   */
  screen: {
    flex: 1,
    gap: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
  },
  /**
   * Ust bolge — gorsel + baslik maskesi. Kalan alani alir ve gerektiginde
   * KENDI ICINDE kayar. `minHeight: 0` bilincli: tasan icerik bu bolgeyi
   * buyutup aksiyon barini itemez; kuculen bu bolgedir.
   */
  topRegion: {
    flex: 1,
    minHeight: 0,
  },
  topContent: {
    gap: Theme.spacing.md,
  },
  /** Maske etiketi + satirlari — yuksekligi olculur, gorsel kalan alandan pay alir */
  maskBlock: {
    gap: Theme.spacing.md,
  },

  // ─── Gorsel ───────────────────────────────────────────────────────────────
  stillWrap: {
    width: STILL_W,
    height: STILL_H,
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
  // Slot / ayrac / satir stilleri olcege bagli → `createMaskStyles`

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

/**
 * Baslik maskesi stilleri — slot boyutu ve yazisi `scale` ile kuculur
 * (maskLayout.ts › fitMaskScale; 1.0 → 0.8, bes kademe). Olculer tam olcekte
 * eski sabitlerle ayni; `scale === 1` gorunumu degistirmez.
 */
export const createMaskStyles = (theme: GameTheme, scale: number) => {
  const accentHairline = withAlpha(theme.accent, 0.22);
  const slotH = scaled(MASK_SLOT_H, scale);
  const glyph = {
    ...Theme.typography.serifTitle,
    fontSize: scaled(MASK_FONT_SIZE, scale),
    lineHeight: scaled(MASK_LINE_HEIGHT, scale),
  };

  return StyleSheet.create({
    /** Kelimeler satira sarilir; kelime ici kirilmaz */
    maskRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      columnGap: wordSpacing(scale),
      rowGap: MASK_GAP,
      paddingHorizontal: MASK_ROW_PADDING,
    },
    /**
     * Tek kelime. `flexWrap` yalnizca satirdan genis tek kelime icin son care
     * (maskLayout.ts › countMaskRows ayni kurali sayar).
     */
    maskWord: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: MASK_GAP,
      maxWidth: '100%',
    },
    /** Tahmin edilecek karakter kutusu */
    slot: {
      minWidth: scaled(MASK_SLOT_W, scale),
      height: slotH,
      alignItems: 'center',
      justifyContent: 'flex-end',
      borderBottomWidth: 2,
      borderBottomColor: accentHairline,
    },
    slotRevealed: {
      borderBottomColor: theme.accent,
    },
    slotText: {
      ...glyph,
      color: theme.accent,
    },
    /** Kelime ici gorunur ayrac (tire, iki nokta...) */
    separator: {
      minWidth: scaled(MASK_SEP_W, scale),
      height: slotH,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    separatorText: {
      ...glyph,
      color: Colors.textTertiary,
    },
  });
};
