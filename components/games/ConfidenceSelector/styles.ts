import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: Theme.spacing.sm,
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.textLightGrey,
  },

  // ── Segment satiri ──
  segments: {
    flexDirection: 'row',
    width: '100%',
    gap: Theme.spacing.xs,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: 4,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.white05,
    minHeight: 52,
  },
  segmentActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldDim,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textGrey,
    textAlign: 'center',
  },
  segmentTextActive: {
    color: Colors.gold,
    fontWeight: '700',
  },
  segmentValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textLightGrey,
  },
  segmentValueActive: {
    color: Colors.gold,
  },

  disabled: {
    opacity: 0.5,
  },

  /** Secilen bahsin bedeli — secmeden once gorunur olmali */
  preview: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textGrey,
  },
});
