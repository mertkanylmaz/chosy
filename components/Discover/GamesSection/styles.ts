import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    marginBottom: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.sm,
  },
  headerTitle: {
    ...Theme.typography.h2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm + 4,
  },
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.bgElevated,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: Theme.spacing.md,
    gap: Theme.spacing.xs,
  },
  cardIcon: {
    marginBottom: Theme.spacing.xs,
  },
  cardTitle: {
    ...Theme.typography.h3,
  },
  cardDescription: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accentPrimary,
  },
});
