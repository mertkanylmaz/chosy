import { StyleSheet } from 'react-native';

import { color, size, space, type } from '@/constants/design/semantic';
import { GAME_THEMES } from '@/constants/gameThemes';

/** Nokta çapı — sabit; dolu/boş geçişi düzeni oynatmaz */
const DOT = 10;

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
  label: {
    ...type.meta,
    color: color.text.secondary,
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
    borderWidth: size.hairline * 1.5,
  },
  /** Kalan hak — marquee dolgu */
  dotFilled: {
    backgroundColor: GAME_THEMES.spotlight.accent,
    borderColor: GAME_THEMES.spotlight.accent,
  },
  /** Harcanan hak — içi boş, graphite kenar */
  dotSpent: {
    backgroundColor: 'transparent',
    borderColor: color.surface.border,
  },
});
