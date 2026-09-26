/**
 * WatchProvidersRow stilleri — DESIGN_OS v4.1 §4.3 (drop shadow YOK).
 * Logolar sağlayıcının kendi markası olduğu için renk taşır; çevresi
 * tokenlarla nötr kalır.
 *
 * Satır içi blok, sheet değil: cam YOK, kendi zemini YOK — şampiyon
 * ekranının zemininde durur.
 */
import { StyleSheet } from 'react-native';

import { color, radius, space, type } from '@/constants/design/semantic';

/**
 * TMDB w92 logoları kare, 36pt. Logolar DOKUNULMAZ (TestFlight 2.1.0 kararı),
 * bu yüzden K-54'ün 44pt dokunma hedefi burada uygulanmaz.
 */
const LOGO_SIZE = 36;

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
    gap: space.sm,
    minHeight: LOGO_SIZE,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
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
});
