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
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    paddingRight: Theme.spacing.md,
  },
  chip: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 7,
    borderRadius: Theme.borderRadius.xl,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.chipInactiveBorder,
  },
  chipSelected: {
    backgroundColor: Colors.chipActiveBg,
    borderColor: Colors.gold,
  },
  chipText: {
    fontSize: 13,
    color: Colors.chipInactiveText,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: Colors.chipActiveText,
    fontWeight: '700',
  },
});
