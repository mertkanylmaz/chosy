/**
 * WhyThisMovieFunnel — StyleSheet definitions.
 *
 * Accent: teal (#2DD4BF) for lightbulb, amber for CTA.
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

/** Teal accent for the lightbulb icon */
export const TEAL = '#2DD4BF';
const TEAL_DIM = 'rgba(45,212,191,0.12)';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 16,
    gap: 12,
  },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: TEAL_DIM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textWhite,
  },

  // ── Why Text ──
  whyText: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
    lineHeight: 20,
    fontStyle: 'italic',
  },

  // ── Fun Fact ──
  funFactSection: {
    gap: 6,
  },
  funFactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  funFactLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  funFactText: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // ── Divider ──
  divider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
  },

  // ── CTA Row ──
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  watchButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Colors.accentPrimary,
  },
  watchButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textOnAccent,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accentPrimary,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accentPrimary,
  },
});
