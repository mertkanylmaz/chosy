/**
 * Paywall — abonelik planlarını gösteren modal ekran.
 *
 * Session 3'te tam UI implementasyonu yapılacak.
 * Şimdilik iskelet: 3 plan kartı + purchase flow + restore.
 *
 * Açılış noktaları:
 *   - QuotaExhausted overlay → "Upgrade" butonu
 *   - Profile ekranı → "Upgrade to Premium" satırı
 *   - B+C hibrit: ilk free arama sonrası → soft paywall
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PurchasesPackage } from 'react-native-purchases';
import Purchases from 'react-native-purchases';

import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { PLANS, type PlanId } from '@/constants/subscriptionPlans';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '@/services/purchaseService';
import { upsertSubscription } from '@/services/subscriptionService';
import { claimFreeTrial, hasUsedFreeTrial } from '@/services/quotaEngine';
import { getAppUserId } from '@/services/watchlist';
import { supabase } from '@/services/supabase';
import { hapticSuccess, hapticMedium } from '@/utils/haptics';
import { logger } from '@/utils/logger';

// ─── Yasal Sayfa URL'leri ────────────────────────────────────────────────────

const TERMS_URL =
  'https://www.notion.so/Chosy-ai-Terms-of-Service-34a00bffbfbe80899613c3ce2e5ed01b';
const PRIVACY_URL =
  'https://abalone-dracopelta-382.notion.site/Chosy-ai-Privacy-Policy-34a00bffbfbe80af9f5fd996fa7ab55b';

// ─── Plan UI Tanımları ───────────────────────────────────────────────────────

interface PlanUI {
  planId: PlanId;
  titleKey: string;
  badgeKey: string;
  descKey: string;
  durationKey: string;
  periodKey: string;
  featured: boolean;
}

const PLAN_UI: PlanUI[] = [
  {
    planId: 'weekly',
    titleKey: 'paywall.weeklyTitle',
    badgeKey: 'paywall.weeklyBadge',
    descKey: 'paywall.weeklyDesc',
    durationKey: 'paywall.weeklyDuration',
    periodKey: 'paywall.perWeek',
    featured: false,
  },
  {
    planId: 'monthly',
    titleKey: 'paywall.monthlyTitle',
    badgeKey: 'paywall.monthlyBadge',
    descKey: 'paywall.monthlyDesc',
    durationKey: 'paywall.monthlyDuration',
    periodKey: 'paywall.perMonth',
    featured: true,
  },
  {
    planId: 'yearly',
    titleKey: 'paywall.yearlyTitle',
    badgeKey: 'paywall.yearlyBadge',
    descKey: 'paywall.yearlyDesc',
    durationKey: 'paywall.yearlyDuration',
    periodKey: 'paywall.perYear',
    featured: false,
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function PaywallScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isPremium, refreshSubscription } = useSubscription();

  /**
   * Onboarding akisi: discover.tsx'ten gelen param.
   * true ise "Belki Sonra" butonu gosterilir, kapat/satin al → /(tabs) replace yapar.
   */
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const isOnboarding = onboarding === '1';

  /** Onboarding modunda navigation hedef: stack'i temizle, tabs'a git */
  const navigateAfterPaywall = useCallback(() => {
    router.replace('/(tabs)' as never);
  }, [router]);

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('monthly');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [trialUsed, setTrialUsed] = useState(false);
  const [loading, setLoading] = useState(true);


  // ── Paketleri yükle ──────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const pkgs = await getOfferings();
        setPackages(pkgs);

        // Trial kontrolü
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const used = await hasUsedFreeTrial(user.email);
          setTrialUsed(used);
        }
      } catch (err) {
        logger.error('[paywall] Yükleme hatası:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /**
   * Apple Offer Code redemption sheet'ini açar.
   * iOS 14+ — Apple'ın native kod girişi ekranını gösterir.
   * Kod doğrulama, indirim uygulama, kullanım limiti: Apple yönetir.
   */
  const handleRedeemCode = useCallback(async () => {
    if (Platform.OS !== 'ios') return;
    try {
      await Purchases.presentCodeRedemptionSheet();
    } catch (err) {
      logger.warn('[paywall] Code redemption sheet hatası:', err);
    }
  }, []);

  // Premium ise bilgilendir ve cik
  useEffect(() => {
    if (isPremium && !loading) {
      if (isOnboarding) {
        // Onboarding modunda alert gostermeden dogrudan tabs'a git
        navigateAfterPaywall();
      } else {
        Alert.alert(t('paywall.alreadyPremium'));
        if (router.canGoBack()) router.back();
      }
    }
  }, [isPremium, loading, t, router, isOnboarding, navigateAfterPaywall]);

  /**
   * Seçili planı RevenueCat'ten satın alır.
   */
  const handlePurchase = useCallback(async () => {
    if (purchasing) return;
    hapticMedium();
    setPurchasing(true);

    try {
      const plan = PLANS[selectedPlan];
      const pkg = packages.find((p) =>
        p.product.identifier === plan.rcProductId,
      );

      if (!pkg) {
        // RevenueCat paket bulunamazsa fallback: displayPrice göster
        Alert.alert(t('errors.generic'), t('paywall.purchaseError'));
        setPurchasing(false);
        return;
      }

      const result = await purchasePackage(pkg);

      if (result.cancelled) {
        setPurchasing(false);
        return;
      }

      if (result.success) {
        hapticSuccess();

        // Supabase'e kaydet
        const userId = await getAppUserId();
        if (userId) {
          const isTrialPlan = selectedPlan === 'weekly' && !trialUsed;
          await upsertSubscription({
            userId,
            plan: selectedPlan,
            status: isTrialPlan ? 'trial' : 'active',
            trialUsed: isTrialPlan ? true : undefined,
            rcCustomerId: result.customerInfo?.originalAppUserId ?? null,
          });

          // Trial claim kaydet
          if (isTrialPlan) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
              await claimFreeTrial(user.email);
            }
          }
        }

        await refreshSubscription();
        Alert.alert(t('paywall.purchaseSuccess'));
        // Onboarding modunda: stack'i temizle, tabs'a git
        if (isOnboarding) {
          navigateAfterPaywall();
        } else if (router.canGoBack()) {
          router.back();
        }
      } else {
        Alert.alert(t('paywall.purchaseError'), result.error ?? '');
      }
    } catch (err) {
      logger.error('[paywall] Satın alma hatası:', err);
      Alert.alert(t('paywall.purchaseError'));
    } finally {
      setPurchasing(false);
    }
  }, [selectedPlan, packages, purchasing, trialUsed, t, router, refreshSubscription, isOnboarding, navigateAfterPaywall]);

  /**
   * Önceki satın alımları geri yükler.
   */
  const handleRestore = useCallback(async () => {
    if (restoring) return;
    setRestoring(true);

    try {
      const result = await restorePurchases();

      if (result.success) {
        hapticSuccess();
        await refreshSubscription();
        Alert.alert(t('paywall.restoreSuccess'));
        if (isOnboarding) {
          navigateAfterPaywall();
        } else if (router.canGoBack()) {
          router.back();
        }
      } else {
        Alert.alert(t('paywall.restoreEmpty'));
      }
    } catch (err) {
      logger.error('[paywall] Restore hatası:', err);
    } finally {
      setRestoring(false);
    }
  }, [restoring, t, router, refreshSubscription, isOnboarding, navigateAfterPaywall]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.accentPrimary} size="large" style={styles.loader} />
      </SafeAreaView>
    );
  }

  const showTrial = selectedPlan === 'weekly' && !trialUsed;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Kapat butonu — onboarding modunda tabs'a cikar ──────── */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => {
            if (isOnboarding) navigateAfterPaywall();
            else if (router.canGoBack()) router.back();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={24} color={Colors.textGrey} />
        </TouchableOpacity>

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <Ionicons name="diamond" size={48} color={Colors.accentPrimary} />
          <View style={styles.serviceNameBadge}>
            <Text style={styles.serviceNameText}>{t('paywall.serviceName')}</Text>
          </View>
          <Text style={styles.heroTitle}>{t('paywall.title')}</Text>
          <Text style={styles.heroSubtitle}>
            {isOnboarding ? t('paywall.onboardingSubtitle') : t('paywall.subtitle')}
          </Text>
        </View>

        {/* ── Plan Kartları ────────────────────────────────────────── */}
        <View style={styles.planContainer}>
          {PLAN_UI.map((planUI) => {
            const plan = PLANS[planUI.planId];
            const isSelected = selectedPlan === planUI.planId;

            return (
              <TouchableOpacity
                key={planUI.planId}
                style={[
                  styles.planCard,
                  isSelected && styles.planCardSelected,
                  planUI.featured && styles.planCardFeatured,
                ]}
                onPress={() => { hapticMedium(); setSelectedPlan(planUI.planId); }}
                activeOpacity={0.8}
              >
                {/* Badge */}
                <View style={[styles.badge, isSelected && styles.badgeSelected]}>
                  <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
                    {t(planUI.badgeKey)}
                  </Text>
                </View>

                {/* Plan bilgisi */}
                <Text style={[styles.planTitle, isSelected && styles.planTitleSelected]}>
                  {t(planUI.titleKey)}
                </Text>
                <Text style={[styles.planDuration, isSelected && styles.planDurationSelected]}>
                  {t(planUI.durationKey)}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
                    {plan.displayPrice}
                  </Text>
                  <Text style={[styles.planPeriod, isSelected && styles.planPeriodSelected]}>
                    {t(planUI.periodKey)}
                  </Text>
                </View>
                <Text style={styles.planDesc}>{t(planUI.descKey)}</Text>

                {/* Seçim indikatörü */}
                <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Trial notu ──────────────────────────────────────────── */}
        {showTrial && (
          <Text style={styles.trialNote}>{t('paywall.trialNote')}</Text>
        )}

        {/* ── Promo / Offer Code — Apple native ────────────────── */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.promoToggle}
            onPress={handleRedeemCode}
            activeOpacity={0.7}
          >
            <Ionicons name="pricetag-outline" size={14} color={Colors.textTertiary} />
            <Text style={styles.promoToggleText}>{t('paywall.redeemCode')}</Text>
          </TouchableOpacity>
        )}

        {/* ── CTA ─────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.ctaButton, purchasing && styles.ctaDisabled]}
          onPress={handlePurchase}
          disabled={purchasing}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[Colors.accentPrimary, Colors.accentHover]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            {purchasing ? (
              <ActivityIndicator color={Colors.textOnAccent} size="small" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color={Colors.textOnAccent} />
                <Text style={styles.ctaText}>
                  {showTrial ? t('paywall.startTrial') : t('paywall.subscribe')}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Restore ─────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={handleRestore}
          disabled={restoring}
          activeOpacity={0.7}
        >
          <Text style={styles.restoreText}>
            {restoring ? '...' : t('paywall.restorePurchases')}
          </Text>
        </TouchableOpacity>

        {/* ── Belki Sonra — sadece onboarding modunda gosterilir ─── */}
        {isOnboarding && (
          <TouchableOpacity
            style={styles.maybeLaterBtn}
            onPress={navigateAfterPaywall}
            activeOpacity={0.7}
          >
            <Text style={styles.maybeLaterText}>{t('paywall.skipForNow')}</Text>
          </TouchableOpacity>
        )}

        {/* ── Otomatik yenileme aciklamasi (Apple 3.1.2c zorunlu) ─── */}
        <Text style={styles.autoRenewText}>{t('paywall.autoRenewDisclosure')}</Text>

        {/* ── Yasal linkler — ayri TouchableOpacity (Apple gerekliligi) */}
        <View style={styles.legalLinksRow}>
          <TouchableOpacity
            onPress={() => Linking.openURL(TERMS_URL)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Text style={styles.legalLinkBtn}>{t('paywall.termsAction')}</Text>
          </TouchableOpacity>
          <Text style={styles.legalSeparator}>·</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(PRIVACY_URL)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Text style={styles.legalLinkBtn}>{t('paywall.privacyAction')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },

  // ── Kapat ───────────────────────────────────────────────────────────────
  closeBtn: {
    alignSelf: 'flex-end',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },

  // ── Hero ────────────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 28,
  },
  serviceNameBadge: {
    marginTop: 10,
    backgroundColor: Colors.accentPrimary + '20',
    borderWidth: 1,
    borderColor: Colors.accentPrimary + '50',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  serviceNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accentPrimary,
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textWhite,
    marginTop: 10,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },

  // ── Plan Kartları ───────────────────────────────────────────────────────
  planContainer: {
    gap: 12,
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Theme.borderRadius.lg,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: Colors.accentPrimary,
    backgroundColor: Colors.accentPrimary + '10',
  },
  planCardFeatured: {
    // Featured vurgusu (monthly)
  },

  // Badge
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.white10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 8,
  },
  badgeSelected: {
    backgroundColor: Colors.accentPrimary + '30',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },
  badgeTextSelected: {
    color: Colors.accentPrimary,
  },

  // Plan info
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 2,
  },
  planTitleSelected: {
    color: Colors.accentPrimary,
  },
  planDuration: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textTertiary,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  planDurationSelected: {
    color: Colors.accentPrimary + '80',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  planPriceSelected: {
    color: Colors.accentPrimary,
  },
  planPeriod: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  planPeriodSelected: {
    color: Colors.accentPrimary + '90',
  },
  planDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Radio
  radioOuter: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.white10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.accentPrimary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accentPrimary,
  },

  // ── Promo / Offer Code ──────────────────────────────────────────────────
  promoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 8,
  },
  promoToggleText: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '500',
  },

  // ── Trial ───────────────────────────────────────────────────────────────
  trialNote: {
    fontSize: 13,
    color: Colors.accentPrimary,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },

  // ── CTA ─────────────────────────────────────────────────────────────────
  ctaButton: {
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: 12,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textOnAccent,
    letterSpacing: 0.3,
  },

  // ── Restore ─────────────────────────────────────────────────────────────
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  restoreText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: '500',
  },

  // ── Maybe Later (onboarding) ────────────────────────────────────────────
  maybeLaterBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  maybeLaterText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // ── Auto-renewal Disclosure (Apple 3.1.2c) ──────────────────────────────
  autoRenewText: {
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
  },

  // ── Legal Links ─────────────────────────────────────────────────────────
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  legalLinkBtn: {
    fontSize: 12,
    color: Colors.accentPrimary,
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  legalSeparator: {
    fontSize: 12,
    color: Colors.textTertiary,
  },

});
