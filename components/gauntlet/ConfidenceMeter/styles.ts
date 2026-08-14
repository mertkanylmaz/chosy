/**
 * ConfidenceMeter stilleri — DESIGN_OS §10.4: graphite zemin, dolu segment
 * marquee (color.reward.primary).
 */
import { StyleSheet } from 'react-native';

import { color, space, type } from '@/constants/design/semantic';

const SEGMENT_WIDTH = 10;
const SEGMENT_HEIGHT = 4;

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  label: {
    ...type.meta,
    color: color.text.secondary,
  },
  segments: {
    flexDirection: 'row',
    gap: space.xs / 2,
  },
  segment: {
    width: SEGMENT_WIDTH,
    height: SEGMENT_HEIGHT,
    backgroundColor: color.surface.border,
  },
  segmentFilled: {
    backgroundColor: color.reward.primary,
  },
});
