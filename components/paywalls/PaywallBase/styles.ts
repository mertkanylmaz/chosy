/**
 * PaywallBase — shared styles for all contextual paywall variants (V2).
 *
 * Renkler `constants/design/semantic.ts` tokenlarından gelir (Karanlık Salon).
 * Düzen: üstte kaydırılabilir içerik, altta SABİT satın alma alanı.
 */

import { Dimensions, StyleSheet } from 'react-native';

import { color, radius, size, space, type } from '@/constants/design/semantic';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const PAYWALL_HEIGHT = SCREEN_HEIGHT * 0.85;

/**
 * Sheet'in üstündeki tutamaç + ✕ bandı. Kaydırılan içerik bu bandın altından
 * başlar; hero bu bandın ALTINA uzanır (negatif marj) ki ✕ hero üstünde dursun.
 */
export const PAYWALL_TOP_INSET = size.touchTarget;

/** Yatay kenar boşluğu — hero bunu negatif marjla aşar. */
export const PAYWALL_GUTTER = space.lg - space.xs; // 20

export const styles = StyleSheet.create({
  // ─── Bottom Sheet Overlay ──────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: PAYWALL_HEIGHT,
    backgroundColor: color.surface.raised,
    borderTopLeftRadius: radius.chrome,
    borderTopRightRadius: radius.chrome,
    overflow: 'hidden',
  },

  // ─── Üst bant: tutamaç + ✕ ────────────────────────────────────────────────
  /**
   * Opak şerit: kaydırılan içerik tutamaç ve ✕'in ALTINDAN geçer, üstünden
   * değil. Zemin sheet ile aynı token (`surface.raised`) — görünür bir bant
   * değil, yalnız örtü. Altındaki `topFade` içeriğe/hero ışığına yumuşak geçiş.
   */
  topBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: PAYWALL_TOP_INSET,
    backgroundColor: color.surface.raised,
    zIndex: 1,
  },
  topFade: {
    position: 'absolute',
    top: PAYWALL_TOP_INSET,
    left: 0,
    right: 0,
    height: space.md,
    zIndex: 1,
  },
  dragHandleArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: PAYWALL_TOP_INSET,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.text.secondary,
    opacity: 0.6,
  },
  /** ✕ — 44×44pt dokunma alanı, sheet'in sağ üstü */
  closeButton: {
    position: 'absolute',
    top: 0,
    right: space.sm,
    width: size.touchTarget,
    height: size.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },

  // ─── Kaydırılabilir içerik ────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: PAYWALL_GUTTER,
    paddingTop: PAYWALL_TOP_INSET,
    paddingBottom: space.base,
  },

  // ─── Plan kartları ────────────────────────────────────────────────────────
  planContainer: {
    gap: space.sm + 2,
    marginTop: space.xs,
  },
  planCard: {
    minHeight: size.touchTarget,
    backgroundColor: color.surface.base,
    borderRadius: radius.surface,
    paddingVertical: space.md,
    paddingHorizontal: space.base,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  /** İnce marquee kontur */
  planCardSelected: {
    borderColor: color.reward.primary,
  },
  planInfo: {
    flex: 1,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  planTitle: {
    ...type['body-strong'],
    color: color.text.primary,
  },
  planBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: color.reward.primary,
  },
  planBadgeText: {
    ...type['label-caps'],
    letterSpacing: 0.4,
    color: color.surface.base,
  },
  planPrice: {
    ...type.callout,
    color: color.text.primarySoft,
    marginTop: 2,
  },
  planEquivalent: {
    ...type.caption,
    color: color.text.secondary,
    marginTop: 2,
  },

  // Radio indicator
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: color.text.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: space.md,
  },
  radioOuterSelected: {
    borderColor: color.reward.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: color.reward.primary,
  },

  // ─── Skeleton (fiyatlar yüklenirken; animasyonsuz) ────────────────────────
  skeletonCard: {
    height: 68,
    borderRadius: radius.surface,
    backgroundColor: color.surface.base,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: color.surface.border,
  },
  skeletonLineWide: { width: '85%' },
  skeletonLineNarrow: { width: '60%' },
  skeletonDescription: {
    marginTop: space.md,
    gap: 6,
    alignItems: 'center',
  },

  // ─── Sabit satın alma alanı ───────────────────────────────────────────────
  footer: {
    paddingHorizontal: PAYWALL_GUTTER,
    paddingTop: space.sm,
    borderTopWidth: size.hairline,
    borderTopColor: color.surface.border,
    backgroundColor: color.surface.raised,
  },
  /** Büyük Dynamic Type'ta footer içeriğin sonuna akar; sabit değil. */
  footerInline: {
    paddingTop: space.lg,
  },
  ctaButton: {
    minHeight: size.actionHeight + 6,
    borderRadius: radius.surface,
    backgroundColor: color.reward.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.base,
  },
  ctaText: {
    ...type['body-strong'],
    color: color.surface.base,
    textAlign: 'center',
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  description: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
    marginTop: space.sm - 2,
  },

  // ─── Restore · Terms · Privacy ────────────────────────────────────────────
  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: space.sm,
    marginTop: space.xs,
  },
  legalItem: {
    minHeight: size.touchTarget,
    // Yatay padding küçük: üç etiket 393pt'te TEK satıra sığsın. Yükseklik
    // 44pt kalır; büyük Dynamic Type'ta flexWrap satırı serbestçe kırar.
    paddingHorizontal: space.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legalText: {
    ...type.caption,
    color: color.text.secondary,
    textDecorationLine: 'underline',
  },

  // ─── Offering Yukleme Hatasi ──────────────────────────────────────────────
  offeringsErrorBox: {
    alignItems: 'center',
    paddingVertical: space.lg,
    paddingHorizontal: space.base,
    gap: space.base,
  },
  offeringsErrorText: {
    ...type.callout,
    color: color.text.secondary,
    textAlign: 'center',
  },
  offeringsRetryBtn: {
    minHeight: size.touchTarget,
    paddingHorizontal: space.lg,
    borderRadius: radius.surface,
    borderWidth: size.hairline,
    borderColor: color.reward.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offeringsRetryText: {
    ...type.callout,
    color: color.text.primary,
  },
});
