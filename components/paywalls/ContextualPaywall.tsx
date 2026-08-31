/**
 * ContextualPaywall — variant router.
 *
 * PaywallVariant'a gore dogru component'i render eder.
 *
 * Kullanim:
 *   <ContextualPaywall {...paywallProps} />
 */

import React, { useEffect } from 'react';

import type { PlanId } from '@/constants/subscriptionPlans';
import { posthogAnalytics } from '@/services/posthog';
import type { PaywallVariant } from '@/services/conversion';

import PaywallQuotaExhausted from './PaywallQuotaExhausted';
import PaywallStreakMilestone from './PaywallStreakMilestone';
import PaywallWatchlistFull from './PaywallWatchlistFull';
import PaywallMoodHistory from './PaywallMoodHistory';
import PaywallStreamingLink from './PaywallStreamingLink';
import PaywallProfileUpgrade from './PaywallProfileUpgrade';
import PaywallRouletteLimit from './PaywallRouletteLimit';
import PaywallLifetimeSoldout from './PaywallLifetimeSoldout';
import PaywallMissedDayArchive from './PaywallMissedDayArchive';

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
  useEffect(() => {
    if (visible) {
      posthogAnalytics.track('paywall_viewed', { variant: variant.name });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, variant.name]);

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
    case 'profile_upgrade':
      return <PaywallProfileUpgrade {...commonProps} />;
    case 'roulette_limit':
      return <PaywallRouletteLimit {...commonProps} />;
    case 'lifetime_soldout':
      return <PaywallLifetimeSoldout {...commonProps} />;
    case 'missed_day_archive':
      return <PaywallMissedDayArchive {...commonProps} />;
    default:
      return null;
  }
}
