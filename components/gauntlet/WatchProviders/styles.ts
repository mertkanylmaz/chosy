/**
 * WatchProvidersRow stilleri — DESIGN_OS v4.1 §4.3 (drop shadow YOK).
 * Logolar sağlayıcının kendi markası olduğu için renk taşır; çevresi
 * tokenlarla nötr kalır.
 *
 * Satır içi blok, sheet değil: cam YOK, kendi zemini YOK — şampiyon
 * ekranının zemininde durur.
 */
import { StyleSheet } from 'react-native';

import { color, radius, size, space, type } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';

/**
 * Şampiyon satırındaki logo — V-3 referans uyumu: 36 → 60pt (en fazla 3
 * logo, platform ekranın odak öğesi). TMDB w92 kaynağı 3x'te 60pt'yi
 * karşılamaz (180px gerekir) → `index.tsx` w185 ister. Logolar DOKUNULMAZ
 * (TestFlight 2.1.0 kararı), bu yüzden K-54'ün 44pt hedefi uygulanmaz.
 */
const ROW_LOGO_SIZE = 60;

/** "See all" sheet'inin liste satırındaki logo — isimle yan yana, 36pt kalır. */
const SHEET_LOGO_SIZE = 36;

export const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: space.sm,
  },
  label: {
    ...type.meta,
    color: color.text.secondary,
    textAlign: 'center',
  },
  /**
   * `minHeight` = logo boyu: `loading`'de boş satır aynı yeri tutar, veri
   * gelince düzen zıplamaz (C2e).
   */
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.lg,
    minHeight: ROW_LOGO_SIZE,
  },
  logo: {
    width: ROW_LOGO_SIZE,
    height: ROW_LOGO_SIZE,
    borderRadius: radius.poster,
    backgroundColor: color.surface.raised,
  },
  /** C2e durum satırı — "bölgende akışta yok" / "yüklenemedi" (§15.2). */
  stateLine: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
  },
  /** TMDB attribution — kaynağın adı gösterilmeden veri kullanılmaz. */
  attribution: {
    ...type.caption,
    color: color.text.secondary,
    opacity: 0.7,
    textAlign: 'center',
  },
  /**
   * "JustWatch" markası — `app/film/[id].tsx`'teki `justWatchText` ile aynı rol.
   * Oradaki eski `Colors.textTertiary` yerine bu ekranın tokenı kullanılır
   * (§9: iki palet aynı ağaçta karıştırılmaz); ayırt edici olan ağırlık farkı.
   */
  justWatchText: {
    ...type.caption,
    color: color.text.secondary,
    fontWeight: '500',
  },
  /**
   * V-3 referans uyumu: "See all →" pill'i logoların ALTINDA, ortalı (G2'de
   * yanındaydı). Dokunulur — görsel yükseklik caption + 2×`space.sm` (34pt),
   * K-54'ün 44pt hedefi `hitSlop` ile tamamlanır.
   */
  logoLine: {
    alignItems: 'center',
    gap: space.md,
  },
  seeAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
  },
  seeAllText: {
    ...type.caption,
    color: color.text.primary,
  },
});

/** "See all" sheet'i — ContextBar sheet deseni (charcoal zemin, cam yok). */
export const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(color.surface.base, 0.6),
  },
  /** Alt dolgu inline: home indicator + `space.lg`. Yükseklik ekranın %75'iyle sınırlı. */
  sheet: {
    maxHeight: '75%',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopLeftRadius: radius.surface,
    borderTopRightRadius: radius.surface,
    backgroundColor: color.surface.raised,
    gap: space.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.surface.border,
    marginBottom: space.xs,
  },
  title: {
    ...type.callout,
    color: color.text.primary,
    textAlign: 'center',
  },
  body: {
    gap: space.lg,
    paddingBottom: space.sm,
  },
  group: {
    gap: space.sm,
  },
  groupTitle: {
    ...type['label-caps'],
    color: color.text.secondary,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  providerLogo: {
    width: SHEET_LOGO_SIZE,
    height: SHEET_LOGO_SIZE,
    borderRadius: radius.poster,
    backgroundColor: color.surface.base,
  },
  providerName: {
    ...type.body,
    color: color.text.primary,
    flexShrink: 1,
  },
});
