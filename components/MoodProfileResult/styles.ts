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
    paddingTop: 16,
    paddingBottom: 8,
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
    borderColor: 'rgba(212,168,67,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Scroll ─────────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // ─── Title ──────────────────────────────────────────────────────────────────
  title: {
    fontSize: 32,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.textWhite,
    marginTop: 16,
    lineHeight: 40,
  },

  // ─── Profile subtitle ────────────────────────────────────────────────────────
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  profileBadgeLabel: {
    fontSize: 14,
    color: Colors.textGrey,
  },
  profileBadgeName: {
    fontSize: 14,
    color: Colors.textWhite,
    fontWeight: '700',
  },

  // ─── Description ────────────────────────────────────────────────────────────
  description: {
    fontSize: 14,
    color: Colors.textGrey,
    marginTop: 4,
    lineHeight: 22,
    marginBottom: 8,
  },

  // ─── Grid ───────────────────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 20,
  },
  animWrapper: {
    width: CARD_WIDTH,
  },

  // ─── Card ───────────────────────────────────────────────────────────────────
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.cardSolid,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.12)',
    borderRadius: Theme.borderRadius.xl,
    padding: 18,
    minHeight: 140,
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
    borderColor: 'rgba(212,168,67,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
    fontSize: 16,
  },
  cardLabel: {
    fontSize: 11,
    color: Colors.textGrey,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 20,
    color: Colors.textWhite,
    fontFamily: 'PlayfairDisplay_700Bold',
    lineHeight: 26,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: Colors.textGrey,
    lineHeight: 17,
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

  // ─── Browse Movies button ───────────────────────────────────────────────────
  browseWrapper: {
    marginTop: 32,
    marginBottom: 40,
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
    fontSize: 17,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
