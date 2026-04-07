/**
 * ProgressBar styles — Taste Calibration ilerleme çubuğu
 */

import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: Theme.spacing.md,
  },

  label: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: Colors.accentPrimary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: Theme.spacing.sm,
  },

  track: {
    height: 4,
    backgroundColor: Colors.bgSubtle,
    borderRadius: 2,
    width: '100%',
    overflow: 'visible',
    position: 'relative',
  },

  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 4,
    backgroundColor: Colors.accentPrimary,
    borderRadius: 2,
  },

  dot: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accentPrimary,
    marginLeft: -6,
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
});
