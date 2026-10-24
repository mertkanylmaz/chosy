/**
 * PaywallMoodOffer — Pro Mode teklifi (MONEY-1C).
 *
 * Trigger: mood_offer (`entry`: champion_card | spotlight_card | quota_exhausted |
 * deck_end | deck_exit). Şablon PaywallProfileUpgrade: PaywallBase + ProHero +
 * ProBenefits; üstte giriş noktasına göre tek satır. "7 gün ücretsiz" kopyası
 * BURADA yoktur — deneme yalnız PaywallBase'in `buildOffer` çıktısıyla ve
 * `getTrialEligibility === 'eligible'` ise görünür; uygun olmayan kullanıcı
 * standart fiyatlı teklifi görür.
 */

import React, { useCallback } from 'react';
import { StyleSheet, Text } from 'react-native';

import { color, space, type } from '@/constants/design/semantic';
import type { PlanId } from '@/constants/subscriptionPlans';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PaywallVariant } from '@/services/conversion';
import { moodOfferKickerKey } from '@/utils/moodOfferCopy';
import PaywallBase, { type PaywallHeaderContext } from '../PaywallBase';
import { ProBenefits, ProHero } from '../ProHero';

interface Props {
  visible: boolean;
  variant: PaywallVariant;
  onConvert: (plan: PlanId) => void;
  onDismiss: () => void;
}

export default function PaywallMoodOffer({ visible, variant, onConvert, onDismiss }: Props) {
  const { t } = useLanguage();
  const entry = variant.trigger.type === 'mood_offer' ? variant.trigger.entry : 'deck_end';

  const renderHeader = useCallback(
    (_pricing: unknown, ctx: PaywallHeaderContext) => (
      <>
        <Text style={styles.kicker}>{t(moodOfferKickerKey(entry))}</Text>
        <ProHero hideSubhead={ctx.trialShown} />
      </>
    ),
    [entry, t],
  );
  const renderBelowPlans = useCallback(() => <ProBenefits />, []);

  return (
    <PaywallBase
      visible={visible}
      variant={variant}
      onConvert={onConvert}
      onDismiss={onDismiss}
      renderHeader={renderHeader}
      renderBelowPlans={renderBelowPlans}
    />
  );
}

const styles = StyleSheet.create({
  kicker: {
    ...type['label-caps'],
    color: color.text.secondary,
    textAlign: 'center',
    marginBottom: space.sm,
  },
});
