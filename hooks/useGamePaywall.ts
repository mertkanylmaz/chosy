/**
 * useGamePaywall — game tamamlandiktan sonra contextual paywall trigger.
 *
 * Perfect streak milestone'larinda (3, 5, 7, 10 arka arkaya cozum)
 * free user'lara paywall gosterir.
 *
 * Kullanim:
 *   const { checkGamePaywall, paywallProps } = useGamePaywall();
 *
 *   // Oyun bittikten sonra:
 *   checkGamePaywall(streakCount, solved);
 *
 *   // JSX'te:
 *   <ContextualPaywall {...paywallProps} />
 */

import { useCallback } from 'react';

import { useSubscription } from '@/contexts/SubscriptionContext';
import { useContextualPaywall } from '@/components/paywalls/useContextualPaywall';
import { isPerfectGameMilestone } from '@/services/conversion';
import type { PaywallVariant } from '@/services/conversion';
import type { PlanId } from '@/constants/subscriptionPlans';

interface UseGamePaywallReturn {
  /** Oyun bittikten sonra cagir — streak milestone kontrolu yapar */
  checkGamePaywall: (streakCount: number, solved: boolean) => void;
  /** ContextualPaywall'a gonderilecek props */
  paywallProps: {
    visible: boolean;
    variant: PaywallVariant;
    onConvert: (plan: PlanId) => void;
    onDismiss: () => void;
  };
}

/** Game completion sonrasi paywall trigger hook */
export function useGamePaywall(): UseGamePaywallReturn {
  const { isPremium } = useSubscription();
  const { triggerPaywall, paywallProps } = useContextualPaywall();

  const checkGamePaywall = useCallback(
    (streakCount: number, solved: boolean) => {
      // Sadece free user + cozmus + milestone esiginde
      if (isPremium || !solved) return;

      if (isPerfectGameMilestone(streakCount)) {
        triggerPaywall({ type: 'game_perfect_streak', count: streakCount });
      }
    },
    [isPremium, triggerPaywall],
  );

  return {
    checkGamePaywall,
    paywallProps,
  };
}
