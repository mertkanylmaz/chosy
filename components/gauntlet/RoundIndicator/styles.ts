/**
 * RoundIndicator stilleri — DESIGN_OS §2.3 (aktif nokta 4px, beam @100%),
 * §10.1 (● ● ○ ○ deseni).
 */
import { StyleSheet } from 'react-native';

import { color, space, type } from '@/constants/design/semantic';

const DOT_SIZE = 4;

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  dots: {
    flexDirection: 'row',
    gap: space.xs,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: color.surface.border,
  },
  dotActive: {
    backgroundColor: color.accent.active,
  },
  label: {
    ...type.meta,
    color: color.text.secondary,
  },
});
