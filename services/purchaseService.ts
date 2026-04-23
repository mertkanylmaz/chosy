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
  const alreadyConfigured = await Purchases.isConfigured();
  if (alreadyConfigured) {
    _initialized = true;
    logger.log('[purchases] RevenueCat zaten yapılandırılmış — flag senkronize edildi');
    return;
  }

  const apiKey = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;

  if (!apiKey) {
    logger.warn('[purchases] RevenueCat API key bulunamadı — SDK başlatılmadı');
    return;
  }

  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    Purchases.configure({
      apiKey,
      appUserID: supabaseUserId ?? undefined,
    });

    _initialized = true;
    logger.log('[purchases] RevenueCat başlatıldı');

    // === TANI LOGU: SADECE GELİŞTİRME AŞAMASI İÇİN ===
    try {
      const offerings = await Purchases.getOfferings();
      console.log("\n=== REVENUECAT LOG ===");
      console.log(JSON.stringify(offerings, null, 2));
      console.log("======================\n");
    } catch (e) {
      console.error("RevenueCat Log Hatası:", e);
    }
    // =================================================

  } catch (err) {
    logger.error('[purchases] RevenueCat başlatma hatası:', err);
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

// ─── Satın Alma ──────────────────────────────────────────────────────────────

/**
 * Belirtilen paketi satın alır.
 * Paywall'dan çağrılır.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  if (!_initialized) {
    return { success: false, error: 'RevenueCat başlatılmadı' };
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isPremium = customerInfo.entitlements.active[RC_ENTITLEMENT_ID] !== undefined;

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