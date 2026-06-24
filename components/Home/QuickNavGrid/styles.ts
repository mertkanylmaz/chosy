/**
 * QuickNavGrid stilleri — 1×4 kompakt yatay şerit.
 * CDO polish: Kart depth, icon circle glow, minimal dikey alan.
 */

import { Platform, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginTop: 12,
  },

  sectionLabel: {
    fontSize: Theme.typography.micro.fontSize,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 8,
  },

  /** 4 kart yan yana — eşit genişlikte */
  strip: {
    flexDirection: 'row',
    gap: 8,
  },

  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 8,
    // Premium depth
    shadowColor: Colors.background,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  /** Icon circle — soft glow applied inline */
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  /** Dynamic glow for icon circles */
  iconGlow: Platform.select({
    ios: {
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.30,
      shadowRadius: 6,
    },
    android: {
      elevation: 3,
    },
    default: {},
  }),

  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
    lineHeight: 13,
  },
});
