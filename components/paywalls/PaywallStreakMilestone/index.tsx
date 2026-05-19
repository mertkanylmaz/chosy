/**
 * PaywallStreakMilestone — streak milestone'larinda gosterilen contextual paywall.
 *
 * Trigger: streak_milestone (3, 7, 14, 30 gun) | game_perfect_streak
 * Context: "X gunluk streak! Plus ile devam et"
 * A/B test: paywall_streak_v1 (control / lifetime_offer)
 * Special: 14+ gun streak'te Lifetime offer on plana cikar
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

/** Streak milestone'larinda gosterilen paywall */
export default function PaywallStreakMilestone({
  visible,
  variant,
  onConvert,
  onDismiss,
}: Props) {
  const { t } = useLanguage();

  const streakDays = useMemo(() => {
    if ('days' in variant.trigger) return variant.trigger.days;
    if ('count' in variant.trigger) return variant.trigger.count;
    return 0;
  }, [variant.trigger]);

  const isLifetimeOffer = variant.abTestGroup === 'lifetime_offer' && streakDays >= 14;

  const renderHeader = useCallback(() => (
    <View style={localStyles.header}>
      <View style={localStyles.iconCircle}>
        <Ionicons name="flame" size={28} color={Colors.gold} />
      </View>
      <Text style={localStyles.title}>
        {t('contextPaywall.streakTitle', { days: streakDays })}
      </Text>
      <Text style={localStyles.subtitle}>
        {isLifetimeOffer
          ? t('contextPaywall.streakLifetimeSubtitle')
          : t('contextPaywall.streakSubtitle')
        }
      </Text>
    </View>
  ), [streakDays, isLifetimeOffer, t]);

  return (
    <PaywallBase
      visible={visible}
      variant={variant}
      onConvert={onConvert}
      onDismiss={onDismiss}
      renderHeader={renderHeader}
      ctaLabel={
        isLifetimeOffer
          ? t('contextPaywall.streakLifetimeCta')
          : t('contextPaywall.streakCta')
      }
      dismissLabel={t('contextPaywall.streakDismiss')}
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
  },
});
