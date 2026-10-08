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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

import * as Sentry from '@sentry/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkle } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { PLANS, type PlanId, RC_ENTITLEMENT_ID, productIdToTier } from '@/constants/subscriptionPlans';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import {
  getOfferings,
  getTrialEligibility,
  purchasePackage,
  restorePurchases,
} from '@/services/purchaseService';
import { upsertSubscription } from '@/services/subscriptionService';
import { clearQuotaCache } from '@/services/quotaEngine';
import { remoteConfig } from '@/services/remoteConfig';
import { getAppUserId } from '@/services/watchlist';
import type { PurchaseErrorKind } from '@/services/purchaseService';
import { supabase } from '@/services/supabase';
import {
  recordPaywallShown,
  recordPaywallDismissed,
  type PaywallDismissMethod,
  recordPaywallConverted,
} from '@/services/conversion';
import type { PaywallVariant } from '@/services/conversion';
import { hapticSuccess, hapticMedium } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import {
  buildAnnualPricing,
  trialDaysFor,
  type AnnualPricing,
  type TrialEligibility,
} from '@/utils/paywallPricing';
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
  /**
   * Custom header render (variant-specific).
   * `pricing`: yillik planin aylik esdegeri + tasarruf yuzdesi (RC urunlerinden);
   * paketler yuklenmediyse veya tasarruf yoksa null — header fiyatli kopyadan vazgecer.
   */
  renderHeader: (pricing: AnnualPricing | null) => React.ReactNode;
  /**
   * CTA butonu metni (variant-aware).
   * Metin secili planin trial suresine bagliysa fonksiyon gecilir —
   * plan secimi bu component'te yasadigi icin variant disaridan bilemez (K-59).
   * Trial yoksa (uygun degil / okunamadi) ve plan lifetime degilse fonksiyon
   * CAGRILMAZ; "Get Chosy Plus" gosterilir.
   */
  ctaLabel?: string | ((trialDays: number) => string);
  /** Dismiss butonu metni */
  dismissLabel?: string;
}

// ─── Plan UI Definitions ────────────────────────────────────────────────────

interface PlanOption {
  id: PlanId;
  badgeKey: string | null;
}

/** Rozet yalniz annual'da: "BEST VALUE" aylik/yillik fiyat farkindan dogrulanabilir. */
const PLAN_OPTIONS: PlanOption[] = [
  { id: 'monthly', badgeKey: null },
  { id: 'annual', badgeKey: 'contextPaywall.bestValue' },
  { id: 'lifetime', badgeKey: null },
];

/** Fiyat birimi i18n anahtari (`paywall.<unit>`). */
function unitKeyFor(id: PlanId): 'oneTime' | 'perYear' | 'perMonth' {
  return id === 'lifetime' ? 'oneTime' : id === 'annual' ? 'perYear' : 'perMonth';
}

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
  const { t, language } = useLanguage();
  const { refreshSubscription, refreshQuota } = useSubscription();

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  /** productId → trial uygunlugu. Bos/eksik = 'unknown' (trial vaat edilmez). */
  const [eligibility, setEligibility] = useState<Record<string, TrialEligibility>>({});
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [loading, setLoading] = useState(true);
  /** Dolu ise paketler guvenilir degil — plan kartlari yerine hata gosterilir */
  const [offeringsError, setOfferingsError] = useState<PurchaseErrorKind | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * D-08: v1'de yeni lifetime SATILMAZ (§7.3 "Lifetime satışı" donmuş).
   * Kart tasarımı ve satın alma yolu silinmedi, `paywall_lifetime_enabled`
   * flag'inin arkasına alındı — geri açmak tek satırlık `app_config`
   * güncellemesi (R-E'de değerlendirilecek).
   *
   * Flag her render'da lazy okunur (kural 5/6): modül seviyesinde sabit yok.
   * Okuma başarısızsa `remoteConfig` SAFE_DEFAULTS'a düşer → false → kart
   * gizli kalır (fail-closed, D-08 yönünde).
   */
  // SAFE_DEFAULTS literal `false` tipi verdigi icin dogrudan karsilastirma
  // TS2367 uretir — triggerOrchestrator'daki ayni cast deseni kullaniliyor.
  const lifetimeEnabled =
    (remoteConfig as { get(k: string): unknown }).get('paywall_lifetime_enabled') === true;
  /** Plan -> RC urunu. Fiyat/trial yalniz buradan okunur; sabit fiyat yok. */
  const productFor = useCallback(
    (id: PlanId) =>
      packages.find((p) => p.product.identifier === PLANS[id].rcProductId)?.product,
    [packages],
  );

  // RC'de urunu olmayan plan satin alinamaz — karti gosterme.
  const planOptions = useMemo(
    () =>
      (lifetimeEnabled ? PLAN_OPTIONS : PLAN_OPTIONS.filter((o) => o.id !== 'lifetime'))
        .filter((o) => productFor(o.id) !== undefined),
    [lifetimeEnabled, productFor],
  );

  // Secili plan listede degilse (paket eksik) ilk mevcut plana gec.
  useEffect(() => {
    if (planOptions.length > 0 && !planOptions.some((o) => o.id === selectedPlan)) {
      setSelectedPlan(planOptions[0].id);
    }
  }, [planOptions, selectedPlan]);

  /** Yillik aylik esdeger + tasarruf: product.price ve currencyCode'dan hesaplanir. */
  const pricing = useMemo<AnnualPricing | null>(() => {
    const monthly = productFor('monthly');
    const annual = productFor('annual');
    if (!monthly || !annual) return null;
    try {
      return buildAnnualPricing(monthly, annual, language);
    } catch (err) {
      // Gecersiz currencyCode vb. — tasarruf satiri gizlenir, sessiz degil.
      Sentry.captureException(err, {
        level: 'warning',
        tags: { error_code: 'PAYWALL_PRICING_FORMAT_FAILED' },
        extra: { monthlyCurrency: monthly.currencyCode, annualCurrency: annual.currencyCode },
      });
      return null;
    }
  }, [productFor, language]);

  // Paketleri yukle
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      // getOfferings artik throw etmiyor; hata errorKind ile geliyor.
      // Servis katmani Sentry'ye zaten yazdi, burada tekrar loglamiyoruz.
      const res = await getOfferings();
      if (cancelled) return;

      // Uygunluk sorgusu da kendi hatasini Sentry'ye yazar ve asla firlatmaz;
      // okunamazsa 'unknown' doner → trial gosterilmez.
      const productIds = res.items
        .map((p) => p.product.identifier)
        .filter((id) => PLAN_OPTIONS.some((o) => PLANS[o.id].rcProductId === id));
      const elig = res.errorKind || productIds.length === 0
        ? {}
        : await getTrialEligibility(productIds);
      if (cancelled) return;

      setPackages(res.items);
      setEligibility(elig);
      setOfferingsError(res.errorKind ?? null);
      setLoading(false);
    }
    load();

    return () => { cancelled = true; };
  }, [visible, reloadToken]);

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
        Alert.alert(t('paywall.purchaseError'));
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
      } else if (result.errorKind === 'entitlement_pending') {
        // Odeme gitmis olabilir — "tekrar dene" DEME, cift odeme riski.
        // Servis katmani RC_ENTITLEMENT_PENDING ile Sentry'ye yazdi.
        Alert.alert(t('errors.purchasePendingTitle'), t('errors.purchasePending'));
      } else {
        // K-43: ham RC metni ekrana gitmez; servis katmani Sentry'ye yazdi.
        Alert.alert(t('paywall.purchaseError'));
      }
    } catch (err) {
      logger.error('[paywall-base] Satin alma hatasi:', err);
      Alert.alert(t('paywall.purchaseError'));
    } finally {
      setPurchasing(false);
    }
  }, [selectedPlan, packages, purchasing, t, refreshSubscription, refreshQuota, onConvert, variant]);

  /**
   * Secili planin trial suresi: gun sayisi RC `introPrice`'tan, uygunluk RC
   * eligibility'den. Uygun degil / okunamadi / lifetime → 0 (vaat yok).
   */
  const selectedProduct = productFor(selectedPlan);
  const trialDays = selectedProduct
    ? trialDaysFor(eligibility[selectedProduct.identifier] ?? 'unknown', selectedProduct)
    : 0;

  /** CTA metni — trial suresine bagli variant'lar fonksiyon gecer */
  const noTrialCta = t('contextPaywall.ctaNoTrial');
  const resolvedCtaLabel =
    typeof ctaLabel === 'function'
      ? trialDays > 0 || selectedPlan === 'lifetime'
        ? ctaLabel(trialDays)
        : noTrialCta
      : ctaLabel ??
        (trialDays > 0 ? t('contextPaywall.ctaTrial', { days: trialDays }) : noTrialCta);

  /**
   * Terms/Privacy linki. Acilmazsa Sentry'ye error + kullaniciya mevcut hata
   * kopyasi (`errors.openLink`); sessiz reddedilen promise birakilmaz (kural 1).
   * Repoda toast altyapisi yok — profile/film ekranlari da Alert kullaniyor.
   */
  const openLegalLink = useCallback(async (url: string, kind: 'terms' | 'privacy') => {
    try {
      await Linking.openURL(url);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { error_code: 'PAYWALL_LEGAL_LINK_FAILED', link: kind },
        extra: { url },
      });
      Alert.alert(t('errors.openLink'));
    }
  }, [t]);

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
      } else if (result.errorKind === 'no_data') {
        // Sorgu basarili, gercekten geri yuklenecek abonelik yok.
        Alert.alert(t('paywall.restoreEmpty'));
      } else {
        // Ag/SDK hatasi — "aboneligin yok" DEME. App Store zorunlu akisi.
        Alert.alert(t('errors.restoreFailed'));
      }
    } catch (err) {
      logger.error('[paywall-base] Restore hatasi:', err);
      Alert.alert(t('errors.restoreFailed'));
    }
  }, [t, refreshSubscription, refreshQuota, onDismiss]);

  /**
   * Dismiss + tracking.
   *
   * E-09: `dismiss_method` üç kapanış yolunu ayırır — sürükleme tutamacı,
   * "şimdi değil" butonu ve sistem geri hareketi (`onRequestClose`). Üçü aynı
   * olay sayılırsa "paywall reddedildi" verisi, reddin ne kadarının bilinçli
   * olduğunu söyleyemez.
   */
  const handleDismiss = useCallback((method: PaywallDismissMethod) => {
    recordPaywallDismissed(variant, method).catch(() => {});
    onDismiss();
  }, [variant, onDismiss]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => handleDismiss('system_back')}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Drag Handle */}
          <TouchableOpacity
            style={styles.dragHandleArea}
            onPress={() => handleDismiss('drag_handle')}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel={t('paywall.closeSheet')}
          >
            <View style={styles.dragHandle} />
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Custom Header (variant-specific) */}
            {renderHeader(pricing)}

            {/* Loading */}
            {loading ? (
              <ActivityIndicator
                color={Colors.accentPrimary}
                size="large"
                style={{ marginVertical: 40 }}
              />
            ) : offeringsError || planOptions.length === 0 ? (
              /* Paketler yuklenemedi — sessizce bos paywall acmak yerine
                 gorunur hata. Eskiden buraya kadar gelinip satin alma
                 aninda genel "purchaseError" veriliyordu. */
              <View style={styles.offeringsErrorBox}>
                <Text style={styles.offeringsErrorText}>{t('errors.offeringsLoad')}</Text>
                <TouchableOpacity
                  onPress={() => { hapticMedium(); setReloadToken((n) => n + 1); }}
                  activeOpacity={0.8}
                  style={styles.offeringsRetryBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('errors.retry')}
                >
                  <Text style={styles.offeringsRetryText}>{t('errors.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Plan Cards */}
                <View style={styles.planContainer}>
                  {planOptions.map((option) => {
                    const isSelected = selectedPlan === option.id;

                    // planOptions yalniz RC urunu olan planlari icerir.
                    const priceText = productFor(option.id)?.priceString ?? '';
                    const unitText = t(`paywall.${unitKeyFor(option.id)}`);
                    const planLabel = `${t(`paywall.${option.id}Title`)}, ${priceText} ${unitText}`;

                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={[styles.planCard, isSelected && styles.planCardSelected]}
                        onPress={() => { hapticMedium(); setSelectedPlan(option.id); }}
                        activeOpacity={0.8}
                        accessibilityRole="radio"
                        accessibilityLabel={planLabel}
                        accessibilityState={{ selected: isSelected }}
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
                            {priceText} {unitText}
                          </Text>
                          {option.id === 'annual' && pricing && (
                            <Text style={styles.planSaving}>
                              {t('contextPaywall.annualSaving', {
                                percent: pricing.savingsPercent,
                                monthly: pricing.monthlyEquivalent,
                              })}
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

                {/* Trial satiri — Apple 3.1.2: sure + sonraki fiyat. Gun RC introPrice'tan,
                    uygunluk RC eligibility'den; uygun degil/okunamadi/lifetime → gizli. */}
                {trialDays > 0 && selectedProduct && (
                  <Text style={styles.trialInfo}>
                    {t('contextPaywall.trialLine', {
                      days: trialDays,
                      price: selectedProduct.priceString,
                      period: t(`paywall.${unitKeyFor(selectedPlan)}`),
                    })}
                  </Text>
                )}

                {/* CTA */}
                <TouchableOpacity
                  style={[styles.ctaButton, purchasing && styles.ctaDisabled]}
                  onPress={handlePurchase}
                  disabled={purchasing}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={resolvedCtaLabel}
                  accessibilityState={{ disabled: purchasing, busy: purchasing }}
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
                        <Sparkle size={18} color={Colors.textOnAccent} weight="duotone" />
                        <Text style={styles.ctaText}>
                          {resolvedCtaLabel}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Dismiss */}
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={() => handleDismiss('dismiss_button')}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={dismissLabel ?? t('contextPaywall.dismissDefault')}
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
                  accessibilityRole="button"
                  accessibilityLabel={t('paywall.restorePurchases')}
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
                    onPress={() => { void openLegalLink(TERMS_URL, 'terms'); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="link"
                    accessibilityLabel={t('paywall.termsAction')}
                  >
                    <Text style={styles.legalLink}>{t('paywall.termsAction')}</Text>
                  </TouchableOpacity>
                  <Text style={styles.legalSeparator}>·</Text>
                  <TouchableOpacity
                    onPress={() => { void openLegalLink(PRIVACY_URL, 'privacy'); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="link"
                    accessibilityLabel={t('paywall.privacyAction')}
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
