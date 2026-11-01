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
import PaywallBase, { type PaywallHeaderContext } from '../PaywallBase';
import { isMoodGauntletEntryTrigger } from '@/utils/moodEntry';
import { ProBenefits, ProHero } from '../ProHero';

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
  // Kaynak 'mood_gauntlet_entry' ise metin Mood Gauntlet'i anlatır; fiyat/plan/deneme aynı.
  const copy = isMoodGauntletEntryTrigger(variant.trigger) ? 'gauntlet' : 'search';
  const renderHeader = useCallback(
    (_pricing: unknown, ctx: PaywallHeaderContext) => <ProHero hideSubhead={ctx.trialShown} copy={copy} />,
    [copy],
  );
  const renderBelowPlans = useCallback(() => <ProBenefits copy={copy} />, [copy]);

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
