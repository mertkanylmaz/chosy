import { StyleSheet } from 'react-native';

import { color, size, space, type } from '@/constants/design/semantic';
import { GAME_THEMES, withAlpha } from '@/constants/gameThemes';

/** Nokta çapı — sabit; dolu/boş geçişi düzeni oynatmaz */
const DOT = 10;
const DOT_BORDER = size.hairline * 1.5;

export const chancesStyles = StyleSheet.create({
  /** Dar ekran / büyük Dynamic Type'ta etiket ve noktalar temiz sarılır */
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: space.md,
    rowGap: space.sm,
    minHeight: space.lg,
  },
  /** bone@70% — smoke 13pt altında yasak (§2.7); etiket 12pt */
  label: {
    ...type.meta,
    color: withAlpha(color.text.primary, 0.7),
  },
  dots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: DOT_BORDER,
  },
  /**
   * Kalan hak — marquee dolgu. Boş noktanın ÜSTÜNDE katman; opaklığı
   * değişir (B6), kenar payı kadar taşar ki smoke halka altın çevresinde görünmesin.
   */
  dotFilled: {
    position: 'absolute',
    top: -DOT_BORDER,
    left: -DOT_BORDER,
    right: -DOT_BORDER,
    bottom: -DOT_BORDER,
    borderRadius: DOT / 2,
    backgroundColor: GAME_THEMES.spotlight.accent,
  },
  /**
   * Harcanan hak — içi boş, smoke kenar. Smoke/ink = 6.13:1 (≥3:1 gerekir,
   * §2.7 metin-dışı bileşen); graphite 1.30:1 ile yetmiyordu. Durumu renk değil
   * şekil (dolu/boş) taşır. Test: tests/games/chanceDotContrast.test.ts
   */
  dotSpent: {
    backgroundColor: 'transparent',
    borderColor: color.text.secondary,
  },
});
