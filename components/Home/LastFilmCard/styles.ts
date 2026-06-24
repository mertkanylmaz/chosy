/**
 * LastFilmCard stilleri.
 * CDO polish: Poster shadow, kart depth, rating gold glow, boş durum iyileştirmesi.
 */

import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 20,
    marginTop: 20,
  },

  sectionLabel: {
    fontSize: Theme.typography.micro.fontSize,
    lineHeight: Theme.typography.micro.lineHeight,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 10,
  },

  // ── Film kartı ─────────────────────────────────────────────────────────────

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.white10,
    padding: 12,
    gap: 14,
    ...Theme.shadow.card,
  },
  poster: {
    width: 56,
    height: 82,
    borderRadius: 10,
    backgroundColor: Colors.bgElevated,
    // Poster shadow — subtle depth
    shadowColor: Colors.background,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  posterPlaceholder: {
    width: 56,
    height: 82,
    borderRadius: 10,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.white05,
  },
  info: {
    flex: 1,
    gap: 5,
  },
  title: {
    fontSize: Theme.typography.h3.fontSize,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.textPrimary,
    lineHeight: Theme.typography.h3.lineHeight,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    fontSize: Theme.typography.caption.fontSize,
    color: Colors.textSecondary,
  },
  metaDot: {
    fontSize: Theme.typography.caption.fontSize,
    color: Colors.textTertiary,
  },
  rating: {
    fontSize: Theme.typography.caption.fontSize,
    color: Colors.gold,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  addedAt: {
    fontSize: Theme.typography.micro.fontSize,
    color: Colors.textTertiary,
  },

  // ── Boş durum ──────────────────────────────────────────────────────────────

  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.white10,
    padding: 16,
    gap: 14,
  },
  emptyText: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: Theme.typography.body.fontSize,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: Theme.typography.caption.fontSize,
    color: Colors.textSecondary,
    marginTop: 3,
    lineHeight: Theme.typography.caption.lineHeight,
  },
});
