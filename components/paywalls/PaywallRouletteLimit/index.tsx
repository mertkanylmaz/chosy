/**
 * PaywallRouletteLimit — roulette premium/kota limiti paywall.
 *
 * Trigger: roulette_limit
 * Context: Premium ozelliklere erisim veya slot kotasi bitti
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
  { icon: 'shuffle-outline', key: 'contextPaywall.rouletteBenefit1' },
  { icon: 'color-wand-outline', key: 'contextPaywall.rouletteBenefit2' },
  { icon: 'layers-outline', key: 'contextPaywall.rouletteBenefit3' },
];

// ─── Component ──────────────────────────────────────────────────────────────

/** Roulette limit'inde gosterilen paywall */
export default function PaywallRouletteLimit({
  visible,
  variant,
  onConvert,
  onDismiss,
}: Props) {
  const { t } = useLanguage();

  const renderHeader = useCallback(() => (
    <View style={localStyles.header}>
      <View style={localStyles.iconCircle}>
        <Ionicons name="dice-outline" size={28} color={Colors.accentPrimary} />
      </View>
      <Text style={localStyles.title}>{t('contextPaywall.rouletteTitle')}</Text>
      <Text style={localStyles.subtitle}>{t('contextPaywall.rouletteSubtitle')}</Text>

      <View style={localStyles.benefitList}>
        {BENEFITS.map((b) => (
          <View key={b.key} style={localStyles.benefitRow}>
            <Ionicons name={b.icon} size={18} color={Colors.accentPrimary} />
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
      ctaLabel={t('contextPaywall.rouletteCta')}
      dismissLabel={t('contextPaywall.rouletteDismiss')}
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
