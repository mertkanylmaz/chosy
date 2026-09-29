/**
 * SessionAccordion stilleri.
 * Accordion kapsayıcısı, header, body ve 2-sütunlu film grid'i.
 */
import { StyleSheet } from 'react-native';

import { color, radius, size, space, type } from '@/constants/design/semantic';
import { GRID_COL_GAP } from '../WatchlistCard/styles';

export default StyleSheet.create({
  /* ── Kapsayıcı ───────────────────────────────────────────────── */
  container: {
    marginHorizontal: space.base,
    marginBottom: space.md,
    borderRadius: radius.surface,
    backgroundColor: color.surface.raised,
    overflow: 'hidden',
    borderWidth: size.hairline,
    borderColor: color.surface.border,
  },

  /* ── Header ──────────────────────────────────────────────────── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.base,
    paddingVertical: space.md,
    gap: space.md,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: color.surface.base,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerCenter: {
    flex: 1,
  },
  headerLabel: {
    ...type.callout,
    fontWeight: '600',
    color: color.text.primary,
  },
  headerMeta: {
    ...type.caption,
    color: color.text.secondary,
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
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    overflow: 'hidden',
    backgroundColor: color.surface.raised,
  },
  stackPosterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Separator ───────────────────────────────────────────────── */
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.surface.border,
    marginHorizontal: space.base,
  },

  /* ── Body ────────────────────────────────────────────────────── */
  body: {
    paddingHorizontal: space.base,
    paddingTop: space.md,
    paddingBottom: space.base,
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
