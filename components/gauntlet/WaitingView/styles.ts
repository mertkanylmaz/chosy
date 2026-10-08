/**
 * WaitingView stilleri — before_18 düzeni (W1.1: iOS-native, sola hizalı, üstten akar).
 *
 * Yalnız token: renk `color.*`, boşluk `space.*`, yarıçap `radius.*`,
 * tipografi `type.*`. Hardcoded hex yok.
 *
 * Paylaşılan `styles.stateText` BURADA KULLANILMAZ (GauntletShell'de dört dalda
 * kullanılıyor) — başlık `title` kendi stilidir.
 */
import { StyleSheet } from 'react-native';

import { color, radius, size, space, type } from '@/constants/design/semantic';

/** Kısa ekranlar (SE/mini) — `contentTopFor`/`headerGapFor` ile aynı eşik. */
export const WAITING_COMPACT_BELOW = 700;

export function isWaitingCompact(windowHeight: number): boolean {
  return windowHeight < WAITING_COMPACT_BELOW;
}

/**
 * Büyük yazı eşiği: `useWindowDimensions().fontScale` bunu geçince Spotlight ve
 * Last Pick satırlarında görsel metnin ÜSTÜNE dizilir (yan yana değil).
 */
export const LARGE_TEXT_FONT_SCALE = 1.35;

export function isLargeText(fontScale: number): boolean {
  return fontScale >= LARGE_TEXT_FONT_SCALE;
}

/** Inset grup satırı: yatay dolgu, görsel/ikon sütunu ve aralarındaki boşluk. */
export const ROW_PADDING_X = space.base;
export const ROW_ICON_COLUMN = size.touchTarget;
export const ROW_GAP = space.md;
/** Satır ayracının sol inset'i = görsel/ikon sütununun bittiği yer. */
export const ROW_SEPARATOR_INSET = ROW_PADDING_X + ROW_ICON_COLUMN + ROW_GAP;

/** Martian Mono sayaç (`variant="display"`): `meta-strong` ailesi, `display-m` ölçüsü (22/26). */
export const monoCountdown = {
  fontFamily: type['meta-strong'].fontFamily,
  fontSize: type['display-m'].fontSize,
  lineHeight: type['display-m'].lineHeight,
  letterSpacing: type['meta-strong'].letterSpacing,
} as const;

/** DESIGN_OS §3.5: Martian Mono 1.4x ile sınırlanır. */
export const MONO_MAX_FONT_SCALE = 1.4;

export const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  /** Üstten akar, sola hizalı. Taşarsa (AX5, küçük ekran) kaydırılır, kesilmez. */
  scrollContent: {
    paddingHorizontal: space.base,
    paddingTop: space.base,
    paddingBottom: space.lg,
    gap: space.lg,
  },
  scrollContentCompact: {
    gap: space.base,
  },
  header: {
    gap: space.xs,
  },
  headerText: {
    gap: space.xs,
  },
  title: {
    ...type.largeTitle,
    color: color.text.primary,
  },
  subtitle: {
    ...type.callout,
    color: color.text.secondary,
  },
  championWrap: {
    alignSelf: 'stretch',
  },

  /** Inset grup — tek yüzey: charcoal, ≈14 köşe, hairline graphite kenar. */
  group: {
    alignSelf: 'stretch',
    borderRadius: radius.poster,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.surface.border,
    backgroundColor: color.surface.raised,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.surface.border,
  },

  /** Notify satırı. */
  row: {
    minHeight: size.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ROW_PADDING_X,
    gap: ROW_GAP,
  },
  rowPressed: {
    backgroundColor: color.surface.border,
  },
  rowDisabled: {
    opacity: 0.35,
  },
  rowIcon: {
    width: ROW_ICON_COLUMN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    ...type.body,
    flex: 1,
    flexShrink: 1,
    color: color.text.primary,
  },
});
