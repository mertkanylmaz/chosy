/**
 * Auth Service — Apple ve Google sosyal kimlik doğrulaması.
 *
 * Akış:
 *   1. Kullanıcı Apple/Google butonuna basar (auth.tsx)
 *   2. Native provider'dan idToken alınır
 *   3. supabase.auth.signInWithIdToken ile oturum açılır
 *   4. Anonim kullanıcılar için Supabase "automatic anon linking" ile
 *      mevcut user_id korunur (Dashboard → Auth → Enable anonymous sign-ins
 *      + Link existing identity when email already exists etkinleştirilmeli)
 *   5. users tablosuna auth_provider güncellenir
 *
 * Konfigürasyon gereksinimleri:
 *   - EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID  : Google Cloud Console → OAuth 2.0 client (Web)
 *   - EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID  : Google Cloud Console → OAuth 2.0 client (iOS)
 *   - Supabase Dashboard → Authentication → Providers → Apple: etkin
 *   - Supabase Dashboard → Authentication → Providers → Google: etkin
 */

import * as AppleAuthentication from 'expo-apple-authentication';
import * as ExpoCrypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import * as Sentry from '@sentry/react-native';

import { supabase } from './supabase';
import { posthogAnalytics } from './posthog';
import { logOutPurchases } from './purchaseService';
import { clearQuotaCache } from './quotaEngine';
import { getAppUserId } from './auth-utils';
import { logger } from '../utils/logger';

// ─── Google Sign-In (WebBrowser OAuth) ───────────────────────────────────────
//
// @react-native-google-signin/google-signin yerine Supabase OAuth + expo-web-browser
// kullanılır. Bu yaklaşım native build gerektirmez; Expo Go ve dev client'ta çalışır.
//
// Akış:
//   1. supabase.auth.signInWithOAuth → Supabase'den Google login URL'i al
//   2. WebBrowser.openAuthSessionAsync → tarayıcıda Google ile giriş yap
//   3. Supabase callback → uygulamaya redirect
//   4. exchangeCodeForSession → PKCE kodu oturumaçevir
//
// Gereksinim:
//   - Supabase Dashboard → Auth → URL Config → "chosy://" Redirect URLs'e eklenmeli
//   - Google Cloud Console → OAuth Credentials → Authorized redirect URI:
//     https://[project-id].supabase.co/auth/v1/callback (Supabase'de Google aktifken otomatik eklenir)

/**
 * Google Sign-In konfigürasyonu — WebBrowser OAuth yaklaşımında gerekli değil.
 * _layout.tsx uyumluluğu için korunur (no-op).
 */
export function configureGoogleSignIn(): void {
  // WebBrowser OAuth flow konfigürasyon gerektirmez.
}

// ─── Tipler ───────────────────────────────────────────────────────────────────

/** Auth işlemi sonuç tipi */
export type AuthResult =
  | { success: true; isNewUser: boolean }
  | { success: false; error: 'canceled' | 'not_available' | 'network' | 'failed'; message?: string };

/**
 * Hata mesajından network hatası olup olmadığını tespit eder.
 * Supabase, Apple SDK ve fetch kaynaklı hatalar için ortak kontrol.
 */
function isNetworkError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('internet') ||
    msg.includes('offline') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('fetch') ||
    msg.includes('dns') ||
    msg.includes('econnrefused') ||
    msg.includes('could not connect') ||
    msg.includes('no connection')
  );
}

// ─── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────

/**
 * Mevcut kullanıcının anonim olup olmadığını kontrol eder.
 * Supabase anonymous sign-in ile giriş yapılmışsa `is_anonymous: true` döner.
 *
 * @returns Kullanıcı anonimse true, sosyal auth ile giriş yapmışsa false
 */
export async function isCurrentUserAnonymous(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.is_anonymous ?? true;
  } catch {
    return true;
  }
}

/**
 * Apple Sign-In'den gelen ismi users.display_name alanina yazar.
 * Yalnizca display_name henuz NULL ise gunceller — var olan ismi silmez.
 * Apple, ismi yalnizca ilk authorization'da token'a gomer; sonrakinde gelmez.
 *
 * @param name - credential.fullName'den turetilmis tam ad
 */
async function syncDisplayName(name: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('users')
      .update({ display_name: name })
      .eq('auth_id', user.id)
      .is('display_name', null); // Kullanici daha once isim koyduysa ezme

    if (error) {
      logger.warn('[authService] syncDisplayName guncelleme hatasi:', error.message);
    }
  } catch (err) {
    logger.error('[authService] syncDisplayName beklenmedik hata:', err);
  }
}

/**
 * Sosyal auth tamamlandıktan sonra users tablosundaki auth_provider alanını günceller.
 * Hata durumunda log bırakır; üst katmana yayılmaz (non-blocking).
 *
 * @param provider - 'apple' | 'google'
 */
async function syncAuthProvider(provider: 'apple' | 'google'): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from('users')
      .update({ auth_provider: provider })
      .eq('auth_id', user.id);

    if (error) {
      logger.warn('[authService] syncAuthProvider güncelleme hatası:', error.message);
    }
  } catch (err) {
    logger.error('[authService] syncAuthProvider beklenmedik hata:', err);
  }
}

// ─── Apple Sign-In ────────────────────────────────────────────────────────────

// ⚠️ SUPABASE DASHBOARD GEREKSİNİMİ (tek seferlik kurulum):
//   Supabase Dashboard → Authentication → Providers → Apple
//   "Authorized Client IDs" alanına "com.chosy.ai" ekle.
//   Bu olmadan Supabase, Apple token'ının aud alanını ("com.chosy.ai")
//   reddeder → "Unacceptable audience in id_token" hatası alınır.

/**
 * Apple Sign-In için kriptografik nonce çifti üretir.
 *
 * Güvenlik gereği:
 *  - Apple native SDK'ya hashedNonce gönderilir (token'a gömülür)
 *  - Supabase'e rawNonce gönderilir (hash'i doğrular)
 *  - İkisi uyuşmazsa Supabase token'ı reddeder → replay attack önlenir
 *
 * @returns rawNonce (Supabase'e) ve hashedNonce (Apple'a)
 */
async function generateAppleNonce(): Promise<{ rawNonce: string; hashedNonce: string }> {
  // 16 byte kriptografik rastgele → hex string
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  const rawNonce = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

  const hashedNonce = await ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  return { rawNonce, hashedNonce };
}

/**
 * Apple ile oturum açar (yalnızca iOS).
 *
 * Anonim kullanıcılar için Supabase'in automatic linking özelliği mevcut
 * user_id'yi korur; watchlist/swipe/session verileri kaybolmaz.
 *
 * @returns AuthResult — başarı veya hata detayı
 */
export async function signInWithApple(): Promise<AuthResult> {
  try {
    // iOS cihazda Apple Sign-In kullanılabilir mi?
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      return { success: false, error: 'not_available' };
    }

    // Nonce üret — Apple token'ına gömülür, Supabase doğrular
    const { rawNonce, hashedNonce } = await generateAppleNonce();

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce, // Apple token'ına hash gömülür
    });

    if (!credential.identityToken) {
      return { success: false, error: 'failed', message: 'identityToken alinamadi' };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce, // Supabase hash'i token'daki ile karsilastirir
    });

    if (error) {
      logger.error('[authService] Apple signInWithIdToken hatası:', error.message);
      if (isNetworkError(error)) {
        return { success: false, error: 'network', message: error.message };
      }
      return { success: false, error: 'failed', message: error.message };
    }

    // users tablosundaki auth_provider guncelle (non-blocking)
    void syncAuthProvider('apple');

    // Apple ismi: yalnizca ILK authorization'da credential'da gelir.
    // DB'ye yazilmazsa bir sonraki giriste kaybedilir.
    const givenName = credential.fullName?.givenName ?? '';
    const familyName = credential.fullName?.familyName ?? '';
    const fullAppleName = [givenName, familyName].filter(Boolean).join(' ').trim();
    if (fullAppleName) {
      void syncDisplayName(fullAppleName);
    }

    // Ilk kez giris mi?
    const isNewUser =
      !!data.user &&
      data.user.created_at !== undefined &&
      Math.abs(new Date(data.user.created_at).getTime() - Date.now()) < 10_000;

    return { success: true, isNewUser };
  } catch (err: unknown) {
    // Kullanıcı dialog'u kapattı
    if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
      return { success: false, error: 'canceled' };
    }
    // Network hatası — offline veya DNS çözülemedi
    if (isNetworkError(err)) {
      logger.warn('[authService] Apple sign-in network hatası:', err);
      return { success: false, error: 'network' };
    }
    logger.error('[authService] Apple sign-in beklenmedik hata:', err);
    return {
      success: false,
      error: 'failed',
      message: err instanceof Error ? err.message : 'Bilinmeyen hata',
    };
  }
}

// ─── Google Sign-In ───────────────────────────────────────────────────────────

/**
 * Google ile oturum açar (iOS ve Android).
 *
 * Anonim kullanıcılar için Supabase'in automatic linking özelliği mevcut
 * user_id'yi korur; watchlist/swipe/session verileri kaybolmaz.
 *
 * configureGoogleSignIn() daha önce çağrılmış olmalı.
 *
 * @returns AuthResult — başarı veya hata detayı
 */
/**
 * Google ile oturum açar — Supabase OAuth + WebBrowser akışı.
 *
 * Native build gerektirmez. Expo Go ve dev client'ta çalışır.
 * Anonim kullanıcılar için Supabase'in automatic linking özelliği mevcut
 * user_id'yi korur; watchlist/swipe/session verileri kaybolmaz.
 *
 * @returns AuthResult — başarı veya hata detayı
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    // Uygulama scheme'ine göre redirect URI oluştur
    // Dev client: chosy:// | Expo Go: exp://...
    const redirectTo = Linking.createURL('/');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,   // Tarayıcıyı biz açıyoruz
      },
    });

    if (error || !data.url) {
      logger.error('[authService] Google OAuth URL alınamadı:', error?.message);
      return { success: false, error: 'failed', message: error?.message };
    }

    // Supabase'in ürettiği Google login URL'ini tarayıcıda aç
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type === 'success') {
      // PKCE: auth kodunu oturuma çevir
      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);

      if (sessionError) {
        logger.error('[authService] Google session exchange hatası:', sessionError.message);
        return { success: false, error: 'failed', message: sessionError.message };
      }

      // users tablosundaki auth_provider güncelle (non-blocking)
      void syncAuthProvider('google');

      // İlk kez giriş mi?
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const isNewUser = user
        ? Math.abs(new Date(user.created_at).getTime() - Date.now()) < 10_000
        : false;

      return { success: true, isNewUser };
    }

    // Kullanıcı tarayıcıyı kapattı
    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { success: false, error: 'canceled' };
    }

    return { success: false, error: 'failed' };
  } catch (err) {
    logger.error('[authService] Google OAuth beklenmedik hata:', err);
    return {
      success: false,
      error: 'failed',
      message: err instanceof Error ? err.message : 'Bilinmeyen hata',
    };
  }
}

// ─── Profile Update ───────────────────────────────────────────────────────────

/**
 * Yeni kayıt olan kullanıcının profil bilgilerini günceller.
 * setup-profile.tsx ekranı tarafından çağrılır.
 *
 * Mevcut `users` satırını auth_id ile bulur; username ve avatar_url alanlarını yazar.
 *
 * @param username - Kullanıcının seçtiği takma ad (2-20 alfanümerik karakter)
 * @param avatarUrl - Seçilen avatar'ın id string'i (ör. "clapperboard"); AvatarIcons tablosundan çözülür
 * @returns Başarı durumu ve opsiyonel hata mesajı
 */
export async function updateUserProfile(
  username: string,
  avatarUrl: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'no_user' };
    }

    const { error } = await supabase
      .from('users')
      .update({ username, avatar_url: avatarUrl })
      .eq('auth_id', user.id);

    if (error) {
      logger.error('[authService] updateUserProfile güncelleme hatası:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    logger.error('[authService] updateUserProfile beklenmedik hata:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Bilinmeyen hata',
    };
  }
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

/**
 * Mevcut oturumu kapatır.
 * _layout.tsx'teki listener otomatik yeni anonim oturum açar (skip akışı).
 */
export async function signOut(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      logger.error('[authService] Sign out hatası:', error.message);
    }
  } catch (err) {
    logger.error('[authService] signOut beklenmedik hata:', err);
  }
}

// ─── Delete Account ───────────────────────────────────────────────────────────

/** deleteAccount sonuç tipi */
export type DeleteAccountResult =
  | { success: true }
  | {
      success: false;
      /**
       * `partial_failure` — veri silindi ama auth.users kaydi ayakta kaldi
       * (Edge Function HTTP 207). Oturum KAPATILMAZ: ayni token'la yapilan
       * ikinci cagri "users satiri yok" dalina duser ve auth kaydini siler.
       */
      error: 'not_authenticated' | 'server_error' | 'partial_failure' | 'network_error';
      message?: string;
    };

/**
 * Kullanıcının tüm verilerini ve auth kaydını kalıcı olarak siler.
 *
 * App Store zorunluluğu — GDPR & Apple/Google hesap silme politikası.
 *
 * Akış:
 *   1. Supabase JWT al
 *   2. Edge Function `delete-account` çağır (servis rol yetkisi gerekli)
 *   3. Edge function: subscriptions + mood_searches + users (cascade) + auth.users siler
 *   4. Client: RC logout + PostHog/Sentry reset + signOut + yerel session temizle
 *
 * @returns Başarı durumu ve opsiyonel hata detayı
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  try {
    // Mevcut session token'ı al
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: 'not_authenticated' };
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
    const functionUrl = `${supabaseUrl}/functions/v1/delete-account`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
    });

    // ── HTTP 207: kismi basari — HATA sayilir ────────────────────────────
    // Onceki kod `!response.ok && status !== 207` yaziyordu. 207 zaten 2xx
    // oldugu icin `response.ok` true; kosul hicbir zaman girmiyordu ve
    // auth.users silinemedigi halde client "hesap silindi" gosteriyordu
    // (K-16 App Review blocker). Artik acikca basarisizlik.
    if (response.status === 207) {
      const body = await response.json().catch(() => ({}));
      const warning = (body as { warning?: string }).warning ?? 'auth_user_delete_failed';
      logger.error('[authService] deleteAccount kismi basari (207):', warning, { skipBridge: true });
      Sentry.captureMessage(`delete-account partial failure: ${warning}`, 'error');
      return { success: false, error: 'partial_failure', message: warning };
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      logger.error('[authService] deleteAccount edge function hatası:', body, {
        skipBridge: true,
        extra: { status: response.status },
      });
      Sentry.captureMessage(
        `delete-account failed: HTTP ${response.status}`,
        'error',
      );
      return {
        success: false,
        error: 'server_error',
        message: (body as { error?: string }).error ?? `HTTP ${response.status}`,
      };
    }

    // ── RevenueCat müşteri kimliğini sıfırla ─────────────────────────────
    // Çağrılmazsa on-device entitlement cache kalır → yeni hesap premium görünür (BUG-002)
    await logOutPurchases();

    // ── AsyncStorage quota cache'ini temizle ────────────────────────────
    // Eski kullanıcının kota sayaçları cihazda kalmasın
    const appUserId = await getAppUserId();
    if (appUserId) {
      await clearQuotaCache(appUserId);
    }

    // ── Analitik kimliklerini sifirla ────────────────────────────────────
    // Silinen kullanicinin distinct_id'si cihazda kalirsa sonraki (anonim)
    // oturumun event'leri silinmis kullaniciya baglanir. reset() yeni bir
    // anonim distinct_id uretir. Sunucu tarafi PostHog silme islemi bu turun
    // kapsami disinda (backlog).
    posthogAnalytics.reset();
    Sentry.setUser(null);

    // Tüm veri silindi — yerel oturumu kapat
    await supabase.auth.signOut();
    logger.log('[authService] Hesap silindi, RC + analitik sıfırlandı, oturum kapatıldı.');

    return { success: true };
  } catch (err) {
    logger.error('[authService] deleteAccount beklenmedik hata:', err);
    return {
      success: false,
      error: 'network_error',
      message: err instanceof Error ? err.message : 'Bilinmeyen hata',
    };
  }
}
