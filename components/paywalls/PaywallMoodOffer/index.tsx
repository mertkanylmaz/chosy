/**
 * PaywallMoodOffer — Mood Search teklifi (MONEY-1C).
 *
 * Trigger: mood_offer (`entry`: champion_card | spotlight_card | quota_exhausted |
 * lock_card). PaywallBase + giriş noktasına göre başlık + üç fayda satırı + "gecelik
 * film ücretsiz kalır" notu. Sabit sayı ("8") ve "Unlimited" YOKTUR: hak/deste
 * boyutu sunucu ve yapılandırmayla değişir. "7 gün ücretsiz" kopyası BURADA yoktur —
 * deneme yalnız PaywallBase'in `buildOffer` çıktısıyla ve `getTrialEligibility ===
 * 'eligible'` ise görünür; uygun olmayan kullanıcı standart fiyatlı teklifi görür.
 */

import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CheckCircle } from 'phosphor-react-native';

import { color, size, space, type } from '@/constants/design/semantic';
import type { PlanId } from '@/constants/subscriptionPlans';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PaywallVariant } from '@/services/conversion';
import { moodOfferTitleKey } from '@/utils/moodOfferCopy';
import PaywallBase, { type PaywallHeaderContext } from '../PaywallBase';

interface Props {
  visible: boolean;
  variant: PaywallVariant;
  onConvert: (plan: PlanId) => void;
  onDismiss: () => void;
}

const BENEFIT_KEYS = [
  'moodOffer.paywallBenefit1',
  'moodOffer.paywallBenefit2',
  'moodOffer.paywallBenefit3',
] as const;

export default function PaywallMoodOffer({ visible, variant, onConvert, onDismiss }: Props) {
  const { t } = useLanguage();
  const entry = variant.trigger.type === 'mood_offer' ? variant.trigger.entry : 'lock_card';

  const renderHeader = useCallback(
    (_pricing: unknown, ctx: PaywallHeaderContext) => (
      // Deneme karti plan alanini uzatir (R-5 fit): baslik alt boslugu daralir.
      <Text style={[styles.title, ctx.trialShown && styles.titleCompact]} accessibilityRole="header">
        {t(moodOfferTitleKey(entry))}
      </Text>
    ),
    [entry, t],
  );

  const renderBelowPlans = useCallback(
    () => (
      <View style={styles.benefits}>
        {BENEFIT_KEYS.map((key) => (
          <View key={key} style={styles.benefitRow}>
            <CheckCircle size={size.iconAction} color={color.reward.primary} weight="duotone" />
            <Text style={styles.benefitText}>{t(key)}</Text>
          </View>
        ))}
        <Text style={styles.nightly}>{t('moodOffer.paywallNightly')}</Text>
      </View>
    ),
    [t],
  );

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
  title: {
    ...type['display-m'],
    color: color.text.primary,
    textAlign: 'center',
    marginBottom: space.base,
  },
  titleCompact: {
    marginBottom: space.sm,
  },
  benefits: {
    marginTop: space.lg,
    gap: space.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  benefitText: {
    ...type.body,
    color: color.text.primary,
    flex: 1,
  },
  nightly: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
    marginTop: space.sm,
  },
});
