/**
 * PaywallOnboarding — onboarding tamamlandiktan sonra gosterilen paywall.
 *
 * Trigger: onboarding_complete
 * Context: "Arketipini kesfettin!" + premium benefits
 */

import React, { useCallback } from 'react';
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

// ─── Benefit Items ──────────────────────────────────────────────────────────

const BENEFITS: { icon: keyof typeof Ionicons.glyphMap; key: string }[] = [
  { icon: 'sparkles-outline', key: 'contextPaywall.onboardingBenefit1' },
  { icon: 'infinite-outline', key: 'contextPaywall.onboardingBenefit2' },
  { icon: 'game-controller-outline', key: 'contextPaywall.onboardingBenefit3' },
];

// ─── Component ──────────────────────────────────────────────────────────────

/** Onboarding sonrasi gosterilen paywall variant */
export default function PaywallOnboarding({
  visible,
  variant,
  onConvert,
  onDismiss,
}: Props) {
  const { t } = useLanguage();

  const renderHeader = useCallback(() => (
    <View style={localStyles.header}>
      <View style={localStyles.iconCircle}>
        <Ionicons name="trophy" size={28} color={Colors.gold} />
      </View>
      <Text style={localStyles.title}>{t('contextPaywall.onboardingTitle')}</Text>
      <Text style={localStyles.subtitle}>{t('contextPaywall.onboardingSubtitle')}</Text>

      <View style={localStyles.benefitList}>
        {BENEFITS.map((b) => (
          <View key={b.key} style={localStyles.benefitRow}>
            <Ionicons name={b.icon} size={18} color={Colors.gold} />
            <Text style={localStyles.benefitText}>{t(b.key)}</Text>
          </View>
        ))}
      </View>
    </View>
  ), [t]);

  return (
    <PaywallBase
      visible={visible}
      variant={variant}
      onConvert={onConvert}
      onDismiss={onDismiss}
      renderHeader={renderHeader}
      ctaLabel={t('contextPaywall.onboardingCta')}
      dismissLabel={t('contextPaywall.onboardingDismiss')}
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
    backgroundColor: Colors.goldDim,
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
    marginBottom: 16,
  },
  benefitList: {
    alignSelf: 'stretch',
    gap: 10,
    paddingHorizontal: 4,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitText: {
    fontSize: 14,
    color: Colors.textWhite,
    fontWeight: '500',
    flex: 1,
  },
});
