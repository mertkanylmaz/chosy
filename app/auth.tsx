/**
 * Auth Screen — Apple/Google ile giriş + anonim misafir devam seçeneği.
 *
 * R-A-1 sonrası bu ekran ZORUNLU DEĞİL. gate.tsx artık buraya yönlendirmiyor;
 * geriye iki giriş yolu kaldı: profile → sign-out ve profile → hesap silme.
 * Giriş, kullanıcının geçmişini kalıcılaştırmak/cihazlar arası taşımak içindir.
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

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// TODO: Google Sign-In şimdilik kaldırıldı — native rebuild sonrası geri eklenecek

import * as AppleAuthentication from 'expo-apple-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import FilmSeridi from '@/components/FilmReelAnimation';
import { supabase } from '@/services/supabase';
import { signInWithApple } from '@/services/authService';
import { identifyUser } from '@/services/purchaseService';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { posthogAnalytics } from '@/services/posthog';

// ─── Tipler ───────────────────────────────────────────────────────────────────

/** Hangi butonun yüklendiğini takip eder */
type LoadingState = 'idle' | 'apple';

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

  useEffect(() => {
    posthogAnalytics.track('auth_prompt_viewed');
  }, []);

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Auth başarısı sonrası routing.
   * Gate'e yönlendirir — onboarding / entry / tabs kararı gate.tsx'te verilir.
   * Anonim→Apple linking akışında `created_at` değişmediğinden `isNewUser`
   * güvenilir değil; tüm routing mantığı gate'te merkezi olarak yönetilir.
   */
  async function handleSuccess(_isNewUser: boolean): Promise<void> {
    void hapticSuccess();

    // RevenueCat'e kullanıcıyı eşle — subscription tracking için kritik
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await identifyUser(user.id);

        // PostHog: identify user with traits
        const { data: profile } = await supabase
          .from('users')
          .select('archetype_id, subscription_tier')
          .eq('id', user.id)
          .single();
        posthogAnalytics.identify(user.id, {
          archetype: profile?.archetype_id ?? null,
          subscription_tier: profile?.subscription_tier ?? 'free',
        });
      }
    } catch {
      // RC/PostHog identify başarısız olsa bile akışı engelleme
    }

    posthogAnalytics.track('auth_prompt_completed', { provider: 'apple' });

    // Gate tüm routing kararlarını verir:
    //  - onboarding tamamlanmadıysa → /onboarding
    //  - entry bugün gösterilmedi → /entry
    //  - aksi hâlde → /(tabs)
    router.replace('/gate' as Href);
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
      } else if (result.error === 'network') {
        setErrorMsg(t('auth.errorNetwork'));
      } else {
        setErrorMsg(t('auth.errorGeneral'));
      }
    } catch (err) {
      logger.error('[auth] Apple handler hatası:', err);
      const msg = (err instanceof Error ? err.message : '').toLowerCase();
      if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout') || msg.includes('offline')) {
        setErrorMsg(t('auth.errorNetwork'));
      } else {
        setErrorMsg(t('auth.errorGeneral'));
      }
    } finally {
      setLoading('idle');
    }
  }

  /**
   * Geri butonu — önceki sayfaya döner (eğer gidecek yer varsa).
   * Gate'ten yönlendirildiyse geri yol yoktur — buton gizlenir.
   */
  function handleBack(): void {
    void hapticLight();
    if (router.canGoBack()) {
      router.back();
    }
    // Gidecek yer yoksa (gate'ten gelindi) — buton pasif kalır
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

      {/* Hero — Dönen film şeritleri animasyonu */}
      <View style={styles.heroSection}>
        <LinearGradient
          // Altın glow — film projektörü atmosferi
          colors={[Colors.goldGlow, 'transparent']}
          style={styles.heroGlow}
          pointerEvents="none"
        />
        <FilmSeridi />
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

        {/* Hata mesajı */}
        {errorMsg !== null && (
          <Text style={styles.errorText}>{errorMsg}</Text>
        )}

      </View>

      {/* R-A-1: auth artık zorunlu değil — giriş, geçmişi cihazlar arasında
          taşımak içindir. Not metni bu ayrımı anlatır. */}
      <View style={styles.skipSection}>
        <Text style={styles.skipNote}>{t('auth.requiredNote')}</Text>

        {/* DEV ONLY: misafir olarak devam — production build'de görünmez.
            Bir bypass değil: auth zorunlu olmadığı için misafir devamın
            dev karşılığı. Prod'daki karşılığı R-A-2'de gelecek. */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.devSkipButton}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.7}
          >
            <Text style={styles.devSkipText}>[ DEV ] Continue as guest</Text>
          </TouchableOpacity>
        )}
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
    width: 44,
    height: 44,
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
    ...Theme.typography.h1,          // Inter Bold 24
    fontSize: 28,                     // override — ekran başlığı biraz büyük
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
  skipButton: {
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
  },
  skipText: {
    ...Theme.typography.h3,           // Inter SemiBold 16 — CTA link için uygun
    color: Colors.accentPrimary,
  },
  skipDisabled: {
    opacity: 0.4,
  },
  skipNote: {
    ...Theme.typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  devSkipButton: {
    marginTop: Theme.spacing.md,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.warning,
    borderStyle: 'dashed',
  },
  devSkipText: {
    color: Colors.warning,
    fontSize: 13,
    fontWeight: '700',
  },
});
