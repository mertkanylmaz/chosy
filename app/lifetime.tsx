/**
 * Lifetime Offer — Founding Member ozel satis ekrani.
 *
 * Scarcity-driven: live counter + progress bar + FOMO copy.
 * Entry points:
 *   - Profile > Settings > "Become Founding Member"
 *   - Profile banner (non-lifetime users)
 *   - 14+ day streak paywall variant
 *   - Post-trial conversion offer
 *
 * Sold out durumunda Annual plan'a soft landing.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated as RNAnimated,
  Easing,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { PurchasesPackage } from 'react-native-purchases';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { PLANS } from '@/constants/subscriptionPlans';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import ContextualPaywall from '@/components/paywalls/ContextualPaywall';
import { useContextualPaywall } from '@/components/paywalls/useContextualPaywall';
import {
  getLifetimeOffering,
  purchasePackage,
  restorePurchases,
  type PurchaseErrorKind,
} from '@/services/purchaseService';
import { upsertSubscription } from '@/services/subscriptionService';
import {
  getLifetimeCounter,
  claimLifetimeSpot,
  isFoundingMember,
  type LifetimeCounter,
  type FoundingMemberInfo,
} from '@/services/lifetimeService';
import { getAppUserId } from '@/services/watchlist';
import { clearQuotaCache } from '@/services/quotaEngine';
import { supabase } from '@/services/supabase';
import { hapticSuccess, hapticMedium } from '@/utils/haptics';
import { logger } from '@/utils/logger';

// ─── Yasal Sayfa URL'leri ────────────────────────────────────────────────────

const TERMS_URL =
  'https://www.notion.so/Chosy-ai-Terms-of-Service-34a00bffbfbe80899613c3ce2e5ed01b';
const PRIVACY_URL =
  'https://abalone-dracopelta-382.notion.site/Chosy-ai-Privacy-Policy-34a00bffbfbe80af9f5fd996fa7ab55b';

// ─── Value Props ─────────────────────────────────────────────────────────────

const VALUE_PROPS = [
  { iconName: 'rocket-outline' as const, key: 'lifetime.value1' },
  { iconName: 'search-outline' as const, key: 'lifetime.value2' },
  { iconName: 'infinite-outline' as const, key: 'lifetime.value3' },
  { iconName: 'shield-checkmark-outline' as const, key: 'lifetime.value4' },
  { iconName: 'flash-outline' as const, key: 'lifetime.value5' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function LifetimeOfferScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { tier, refreshSubscription } = useSubscription();
  const { triggerPaywall, paywallProps } = useContextualPaywall();

  const [counter, setCounter] = useState<LifetimeCounter | null>(null);
  const [memberInfo, setMemberInfo] = useState<FoundingMemberInfo | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  /** Dolu ise paketler guvenilir degil — gorunur hata + retry gosterilir */
  const [offeringsError, setOfferingsError] = useState<PurchaseErrorKind | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Animated counter ───────────────────────────────────────────────────
  const animatedSold = useRef(new RNAnimated.Value(0)).current;
  const animatedProgress = useRef(new RNAnimated.Value(0)).current;

  // ── Load data ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [counterData, offerings, userId] = await Promise.all([
          getLifetimeCounter(),
          getLifetimeOffering(),
          getAppUserId(),
        ]);

        setCounter(counterData);
        // errorKind doluysa items render EDILMEZ: lifetime offering
        // bulunamadiginda eskiden "tum paketler" donuyordu ve lifetime
        // OLMAYAN urunler 89.99 iddiasiyla gosterilebiliyordu.
        setPackages(offerings.errorKind ? [] : offerings.items);
        setOfferingsError(offerings.errorKind ?? null);

        // Animate counter
        RNAnimated.timing(animatedSold, {
          toValue: counterData.sold,
          duration: 1500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();

        RNAnimated.timing(animatedProgress, {
          toValue: counterData.percent / 100,
          duration: 1800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();

        // Check if already founding member
        if (userId) {
          const info = await isFoundingMember(userId);
          setMemberInfo(info);
        }
      } catch (err) {
        logger.error('[lifetime] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [animatedSold, animatedProgress, reloadToken]);

  // ── Already lifetime? Show badge ───────────────────────────────────────
  useEffect(() => {
    if (memberInfo?.isMember && !loading) {
      Alert.alert(t('lifetime.alreadyMember'));
    }
  }, [memberInfo, loading, t]);

  // ── Purchase handler ───────────────────────────────────────────────────
  const handlePurchase = useCallback(async () => {
    if (purchasing) return;

    // Sold out check — contextual paywall ile annual one cikar
    if (counter?.soldOut) {
      triggerPaywall({ type: 'lifetime_soldout' });
      return;
    }

    hapticMedium();
    setPurchasing(true);

    try {
      const plan = PLANS.lifetime;
      const pkg = packages.find((p) =>
        p.product.identifier === plan.rcProductId,
      );

      if (!pkg) {
        // Paketler yuklenemediyse "satin alma basarisiz" yaniltici olur.
        Alert.alert(offeringsError ? t('errors.offeringsLoad') : t('paywall.purchaseError'));
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

        // Claim the spot
        const userId = await getAppUserId();
        if (userId) {
          const claimResult = await claimLifetimeSpot(
            userId,
            89.99,
            result.customerInfo?.originalAppUserId,
          );

          if (!claimResult.success && claimResult.error === 'SOLD_OUT') {
            // Fallback: still save as annual
            await upsertSubscription({
              userId,
              plan: 'annual',
              status: 'active',
              rcCustomerId: result.customerInfo?.originalAppUserId ?? null,
            });
          } else {
            await upsertSubscription({
              userId,
              plan: 'lifetime',
              status: 'active',
              rcCustomerId: result.customerInfo?.originalAppUserId ?? null,
              expiresAt: null,
            });
          }
        }

        await refreshSubscription();
        // Client-side quota cache'ini temizle — lifetime tier ile fresh quota
        const uid = await getAppUserId();
        if (uid) await clearQuotaCache(uid);
        Alert.alert(t('lifetime.purchaseSuccess'));
        if (router.canGoBack()) router.back();
      } else if (result.errorKind === 'entitlement_pending') {
        // Odeme gitmis olabilir — "tekrar dene" DEME, cift odeme riski.
        // Servis katmani RC_ENTITLEMENT_PENDING ile Sentry'ye yazdi.
        Alert.alert(t('errors.purchasePendingTitle'), t('errors.purchasePending'));
      } else {
        // K-43: ham RC metni ekrana gitmez; servis katmani Sentry'ye yazdi.
        Alert.alert(t('paywall.purchaseError'));
      }
    } catch (err) {
      logger.error('[lifetime] Purchase error:', err);
      Alert.alert(t('paywall.purchaseError'));
    } finally {
      setPurchasing(false);
    }
  }, [counter, packages, offeringsError, purchasing, t, router, refreshSubscription]);

  // ── Restore handler ──────────────────────────────────────────────────
  const handleRestore = useCallback(async () => {
    if (restoring) return;
    setRestoring(true);

    try {
      const result = await restorePurchases();

      if (result.success) {
        hapticSuccess();

        const userId = await getAppUserId();
        if (userId) {
          const { error: tierErr } = await supabase
            .from('users')
            .update({
              subscription_tier: 'lifetime',
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          if (tierErr) {
            logger.warn('[lifetime] Restore tier update error:', tierErr.message);
          }
        }

        await refreshSubscription();
        const uid = await getAppUserId();
        if (uid) await clearQuotaCache(uid);

        Alert.alert(
          t('lifetime.restoreSuccess'),
          t('lifetime.restoreSuccessDesc'),
          [{ text: 'OK', onPress: () => { if (router.canGoBack()) router.back(); } }],
        );
      } else if (result.errorKind === 'no_data') {
        // Sorgu basarili, gercekten satin alim yok.
        Alert.alert(
          t('lifetime.restoreEmpty'),
          t('lifetime.restoreEmptyDesc'),
        );
      } else {
        // Ag/SDK hatasi — "satin alim bulunamadi" DEME.
        Alert.alert(t('lifetime.restoreError'));
      }
    } catch (err) {
      logger.error('[lifetime] Restore error:', err);
      Alert.alert(t('lifetime.restoreError'));
    } finally {
      setRestoring(false);
    }
  }, [restoring, t, router, refreshSubscription]);

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.gold} size="large" style={styles.loader} />
      </SafeAreaView>
    );
  }

  const isSoldOut = counter?.soldOut ?? false;

  // Animated display value
  const displaySold = animatedSold.interpolate({
    inputRange: [0, counter?.sold ?? 0],
    outputRange: ['0', String(counter?.sold ?? 0)],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Close button ─────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => { if (router.canGoBack()) router.back(); }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={24} color={Colors.textGrey} />
        </TouchableOpacity>

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.diamondContainer}>
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark]}
              style={styles.diamondBg}
            >
              <Ionicons name="diamond" size={40} color={Colors.textWhite} />
            </LinearGradient>
          </View>

          <View style={styles.foundingBadge}>
            <Text style={styles.foundingBadgeText}>FOUNDING MEMBER</Text>
          </View>

          <Text style={styles.heroTitle}>{t('lifetime.heroTitle')}</Text>
          <Text style={styles.heroSubtitle}>{t('lifetime.heroSubtitle')}</Text>
        </View>

        {/* ── Live Counter ─────────────────────────────────────────── */}
        <View style={styles.counterCard}>
          <View style={styles.counterHeader}>
            <RNAnimated.Text style={styles.counterNumber}>
              {displaySold}
            </RNAnimated.Text>
            <Text style={styles.counterTotal}> / 1,000</Text>
          </View>
          <Text style={styles.counterLabel}>
            {isSoldOut
              ? t('lifetime.soldOut')
              : t('lifetime.counterRemaining', { remaining: counter?.remaining ?? 1000 })}
          </Text>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <RNAnimated.View
              style={[
                styles.progressFill,
                {
                  width: animatedProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          {/* Social proof */}
          {(counter?.sold ?? 0) > 0 && (
            <Text style={styles.socialProof}>
              {t('lifetime.socialProof', { count: counter?.sold ?? 0 })}
            </Text>
          )}
        </View>

        {/* ── Value Props ──────────────────────────────────────────── */}
        <View style={styles.valueSection}>
          <Text style={styles.valueSectionTitle}>{t('lifetime.valueTitle')}</Text>
          {VALUE_PROPS.map((prop) => (
            <View key={prop.key} style={styles.valueRow}>
              <View style={styles.valueIcon}>
                <Ionicons name={prop.iconName} size={20} color={Colors.gold} />
              </View>
              <Text style={styles.valueText}>{t(prop.key)}</Text>
            </View>
          ))}
        </View>

        {/* ── Pricing ──────────────────────────────────────────────── */}
        <View style={styles.pricingCard}>
          <Text style={styles.priceLabel}>{t('lifetime.priceLabel')}</Text>
          <Text style={styles.priceAmount}>$89.99</Text>
          <View style={styles.comparisons}>
            <Text style={styles.compareText}>{t('lifetime.compareAnnual')}</Text>
            <Text style={styles.compareText}>{t('lifetime.compareMonthly')}</Text>
          </View>
        </View>

        {/* ── One-time purchase disclaimer (Apple zorunlu) ────────── */}
        <Text style={styles.oneTimeText}>
          {t('lifetime.oneTimeDisclaimer')}
        </Text>

        {/* ── Offering yukleme hatasi ──────────────────────────────── */}
        {offeringsError && (
          <View style={styles.offeringsErrorBox}>
            <Text style={styles.offeringsErrorText}>{t('errors.offeringsLoad')}</Text>
            <TouchableOpacity
              onPress={() => { hapticMedium(); setReloadToken((n) => n + 1); }}
              activeOpacity={0.8}
              style={styles.offeringsRetryBtn}
            >
              <Text style={styles.offeringsRetryText}>{t('errors.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.ctaButton, (purchasing || !!offeringsError) && styles.ctaDisabled]}
          onPress={handlePurchase}
          disabled={purchasing || !!offeringsError}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={isSoldOut ? [Colors.accentPrimary, Colors.accentHover] : [Colors.gold, Colors.goldDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            {purchasing ? (
              <ActivityIndicator color={Colors.textOnAccent} size="small" />
            ) : (
              <>
                <Ionicons
                  name={isSoldOut ? 'arrow-forward' : 'diamond'}
                  size={18}
                  color={Colors.textOnAccent}
                />
                <Text style={styles.ctaText}>
                  {isSoldOut ? t('lifetime.ctaButtonSoldOut') : t('lifetime.ctaButton')}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Restore Purchases (Apple zorunlu) ──────────────────── */}
        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={handleRestore}
          disabled={restoring}
          activeOpacity={0.7}
        >
          <Text style={styles.restoreText}>
            {restoring ? '...' : t('lifetime.restorePurchases')}
          </Text>
        </TouchableOpacity>

        {/* ── Already member badge ─────────────────────────────────── */}
        {memberInfo?.isMember && (
          <View style={styles.memberBadge}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.gold} />
            <Text style={styles.memberBadgeText}>
              {t('lifetime.badgeLabel', { number: memberInfo.saleNumber ?? 0 })}
            </Text>
          </View>
        )}

        {/* ── AI Disclosure (Apple 2025 zorunlu) ─────────────────── */}
        <Text style={styles.aiDisclosureText}>
          {t('lifetime.aiDisclosure')}
        </Text>

        {/* ── Privacy + Terms (Apple zorunlu) ─────────────────────── */}
        <View style={styles.legalLinksRow}>
          <TouchableOpacity
            onPress={() => Linking.openURL(PRIVACY_URL)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Text style={styles.legalLinkText}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.legalSeparator}>{'•'}</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(TERMS_URL)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Text style={styles.legalLinkText}>Terms of Service</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ── Contextual Paywall (lifetime_soldout) ──────────────── */}
      <ContextualPaywall {...paywallProps} />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    paddingBottom: 83,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },

  // ── Close ──────────────────────────────────────────────────────────────
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

  // ── Hero ───────────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
  },
  diamondContainer: {
    marginBottom: 16,
  },
  diamondBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  foundingBadge: {
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: Colors.gold + '50',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 12,
  },
  foundingBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.gold,
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.textWhite,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 15,
    color: Colors.textGrey,
    marginTop: 6,
    textAlign: 'center',
  },

  // ── Counter Card ───────────────────────────────────────────────────────
  counterCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Theme.borderRadius.lg,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.gold + '30',
  },
  counterHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  counterNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.gold,
  },
  counterTotal: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textGrey,
  },
  counterLabel: {
    fontSize: 14,
    color: Colors.textGrey,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.white10,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 4,
  },
  socialProof: {
    fontSize: 13,
    color: Colors.gold,
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '600',
  },

  // ── Value Props ────────────────────────────────────────────────────────
  valueSection: {
    marginBottom: 20,
  },
  valueSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 14,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  valueIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.goldDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textWhite,
    fontWeight: '500',
  },

  // ── Pricing Card ───────────────────────────────────────────────────────
  pricingCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Theme.borderRadius.lg,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gold + '20',
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.gold,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  priceAmount: {
    fontSize: 42,
    fontWeight: '900',
    color: Colors.textWhite,
    letterSpacing: -1,
    marginBottom: 12,
  },
  comparisons: {
    gap: 6,
  },
  compareText: {
    fontSize: 13,
    color: Colors.textGrey,
    textAlign: 'center',
    lineHeight: 18,
  },

  // ── Offering Yukleme Hatasi ───────────────────────────────────────────
  offeringsErrorBox: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  offeringsErrorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  offeringsRetryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  offeringsRetryText: {
    fontSize: 14,
    color: Colors.gold,
    fontWeight: '500',
  },

  // ── CTA ────────────────────────────────────────────────────────────────
  ctaButton: {
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: 16,
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

  // ── Member Badge ───────────────────────────────────────────────────────
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.goldDim,
    borderRadius: Theme.borderRadius.md,
    padding: 12,
    marginBottom: 16,
  },
  memberBadgeText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.gold,
  },

  // ── One-time purchase disclaimer ────────────────────────────────────
  oneTimeText: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 18,
    paddingHorizontal: 16,
  },

  // ── Restore ───────────────────────────────────────────────────────────
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  restoreText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: '500',
  },

  // ── AI Disclosure ─────────────────────────────────────────────────────
  aiDisclosureText: {
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
    lineHeight: 16,
  },

  // ── Legal Links ───────────────────────────────────────────────────────
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
    marginBottom: 32,
  },
  legalLinkText: {
    fontSize: 11,
    color: Colors.textTertiary,
    textDecorationLine: 'underline' as const,
  },
  legalSeparator: {
    fontSize: 11,
    color: Colors.textTertiary,
  },

  bottomSpacer: {
    height: 20,
  },
});
