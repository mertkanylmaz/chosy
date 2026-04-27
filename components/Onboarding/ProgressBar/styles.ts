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
    height: 6,
    backgroundColor: Colors.bgSubtle,
    borderRadius: 3,
    width: '100%',
    overflow: 'visible',
    position: 'relative',
  },

  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 6,
    backgroundColor: Colors.accentPrimary,
    borderRadius: 3,
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },

  dot: {
    position: 'absolute',
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accentPrimary,
    marginLeft: -8,
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
});
