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
import { useSubscription } from '@/contexts/SubscriptionContext';
import { getSearchAnalyticsContext } from '@/services/moodSearchState';
import { posthogAnalytics } from '@/services/posthog';
import { paywallMoodCore } from '@/utils/moodAnalytics';
import type { PaywallVariant } from '@/services/conversion';

import PaywallQuotaExhausted from './PaywallQuotaExhausted';
import PaywallMoodHistory from './PaywallMoodHistory';
import PaywallStreamingLink from './PaywallStreamingLink';
import PaywallProfileUpgrade from './PaywallProfileUpgrade';
import PaywallLifetimeSoldout from './PaywallLifetimeSoldout';
import PaywallMissedDayArchive from './PaywallMissedDayArchive';
import PaywallMoodOffer from './PaywallMoodOffer';

// ⚠️ `streak_milestone` · `watchlist_full` · `roulette_limit` bilesenleri
// `_archive/` altina tasindi (olu varyant temizligi, 26 Eyl 2026). Bu isimlerle
// bir variant artik uretilemez — `triggerToVariant` null donuyor.

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
  const { premiumStatus } = useSubscription();
  useEffect(() => {
    if (visible) {
      // MONEY-1C: mood_offer varyantinda ortak cekirdek (diger varyantlarda sekil ayni).
      posthogAnalytics.track('paywall_viewed', {
        variant: variant.name,
        ...paywallMoodCore(variant.trigger, {
          isPro: premiumStatus === 'premium',
          consent: getSearchAnalyticsContext().consent,
        }),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, variant.name]);

  if (!visible) return null;

  const commonProps = { visible, variant, onConvert, onDismiss };

  switch (variant.name) {
    case 'quota_exhausted':
      return <PaywallQuotaExhausted {...commonProps} />;
    case 'mood_history':
      return <PaywallMoodHistory {...commonProps} />;
    case 'streaming_link':
      return <PaywallStreamingLink {...commonProps} />;
    case 'profile_upgrade':
      return <PaywallProfileUpgrade {...commonProps} />;
    case 'lifetime_soldout':
      return <PaywallLifetimeSoldout {...commonProps} />;
    case 'missed_day_archive':
      return <PaywallMissedDayArchive {...commonProps} />;
    case 'mood_offer':
      return <PaywallMoodOffer {...commonProps} />;
    default:
      return null;
  }
}
