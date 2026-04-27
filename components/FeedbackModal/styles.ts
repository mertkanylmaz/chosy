import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.cardSolid,
    borderTopLeftRadius: Theme.borderRadius.xl,
    borderTopRightRadius: Theme.borderRadius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Theme.spacing.xxl,
    paddingTop: Theme.spacing.md,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.white10,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    color: Colors.textWhite,
    fontSize: 18,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    color: Colors.textGrey,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 28,
  },
  sectionLabel: {
    color: Colors.textGrey,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  starButton: {
    padding: 4,
  },
  starText: {
    fontSize: 36,
    color: Colors.gold,
  },
  onPointRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  onPointButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.white10,
    backgroundColor: Colors.white05,
  },
  onPointButtonActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldDim,
  },
  onPointText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textGrey,
  },
  onPointTextActive: {
    color: Colors.gold,
  },
  submitButton: {
    backgroundColor: Colors.gold,
    paddingVertical: 16,
    borderRadius: Theme.borderRadius.md,
    alignItems: 'center',
    ...Theme.shadow.glow,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.goldDim,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '800',
  },
  submitTextDisabled: {
    color: 'rgba(10,14,39,0.5)',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
