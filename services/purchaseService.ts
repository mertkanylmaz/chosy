/**
 * RevenueCat Purchase Service — abonelik yönetimi.
 *
 * Sorumluluklar:
 * - RevenueCat SDK başlatma (configure)
 * - Aktif abonelik durumu sorgulama
 * - Satın alma akışı (purchase)
 * - Satın alım geri yükleme (restore)
 * - Kullanıcı kimliği eşleme (Supabase auth_id ↔ RC customer)
 *
 * Kullanım:
 * - _layout.tsx'te: initializePurchases()
 * - paywall.tsx'te: purchasePackage(), restorePurchases()
 * - SubscriptionContext'te: getSubscriptionStatus()
 */

import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type CustomerInfoUpdateListener,
  type PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';

import { RC_ENTITLEMENT_ID } from '@/constants/subscriptionPlans';
import { posthogAnalytics } from '@/services/posthog';
import { logger } from '@/utils/logger';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

/** RevenueCat API anahtarları — .env'den okunur */
const RC_IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '';
const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '';

// ─── Tipler ───────────────────────────────────────────────────────────────────

/** Abonelik durum özeti */
export interface SubscriptionInfo {
  /** Premium erişimi var mı? */
  isPremium: boolean;
  /** Aktif plan (null = free) */
  activePlanId: string | null;
  /** Abonelik bitiş tarihi */
  expiresAt: Date | null;
  /** Trial döneminde mi? */
  isInTrial: boolean;
  /** RevenueCat customer ID */
  rcCustomerId: string | null;
}

/** Satın alma sonucu */
export interface PurchaseResult {
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
  cancelled?: boolean;
}

// ─── SDK Başlatma ────────────────────────────────────────────────────────────

let _initialized = false;

/**
 * RevenueCat SDK'yı başlatır. Uygulama açılışında bir kez çağrılır.
 * Supabase user ID ile eşleştirilir.
 */
export async function initializePurchases(supabaseUserId?: string): Promise<void> {
  // JS modülü zaten işaretli — tekrar configure etme
  if (_initialized) return;

  // Native RC instance zaten ayarlanmış (Fast Refresh senaryosu) — sadece flag'i senkronize et
  try {
    const alreadyConfigured = await Purchases.isConfigured();
    if (alreadyConfigured) {
      _initialized = true;
      logger.log('[purchases] RevenueCat zaten yapılandırılmış — flag senkronize edildi');
      return;
    }
  } catch (err) {
    logger.warn('[purchases] isConfigured() kontrolü başarısız — ilk kurulum varsayılıyor:', err);
  }

  const apiKey = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;

  // EAS Build'de env secret tanimli degilse bos string gelir.
  // Bos key ile Purchases.configure() native crash'e yol acabilir — kesinlikle guard'la.
  if (!apiKey || apiKey.trim() === '') {
    logger.warn('[purchases] RevenueCat API key bulunamadi — SDK baslatilmadi');
    logger.warn('[purchases] EXPO_PUBLIC_RC_IOS_KEY EAS Secrets\'ta tanimli mi?');
    return;
  }

  try {
    if (__DEV__) {
      // WARN seviyesi: RC log spam'ini suppress et (Sprint 3 #19)
      // DEBUG seviyesi gerekirse gecici olarak tekrar acilabilir.
      Purchases.setLogLevel(LOG_LEVEL.WARN);
    }

    Purchases.configure({
      apiKey: apiKey.trim(),
      appUserID: supabaseUserId ?? undefined,
    });

    _initialized = true;
    logger.log('[purchases] RevenueCat baslatildi');

  } catch (err) {
    // Native crash'i JS katmaninda yakala — uygulamayi cokertme
    logger.error('[purchases] RevenueCat baslatma hatasi:', err);
    // _initialized = false kalir; diger servisler _initialized guard ile korunur
  }
}

/**
 * Supabase kullanıcısı değiştiğinde RevenueCat customer ID'yi günceller.
 * Auth sonrası çağrılır (Apple/Google link).
 */
export async function identifyUser(supabaseUserId: string): Promise<void> {
  if (!_initialized) return;

  try {
    await Purchases.logIn(supabaseUserId);
    logger.log('[purchases] Kullanıcı eşleştirildi:', supabaseUserId);
  } catch (err) {
    logger.error('[purchases] Kullanıcı eşleştirme hatası:', err);
  }
}

// ─── Abonelik Durumu ─────────────────────────────────────────────────────────

/**
 * RevenueCat'ten aktif abonelik bilgisini sorgular.
 */
export async function getSubscriptionStatus(): Promise<SubscriptionInfo> {
  const defaultStatus: SubscriptionInfo = {
    isPremium: false,
    activePlanId: null,
    expiresAt: null,
    isInTrial: false,
    rcCustomerId: null,
  };

  if (!_initialized) return defaultStatus;

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return parseCustomerInfo(customerInfo);
  } catch (err) {
    logger.error('[purchases] Abonelik durumu sorgu hatası:', err);
    return defaultStatus;
  }
}

/**
 * CustomerInfo'dan SubscriptionInfo'ya dönüştürür.
 */
function parseCustomerInfo(info: CustomerInfo): SubscriptionInfo {
  const entitlement = info.entitlements.active[RC_ENTITLEMENT_ID];
  const isPremium = entitlement !== undefined;

  return {
    isPremium,
    activePlanId: entitlement?.productIdentifier ?? null,
    expiresAt: entitlement?.expirationDate
      ? new Date(entitlement.expirationDate)
      : null,
    isInTrial: entitlement?.periodType === 'TRIAL',
    rcCustomerId: info.originalAppUserId,
  };
}

// ─── Listener — Abonelik Değişim Dinleyicisi ─────────────────────────────────

/**
 * RevenueCat customerInfo değişiklik dinleyicisi.
 * Abonelik yenilenme, expire, cancel gibi olaylarda tetiklenir.
 * SubscriptionContext bu callback'i kullanarak state'i günceller.
 *
 * @returns Cleanup fonksiyonu (listener'ı kaldırır)
 */
export function addSubscriptionListener(
  callback: (info: SubscriptionInfo) => void,
): () => void {
  if (!_initialized) return () => {};

  // Named referans — removeCustomerInfoUpdateListener ayni fonksiyonu alir
  const listenerFn: CustomerInfoUpdateListener = (customerInfo) => {
    const parsed = parseCustomerInfo(customerInfo);
    callback(parsed);
  };

  Purchases.addCustomerInfoUpdateListener(listenerFn);

  return () => {
    Purchases.removeCustomerInfoUpdateListener(listenerFn);
  };
}

// ─── Mevcut Paketleri Getir ──────────────────────────────────────────────────

/**
 * RevenueCat'ten mevcut offering paketlerini döndürür.
 * Paywall UI bunu kullanarak fiyat/trial bilgilerini gösterir.
 */
export async function getOfferings(): Promise<PurchasesPackage[]> {
  if (!_initialized) return [];

  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;

    if (!current) {
      logger.warn('[purchases] Aktif offering bulunamadı');
      return [];
    }

    return current.availablePackages;
  } catch (err) {
    logger.error('[purchases] Offering getirme hatası:', err);
    return [];
  }
}

// ─── Lifetime Offering ──────────────────────────────────────────────────────

/**
 * RevenueCat'ten lifetime_founding offering paketlerini döndürür.
 * Lifetime ürünü ayrı offering'te tutulur — paywall'daki default'tan ayrı.
 * Fallback: default offering'teki lifetime paketini arar.
 */
export async function getLifetimeOffering(): Promise<PurchasesPackage[]> {
  if (!_initialized) return [];

  try {
    const offerings = await Purchases.getOfferings();

    // Önce ayrı lifetime offering'i dene
    const lifetimeOffering = offerings.all['lifetime_founding'];
    if (lifetimeOffering?.availablePackages?.length) {
      return lifetimeOffering.availablePackages;
    }

    // Fallback: default offering'teki lifetime paketini bul
    const current = offerings.current;
    if (current) {
      const lifetimePkg = current.availablePackages.filter(
        (p) => p.product.identifier === 'com.chosy.lifetime',
      );
      if (lifetimePkg.length > 0) return lifetimePkg;
    }

    logger.warn('[purchases] Lifetime offering bulunamadı — fallback: tüm paketler');
    return current?.availablePackages ?? [];
  } catch (err) {
    logger.error('[purchases] Lifetime offering hatası:', err);
    return [];
  }
}

// ─── Satın Alma ──────────────────────────────────────────────────────────────

/**
 * Belirtilen paketi satın alır.
 * Paywall'dan çağrılır.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  if (!_initialized) {
    return { success: false, error: 'RevenueCat başlatılmadı' };
  }

  posthogAnalytics.track('purchase_started', {
    package_id: pkg.identifier,
    product_id: pkg.product.identifier,
  });

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isPremium = customerInfo.entitlements.active[RC_ENTITLEMENT_ID] !== undefined;

    if (isPremium) {
      posthogAnalytics.track('purchase_completed', {
        package_id: pkg.identifier,
        product_id: pkg.product.identifier,
      });
    }

    return {
      success: isPremium,
      customerInfo,
      error: isPremium ? undefined : 'Entitlement aktif değil',
    };
  } catch (err: unknown) {
    // Kullanıcı iptal etti
    if (err && typeof err === 'object' && 'userCancelled' in err && (err as { userCancelled: boolean }).userCancelled) {
      return { success: false, cancelled: true };
    }

    const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
    logger.error('[purchases] Satın alma hatası:', message);
    return { success: false, error: message };
  }
}

// ─── Oturum Sıfırlama ────────────────────────────────────────────────────

/**
 * RevenueCat müşteri kimliğini sıfırlar (anonim kullanıcıya döner).
 * Hesap silme akışında çağrılır — on-device entitlement cache'ini temizler.
 * Çağrılmazsa eski abonelik bilgisi cihazda kalır ve yeni hesap premium görünür.
 */
export async function logOutPurchases(): Promise<void> {
  if (!_initialized) return;

  try {
    await Purchases.logOut();
    logger.log('[purchases] RevenueCat oturumu sıfırlandı (anonim)');
  } catch (err) {
    logger.warn('[purchases] RevenueCat logOut hatası:', err);
  }
}

// ─── Geri Yükleme ────────────────────────────────────────────────────────────

/**
 * Önceki satın alımları geri yükler.
 * App Store review guide: bu buton zorunlu.
 */
export async function restorePurchases(): Promise<PurchaseResult> {
  if (!_initialized) {
    return { success: false, error: 'RevenueCat başlatılmadı' };
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    const isPremium = customerInfo.entitlements.active[RC_ENTITLEMENT_ID] !== undefined;

    if (isPremium) {
      posthogAnalytics.track('restore_completed');
    }

    return {
      success: isPremium,
      customerInfo,
      error: isPremium ? undefined : 'Geri yüklenecek abonelik bulunamadı',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
    logger.error('[purchases] Geri yükleme hatası:', message);
    return { success: false, error: message };
  }
}