/**
 * WatchProvidersSheet stilleri — DESIGN_OS v4.1 §4.3 (drop shadow YOK), K-09
 * (sheet). Logolar sağlayıcının kendi markası olduğu için renk taşır;
 * çevresi tokenlarla nötr kalır.
 *
 * Cam YOK: v4.1'de cam yalnız navigasyon ve SİSTEM sheet'lerinde. Bu bizim
 * çizdiğimiz bir yüzey, o yüzden opak `charcoal` (elev-1).
 */
import { StyleSheet } from 'react-native';

import { color, radius, space, type } from '@/constants/design/semantic';

/**
 * TMDB w92 logoları kare. Görsel boyut 36pt ama DOKUNMA HEDEFİ 44pt
 * (K-54, C.9b-UI C2): `item` 44×44 merkezleyici, logo içinde 36×36.
 * Eskiden hedef 36pt'ydi ve `hitSlop` yoktu — K-54 keşif raporunun bulgusu.
 */
const LOGO_SIZE = 36;
const TOUCH_SIZE = 44;

export const styles = StyleSheet.create({
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 9, 11, 0.6)',
  },
  sheet: {
    backgroundColor: color.surface.raised,
    borderTopLeftRadius: radius.surface,
    borderTopRightRadius: radius.surface,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    // Home indicator payı — sheet ekranın dibine yapışır.
    paddingBottom: space.xxl,
    alignItems: 'center',
    gap: space.md,
  },
  /** Kapatılabilirliğin sessiz işareti (sistem sheet'lerinin dili). */
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.surface.border,
    marginBottom: space.xs,
  },
  label: {
    ...type.meta,
    color: color.text.secondary,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
  },
  /** 44×44 dokunma hedefi; logo içinde ortalanır (K-54). */
  item: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: radius.poster,
    backgroundColor: color.surface.base,
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
  closeRow: {
    marginTop: space.xs,
  },
});
