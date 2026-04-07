/**
 * TasteCalibration styles
 */

import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Theme.spacing.lg,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },

  topSpacer: {
    flex: 1,
  },

  skipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  skipText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },

  progressWrap: {
    marginBottom: Theme.spacing.xl,
    paddingRight: 12,
  },

  cardWrap: {
    flex: 1,
    justifyContent: 'center',
  },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Theme.spacing.lg,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.bgSubtle,
  },

  dotActive: {
    width: 18,
    backgroundColor: Colors.accentPrimary,
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },

  dotDone: {
    backgroundColor: Colors.accentPrimary,
    opacity: 0.4,
  },
});
