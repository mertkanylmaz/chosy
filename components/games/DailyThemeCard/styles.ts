/**
 * DailyThemeCard stilleri — Festival Layer.
 *
 * Acilmis tema: arkada ilk filmin afisi + scrim, ustte eyebrow,
 * ortada serif tema adi, altta afis seridi.
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    overflow: 'hidden',
  },
  containerUnlocked: {
    borderColor: Colors.goldHairline,
    // Arka plan afisi tasarken ic bosluk daha genis — metin nefes alsin
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.lg,
  },

  /** Acilmis temada arkada duran afis — scrim ile bastirilir */
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.scrim,
  },
  /** Metin katmani — arka plan uzerinde kalmasi icin */
  content: {
    gap: Theme.spacing.sm,
  },

  eyebrow: {
    ...Theme.typography.eyebrow,
  },
  eyebrowUnlocked: {
    ...Theme.typography.eyebrow,
    color: Colors.gold,
  },
  /** Kilitli durumdaki "???" — tema adinin yerini tutar */
  titleLocked: {
    ...Theme.typography.serifHero,
    color: Colors.textTertiary,
    letterSpacing: 4,
  },
  themeLabel: {
    ...Theme.typography.serifHero,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  /** Sagdaki ikon + sayac grubu — headerRow'un space-between'i buraya sizmasin */
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressText: {
    ...Theme.typography.micro,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  progressTextUnlocked: {
    color: Colors.gold,
  },

  // ─── Kilitli ilerleme noktalari ───────────────────────────────────────────
  dotsRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    alignItems: 'center',
    marginTop: Theme.spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dotFilled: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },

  // ─── Afis seridi ──────────────────────────────────────────────────────────
  filmStrip: {
    gap: Theme.spacing.sm,
    paddingRight: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  filmCard: {
    width: 84,
    gap: 4,
  },
  poster: {
    width: 84,
    height: 126,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.goldHairline,
  },
  filmTitle: {
    ...Theme.typography.micro,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  filmGame: {
    ...Theme.typography.eyebrow,
    fontSize: 9,
    lineHeight: 12,
  },

  // ─── Hata ─────────────────────────────────────────────────────────────────
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  errorText: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  retryButton: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: Colors.goldHairline,
  },
  retryText: {
    ...Theme.typography.micro,
    color: Colors.gold,
    fontWeight: '600',
  },
});
