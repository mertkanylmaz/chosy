/**
 * PaywallQuotaExhausted — kota bittiginde gosterilen contextual paywall.
 *
 * Trigger: quota_exhausted (search | slot | refine)
 * Context: "Bugunku kesiflerin bitti"
 * A/B test: paywall_quota_v1 (control / value_framing / social_proof)
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colors';
import type { PlanId } from '@/constants/subscriptionPlans';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PaywallVariant } from '@/services/conversion';
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

  // A/B test variant'a gore header copy
  const headerCopy = useMemo(() => {
    switch (variant.abTestGroup) {
      case 'value_framing':
        return {
          title: t('contextPaywall.quotaValueTitle'),
          subtitle: t('contextPaywall.quotaValueSubtitle'),
        };
      case 'social_proof':
        return {
          title: t('contextPaywall.quotaSocialTitle'),
          subtitle: t('contextPaywall.quotaSocialSubtitle'),
        };
      default:
        return {
          title: t('contextPaywall.quotaTitle'),
          subtitle: t('contextPaywall.quotaSubtitle'),
        };
    }
  }, [variant.abTestGroup, t]);

  const renderHeader = useCallback(() => (
    <View style={localStyles.header}>
      <View style={localStyles.iconCircle}>
        <Ionicons name="hourglass-outline" size={28} color={Colors.accentPrimary} />
      </View>
      <Text style={localStyles.title}>{headerCopy.title}</Text>
      <Text style={localStyles.subtitle}>{headerCopy.subtitle}</Text>
    </View>
  ), [headerCopy]);

  return (
    <PaywallBase
      visible={visible}
      variant={variant}
      onConvert={onConvert}
      onDismiss={onDismiss}
      renderHeader={renderHeader}
      ctaLabel={t('contextPaywall.quotaCta')}
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
