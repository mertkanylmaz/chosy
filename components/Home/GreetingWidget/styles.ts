import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.xs,
    paddingBottom: Theme.spacing.xs,
  },
  greeting: {
    fontSize: Theme.typography.h1.fontSize,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: Theme.typography.h1.lineHeight,
    letterSpacing: Theme.typography.h1.letterSpacing,
  },
  subtitle: {
    fontSize: Theme.typography.body.fontSize,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: Theme.typography.body.lineHeight,
  },
});
