/**
 * Auth Screen — Apple/Google ile giriş + anonim misafir devam seçeneği.
 *
 * Akış:
 *  1. Apple/Google butonuna basılır → authService.signInWithApple/Google
 *  2. Başarılı → /(tabs)
 *     (TODO: setup-profile hazır olduğunda isNewUser → /setup-profile dalı)
 *  3. Skip → /(tabs) (mevcut anonim oturum korunur)
 *
 * Platform notu:
 *  - AppleAuthenticationButton yalnızca iOS'ta render edilir
 *  - Google butonu hem iOS hem Android'de gösterilir
 *
 * Kullanım: profile ekranından "Sign In" butonuyla veya
 *           ileride onboarding akışından navigate edilir.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import * as AppleAuthentication from 'expo-apple-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import Lumi from '@/components/Lumi';
import { signInWithApple, signInWithGoogle } from '@/services/authService';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { logger } from '@/utils/logger';

// ─── Tipler ───────────────────────────────────────────────────────────────────

/** Hangi butonun yüklendiğini takip eder */
type LoadingState = 'idle' | 'apple' | 'google';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Auth sign-in ekranı.
 * Lumi hero + Apple/Google + misafir devam akışı.
 */
export default function AuthScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const [loading, setLoading] = useState<LoadingState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isLoading = loading !== 'idle';

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Auth başarısı sonrası routing.
   * Yeni kullanıcı ise profil kurulum ekranına, mevcut kullanıcı ise feed'e yönlendirir.
   *
   * @param isNewUser - Supabase'den gelen "yeni kayıt mı?" bilgisi
   */
  function handleSuccess(isNewUser: boolean): void {
    void hapticSuccess();
    if (isNewUser) {
      router.replace('/setup-profile' as Href);
    } else {
      router.replace('/(tabs)');
    }
  }

  // ─── Handlers ────────────────────────────────────────────────────────────

  /**
   * Apple ile giriş handler'ı.
   * Yalnızca iOS'ta çağrılır (platform guard butonda).
   */
  async function handleApple(): Promise<void> {
    if (isLoading) return;
    void hapticLight();
    setErrorMsg(null);
    setLoading('apple');

    try {
      const result = await signInWithApple();

      if (result.success) {
        handleSuccess(result.isNewUser);
      } else if (result.error === 'canceled') {
        // Kullanıcı iptal etti — sessizce geç
      } else if (result.error === 'not_available') {
        setErrorMsg(t('auth.errorNotAvailable'));
      } else {
        setErrorMsg(t('auth.errorGeneral'));
      }
    } catch (err) {
      logger.error('[auth] Apple handler hatası:', err);
      setErrorMsg(t('auth.errorGeneral'));
    } finally {
      setLoading('idle');
    }
  }

  /**
   * Google ile giriş handler'ı.
   * configureGoogleSignIn() _layout.tsx'te zaten çağrılmıştır.
   */
  async function handleGoogle(): Promise<void> {
    if (isLoading) return;
    void hapticLight();
    setErrorMsg(null);
    setLoading('google');

    try {
      const result = await signInWithGoogle();

      if (result.success) {
        handleSuccess(result.isNewUser);
      } else if (result.error === 'canceled') {
        // Kullanıcı iptal etti — sessizce geç
      } else if (result.error === 'not_available') {
        setErrorMsg(t('auth.errorNotAvailable'));
      } else {
        setErrorMsg(t('auth.errorGeneral'));
      }
    } catch (err) {
      logger.error('[auth] Google handler hatası:', err);
      setErrorMsg(t('auth.errorGeneral'));
    } finally {
      setLoading('idle');
    }
  }

  /**
   * Misafir devam — anonim oturumu korur, /(tabs)'a yönlendirir.
   */
  function handleSkip(): void {
    void hapticLight();
    router.replace('/(tabs)');
  }

  /**
   * Geri butonu — önceki sayfaya döner (ör. profile ekranı).
   */
  function handleBack(): void {
    void hapticLight();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>

      {/* Geri butonu */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleBack}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={24} color={Colors.textGrey} />
      </TouchableOpacity>

      {/* Hero — Lumi + ortam ışığı */}
      <View style={styles.heroSection}>
        <LinearGradient
          colors={[Colors.accentPrimary + '28', 'transparent']}
          style={styles.heroGlow}
          pointerEvents="none"
        />
        <Lumi size="large" mood="happy" showParticles showGlow />
      </View>

      {/* Metin */}
      <View style={styles.copySection}>
        <Text style={styles.title}>{t('auth.welcomeTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.welcomeSubtitle')}</Text>
      </View>

      {/* Butonlar */}
      <View style={styles.buttonsSection}>

        {/* Apple Sign-In — yalnızca iOS */}
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={Theme.borderRadius.lg}
            style={styles.appleButton}
            onPress={() => void handleApple()}
          />
        )}

        {/* Google Sign-In */}
        <TouchableOpacity
          style={[styles.googleButton, isLoading && styles.buttonDisabled]}
          onPress={() => void handleGoogle()}
          activeOpacity={0.85}
          disabled={isLoading}
        >
          {loading === 'google' ? (
            <ActivityIndicator color={Colors.textWhite} size="small" />
          ) : (
            <View style={styles.googleButtonInner}>
              <Ionicons
                name="logo-google"
                size={20}
                color={Colors.textWhite}
                style={styles.buttonIcon}
              />
              <Text style={styles.googleButtonText}>{t('auth.signInGoogle')}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Hata mesajı */}
        {errorMsg !== null && (
          <Text style={styles.errorText}>{errorMsg}</Text>
        )}

      </View>

      {/* Misafir devam */}
      <View style={styles.skipSection}>
        <TouchableOpacity
          onPress={handleSkip}
          activeOpacity={0.7}
          disabled={isLoading}
          hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
        >
          <Text style={[styles.skipText, isLoading && styles.skipDisabled]}>
            {t('auth.skipAnonymous')}
          </Text>
        </TouchableOpacity>
        <Text style={styles.skipNote}>{t('auth.skipNote')}</Text>
      </View>

    </SafeAreaView>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ─── Geri ───────────────────────────────────────────────────────────────
  backButton: {
    position: 'absolute',
    top: 56,
    left: Theme.spacing.md,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Hero ────────────────────────────────────────────────────────────────
  heroSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    maxHeight: 300,
    marginTop: Theme.spacing.xl,
  },
  heroGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
  },

  // ─── Metin ───────────────────────────────────────────────────────────────
  copySection: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.md,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 30,
    color: Colors.textWhite,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  subtitle: {
    ...Theme.typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Theme.spacing.md,
  },

  // ─── Butonlar ────────────────────────────────────────────────────────────
  buttonsSection: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },

  /** expo-apple-authentication native button — yükseklik sabit */
  appleButton: {
    width: '100%',
    height: 54,
  },

  googleButton: {
    width: '100%',
    height: 54,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.white10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonIcon: {
    marginRight: Theme.spacing.sm,
  },
  googleButtonText: {
    ...Theme.typography.h3,
    color: Colors.textWhite,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  errorText: {
    ...Theme.typography.caption,
    color: Colors.error,
    textAlign: 'center',
    marginTop: Theme.spacing.xs,
  },

  // ─── Misafir devam ───────────────────────────────────────────────────────
  skipSection: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.xl,
    gap: Theme.spacing.xs,
  },
  skipText: {
    ...Theme.typography.body,
    color: Colors.accentPrimary,
    fontWeight: '600',
  },
  skipDisabled: {
    opacity: 0.4,
  },
  skipNote: {
    ...Theme.typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
