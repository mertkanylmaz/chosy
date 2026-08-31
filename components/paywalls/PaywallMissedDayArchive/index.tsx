/**
 * PaywallMissedDayArchive — K-46'nın tek paywall tetikleyicisi.
 *
 * Trigger: missed_day_archive (2. kaçırılan gün, `get-archive-status` karar verir)
 * Context: "İki akşamı kaçırdın — arşiv onları geri getirir."
 *
 * ── Neden yalnız iki değer ──────────────────────────────────────────────────
 * K-47: paywall'da 11 benefit değil 2 değer gösterilir — Functional ("Replay
 * missed days") + Identity ("See how your taste evolves"). R-16 bunun kuralını
 * koyuyor: var olmayan özelliği satmak yasak. "Unlimited rerolls" ve "streaming
 * filters" bu ekranda GEÇMEZ; ret merdiveni ücretsizdir (R-02), streaming
 * filtresi ise yoktur (R-03).
 *
 * A/B varyantı YOK: E-10 fiyat testini Faz 1'e kilitledi, v1'de bu paywall'ın
 * copy'si tek. `triggerToExperiment` bu trigger için null döner.
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

// ─── Component ──────────────────────────────────────────────────────────────

export default function PaywallMissedDayArchive({
  visible,
  variant,
  onConvert,
  onDismiss,
}: Props) {
  const { t } = useLanguage();

  // Kaç gün kaçırıldığı sunucudan geldi — istemci saymaz, yalnız gösterir.
  const missedDayCount =
    'missedDayCount' in variant.trigger ? variant.trigger.missedDayCount : 0;

  const renderHeader = useCallback(() => (
    <View style={localStyles.header}>
      <View style={localStyles.iconCircle}>
        <Ionicons name="calendar-outline" size={28} color={Colors.accentPrimary} />
      </View>
      <Text style={localStyles.title}>{t('contextPaywall.missedDayTitle')}</Text>
      <Text style={localStyles.subtitle}>
        {t('contextPaywall.missedDaySubtitle', { count: missedDayCount })}
      </Text>

      {/* K-47: iki değer, fazlası yok. */}
      <View style={localStyles.values}>
        <View style={localStyles.valueRow}>
          <Ionicons name="play-back-outline" size={18} color={Colors.gold} />
          <Text style={localStyles.valueText}>
            {t('contextPaywall.missedDayValueFunctional')}
          </Text>
        </View>
        <View style={localStyles.valueRow}>
          <Ionicons name="sparkles-outline" size={18} color={Colors.gold} />
          <Text style={localStyles.valueText}>
            {t('contextPaywall.missedDayValueIdentity')}
          </Text>
        </View>
      </View>
    </View>
  ), [t, missedDayCount]);

  return (
    <PaywallBase
      visible={visible}
      variant={variant}
      onConvert={onConvert}
      onDismiss={onDismiss}
      renderHeader={renderHeader}
      ctaLabel={t('contextPaywall.missedDayCta')}
      dismissLabel={t('contextPaywall.missedDayDismiss')}
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
  values: {
    marginTop: 16,
    gap: 10,
    alignSelf: 'stretch',
    paddingHorizontal: 12,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  valueText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textWhite,
    lineHeight: 20,
  },
});
