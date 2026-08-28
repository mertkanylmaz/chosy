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
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';

import { RC_ENTITLEMENT_ID } from '@/constants/subscriptionPlans';
import { posthogAnalytics } from '@/services/posthog';
import { logger } from '@/utils/logger';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

/** RevenueCat API anahtarları — .env'den okunur */
const RC_IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '';
const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '';

// ─── Tipler ───────────────────────────────────────────────────────────────────

/**
 * Bir RevenueCat çağrısının neden sonuç üretemediği.
 *
 * Amaç: "gerçekten yok" ile "sorgulanamadı" ayrımı. Bu ikisi aynı dönüş
 * değerine indirgendiğinde ödeme yapmış kullanıcı free'ye düşüyor ve ağ
 * hatası ekranda "aboneliğiniz yok" olarak görünüyordu.
 */
export type PurchaseErrorKind =
  /** RC SDK configure edilmemiş — API key eksik veya init patladı */
  | 'not_initialized'
  /** Ağ/timeout — retry anlamlı */
  | 'network'
  /** RC SDK içsel hatası */
  | 'sdk_error'
  /** Satın alma geçti ama entitlement henüz aktif değil (RC senkron gecikmesi) */
  | 'entitlement_pending'
  /** Sorgu başarılı, sonuç gerçekten boş */
  | 'no_data';

/**
 * RC hatasını PurchaseErrorKind'a çevirir.
 * Kod eşleşmezse 'sdk_error' — sessiz sınıflandırma yok.
 */
function classifyPurchaseError(err: unknown): PurchaseErrorKind {
  const code = (err as { code?: unknown } | null | undefined)?.code;

  switch (String(code)) {
    case PURCHASES_ERROR_CODE.NETWORK_ERROR:
    case PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR:
    case PURCHASES_ERROR_CODE.API_ENDPOINT_BLOCKED:
    case PURCHASES_ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR:
      return 'network';
    case PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR:
      return 'entitlement_pending';
    default:
      return 'sdk_error';
  }
}

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
  /**
   * Dolu ise bu değerler RC'den okunmadı, fallback'tir.
   * Çağıran taraf bu durumda mevcut state'i KORUMALI — aksi hâlde
   * geçici bir ağ hatası ödeme yapmış kullanıcıyı free'ye düşürür.
   */
  errorKind?: PurchaseErrorKind;
}

/** Offering sorgusu sonucu — boş liste ile "yüklenemedi" ayrımı için */
export interface OfferingsResult {
  items: PurchasesPackage[];
  /** Dolu ise `items` güvenilir değil — çağıran paketleri render ETMEMELİ */
  errorKind?: PurchaseErrorKind;
}

/** Satın alma sonucu */
export interface PurchaseResult {
  success: boolean;
  customerInfo?: CustomerInfo;
  /** Ham hata metni — K-43: ekrana değil Sentry'ye gider */
  error?: string;
  cancelled?: boolean;
  /**
   * Başarısızlığın sınıfı. `success: false` iken 'no_data' gerçekten
   * satın alım olmadığı anlamına gelir; diğerleri sorgulanamadı demektir.
   * `cancelled: true` bir hata değildir — bu alan boş kalır.
   */
  errorKind?: PurchaseErrorKind;
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
    // Hata yolu DEĞİL: akış aşağıda gerçek configure()'a devam ediyor.
    // Başarısızlık burada bir sonuç değiştirmediği için warn seviyesinde kalır;
    // asıl başlatma hatası aşağıdaki catch'te logger.error olarak raporlanır.
    logger.warn('[purchases] isConfigured() kontrolü başarısız — ilk kurulum varsayılıyor:', err);
  }

  const apiKey = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;

  // EAS Build'de env secret tanimli degilse bos string gelir.
  // Bos key ile Purchases.configure() native crash'e yol acabilir — kesinlikle guard'la.
  if (!apiKey || apiKey.trim() === '') {
    // Odeme sistemi hic baslamiyor demek — bu sessiz kalmamali.
    logger.error(
      '[purchases] RevenueCat API key bulunamadi — SDK baslatilmadi',
      new Error('RC api key missing'),
      {
        code: 'RC_API_KEY_MISSING',
        extra: {
          platform: Platform.OS,
          hint: 'EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY EAS Secrets tanimli mi?',
        },
      },
    );
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
  if (!_initialized) {
    // Eslenme hic olmuyor — satin alim yanlis RC customer'a baglanabilir.
    logger.error(
      '[purchases] identifyUser: RevenueCat baslatilmamis — eslenme atlandi',
      new Error('RC not initialized'),
      { code: 'RC_NOT_INITIALIZED', extra: { fn: 'identifyUser' } },
    );
    return;
  }

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

  if (!_initialized) {
    logger.error(
      '[purchases] getSubscriptionStatus: RevenueCat baslatilmamis',
      new Error('RC not initialized'),
      { code: 'RC_NOT_INITIALIZED', extra: { fn: 'getSubscriptionStatus' } },
    );
    return { ...defaultStatus, errorKind: 'not_initialized' };
  }

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return parseCustomerInfo(customerInfo);
  } catch (err) {
    const errorKind = classifyPurchaseError(err);
    logger.error('[purchases] Abonelik durumu sorgu hatasi', err, {
      code: 'RC_STATUS_FETCH_FAILED',
      extra: { errorKind },
    });
    // isPremium: false donuyoruz ama errorKind ile isaretli — cagiran
    // bunu "free" diye state'e YAZMAMALI.
    return { ...defaultStatus, errorKind };
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
  if (!_initialized) {
    // Listener hic takilmiyor — abonelik yenilenme/expire/cancel olaylari
    // sessizce islenmez.
    logger.error(
      '[purchases] addSubscriptionListener: RevenueCat baslatilmamis',
      new Error('RC not initialized'),
      { code: 'RC_NOT_INITIALIZED', extra: { fn: 'addSubscriptionListener' } },
    );
    return () => {};
  }

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
export async function getOfferings(): Promise<OfferingsResult> {
  if (!_initialized) {
    logger.error(
      '[purchases] getOfferings: RevenueCat baslatilmamis',
      new Error('RC not initialized'),
      { code: 'RC_NOT_INITIALIZED', extra: { fn: 'getOfferings' } },
    );
    return { items: [], errorKind: 'not_initialized' };
  }

  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;

    if (!current) {
      // Paywall satis yapamaz hale gelir — bu bir yapilandirma hatasi.
      logger.error(
        '[purchases] Aktif offering bulunamadi',
        new Error('no current offering'),
        { code: 'RC_NO_ACTIVE_OFFERING' },
      );
      return { items: [], errorKind: 'no_data' };
    }

    return { items: current.availablePackages };
  } catch (err) {
    const errorKind = classifyPurchaseError(err);
    logger.error('[purchases] Offering getirme hatasi', err, {
      code: 'RC_OFFERINGS_FAILED',
      extra: { errorKind },
    });
    return { items: [], errorKind };
  }
}

// ─── Lifetime Offering ──────────────────────────────────────────────────────

/**
 * RevenueCat'ten lifetime_founding offering paketlerini döndürür.
 * Lifetime ürünü ayrı offering'te tutulur — paywall'daki default'tan ayrı.
 * Fallback: default offering'teki lifetime paketini arar.
 */
export async function getLifetimeOffering(): Promise<OfferingsResult> {
  if (!_initialized) {
    logger.error(
      '[purchases] getLifetimeOffering: RevenueCat baslatilmamis',
      new Error('RC not initialized'),
      { code: 'RC_NOT_INITIALIZED', extra: { fn: 'getLifetimeOffering' } },
    );
    return { items: [], errorKind: 'not_initialized' };
  }

  try {
    const offerings = await Purchases.getOfferings();

    // Önce ayrı lifetime offering'i dene
    const lifetimeOffering = offerings.all['lifetime_founding'];
    if (lifetimeOffering?.availablePackages?.length) {
      return { items: lifetimeOffering.availablePackages };
    }

    // Fallback: default offering'teki lifetime paketini bul
    const current = offerings.current;
    if (current) {
      const lifetimePkg = current.availablePackages.filter(
        (p) => p.product.identifier === 'com.chosy.lifetime',
      );
      if (lifetimePkg.length > 0) return { items: lifetimePkg };
    }

    // Lifetime ürünü hiçbir yerde yok. Eskiden buradan "tüm paketler"
    // dönüyordu — lifetime ekranında lifetime OLMAYAN ürünleri 89.99
    // iddiasıyla gösterme riski. Paketler veri kaybı olmasın diye hâlâ
    // dönüyor ama errorKind ile işaretli: çağıran render ETMEMELİ.
    logger.error(
      '[purchases] Lifetime offering bulunamadi',
      new Error('no lifetime offering'),
      { code: 'RC_NO_LIFETIME_OFFERING' },
    );
    return { items: current?.availablePackages ?? [], errorKind: 'no_data' };
  } catch (err) {
    const errorKind = classifyPurchaseError(err);
    logger.error('[purchases] Lifetime offering hatasi', err, {
      code: 'RC_LIFETIME_OFFERINGS_FAILED',
      extra: { errorKind },
    });
    return { items: [], errorKind };
  }
}

// ─── Satın Alma ──────────────────────────────────────────────────────────────

/**
 * Belirtilen paketi satın alır.
 * Paywall'dan çağrılır.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  if (!_initialized) {
    logger.error(
      '[purchases] purchasePackage: RevenueCat baslatilmamis',
      new Error('RC not initialized'),
      { code: 'RC_NOT_INITIALIZED', extra: { fn: 'purchasePackage' } },
    );
    return { success: false, error: 'RevenueCat başlatılmadı', errorKind: 'not_initialized' };
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

    if (!isPremium) {
      // ÖDEME GİTMİŞ OLABİLİR: SDK satın almayı onayladı ama entitlement
      // henüz aktif değil (RC senkron gecikmesi, tipik olarak saniyeler).
      // Bu genel bir satın alma hatası DEĞİL — çağıran kullanıcıya
      // "tekrar dene" değil "işleniyor" demeli, aksi hâlde çift ödeme riski.
      logger.error(
        '[purchases] Satin alma tamamlandi ama entitlement aktif degil',
        new Error('entitlement pending after purchase'),
        {
          code: 'RC_ENTITLEMENT_PENDING',
          extra: {
            packageId: pkg.identifier,
            productId: pkg.product.identifier,
            rcCustomerId: customerInfo.originalAppUserId,
          },
        },
      );
    }

    return {
      success: isPremium,
      customerInfo,
      error: isPremium ? undefined : 'Entitlement aktif değil',
      errorKind: isPremium ? undefined : 'entitlement_pending',
    };
  } catch (err: unknown) {
    // Kullanıcı iptal etti — hata değil, errorKind taşımaz
    if (err && typeof err === 'object' && 'userCancelled' in err && (err as { userCancelled: boolean }).userCancelled) {
      return { success: false, cancelled: true };
    }

    const errorKind = classifyPurchaseError(err);
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
    // K-43: ham RC metni ekrana degil Sentry'ye
    logger.error('[purchases] Satin alma hatasi', err, {
      code: 'RC_PURCHASE_FAILED',
      extra: { errorKind, packageId: pkg.identifier, productId: pkg.product.identifier },
    });
    return { success: false, error: message, errorKind };
  }
}

// ─── Oturum Sıfırlama ────────────────────────────────────────────────────

/**
 * RevenueCat müşteri kimliğini sıfırlar (anonim kullanıcıya döner).
 * Hesap silme akışında çağrılır — on-device entitlement cache'ini temizler.
 * Çağrılmazsa eski abonelik bilgisi cihazda kalır ve yeni hesap premium görünür.
 */
export async function logOutPurchases(): Promise<void> {
  if (!_initialized) {
    // RC cache temizlenmiyor — yeni hesap premium gorunebilir (BUG-002).
    logger.error(
      '[purchases] logOutPurchases: RevenueCat baslatilmamis',
      new Error('RC not initialized'),
      { code: 'RC_NOT_INITIALIZED', extra: { fn: 'logOutPurchases' } },
    );
    return;
  }

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
    logger.error(
      '[purchases] restorePurchases: RevenueCat baslatilmamis',
      new Error('RC not initialized'),
      { code: 'RC_NOT_INITIALIZED', extra: { fn: 'restorePurchases' } },
    );
    return { success: false, error: 'RevenueCat başlatılmadı', errorKind: 'not_initialized' };
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    const isPremium = customerInfo.entitlements.active[RC_ENTITLEMENT_ID] !== undefined;

    if (isPremium) {
      posthogAnalytics.track('restore_completed');
      return { success: true, customerInfo };
    }

    // Sorgu BAŞARILI, gerçekten geri yüklenecek bir şey yok.
    // Ağ hatasından ayrı tutulmalı — çağıran "aboneliğin yok" diyebilir.
    return {
      success: false,
      customerInfo,
      error: 'Geri yüklenecek abonelik bulunamadı',
      errorKind: 'no_data',
    };
  } catch (err) {
    const errorKind = classifyPurchaseError(err);
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
    logger.error('[purchases] Geri yukleme hatasi', err, {
      code: 'RC_RESTORE_FAILED',
      extra: { errorKind },
    });
    // errorKind 'no_data' DEĞİL — çağıran "aboneliğin yok" DEMEMELİ.
    return { success: false, error: message, errorKind };
  }
}