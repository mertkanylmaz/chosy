import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  // ── Kart ──
  card: {
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.3)',
    overflow: 'hidden',
    minHeight: 200,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },

  // ── Backdrop ──
  backdropAbsolute: {
    ...StyleSheet.absoluteFillObject,
  },
  blurFill: {
    ...StyleSheet.absoluteFillObject,
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,14,39,0.70)',
  },

  // ── İçerik ──
  contentPadding: {
    padding: Theme.spacing.md,
  },

  // ── Başlık ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  headerEmoji: {
    fontSize: 16,
  },
  headerTitle: {
    color: Colors.textWhite,
    fontSize: 16,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 0.2,
    flex: 1,
  },
  headerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  headerBadgeText: {
    color: Colors.gold,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  // ── Film satırı ──
  filmRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  posterWrapper: {
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 16,
  },
  poster: {
    width: 72,
    height: 108,
    borderRadius: 10,
    backgroundColor: Colors.white10,
    transform: [{ rotate: '2deg' }],
  },
  posterPlaceholder: {
    width: 72,
    height: 108,
    borderRadius: 10,
    backgroundColor: Colors.white10,
    transform: [{ rotate: '2deg' }],
  },
  filmInfo: {
    flex: 1,
    gap: 5,
    paddingTop: 4,
  },
  filmTitle: {
    color: Colors.textWhite,
    fontSize: 20,
    fontFamily: 'PlayfairDisplay_700Bold',
    lineHeight: 26,
  },
  filmMeta: {
    color: Colors.textGrey,
    fontSize: 13,
  },
  genres: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  genreTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Theme.borderRadius.pill,
    borderWidth: 1,
    borderColor: Colors.white10,
    backgroundColor: Colors.white05,
  },
  genreTagText: {
    color: Colors.textLightGrey,
    fontSize: 10,
  },

  // ── Match score ──
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  matchCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.goldDim,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  matchPercent: {
    color: Colors.gold,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  matchTextBlock: {
    flex: 1,
    gap: 4,
  },
  matchExplanation: {
    color: Colors.gold,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },

  // ── Boş durum ──
  empty: {
    color: Colors.textGrey,
    fontSize: 13,
    paddingVertical: 8,
    lineHeight: 18,
  },

  // ── Skeleton ──
  skeletonBlock: {
    gap: 10,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonInfo: {
    flex: 1,
    gap: 8,
  },
});
