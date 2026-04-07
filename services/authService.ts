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
import {
  GoogleSignin,
  statusCodes,
  type SignInResponse,
} from '@react-native-google-signin/google-signin';

import { supabase } from './supabase';
import { logger } from '../utils/logger';

// ─── Google Sign-In Konfigürasyonu ────────────────────────────────────────────

/**
 * Uygulama başlangıcında çağrılmalı (ör. _layout.tsx useEffect içinde).
 * webClientId Supabase Google provider ile eşleşmeli.
 */
export function configureGoogleSignIn(): void {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    scopes: ['profile', 'email'],
    // iOS için ayrı client ID (GoogleService-Info.plist'ten alınır)
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
}

// ─── Tipler ───────────────────────────────────────────────────────────────────

/** Auth işlemi sonuç tipi */
export type AuthResult =
  | { success: true; isNewUser: boolean }
  | { success: false; error: 'canceled' | 'not_available' | 'failed'; message?: string };

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

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { success: false, error: 'failed', message: 'identityToken alınamadı' };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error) {
      logger.error('[authService] Apple signInWithIdToken hatası:', error.message);
      return { success: false, error: 'failed', message: error.message };
    }

    // users tablosundaki auth_provider güncelle (non-blocking)
    void syncAuthProvider('apple');

    // İlk kez giriş mi?
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
export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response: SignInResponse = await GoogleSignin.signIn();

    if (response.type === 'cancelled') {
      return { success: false, error: 'canceled' };
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      return { success: false, error: 'failed', message: 'idToken alınamadı' };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      logger.error('[authService] Google signInWithIdToken hatası:', error.message);
      return { success: false, error: 'failed', message: error.message };
    }

    // users tablosundaki auth_provider güncelle (non-blocking)
    void syncAuthProvider('google');

    // İlk kez giriş mi?
    const isNewUser =
      !!data.user &&
      data.user.created_at !== undefined &&
      Math.abs(new Date(data.user.created_at).getTime() - Date.now()) < 10_000;

    return { success: true, isNewUser };
  } catch (err: unknown) {
    const errCode = (err as { code?: string }).code;

    if (errCode === statusCodes.SIGN_IN_CANCELLED) {
      return { success: false, error: 'canceled' };
    }
    if (errCode === statusCodes.IN_PROGRESS) {
      // Kullanıcı tekrar tıkladı, zaten işlem devam ediyor
      return { success: false, error: 'canceled' };
    }
    if (errCode === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { success: false, error: 'not_available' };
    }

    logger.error('[authService] Google sign-in beklenmedik hata:', err);
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
 * @param avatarUrl - Seçilen avatarı temsil eden emoji string (ör. "🎬")
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
