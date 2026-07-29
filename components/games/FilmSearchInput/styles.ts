/**
 * FilmSearchInput stilleri — Festival Layer.
 *
 * Tek arama bileseni (Hard Rule): kopyalanmaz, genisletilir.
 * Kenarlik amber tint yerine altin sac teli.
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.goldHairline,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.md,
    height: 52,
    gap: Theme.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  dropdown: {
    position: 'absolute',
    bottom: 56,
    left: 0,
    right: 0,
    backgroundColor: Colors.bgElevated,
    borderRadius: Theme.borderRadius.md,
    maxHeight: 280,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.goldHairline,
    elevation: 10,
    shadowColor: Colors.shadowBlack,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    gap: Theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  resultPoster: {
    width: 36,
    height: 54,
    borderRadius: 4,
  },
  noPoster: {
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  resultYear: {
    ...Theme.typography.caption,
  },
});
