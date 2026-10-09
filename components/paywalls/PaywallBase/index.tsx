/**
 * PaywallBase — bottom sheet modal with plan selection + purchase flow (V2).
 *
 * Her contextual paywall variant bu base component'i sarar.
 * RevenueCat purchase, restore, trial flow'lari buradan yonetilir.
 *
 * Layout (R-5 V2):
 *   - Ust bant: surukleme tutamaci + ✕ (her durumda gorunur)
 *   - KAYDIRILABILIR icerik: variant header'i + plan kartlari (Annual, Monthly)
 *   - SABIT satin alma alani: CTA, aciklama, Restore · Terms · Privacy
 *
 * CTA metni, aciklama ve plan karti fiyat satiri `buildOffer`'dan (utils/
 * paywallPricing.ts) gelir — tek kaynak. Lifetime bu ekranda SATILMAZ (D-08);
 * kart bu surumde kaldirildi, geri acma notu docs/TEKNIK_BORC.md'de.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PurchasesPackage } from 'react-native-purchases';

import * as Sentry from '@sentry/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { X } from 'phosphor-react-native';

import { color } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';
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
import { getAppUserId } from '@/services/watchlist';
import type { PurchaseErrorKind } from '@/services/purchaseService';
import { posthogAnalytics } from '@/services/posthog';
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
  buildOffer,
  type AnnualPricing,
  type OfferPlan,
  type TrialEligibility,
} from '@/utils/paywallPricing';
import { styles } from './styles';

// ─── Legal URLs ──────────────────────────────────────────────────────────────

const TERMS_URL =
  'https://www.notion.so/Chosy-ai-Terms-of-Service-34a00bffbfbe80899613c3ce2e5ed01b';
const PRIVACY_URL =
  'https://abalone-dracopelta-382.notion.site/Chosy-ai-Privacy-Policy-34a00bffbfbe80af9f5fd996fa7ab55b';

/**
 * Bu Dynamic Type olcegi ustunde satin alma alani sabit kalmaz, icerigin
 * sonuna akar: sabit alan kaydirma alanini yutardi ve kesilirdi.
 */
const INLINE_FOOTER_FONT_SCALE = 1.35;

// ─── Props ──────────────────────────────────────────────────────────────────

/** `renderHeader`'a ikinci argüman: header'ın yerleşimini etkileyen teklif durumu. */
export interface PaywallHeaderContext {
  /**
   * Annual için deneme vaadi gösteriliyor mu (eligible + intro tanımlı).
   * Bu durumda açıklama 3 satıra çıkar; hero sığmak için alt metni gizler.
   * Plan seçiminden BAĞIMSIZ: Monthly'ye dokununca yerleşim zıplamasın.
   */
  trialShown: boolean;
}

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
  renderHeader: (pricing: AnnualPricing | null, ctx: PaywallHeaderContext) => React.ReactNode;
  /**
   * Plan kartlarının (veya yükleme/hata bloğunun) ALTINDA, kaydırılan alanın
   * içinde gösterilecek içerik. Hero'daki fayda satırları gibi, kartlardan
   * sonra gelmesi gereken içerik içindir (R-5 fit).
   */
  renderBelowPlans?: () => React.ReactNode;
  /**
   * @deprecated R-5: CTA metni `buildOffer`'dan gelir (tek kaynak). Prop
   * olu varyantlarin imzasini bozmamak icin duruyor, OKUNMAZ.
   * Bkz. docs/TEKNIK_BORC.md "R-5 ertelenenler".
   */
  ctaLabel?: string | ((trialDays: number) => string);
  /**
   * @deprecated R-5: "Maybe later" metin butonu kaldirildi, kapatma ✕ ile.
   * Prop olu varyantlarin imzasini bozmamak icin duruyor, OKUNMAZ.
   */
  dismissLabel?: string;
}

// ─── Başarı sonrası yan iş ──────────────────────────────────────────────────

/**
 * Başarılı satın alma sonrası tek bir yan işi çalıştırır. Hata yutulmaz
 * (Sentry, kural 1) ama yayılmaz: ödeme alınmışken kullanıcıya "satın alma
 * gitmedi" demek yanlış ve çift ödeme riskidir.
 */
async function postPurchaseStep(step: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.error('[paywall-base] Satin alma sonrasi adim basarisiz:', err, {
      code: 'PAYWALL_POST_PURCHASE_STEP_FAILED',
      extra: { step },
    });
  }
}

// ─── Plan UI ────────────────────────────────────────────────────────────────

/** Gosterim sirasi: Annual (varsayilan secili) once. */
const PLAN_ORDER: readonly OfferPlan[] = ['annual', 'monthly'];

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
  renderBelowPlans,
}: PaywallBaseProps) {
  const { t, language } = useLanguage();
  const { refreshSubscription, refreshQuota, premiumStatus } = useSubscription();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  /** productId → trial uygunlugu. Bos/eksik = 'unknown' (trial vaat edilmez). */
  const [eligibility, setEligibility] = useState<Record<string, TrialEligibility>>({});
  const [selectedPlan, setSelectedPlan] = useState<OfferPlan>('annual');
  const [loading, setLoading] = useState(true);
  /** Dolu ise paketler guvenilir degil — plan kartlari yerine hata gosterilir */
  const [offeringsError, setOfferingsError] = useState<PurchaseErrorKind | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * Satın alma / restore kilidi (R-5 B5). Karar `busyRef`'ten okunur — React
   * state'i render sonrası güncellendiği için aynı tick'teki ikinci dokunuşu
   * yakalayamaz. `busy` yalnız görünüm içindir (spinner, devre dışı).
   */
  const busyRef = useRef(false);
  const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);
  const purchasing = busy === 'purchase';
  const restoring = busy === 'restore';

  const acquireLock = useCallback((kind: 'purchase' | 'restore'): boolean => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(kind);
    return true;
  }, []);

  const releaseLock = useCallback(() => {
    busyRef.current = false;
    setBusy(null);
  }, []);

  /** Plan -> RC urunu. Fiyat/trial yalniz buradan okunur; sabit fiyat yok. */
  const productFor = useCallback(
    (id: OfferPlan) =>
      packages.find((p) => p.product.identifier === PLANS[id].rcProductId)?.product,
    [packages],
  );

  // RC'de urunu olmayan plan satin alinamaz — karti gosterme.
  const planOptions = useMemo(
    () => PLAN_ORDER.filter((id) => productFor(id) !== undefined),
    [productFor],
  );

  // Secili plan listede degilse (paket eksik) ilk mevcut plana gec.
  useEffect(() => {
    if (planOptions.length > 0 && !planOptions.includes(selectedPlan)) {
      setSelectedPlan(planOptions[0]);
    }
  }, [planOptions, selectedPlan]);

  /** Teklif (CTA + aciklama + fiyat satiri) — plan basina, tek kaynak. */
  const offers = useMemo(() => {
    const out = {} as Record<OfferPlan, ReturnType<typeof buildOffer>>;
    for (const id of PLAN_ORDER) {
      const product = productFor(id);
      out[id] = buildOffer(
        id,
        product ?? null,
        product ? eligibility[product.identifier] ?? 'unknown' : 'unknown',
      );
    }
    return out;
  }, [productFor, eligibility]);
  const selectedOffer = offers[selectedPlan];
  const trialShown = offers.annual.kind === 'trial';

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

      const planProductIds = PLAN_ORDER.map((id) => PLANS[id].rcProductId);
      const productIds = res.items
        .map((p) => p.product.identifier)
        .filter((id) => planProductIds.includes(id));

      // Hata YOK ama satilan urun de yok: fiyat uydurulmaz, kullanici "Try again"
      // gorur — ve bu sessiz kalmaz (kural 1). Hata varsa servis zaten yazdi.
      if (!res.errorKind && productIds.length === 0) {
        Sentry.captureMessage('Paywall: offering bos, satilan urun yok', {
          level: 'error',
          tags: { error_code: 'PAYWALL_OFFERINGS_EMPTY', variant: variant.name },
          extra: { returnedProductIds: res.items.map((p) => p.product.identifier) },
        });
      }

      // Uygunluk sorgusu da kendi hatasini Sentry'ye yazar ve asla firlatmaz;
      // okunamazsa 'unknown' doner → trial gosterilmez.
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
  }, [visible, reloadToken, variant.name]);

  // Shown event kaydet
  useEffect(() => {
    if (visible) {
      recordPaywallShown(variant).catch(() => {});
    }
  }, [visible, variant]);

  // Zaten Pro: paywall acik kalmaz (analitik 'dismissed' sayilmaz, bu bir ret degil).
  useEffect(() => {
    if (visible && premiumStatus === 'premium' && !busyRef.current) {
      onDismiss();
    }
  }, [visible, premiumStatus, onDismiss]);

  /** Satin alma */
  const handlePurchase = useCallback(async () => {
    if (!acquireLock('purchase')) return;
    hapticMedium();

    // Iptal DEGIL (o `purchase_cancelled`, purchaseService'te); basarisiz sonuc.
    const trackPurchaseFailed = (errorKind: string) => {
      posthogAnalytics.track('purchase_failed', { error_kind: errorKind, plan: selectedPlan });
    };

    try {
      const plan = PLANS[selectedPlan];
      const pkg = packages.find((p) => p.product.identifier === plan.rcProductId);

      if (!pkg) {
        trackPurchaseFailed('package_missing');
        Alert.alert(t('paywall.purchaseError'));
        return;
      }

      const result = await purchasePackage(pkg);

      // İptal: sessiz, kilit finally'de açılır.
      if (result.cancelled) return;

      if (result.success) {
        // Başarı kriteri `purchaseService`'te belirlendi (entitlements.active
        // [chosy_plus]). Bundan sonraki her adım YAN İŞTİR: biri patlarsa
        // ödeme zaten alınmıştır, kullanıcıya "Try again" gösterilmez (çift
        // ödeme riski) — hata Sentry'ye gider, başarı akışı sürer (R-5 B6).
        hapticSuccess();

        // Nesne sarmalayıcı: kapanış içinde atanan `let`, TS'te `null`'a
        // daralır ve `if` bloğunu `never` yapar.
        const resolved: { userId: string | null } = { userId: null };
        await postPurchaseStep('get_app_user_id', async () => {
          resolved.userId = await getAppUserId();
        });

        if (resolved.userId) {
          const uid: string = resolved.userId;
          await postPurchaseStep('upsert_subscription', async () => {
            await upsertSubscription({
              userId: uid,
              plan: selectedPlan,
              status: 'active',
              rcCustomerId: result.customerInfo?.originalAppUserId ?? null,
            });
          });

          // KRITIK: users.subscription_tier'i hemen guncelle.
          // Quota RPC'leri (check_and_consume_quota) bu kolonu okur.
          // Webhook async gelebilir — kullanici arada "limit reached" gorebilir.
          await postPurchaseStep('update_subscription_tier', async () => {
            const tier = selectedPlan === 'annual' ? 'annual' : 'monthly';
            const { error: tierErr } = await supabase
              .from('users')
              .update({
                subscription_tier: tier,
                updated_at: new Date().toISOString(),
              })
              .eq('id', uid);
            if (tierErr) throw tierErr;
          });

          // Client-side quota cache'ini temizle — yeni tier ile fresh quota
          await postPurchaseStep('clear_quota_cache', () => clearQuotaCache(uid));
        }

        await postPurchaseStep('record_converted', () => recordPaywallConverted(variant));
        await postPurchaseStep('refresh_subscription', () => refreshSubscription());
        await postPurchaseStep('refresh_quota', () => refreshQuota());
        await postPurchaseStep('on_convert', async () => { onConvert(selectedPlan); });
      } else if (result.errorKind === 'entitlement_pending') {
        // Odeme gitmis olabilir — "tekrar dene" DEME, cift odeme riski.
        // Servis katmani RC_ENTITLEMENT_PENDING ile Sentry'ye yazdi.
        trackPurchaseFailed('entitlement_pending');
        Alert.alert(t('errors.purchasePendingTitle'), t('errors.purchasePending'));
      } else if (result.errorKind === 'not_ready') {
        // RC/kimlik henüz hazır değil: ödeme BAŞLAMADI, tekrar denemek güvenli.
        trackPurchaseFailed('not_ready');
        Alert.alert(t('errors.accountNotReady'));
      } else {
        // K-43: ham RC metni ekrana gitmez; servis katmani Sentry'ye yazdi.
        trackPurchaseFailed(result.errorKind ?? 'unknown');
        Alert.alert(t('paywall.purchaseError'));
      }
    } catch (err) {
      logger.error('[paywall-base] Satin alma hatasi:', err);
      trackPurchaseFailed('exception');
      Alert.alert(t('paywall.purchaseError'));
    } finally {
      releaseLock();
    }
  }, [selectedPlan, packages, acquireLock, releaseLock, t, refreshSubscription, refreshQuota, onConvert, variant]);

  /**
   * Terms/Privacy linki. Acilmazsa Sentry'ye error + kullaniciya mevcut hata
   * kopyasi (`errors.openLink`); sessiz reddedilen promise birakilmaz (kural 1).
   */
  const openLegalLink = useCallback(async (url: string, kind: 'terms' | 'privacy') => {
    try {
      await WebBrowser.openBrowserAsync(url);
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
    if (!acquireLock('restore')) return;
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
      } else if (result.errorKind === 'not_ready') {
        // RC/kimlik hazır değil: restore çağrılmadı, "aboneliğin yok" DEME.
        Alert.alert(t('errors.accountNotReady'));
      } else {
        // Ag/SDK hatasi — "aboneligin yok" DEME. App Store zorunlu akisi.
        Alert.alert(t('errors.restoreFailed'));
      }
    } catch (err) {
      logger.error('[paywall-base] Restore hatasi:', err);
      Alert.alert(t('errors.restoreFailed'));
    } finally {
      releaseLock();
    }
  }, [t, acquireLock, releaseLock, refreshSubscription, refreshQuota, onDismiss]);

  /**
   * Dismiss + tracking.
   *
   * E-09: `dismiss_method` üç kapanış yolunu ayırır — sürükleme tutamacı,
   * ✕ butonu (`dismiss_button`) ve sistem geri hareketi (`onRequestClose`).
   */
  const handleDismiss = useCallback((method: PaywallDismissMethod) => {
    // Satın alma / restore sürerken hiçbir kapanış yolu çalışmaz (R-5 B5).
    if (busyRef.current) return;
    recordPaywallDismissed(variant, method).catch(() => {});
    onDismiss();
  }, [variant, onDismiss]);

  const selectPlan = useCallback((id: OfferPlan) => {
    if (busyRef.current) return;
    hapticMedium();
    if (id !== selectedPlan) {
      posthogAnalytics.track('paywall_plan_selected', {
        plan: id,
        source: variant.name,
        // Secimden sonra ekranda deneme vaadi gorunuyor mu (buildOffer ile ayni kaynak).
        trial_shown: offers[id].kind === 'trial',
      });
    }
    setSelectedPlan(id);
  }, [selectedPlan, variant.name, offers]);

  // ─── Sabit satın alma alanı ───────────────────────────────────────────────

  const ctaLabel = t(selectedOffer.cta.key, selectedOffer.cta.params);
  const description = selectedOffer.description
    ? t(selectedOffer.description.key, selectedOffer.description.params)
    : null;
  const ctaDisabled = loading || !selectedOffer.canPurchase || busy !== null;
  const inlineFooter = fontScale >= INLINE_FOOTER_FONT_SCALE;

  const footer = (
    <View
      style={[
        styles.footer,
        inlineFooter && styles.footerInline,
        !inlineFooter && { paddingBottom: Math.max(insets.bottom - 8, 16) },
      ]}
    >
      <TouchableOpacity
        style={[styles.ctaButton, ctaDisabled && styles.ctaDisabled]}
        onPress={handlePurchase}
        disabled={ctaDisabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={loading ? t('paywall.loadingPrices') : ctaLabel}
        accessibilityState={{ disabled: ctaDisabled, busy: purchasing || loading }}
      >
        {purchasing || loading ? (
          <ActivityIndicator color={color.surface.base} size="small" />
        ) : (
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        )}
      </TouchableOpacity>

      {loading ? (
        <View
          style={styles.skeletonDescription}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={[styles.skeletonLine, styles.skeletonLineWide]} />
          <View style={[styles.skeletonLine, styles.skeletonLineNarrow]} />
        </View>
      ) : description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}

      {/* Restore, Terms, Privacy — ayraçsız (wrap'te yetim işaret kalmaz); yükleme ve hata dahil HER durumda */}
      <View style={styles.legalRow}>
        <TouchableOpacity
          style={styles.legalItem}
          onPress={handleRestore}
          disabled={busy !== null}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('paywall.restorePurchases')}
          accessibilityState={{ disabled: busy !== null, busy: restoring }}
        >
          {restoring ? (
            <ActivityIndicator color={color.text.secondary} size="small" />
          ) : (
            <Text style={styles.legalText}>{t('paywall.restorePurchases')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.legalItem}
          onPress={() => { void openLegalLink(TERMS_URL, 'terms'); }}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel={t('paywall.termsAction')}
        >
          <Text style={styles.legalText}>{t('paywall.termsAction')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.legalItem}
          onPress={() => { void openLegalLink(PRIVACY_URL, 'privacy'); }}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel={t('paywall.privacyAction')}
        >
          <Text style={styles.legalText}>{t('paywall.privacyAction')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

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
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Custom Header (variant-specific) */}
            {renderHeader(pricing, { trialShown })}

            {loading ? (
              /* Fiyatlar yükleniyor — animasyonsuz iskelet, fiyat UYDURULMAZ */
              <View
                style={styles.planContainer}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View style={styles.skeletonCard} />
                <View style={styles.skeletonCard} />
              </View>
            ) : offeringsError || planOptions.length === 0 ? (
              /* Paketler yüklenemedi/boş — fiyat gösterilmez, CTA kapalı. */
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
              <View style={styles.planContainer} accessibilityRole="radiogroup">
                {planOptions.map((id) => {
                  const isSelected = selectedPlan === id;
                  const offer = offers[id];
                  const unitText = offer.priceLine ? t(`paywall.${offer.priceLine.unitKey}`) : '';
                  const priceText = offer.priceLine ? `${offer.priceLine.price}${unitText}` : '';
                  const showSavings = id === 'annual' && pricing !== null;
                  const badgeText = showSavings
                    ? t('paywall.saveBadge', { percent: pricing.savingsPercent })
                    : null;
                  const equivalentText = showSavings
                    ? t('paywall.perMonthEquivalent', { monthly: pricing.monthlyEquivalent })
                    : null;
                  const planLabel = [
                    t(`paywall.${id}Title`),
                    priceText,
                    badgeText,
                    equivalentText,
                  ].filter(Boolean).join(', ');

                  return (
                    <TouchableOpacity
                      key={id}
                      style={[styles.planCard, isSelected && styles.planCardSelected]}
                      onPress={() => selectPlan(id)}
                      disabled={busy !== null}
                      activeOpacity={0.8}
                      accessibilityRole="radio"
                      accessibilityLabel={planLabel}
                      accessibilityState={{ selected: isSelected, disabled: busy !== null }}
                    >
                      <View style={styles.planInfo}>
                        <View style={styles.planTitleRow}>
                          <Text style={styles.planTitle}>{t(`paywall.${id}Title`)}</Text>
                          {badgeText && (
                            <View style={styles.planBadge}>
                              <Text style={styles.planBadgeText}>{badgeText}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.planPrice}>{priceText}</Text>
                        {equivalentText && (
                          <Text style={styles.planEquivalent}>{equivalentText}</Text>
                        )}
                      </View>

                      <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {renderBelowPlans?.()}

            {inlineFooter && footer}
          </ScrollView>

          {!inlineFooter && footer}

          {/* Opak üst şerit: içerik tutamaç/✕'in altından geçer (zIndex 1 < 2,3) */}
          <View style={styles.topBand} pointerEvents="none" />
          <LinearGradient
            colors={[color.surface.raised, withAlpha(color.surface.raised, 0)]}
            style={styles.topFade}
            pointerEvents="none"
          />

          {/* Tutamaç + ✕ — şeridin ÜSTÜNDE, her durumda görünür */}
          <TouchableOpacity
            style={styles.dragHandleArea}
            onPress={() => handleDismiss('drag_handle')}
            disabled={busy !== null}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel={t('paywall.closeSheet')}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={styles.dragHandle} />
          </TouchableOpacity>

          {/* ✕ — yükleme / offeringsError dahil HER durumda görünür (R-5 B4) */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => handleDismiss('dismiss_button')}
            disabled={busy !== null}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('paywall.closeSheet')}
            accessibilityState={{ disabled: busy !== null }}
          >
            <X size={22} color={color.text.primary} weight="bold" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
