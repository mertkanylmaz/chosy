import { Dimensions, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Her kartın genişliği: (ekran - 2×yatay padding - gap) / 2 */
export const CARD_WIDTH = (SCREEN_WIDTH - 40 - 12) / 2;

export default StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  gradient: {
    flex: 1,
  },

  // ─── Header bar ─────────────────────────────────────────────────────────────
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 4,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Scroll ─────────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  // ─── Title ──────────────────────────────────────────────────────────────────
  title: {
    fontSize: Theme.typography.display.fontSize - 6,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.textWhite,
    marginTop: 4,
    lineHeight: 32,
  },

  // ─── Profile subtitle ────────────────────────────────────────────────────────
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 2,
  },
  profileBadgeLabel: {
    fontSize: Theme.typography.body.fontSize,
    color: Colors.textGrey,
  },
  profileBadgeName: {
    fontSize: Theme.typography.body.fontSize,
    color: Colors.textWhite,
    fontWeight: '700',
  },

  // ─── Description ────────────────────────────────────────────────────────────
  description: {
    fontSize: Theme.typography.caption.fontSize,
    color: Colors.textGrey,
    marginTop: 2,
    lineHeight: 20,
    marginBottom: 4,
  },

  // ─── Grid ───────────────────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  animWrapper: {
    width: CARD_WIDTH,
  },

  // ─── Card ───────────────────────────────────────────────────────────────────
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.cardSolid,
    borderWidth: 1,
    borderColor: Colors.goldDim,
    borderRadius: Theme.borderRadius.xl,
    padding: 14,
    minHeight: 120,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
    width: 20,
    height: 20,
  },
  cardLabel: {
    fontSize: Theme.typography.micro.fontSize,
    color: Colors.textGrey,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  cardValue: {
    fontSize: Theme.typography.h2.fontSize - 2,
    color: Colors.textWhite,
    fontFamily: 'PlayfairDisplay_700Bold',
    lineHeight: 26,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: Theme.typography.caption.fontSize,
    color: Colors.textGrey,
    lineHeight: Theme.typography.caption.lineHeight,
  },

  // ─── Energy progress bar ────────────────────────────────────────────────────
  progressBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },

  // ─── Share Your Mood button ─────────────────────────────────────────────────
  shareWrapper: {
    marginTop: 14,
  },
  shareBtn: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.accentPrimary,
    backgroundColor: 'transparent',
  },
  shareBtnText: {
    color: Colors.accentPrimary,
    fontSize: Theme.typography.h3.fontSize,
    fontWeight: '600',
  },

  // ─── Browse Movies button ───────────────────────────────────────────────────
  browseWrapper: {
    marginTop: 16,
    marginBottom: 20,
    borderRadius: Theme.borderRadius.xl,
    overflow: 'hidden',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  browseBtn: {
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Theme.borderRadius.xl,
  },
  browseBtnText: {
    color: Colors.background,
    fontSize: Theme.typography.h3.fontSize,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
