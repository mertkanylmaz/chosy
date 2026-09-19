/**
 * RoundIndicator stilleri — DESIGN_OS v4.1 §10.1 (C.9b-UI, L-6).
 *
 * 4 nokta (4pt daire) yerine **3 segment**: aktif `beam`, pasif `graphite`.
 * Segment noktadan geniştir çünkü "ilerleme" anlatır, "adet" değil — nokta
 * sayılabilir bir şey, segment dolan bir şey.
 */
import { StyleSheet } from 'react-native';

import { color, space, type } from '@/constants/design/semantic';

const SEGMENT_WIDTH = 24;
const SEGMENT_HEIGHT = 2;

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  segments: {
    flexDirection: 'row',
    gap: space.xs,
  },
  segment: {
    width: SEGMENT_WIDTH,
    height: SEGMENT_HEIGHT,
    borderRadius: SEGMENT_HEIGHT / 2,
    backgroundColor: color.surface.border,
  },
  segmentActive: {
    backgroundColor: color.accent.active,
  },
  /** Sayaç — §10.1'in mono istisnası (yıl·süre·tur sayacı). */
  label: {
    ...type.meta,
    color: color.text.secondary,
  },
});
