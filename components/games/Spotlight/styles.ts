/**
 * Spotlight V3 stilleri — "Karanlık Salon" (DESIGN_OS 07.10.2026 kararı).
 *
 * Hiyerarşi (yukarıdan aşağı): görsel → hak noktaları → başlık maskesi →
 * yardımcı satır → harf tahtası → birincil CTA. Zemin düz ink; altın SIT
 * (hak noktaları, CTA, anlamlı durum). Ham hex yok — token + `withAlpha`.
 */
import { Dimensions, StyleSheet } from 'react-native';

import { color, radius, size, space, type } from '@/constants/design/semantic';
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

/**
 * Harf tahtasi — en genis sira 10 sutun, tahta kare ile ayni genislikte.
 *
 * Dokunma hedefi ISTISNASI (DESIGN_OS §14): 10 tusluk sira 390pt ekranda 44pt
 * genislige ulasamaz. Karar: tus YUKSEKLIGI ≥ 48pt (hucre 50), bosluklar yok —
 * her tus hucresinin tamami dokunma alani, gorunen yuzey hucreye `KEY_INSET`
 * kadar girintili (sistem klavyesi deseni). Genislik < 44pt olabilir.
 */
const KEY_CELL_W = Math.floor(STILL_W / 10);
const KEY_CELL_H = 50;
const KEY_INSET = 2;
const KEY_RADIUS = 8;

export { SCREEN_W };

export const createStyles = (theme: GameTheme) => {
  /** Anlamli durum geri bildirimi: baslikta cikan harf — altin hairline */
  const hitBorder = withAlpha(theme.accent, 0.55);

  return StyleSheet.create({
  /**
   * Oynanis kabi: ust bolge (kayar) + aksiyon bari (sabit).
   *
   * Festival Layer Kural 7 "tek sayfa, ScrollView YOK" icin Spotlight'a OZEL
   * istisna (KAPSAM_KILIDI v1.36): uzun baslik + kucuk ekranda icerik ekrana
   * sigmiyor ve tasma aksiyon barini ekran disina itiyordu (B-1 / Fix 8).
   */
  screen: {
    flex: 1,
    gap: space.sm,
    paddingBottom: space.sm,
  },
  /**
   * Ust bolge — gorsel + hak + maske. Kalan alani alir ve gerektiginde KENDI
   * ICINDE kayar. `minHeight: 0` bilincli: tasan icerik bu bolgeyi buyutup
   * aksiyon barini itemez; kuculen bu bolgedir.
   */
  topRegion: {
    flex: 1,
    minHeight: 0,
  },
  /**
   * `flexGrow: 1`: uzun ekranda artan dikey bosluk maske bloguna verilir
   * (asagida `maskBlock`), gorsel ve hak satiri ustte kalir.
   */
  topContent: {
    flexGrow: 1,
    gap: space.md,
  },
  /**
   * Maske + yardimci satir — gorsel ile tahta arasindaki bosluga ortalanir;
   * olu bosluk iki yanda esit bolunur, kompozisyon tek parca okunur.
   */
  maskBlock: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: space.md,
  },
  /** Yardimci satir — bone@70% (smoke 13pt alti yasak, §2.7) */
  helper: {
    ...type.callout,
    color: withAlpha(color.text.primary, 0.7),
    textAlign: 'center',
  },

  // ─── Gorsel ───────────────────────────────────────────────────────────────
  /** Kahraman: ekranin en doygun ogesi — rozet/gradyan/chrome yok */
  stillWrap: {
    width: STILL_W,
    height: STILL_H,
    borderRadius: radius.surface,
    overflow: 'hidden',
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    backgroundColor: color.surface.raised,
  },
  still: {
    width: '100%',
    height: '100%',
  },
  /** Sonucta net kat — bulanik katin tam ustunde (SpotlightStill) */
  stillLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  /** FocusStill: belirmekte olan kat eski katın üstünde çizilir */
  layerTop: {
    zIndex: 2,
  },
  layerBase: {
    zIndex: 1,
  },

  // ─── Baslik maskesi ───────────────────────────────────────────────────────
  // Slot / ayrac / satir stilleri olcege bagli → `createMaskStyles`

  // ─── Aksiyon bari ─────────────────────────────────────────────────────────
  /** Tahta + CTA — normal akista ekranin dibinde, kareyle ayni genislik */
  actionBar: {
    gap: space.md,
  },

  // ─── Harf tahtasi ─────────────────────────────────────────────────────────
  keyboard: {
    alignItems: 'center',
  },
  keyboardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  /** Dokunma hucresi — bosluksuz; tum alan basilabilir */
  keyCell: {
    width: KEY_CELL_W,
    height: KEY_CELL_H,
  },
  /** Gorunen yuzey: charcoal, graphite kenar, ust kenarda ince isik (dokunsal) */
  key: {
    flex: 1,
    margin: KEY_INSET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: KEY_RADIUS,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    borderTopColor: withAlpha(color.text.primary, 0.1),
    backgroundColor: color.surface.raised,
  },
  /**
   * Baslikta cikan harf — SONUK DEGIL, ustu CIZILMEZ: altin harf + altin hairline
   * + alt cubuk (`keyHitBar`). Durum renge degil sekle de dayanir (§2.7).
   */
  keyHit: {
    borderColor: hitBorder,
  },
  /** Sekil isareti: harfin altinda ince altin cubuk (marquee/raised >> 3:1) */
  keyHitBar: {
    position: 'absolute',
    bottom: 7,
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.accent,
  },
  /** Baslikta olmayan harf — sonuk, tekrar denenemez */
  keyMiss: {
    opacity: 0.35,
  },
  keyText: {
    ...type['body-strong'],
    color: color.text.primary,
  },
  keyTextHit: {
    color: theme.accent,
  },
  /** Kullanilmis tus: renkten bagimsiz isaret — harfin uzerinden ince cizgi */
  keyStrike: {
    position: 'absolute',
    width: 16,
    height: size.hairline * 1.5,
    backgroundColor: withAlpha(color.text.primary, 0.6),
    transform: [{ rotate: '-35deg' }],
  },

  // ─── Tahmin alani ─────────────────────────────────────────────────────────
  guessArea: {
    gap: space.sm,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: Theme.borderRadius.md,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
  },
  errorText: {
    flex: 1,
    ...type.caption,
    color: color.text.secondary,
  },

  completedContainer: {
    gap: space.md,
    paddingBottom: space.xl,
  },
  });
};

/**
 * Baslik maskesi stilleri — slot boyutu ve yazisi `scale` ile kuculur
 * (maskLayout.ts › fitMaskScale; 1.0 → 0.8, bes kademe). Olculer tam olcekte
 * eski sabitlerle ayni; `scale === 1` gorunumu degistirmez.
 *
 * Renk: bone (altin degil) — maske okunurluk icindir, durum geri bildirimi
 * hak noktalari ve tahtadadir. Slot cizgisi acilmamisken bone@45%, acilinca
 * tam bone: kontrast yuksek, mor/aksan yok.
 */
export const createMaskStyles = (_theme: GameTheme, scale: number) => {
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
      borderBottomColor: withAlpha(color.text.primary, 0.45),
    },
    slotRevealed: {
      borderBottomColor: color.text.primary,
    },
    slotText: {
      ...glyph,
      color: color.text.primary,
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
      color: color.text.secondary,
    },
  });
};
