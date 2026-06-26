import { Dimensions, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POSTER_SIZE = SCREEN_WIDTH * 0.28;
const HERO_POSTER_SIZE = SCREEN_WIDTH * 0.42;

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: 40,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerEmoji: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 12,
  },
  title: {
    color: Colors.textWhite,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },

  // ── Stats row ───────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 28,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    color: Colors.textWhite,
    fontSize: 28,
    fontWeight: '800',
  },
  statNumberLiked: {
    color: Colors.success,
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },

  // ── Hero recommendation ─────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 24,
  },
  heroPoster: {
    width: HERO_POSTER_SIZE,
    height: HERO_POSTER_SIZE * 1.5,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Colors.bgCard,
  },
  heroInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  heroBadge: {
    color: Colors.accentPrimary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroTitle: {
    color: Colors.textWhite,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  heroYear: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginBottom: 8,
  },
  heroMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232,168,56,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 4,
  },
  heroMatchText: {
    color: Colors.accentPrimary,
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Liked poster strip ──────────────────────────────────────────────────────
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  posterStrip: {
    paddingBottom: 24,
  },
  posterStripContent: {
    gap: 10,
  },
  posterCard: {
    width: POSTER_SIZE,
    alignItems: 'center',
  },
  posterImage: {
    width: POSTER_SIZE,
    height: POSTER_SIZE * 1.5,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Colors.bgCard,
  },
  posterTitle: {
    color: Colors.textWhite,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    width: POSTER_SIZE,
  },

  // ── Insufficient note ───────────────────────────────────────────────────────
  insufficientNote: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 20,
  },

  // ── Action buttons ──────────────────────────────────────────────────────────
  actions: {
    gap: 12,
    marginTop: 8,
  },
  primaryBtn: {
    backgroundColor: Colors.accentPrimary,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: Colors.textOnAccent,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  secondaryBtnText: {
    color: Colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
});
