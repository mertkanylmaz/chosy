import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export default StyleSheet.create({
  section: {
    marginBottom: Theme.spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    color: Colors.textGrey,
    marginBottom: Theme.spacing.sm,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    paddingRight: Theme.spacing.md,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.bgElevated,
  },
  chipSelected: {
    backgroundColor: Colors.accentPrimary,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textGrey,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: Colors.textOnAccent,
    fontWeight: '700',
  },
});
