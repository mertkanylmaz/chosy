/**
 * Spotlight V3 stilleri — Festival Layer.
 *
 * Tek gorsel + harf harf acilan baslik. Gorsel ekranin kahramani
 * (Kural 4), altinda harf kutulari, en altta klavye.
 */
import { Dimensions, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

/** Gorsel 16:9 — filmden bir kare, afis degil (FadeIn afisle oynuyor) */
export const STILL_W = SCREEN_W - Theme.spacing.md * 2;
export const STILL_H = Math.round(STILL_W * 0.56);

/** Klavye tus olcusu — en genis sira 10 sutun */
const KEY_GAP = 4;
const KEY_W = Math.floor((STILL_W - KEY_GAP * 9) / 10);

export { SCREEN_W };

export const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.md,
  },

  // ─── Gorsel ───────────────────────────────────────────────────────────────
  stillWrap: {
    width: STILL_W,
    height: STILL_H,
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.goldHairline,
    backgroundColor: Colors.bgCard,
    marginTop: Theme.spacing.sm,
  },
  still: {
    width: '100%',
    height: '100%',
  },
  /** Kalan hak rozeti — gorselin sag ustu */
  attemptsBadge: {
    position: 'absolute',
    top: Theme.spacing.sm,
    right: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Colors.scrim,
  },
  attemptsText: {
    ...Theme.typography.eyebrow,
    color: Colors.textPrimary,
  },

  // ─── Baslik maskesi ───────────────────────────────────────────────────────
  maskLabel: {
    ...Theme.typography.eyebrow,
    textAlign: 'center',
  },
  maskRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Theme.spacing.sm,
  },
  /** Tahmin edilecek karakter kutusu */
  slot: {
    minWidth: 22,
    height: 32,
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderBottomWidth: 2,
    borderBottomColor: Colors.goldHairline,
  },
  slotRevealed: {
    borderBottomColor: Colors.gold,
  },
  slotText: {
    ...Theme.typography.serifTitle,
    fontSize: 20,
    lineHeight: 24,
    color: Colors.gold,
  },
  /** Bosluk / noktalama — gorunur ayrac */
  separator: {
    minWidth: 10,
    height: 32,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  separatorText: {
    ...Theme.typography.serifTitle,
    fontSize: 20,
    lineHeight: 24,
    color: Colors.textTertiary,
  },

  // ─── Klavye ───────────────────────────────────────────────────────────────
  keyboard: {
    gap: KEY_GAP,
    alignItems: 'center',
  },
  keyboardRow: {
    flexDirection: 'row',
    gap: KEY_GAP,
    justifyContent: 'center',
  },
  key: {
    width: KEY_W,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  /** Baslikta cikan harf */
  keyHit: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldSeal,
  },
  /** Baslikta olmayan harf — sonuk, tekrar denenemez */
  keyMiss: {
    borderColor: 'transparent',
    opacity: 0.35,
  },
  keyText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  keyTextHit: {
    color: Colors.gold,
  },

  // ─── Tahmin alani ─────────────────────────────────────────────────────────
  guessArea: {
    gap: Theme.spacing.sm,
  },
  guessLabel: {
    ...Theme.typography.eyebrow,
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  errorText: {
    flex: 1,
    ...Theme.typography.caption,
    color: Colors.textSecondary,
  },

  completedContainer: {
    paddingBottom: Theme.spacing.xl,
  },
});
