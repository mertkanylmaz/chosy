/**
 * SessionAccordion stilleri.
 * Accordion kapsayıcısı, header, body ve 2-sütunlu film grid'i.
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { GRID_COL_GAP } from '../WatchlistCard/styles';

export default StyleSheet.create({
  /* ── Kapsayıcı ───────────────────────────────────────────────── */
  container: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: Colors.cardSolid,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },

  /* ── Header ──────────────────────────────────────────────────── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerCenter: {
    flex: 1,
  },
  headerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textWhite,
    lineHeight: 19,
  },
  headerMeta: {
    fontSize: 12,
    color: Colors.textGrey,
    marginTop: 2,
  },
  headerChevron: {
    opacity: 0.7,
    flexShrink: 0,
  },

  /* ── Stacked Poster Önizleme ──────────────────────────────────── */
  /** Kapalı durumda sol tarafta üst üste 3 poster */
  stackedPosters: {
    width: 44,
    height: 32,
    position: 'relative',
    flexShrink: 0,
  },
  stackPoster: {
    position: 'absolute',
    top: 0,
  },
  stackPosterImage: {
    width: 24,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    backgroundColor: Colors.bgElevated,
  },
  stackPosterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Separator ───────────────────────────────────────────────── */
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.white10,
    marginHorizontal: 16,
  },

  /* ── Body ────────────────────────────────────────────────────── */
  body: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: GRID_COL_GAP,
  },

  /* ── Film satırı (2-sütun) ───────────────────────────────────── */
  filmRow: {
    flexDirection: 'row',
    gap: GRID_COL_GAP,
  },
  emptySlot: {
    flex: 1,
  },
});
