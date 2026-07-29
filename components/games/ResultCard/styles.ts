/**
 * ResultCard stilleri — Festival Layer.
 *
 * Sonuc ani = perde acilisi: buyuk afis, serif film adi, sakin durum satiri.
 * Eskiden durum 64px'lik yesil/kirmizi dolgu halkaydi — semantik rengin yuzey
 * olarak kullanilmasi festival kuralini (Kural 1) ihlal ediyordu; artik
 * semantik renk yalnizca ikon ve metinde.
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    opacity: 0,
  },
  container: {
    alignSelf: 'stretch',
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.goldHairline,
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },

  // ── Perde: afis + serif film adi ──────────────────────────────────────────
  filmHero: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  poster: {
    width: 148,
    height: 222,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.goldHairline,
  },
  filmTitle: {
    ...Theme.typography.serifHero,
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  filmYearLabel: {
    ...Theme.typography.caption,
    color: Colors.textTertiary,
  },

  // ── Durum satiri ──────────────────────────────────────────────────────────
  statusSection: {
    alignItems: 'center',
    gap: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusTitle: {
    ...Theme.typography.eyebrow,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2,
  },
  statusTitleSolved: {
    color: Colors.gold,
  },
  statusSubtitle: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // ── XP / guven ────────────────────────────────────────────────────────────
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: Colors.goldHairline,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: Theme.borderRadius.full,
  },
  xpText: {
    ...Theme.typography.micro,
    color: Colors.gold,
    fontWeight: '700',
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    alignSelf: 'center',
  },
  confidenceLabel: {
    ...Theme.typography.eyebrow,
  },
  confidenceValue: {
    ...Theme.typography.micro,
    color: Colors.gold,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // ── Streak ────────────────────────────────────────────────────────────────
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Theme.spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.goldHairline,
  },
  streakCount: {
    ...Theme.typography.stat,
    fontSize: 18,
    lineHeight: 22,
    color: Colors.gold,
  },
  streakText: {
    ...Theme.typography.micro,
    color: Colors.gold,
  },

  // ── Aksiyonlar ────────────────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.goldHairline,
  },
  shareButtonDisabled: {
    opacity: 0.5,
  },
  shareText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gold,
  },
  hubButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  hubText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // ── Geri sayim ────────────────────────────────────────────────────────────
  countdownSection: {
    alignItems: 'center',
    gap: 2,
  },
  countdownLabel: {
    ...Theme.typography.eyebrow,
  },
  countdownTime: {
    ...Theme.typography.stat,
    fontSize: 16,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
});
