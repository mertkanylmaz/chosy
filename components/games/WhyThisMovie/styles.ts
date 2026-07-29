/**
 * WhyThisMovieFunnel — StyleSheet definitions (Festival Layer).
 *
 * Eskiden ampul ikonu teal (#2DD4BF) idi — oyun ekranlarinda kalan son
 * yabanci vurgu rengiydi. Tek altin kurali geregi altina cevrildi.
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

/** Kesif kartinin vurgu rengi — festival katmaninda tek altin */
export const ACCENT = Colors.gold;

/** Katlanabilir baslikta caret'i ters cevirir (acik durum) */
export const CARET_UP_STYLE = { transform: [{ rotate: '180deg' }] } as const;

export const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.goldHairline,
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.goldSeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Theme.typography.eyebrow,
    flex: 1,
  },
  /** Katlanabilir baslik — dokunma hedefi 44pt'a tamamlanir */
  headerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    minHeight: 44,
  },

  // ── Why Text ──
  whyText: {
    ...Theme.typography.serifQuote,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textSecondary,
  },

  // ── Fun Fact ──
  funFactSection: {
    gap: 6,
  },
  funFactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  funFactLabel: {
    ...Theme.typography.eyebrow,
    fontSize: 10,
    lineHeight: 13,
  },
  funFactText: {
    ...Theme.typography.body,
    color: Colors.textSecondary,
  },

  // ── Divider ──
  divider: {
    height: 1,
    backgroundColor: Colors.goldHairline,
  },

  // ── CTA ──
  /**
   * Dikey yigin — "Watch Tonight" en buyuk alani kaplayan birincil eylem.
   * Eskiden yan yanaydi ve bilgi bloklarinin altinda kaliyordu.
   */
  ctaColumn: {
    gap: Theme.spacing.sm,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Colors.accentPrimary,
  },
  watchButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textOnAccent,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.goldHairline,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gold,
  },
});
