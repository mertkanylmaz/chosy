/**
 * DecorativeFrames stilleri. Yalnız token; hardcoded hex yok.
 * Çerçeve oranı: normal 2:3 (poster oranına yakın), kısa ekranda 3:4 (daha kısa).
 */
import { StyleSheet } from 'react-native';

import { color, radius, size, space } from '@/constants/design/semantic';

import { monoLabel } from './styles';

export const frameStyles = StyleSheet.create({
  group: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: space.sm,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: space.sm,
  },
  frame: {
    alignSelf: 'stretch',
    aspectRatio: 2 / 3,
    borderRadius: radius.poster,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    backgroundColor: color.surface.raised,
    overflow: 'hidden',
  },
  frameCompact: {
    aspectRatio: 3 / 4,
  },
  light: {
    ...StyleSheet.absoluteFillObject,
  },
  number: {
    ...monoLabel,
    color: color.text.secondary,
    textAlign: 'center',
  },
});
