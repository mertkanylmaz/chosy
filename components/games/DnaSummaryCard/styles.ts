/**
 * DnaSummaryCard stilleri — Festival Layer.
 * Kart = duz bgCard + altin sac teli kenarlik (glow yok).
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.goldHairline,
    gap: Theme.spacing.sm,
  },
  sectionLabel: {
    ...Theme.typography.eyebrow,
  },
  dimensionsContainer: {
    gap: Theme.spacing.xs,
  },
  dimensionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  dimensionLabel: {
    ...Theme.typography.micro,
    color: Colors.textSecondary,
    width: 96,
  },
  barTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.white05,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
    // Tek altin kurali: DNA cubuklari da vurgu rengini kullanir (eski: Colors.info)
    backgroundColor: Colors.gold,
  },
  dimensionValue: {
    ...Theme.typography.micro,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    width: 28,
    textAlign: 'right',
  },
  comingSoonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  comingSoonText: {
    ...Theme.typography.eyebrow,
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: 1,
  },
});
