/**
 * PaywallProfileUpgrade — Pro Mode kapısının paywall'ı.
 *
 * Trigger: profile_upgrade
 * 2.1.0'da paywall'ın TEK kullanıcı girişi (E-29): Pro Mode kilitli ekranındaki
 * "Chosy Pro" CTA'sı ve Profil'deki Chosy Pro satırı. İçerik Mood Search
 * anlatımıdır (`ProHero`); yalnız doğrulanmış vaatler (R-5).
 */

import React, { useCallback } from 'react';

import type { PlanId } from '@/constants/subscriptionPlans';
import type { PaywallVariant } from '@/services/conversion';
import PaywallBase from '../PaywallBase';
import { ProHero } from '../ProHero';

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  variant: PaywallVariant;
  onConvert: (plan: PlanId) => void;
  onDismiss: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

/** Profile / Pro Mode kapısından upgrade tıklayınca gösterilen paywall */
export default function PaywallProfileUpgrade({
  visible,
  variant,
  onConvert,
  onDismiss,
}: Props) {
  const renderHeader = useCallback(() => <ProHero />, []);

  return (
    <PaywallBase
      visible={visible}
      variant={variant}
      onConvert={onConvert}
      onDismiss={onDismiss}
      renderHeader={renderHeader}
    />
  );
}
