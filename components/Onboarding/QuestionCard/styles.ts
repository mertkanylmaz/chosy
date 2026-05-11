/**
 * QuestionCard styles
 */

import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    width: '100%',
  },

  scenario: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    color: Colors.textPrimary,
    lineHeight: 30,
    textAlign: 'center',
    marginBottom: Theme.spacing.xl,
  },

  optionsContainer: {
    gap: Theme.spacing.sm,
  },

  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderRadius: Theme.borderRadius.lg,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.white10,
    minHeight: 52,
  },

  optionBtnSelected: {
    borderWidth: 1.5,
    borderColor: Colors.accentPrimary,
    backgroundColor: Colors.accentDim,
  },

  optionImage: {
    width: 32,
    height: 32,
    marginRight: Theme.spacing.sm,
  },

  optionLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
});
