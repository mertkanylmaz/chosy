/**
 * WatchProviders stilleri — DESIGN_OS §4.3: drop shadow YOK, §10.2 şampiyon
 * ekranının sessiz bilgi bloğu. Logolar sağlayıcının kendi markası olduğu için
 * renk taşır; çevresi tokenlarla nötr kalır.
 */
import { StyleSheet } from 'react-native';

import { color, radius, space, type } from '@/constants/design/semantic';

/** TMDB w92 logoları kare — ölçek tek yerde tanımlı. */
const LOGO_SIZE = 36;

export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: space.sm,
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
  item: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: radius.poster,
    overflow: 'hidden',
    backgroundColor: color.surface.raised,
  },
  logo: {
    width: '100%',
    height: '100%',
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
