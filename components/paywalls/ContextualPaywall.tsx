/**
 * ContextualPaywall — variant router.
 *
 * PaywallVariant'a gore dogru component'i render eder.
 *
 * Kullanim:
 *   <ContextualPaywall {...paywallProps} />
 */

import React from 'react';

import type { PlanId } from '@/constants/subscriptionPlans';
import type { PaywallVariant } from '@/services/conversion';

import PaywallQuotaExhausted from './PaywallQuotaExhausted';
import PaywallStreakMilestone from './PaywallStreakMilestone';
import PaywallWatchlistFull from './PaywallWatchlistFull';
import PaywallMoodHistory from './PaywallMoodHistory';
import PaywallStreamingLink from './PaywallStreamingLink';

// ─── Props ──────────────────────────────────────────────────────────────────

interface ContextualPaywallProps {
  visible: boolean;
  variant: PaywallVariant;
  onConvert: (plan: PlanId) => void;
  onDismiss: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

/** Variant'a gore dogru paywall component'ini render eder */
export default function ContextualPaywall({
  visible,
  variant,
  onConvert,
  onDismiss,
}: ContextualPaywallProps) {
  if (!visible) return null;

  const commonProps = { visible, variant, onConvert, onDismiss };

  switch (variant.name) {
    case 'quota_exhausted':
      return <PaywallQuotaExhausted {...commonProps} />;
    case 'streak_milestone':
      return <PaywallStreakMilestone {...commonProps} />;
    case 'watchlist_full':
      return <PaywallWatchlistFull {...commonProps} />;
    case 'mood_history':
      return <PaywallMoodHistory {...commonProps} />;
    case 'streaming_link':
      return <PaywallStreamingLink {...commonProps} />;
    default:
      return null;
  }
}
