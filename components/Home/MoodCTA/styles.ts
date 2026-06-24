import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  wrapper: {
    marginTop: Theme.spacing.lg,
    marginHorizontal: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.lg,
    // Violet glow — shadowOpacity animasyonla override edilir (iOS)
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  touchable: {
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    minHeight: 56,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: Theme.spacing.lg,
    minHeight: 56,
  },
  icon: {
    fontSize: 18,
    color: Colors.textOnAccent,
    marginRight: Theme.spacing.sm,
  },
  label: {
    fontSize: Theme.typography.h3.fontSize,
    fontWeight: '700',
    color: Colors.textOnAccent,
    letterSpacing: 0.5,
  },
});
