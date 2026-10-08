/**
 * WaitingView stilleri — before_18 düzeni ("Next screening").
 *
 * Yalnız token: renk `color.*`, boşluk `space.*`, yarıçap `radius.*`,
 * tipografi `type.*`. Hardcoded hex yok.
 *
 * Paylaşılan `styles.stateText` BURADA KULLANILMAZ (GauntletShell'de dört dalda
 * kullanılıyor) — başlık `title` kendi stilidir.
 *
 * DESIGN_OS §2.7: `smoke` 13pt altında kullanılmaz. Martian Mono etiketler bu
 * yüzden `meta`'nın ailesini `caption` boyutuyla (13/18) taşır; `type.meta`
 * (12pt) smoke üstünde kullanılmaz.
 */
import { StyleSheet } from 'react-native';

import { color, size, space, type } from '@/constants/design/semantic';

/** Kısa ekranlar (SE/mini) — `contentTopFor`/`headerGapFor` ile aynı eşik. */
export const WAITING_COMPACT_BELOW = 700;

export function isWaitingCompact(windowHeight: number): boolean {
  return windowHeight < WAITING_COMPACT_BELOW;
}

/** Martian Mono etiket: `meta` ailesi, `caption` ölçüsü (13/18), `label-caps` harf aralığı oranı. */
export const monoLabel = {
  fontFamily: type.meta.fontFamily,
  fontSize: type.caption.fontSize,
  lineHeight: type.caption.lineHeight,
  letterSpacing: type['label-caps'].letterSpacing,
} as const;

/** Martian Mono sayaç: `meta-strong` ailesi, `display-m` ölçüsü (22/26). Archivo DEĞİL. */
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
  /**
   * İçerik sığdığında dikeyde ortalı (`flexGrow` + `justifyContent`);
   * sığmadığında (AX5, küçük ekran) kaydırılır, kesilmez.
   */
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    gap: space.lg,
  },
  scrollContentCompact: {
    paddingVertical: space.base,
    gap: space.base,
  },
  section: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: space.md,
  },
  separator: {
    alignSelf: 'stretch',
    height: size.hairline,
    backgroundColor: color.surface.border,
  },
  eyebrowRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  eyebrowLine: {
    flex: 1,
    height: size.hairline,
    backgroundColor: color.surface.border,
  },
  eyebrow: {
    ...monoLabel,
    flexShrink: 1,
    color: color.text.secondary,
    textAlign: 'center',
  },
  /** Mevcut ekran-başlığı token'ı (`title`, SF Pro 600 20/24). */
  title: {
    ...type.title,
    color: color.text.primary,
    textAlign: 'center',
  },
  tagline: {
    ...monoLabel,
    color: color.text.secondary,
    textAlign: 'center',
  },
  firstScreening: {
    ...type.callout,
    color: color.text.primary,
    textAlign: 'center',
  },
});
