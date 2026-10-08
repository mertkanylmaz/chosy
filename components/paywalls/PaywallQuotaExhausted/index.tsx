/**
 * PaywallQuotaExhausted — kota bittiginde gosterilen contextual paywall.
 *
 * Trigger: quota_exhausted (search | slot | refine)
 * Context: "Bugunku kesiflerin bitti"
 * A/B test: paywall_quota_v1 (control / value_framing / social_proof)
 */

import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Hourglass } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import type { PlanId } from '@/constants/subscriptionPlans';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PaywallVariant } from '@/services/conversion';
import type { AnnualPricing } from '@/utils/paywallPricing';
import PaywallBase from '../PaywallBase';

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  variant: PaywallVariant;
  onConvert: (plan: PlanId) => void;
  onDismiss: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

/** Kota bittiginde gosterilen paywall variant */
export default function PaywallQuotaExhausted({
  visible,
  variant,
  onConvert,
  onDismiss,
}: Props) {
  const { t } = useLanguage();

  // A/B test variant'a gore header copy.
  // `social_proof` grubu: dogrulanamayan sosyal kanit kopyasi kaldirildi (R-C-1);
  // grup adi analitik/atama icin duruyor, kopya `control` ile ayni.
  // `value_framing` fiyati RC urunlerinden (pricing) alir; fiyat hesaplanamadiysa
  // sabit rakam uydurmaz, control kopyasina duser.
  const getHeaderCopy = useCallback((pricing: AnnualPricing | null) => {
    if (variant.abTestGroup === 'value_framing' && pricing) {
      return {
        title: t('contextPaywall.quotaValueTitle', { price: pricing.monthlyEquivalent }),
        subtitle: t('contextPaywall.quotaValueSubtitle', { percent: pricing.savingsPercent }),
      };
    }
    return {
      title: t('contextPaywall.quotaTitle'),
      subtitle: t('contextPaywall.quotaSubtitle'),
    };
  }, [variant.abTestGroup, t]);

  const renderHeader = useCallback((pricing: AnnualPricing | null) => {
    const headerCopy = getHeaderCopy(pricing);
    return (
      <View style={localStyles.header}>
        <View style={localStyles.iconCircle}>
          <Hourglass size={28} color={Colors.accentPrimary} weight="duotone" />
        </View>
        <Text style={localStyles.title}>{headerCopy.title}</Text>
        <Text style={localStyles.subtitle}>{headerCopy.subtitle}</Text>
      </View>
    );
  }, [getHeaderCopy]);

  return (
    <PaywallBase
      visible={visible}
      variant={variant}
      onConvert={onConvert}
      onDismiss={onDismiss}
      renderHeader={renderHeader}
      ctaLabel={(trialDays) =>
        trialDays > 0
          ? t('contextPaywall.quotaCta', { days: trialDays })
          : t('contextPaywall.quotaCtaNoTrial')
      }
      dismissLabel={t('contextPaywall.quotaDismiss')}
    />
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const localStyles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 20,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textWhite,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
});
