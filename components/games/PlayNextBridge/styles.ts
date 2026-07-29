/**
 * PlayNextBridge stilleri — Festival Layer.
 * DailyRoute ile ayni dil: altin sac teli, eyebrow baslik.
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    borderWidth: 1,
    // Eskiden hardcoded rgba(218,165,32,0.2) idi — token'a cevrildi
    borderColor: Colors.goldHairline,
    gap: Theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  headerText: {
    ...Theme.typography.eyebrow,
    color: Colors.gold,
  },
  suggestion: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
  },
  playButton: {
    borderWidth: 1,
    borderColor: Colors.goldHairline,
    borderRadius: Theme.borderRadius.sm,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    alignSelf: 'flex-start',
  },
  playButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gold,
  },
});
