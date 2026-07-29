/**
 * ConfidenceSelector stilleri — Festival Layer.
 *
 * Mockup: uc segment, secili olan altin dolgu + koyu metin.
 * Carpanlar segmentin altinda kalir — risk secmeden once okunur.
 */
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
    ...Theme.typography.eyebrow,
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
    borderColor: Colors.border,
    minHeight: 56,
  },
  /** Secili segment — altin dolgu, uzerinde koyu metin (mockup) */
  segmentActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.gold,
  },
  segmentValue: {
    ...Theme.typography.stat,
    fontSize: 17,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  segmentValueActive: {
    color: Colors.bgPrimary,
  },
  segmentText: {
    ...Theme.typography.eyebrow,
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
  },
  segmentTextActive: {
    color: Colors.bgPrimary,
  },
  /** Dogru/yanlis carpani — segment icinde, kucuk */
  segmentFactors: {
    ...Theme.typography.micro,
    fontSize: 10,
    lineHeight: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  segmentFactorsActive: {
    color: Colors.bgPrimary,
  },

  disabled: {
    opacity: 0.5,
  },

  /** Secilen bahsin bedeli — secmeden once gorunur olmali */
  preview: {
    ...Theme.typography.micro,
    color: Colors.textSecondary,
  },
});
