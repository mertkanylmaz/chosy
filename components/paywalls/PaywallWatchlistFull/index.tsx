/**
 * PaywallWatchlistFull — watchlist 30 film limitine ulastiginda gosterilir.
 *
 * Trigger: watchlist_full
 * Context: "Listende harika secimler var. Hepsini sakla?"
 * CTA: "Sinirsiz Watchlist" + "Eski Filmleri Sil"
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

/** Watchlist doldugunda gosterilen paywall */
export default function PaywallWatchlistFull({
  visible,
  variant,
  onConvert,
  onDismiss,
}: Props) {
  const { t } = useLanguage();

  const renderHeader = useCallback(() => (
    <View style={localStyles.header}>
      <View style={localStyles.iconCircle}>
        <Ionicons name="bookmark" size={28} color={Colors.accentPrimary} />
      </View>
      <Text style={localStyles.title}>
        {t('contextPaywall.watchlistTitle')}
      </Text>
      <Text style={localStyles.subtitle}>
        {t('contextPaywall.watchlistSubtitle')}
      </Text>
    </View>
  ), [t]);

  return (
    <PaywallBase
      visible={visible}
      variant={variant}
      onConvert={onConvert}
      onDismiss={onDismiss}
      renderHeader={renderHeader}
      ctaLabel={t('contextPaywall.watchlistCta')}
      dismissLabel={t('contextPaywall.watchlistDismiss')}
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
