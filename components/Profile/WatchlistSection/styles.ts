/**
 * WatchlistSection stilleri.
 * watchlist-detail.tsx'ten tasinmistir — Stack screen wrapper stilleri cikarildi.
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { CARD_WIDTH, GRID_COL_GAP, GRID_H_PAD } from '@/components/Watchlist/WatchlistCard/styles';

export { CARD_WIDTH, GRID_COL_GAP, GRID_H_PAD };

const POSTER_HEIGHT = CARD_WIDTH * 1.5;
export { POSTER_HEIGHT };

export const styles = StyleSheet.create({
  /** Ana container — Profile ScrollView icinde gorunur */
  container: {
    paddingTop: 8,
    marginTop: 8,
    marginBottom: 16,
  },

  /* Section header — baslik + film sayisi + ikonlar */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 2,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white05,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Film sayisi badge */
  countBadge: {
    backgroundColor: Colors.goldDim,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 6,
  },
  countBadgeText: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '700',
  },

  /* Arama */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.white10,
    borderRadius: 12,
    backgroundColor: Colors.white05,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.textWhite,
    fontSize: 15,
  },
  clearSearch: {
    color: Colors.textGrey,
    fontSize: 18,
    paddingLeft: 4,
  },

  /* Chip'ler */
  chipsScroll: {
    flexGrow: 0,
    marginTop: 12,
    marginBottom: 4,
  },
  chipsContent: {
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  chip: {
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: Colors.accentPrimary,
  },
  chipInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.tabInactive,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Colors.textOnAccent,
  },
  chipTextInactive: {
    color: Colors.textGrey,
  },
  chipDivider: {
    width: 1,
    height: 18,
    backgroundColor: Colors.white10,
    marginHorizontal: 4,
  },

  /* Roulette CTA */
  rouletteCta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: Colors.accentPrimary,
    gap: 10,
  },
  rouletteCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textOnAccent,
  },

  /* Grid (list mode) — FlatList yerine map() kullanilir */
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_COL_GAP,
    marginTop: 16,
    paddingBottom: 8,
  },

  /* Skeleton grid */
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_COL_GAP,
    paddingTop: 16,
  },
  skeletonCard: {
    width: CARD_WIDTH,
  },

  /* Grouped view */
  groupedContainer: {
    marginTop: 16,
  },
  groupSkeleton: {
    marginBottom: 12,
  },
  groupedEmpty: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 32,
    gap: 10,
  },
  groupedEmptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textWhite,
    textAlign: 'center',
  },
  groupedEmptySubtitle: {
    fontSize: 14,
    color: Colors.textGrey,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Uzun basma modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: Colors.cardSolid,
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalFilmTitle: {
    fontSize: 13,
    color: Colors.textGrey,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.white10,
  },
  modalOption: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.white10,
  },
  modalOptionLast: {
    borderBottomWidth: 0,
  },
  modalOptionText: {
    fontSize: 16,
    color: Colors.textWhite,
  },
  modalOptionTextRed: {
    color: Colors.error,
  },

  /* Menu modal */
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: Colors.cardSolid,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.white05,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    color: Colors.textWhite,
    fontSize: 16,
  },
  menuItemTextActive: {
    color: Colors.gold,
    fontWeight: '700',
  },
  menuItemTextRed: {
    color: Colors.error,
    fontSize: 16,
  },
  menuItemTextGrey: {
    color: Colors.textGrey,
    fontSize: 16,
    textAlign: 'center',
  },

  /* Bos durum — empty state wrapper */
  emptyContainer: {
    paddingTop: 24,
    paddingBottom: 16,
  },
});
