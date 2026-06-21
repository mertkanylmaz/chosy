/**
 * PaywallBase — bottom sheet modal with plan selection + purchase flow.
 *
 * Her contextual paywall variant bu base component'i sarar.
 * RevenueCat purchase, restore, trial flow'lari buradan yonetilir.
 *
 * Layout:
 *   - Drag handle to dismiss
 *   - Custom header (variant-specific)
 *   - 3 plan card (Monthly, Annual, Lifetime)
 *   - Trial info
 *   - CTA button
 *   - Restore + ToS + Privacy
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colors';
import { PLANS, type PlanId, RC_ENTITLEMENT_ID, productIdToTier } from '@/constants/subscriptionPlans';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '@/services/purchaseService';
import { upsertSubscription } from '@/services/subscriptionService';
import { clearQuotaCache } from '@/services/quotaEngine';
import { getAppUserId } from '@/services/watchlist';
import { supabase } from '@/services/supabase';
import {
  recordPaywallShown,
  recordPaywallDismissed,
  recordPaywallConverted,
} from '@/services/conversion';
import type { PaywallVariant } from '@/services/conversion';
import { hapticSuccess, hapticMedium } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { styles } from './styles';

// ─── Legal URLs ──────────────────────────────────────────────────────────────

const TERMS_URL =
  'https://www.notion.so/Chosy-ai-Terms-of-Service-34a00bffbfbe80899613c3ce2e5ed01b';
const PRIVACY_URL =
  'https://abalone-dracopelta-382.notion.site/Chosy-ai-Privacy-Policy-34a00bffbfbe80af9f5fd996fa7ab55b';

// ─── Props ──────────────────────────────────────────────────────────────────

interface PaywallBaseProps {
  /** Gosterilecek mi? */
  visible: boolean;
  /** Variant bilgisi (tracking icin) */
  variant: PaywallVariant;
  /** Basarili satin alma callback */
  onConvert: (plan: PlanId) => void;
  /** Kapatma / dismiss callback */
  onDismiss: () => void;
  /** Custom header render (variant-specific) */
  renderHeader: () => React.ReactNode;
  /** CTA butonu metni (variant-aware) */
  ctaLabel?: string;
  /** Dismiss butonu metni */
  dismissLabel?: string;
}

// ─── Plan UI Definitions ────────────────────────────────────────────────────

interface PlanOption {
  id: PlanId;
  badgeKey: string | null;
  savingKey: string | null;
}

const PLAN_OPTIONS: PlanOption[] = [
  { id: 'monthly', badgeKey: null, savingKey: null },
  { id: 'annual', badgeKey: 'contextPaywall.mostPopular', savingKey: 'contextPaywall.annualSaving' },
  { id: 'lifetime', badgeKey: 'contextPaywall.bestValue', savingKey: null },
];

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Contextual paywall base — bottom sheet modal.
 * Annual plan default selected.
 */
export default function PaywallBase({
  visible,
  variant,
  onConvert,
  onDismiss,
  renderHeader,
  ctaLabel,
  dismissLabel,
}: PaywallBaseProps) {
  const { t } = useLanguage();
  const { refreshSubscription, refreshQuota } = useSubscription();

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Paketleri yukle
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    async function load() {
      try {
        const pkgs = await getOfferings();
        if (!cancelled) setPackages(pkgs);
      } catch (err) {
        logger.error('[paywall-base] Paket yukleme hatasi:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();

    return () => { cancelled = true; };
  }, [visible]);

  // Shown event kaydet
  useEffect(() => {
    if (visible) {
      recordPaywallShown(variant).catch(() => {});
    }
  }, [visible, variant]);

  /** Satin alma */
  const handlePurchase = useCallback(async () => {
    if (purchasing) return;
    hapticMedium();
    setPurchasing(true);

    try {
      const plan = PLANS[selectedPlan];
      const pkg = packages.find((p) => p.product.identifier === plan.rcProductId);

      if (!pkg) {
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

        const userId = await getAppUserId();
        if (userId) {
          await upsertSubscription({
            userId,
            plan: selectedPlan,
            status: 'active',
            rcCustomerId: result.customerInfo?.originalAppUserId ?? null,
          });

          // KRITIK: users.subscription_tier'i hemen guncelle.
          // Quota RPC'leri (check_and_consume_quota) bu kolonu okur.
          // Webhook async gelebilir — kullanici arada "limit reached" gorebilir.
          const tier = selectedPlan === 'annual' ? 'annual'
            : selectedPlan === 'lifetime' ? 'lifetime'
            : 'monthly';
          const { error: tierErr } = await supabase
            .from('users')
            .update({
              subscription_tier: tier,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          if (tierErr) {
            logger.warn('[paywall-base] users.subscription_tier guncelleme hatasi:', tierErr.message);
          }

          // Client-side quota cache'ini temizle — yeni tier ile fresh quota
          await clearQuotaCache(userId);
        }

        await recordPaywallConverted(variant);
        await refreshSubscription();
        await refreshQuota();
        onConvert(selectedPlan);
      } else {
        Alert.alert(t('paywall.purchaseError'), result.error ?? '');
      }
    } catch (err) {
      logger.error('[paywall-base] Satin alma hatasi:', err);
      Alert.alert(t('paywall.purchaseError'));
    } finally {
      setPurchasing(false);
    }
  }, [selectedPlan, packages, purchasing, t, refreshSubscription, refreshQuota, onConvert, variant]);

  /** Restore */
  const handleRestore = useCallback(async () => {
    try {
      const result = await restorePurchases();
      if (result.success) {
        hapticSuccess();

        // Restore sonrasi users.subscription_tier'i hemen guncelle
        const userId = await getAppUserId();
        if (userId && result.customerInfo) {
          const entitlement = result.customerInfo.entitlements.active[RC_ENTITLEMENT_ID];
          if (entitlement) {
            const tier = productIdToTier(entitlement.productIdentifier);
            if (tier !== 'free') {
              const { error: tierErr } = await supabase
                .from('users')
                .update({
                  subscription_tier: tier,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', userId);

              if (tierErr) {
                logger.warn('[paywall-base] Restore tier guncelleme hatasi:', tierErr.message);
              }

              await upsertSubscription({
                userId,
                plan: tier === 'weekly_legacy' ? 'weekly' as PlanId : tier as PlanId,
                status: 'active',
                rcCustomerId: result.customerInfo.originalAppUserId ?? null,
              });
            }
          }

          // Client-side quota cache temizle
          await clearQuotaCache(userId);
        }

        await refreshSubscription();
        await refreshQuota();
        Alert.alert(t('paywall.restoreSuccess'));
        onDismiss();
      } else {
        Alert.alert(t('paywall.restoreEmpty'));
      }
    } catch (err) {
      logger.error('[paywall-base] Restore hatasi:', err);
    }
  }, [t, refreshSubscription, refreshQuota, onDismiss]);

  /** Dismiss + tracking */
  const handleDismiss = useCallback(() => {
    recordPaywallDismissed(variant).catch(() => {});
    onDismiss();
  }, [variant, onDismiss]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Drag Handle */}
          <TouchableOpacity
            style={styles.dragHandleArea}
            onPress={handleDismiss}
            activeOpacity={1}
          >
            <View style={styles.dragHandle} />
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Custom Header (variant-specific) */}
            {renderHeader()}

            {/* Loading */}
            {loading ? (
              <ActivityIndicator
                color={Colors.accentPrimary}
                size="large"
                style={{ marginVertical: 40 }}
              />
            ) : (
              <>
                {/* Plan Cards */}
                <View style={styles.planContainer}>
                  {PLAN_OPTIONS.map((option) => {
                    const plan = PLANS[option.id];
                    const isSelected = selectedPlan === option.id;

                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={[styles.planCard, isSelected && styles.planCardSelected]}
                        onPress={() => { hapticMedium(); setSelectedPlan(option.id); }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.planInfo}>
                          <View style={styles.planTitleRow}>
                            <Text style={[styles.planTitle, isSelected && styles.planTitleSelected]}>
                              {t(`paywall.${option.id}Title`)}
                            </Text>
                            {option.badgeKey && (
                              <View style={styles.planBadge}>
                                <Text style={styles.planBadgeText}>{t(option.badgeKey)}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.planPrice}>
                            {plan.displayPrice} {t(`paywall.${option.id === 'lifetime' ? 'oneTime' : option.id === 'annual' ? 'perYear' : 'perMonth'}`)}
                          </Text>
                          {option.id === 'annual' && (
                            <Text style={styles.planSaving}>
                              {t('contextPaywall.annualSaving')}
                            </Text>
                          )}
                        </View>

                        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Trial Info */}
                <Text style={styles.trialInfo}>
                  {t('contextPaywall.trialInfo')}
                </Text>

                {/* CTA */}
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
                          {ctaLabel ?? t('contextPaywall.ctaDefault')}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Dismiss */}
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={handleDismiss}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dismissText}>
                    {dismissLabel ?? t('contextPaywall.dismissDefault')}
                  </Text>
                </TouchableOpacity>

                {/* Restore */}
                <TouchableOpacity
                  style={styles.restoreButton}
                  onPress={handleRestore}
                  activeOpacity={0.7}
                >
                  <Text style={styles.restoreText}>
                    {t('paywall.restorePurchases')}
                  </Text>
                </TouchableOpacity>

                {/* Auto-renew disclosure (Apple 3.1.2c) */}
                <Text style={styles.autoRenew}>
                  {t('paywall.autoRenewDisclosure')}
                </Text>

                {/* Legal links */}
                <View style={styles.legalRow}>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(TERMS_URL)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.legalLink}>{t('paywall.termsAction')}</Text>
                  </TouchableOpacity>
                  <Text style={styles.legalSeparator}>·</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(PRIVACY_URL)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.legalLink}>{t('paywall.privacyAction')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
