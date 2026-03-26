import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const COLORS = Colors;

export default StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.textWhite,
    marginBottom: Theme.spacing.sm,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textGrey,
    marginBottom: Theme.spacing.xl,
    lineHeight: 20,
  },
  filtersContainer: {
    marginBottom: Theme.spacing.md,
  },
  inputContainer: {
    backgroundColor: Colors.inputBg,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    ...Theme.shadow.card,
  },
  inputContainerFocused: {
    borderColor: Colors.gold,
  },
  textInput: {
    fontSize: 15,
    color: Colors.textWhite,
    lineHeight: 22,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: Colors.textGrey,
    textAlign: 'right',
    marginTop: Theme.spacing.sm,
  },
  charCountWarning: {
    color: Colors.error,
  },
  /** Animasyonlu placeholder overlay */
  placeholderOverlay: {
    position: 'absolute',
    top: Theme.spacing.md,
    left: Theme.spacing.md,
    right: Theme.spacing.md,
  },
  animatedPlaceholderText: {
    fontSize: 15,
    color: Colors.textGrey,
    lineHeight: 22,
  },
  emojiLabel: {
    fontSize: 11,
    color: Colors.textGrey,
    marginBottom: Theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: Theme.spacing.xl,
  },
  emojiButton: {
    width: 50,
    height: 50,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.white10,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadow.card,
  },
  emojiButtonSelected: {
    backgroundColor: Colors.goldDim,
    borderColor: Colors.gold,
  },
  emojiText: {
    fontSize: 24,
  },
  submitButton: {
    backgroundColor: Colors.gold,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadow.glow,
  },
  submitButtonDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.background,
    letterSpacing: 0.3,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.background,
  },
});
