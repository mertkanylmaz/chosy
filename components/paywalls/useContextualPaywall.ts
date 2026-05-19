/**
 * useContextualPaywall — integration hook for contextual paywalls.
 *
 * Trigger event gonderildiginde orchestrator karari verir,
 * uygun paywall variant'ini acar.
 *
 * Kullanim:
 *   const { triggerPaywall, paywallProps } = useContextualPaywall();
 *
 *   // Kota bittiginde:
 *   triggerPaywall({ type: 'quota_exhausted', quota: 'search' });
 *
 *   // JSX'te:
 *   <ContextualPaywall {...paywallProps} />
 */

import { useCallback, useState } from 'react';

import type { PlanId } from '@/constants/subscriptionPlans';
import { useSubscription } from '@/contexts/SubscriptionContext';
import {
  shouldShowPaywall,
  type TriggerEvent,
  type PaywallVariant,
} from '@/services/conversion';
import { logger } from '@/utils/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ContextualPaywallState {
  visible: boolean;
  variant: PaywallVariant | null;
}

interface UseContextualPaywallReturn {
  /** Trigger event gonder — uygunsa paywall acar */
  triggerPaywall: (event: TriggerEvent) => Promise<boolean>;
  /** Paywall'a gonderilecek props */
  paywallProps: {
    visible: boolean;
    variant: PaywallVariant;
    onConvert: (plan: PlanId) => void;
    onDismiss: () => void;
  };
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Contextual paywall hook — orchestrator + UI state yonetimi.
 *
 * @param onConvertCallback Basarili satin alma sonrasi ek callback (opsiyonel)
 */
export function useContextualPaywall(
  onConvertCallback?: (plan: PlanId) => void,
): UseContextualPaywallReturn {
  const { isInTrial, isPremium } = useSubscription();
  const [state, setState] = useState<ContextualPaywallState>({
    visible: false,
    variant: null,
  });

  /** Trigger event gonder */
  const triggerPaywall = useCallback(async (event: TriggerEvent): Promise<boolean> => {
    try {
      const variant = await shouldShowPaywall(event, isInTrial, isPremium);
      if (variant) {
        setState({ visible: true, variant });
        return true;
      }
      return false;
    } catch (err) {
      logger.warn('[contextual-paywall] Trigger hatasi:', err);
      return false;
    }
  }, [isInTrial, isPremium]);

  /** Dismiss handler */
  const handleDismiss = useCallback(() => {
    setState({ visible: false, variant: null });
  }, []);

  /** Convert handler */
  const handleConvert = useCallback((plan: PlanId) => {
    setState({ visible: false, variant: null });
    onConvertCallback?.(plan);
  }, [onConvertCallback]);

  // Placeholder variant for type safety (never rendered when variant is null)
  const safeVariant: PaywallVariant = state.variant ?? {
    name: 'quota_exhausted',
    trigger: { type: 'quota_exhausted', quota: 'search' },
    abTestGroup: null,
  };

  return {
    triggerPaywall,
    paywallProps: {
      visible: state.visible,
      variant: safeVariant,
      onConvert: handleConvert,
      onDismiss: handleDismiss,
    },
  };
}
