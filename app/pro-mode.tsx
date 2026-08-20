/**
 * Pro Mode — mood search'un yeni evi (C.9c).
 *
 * Gauntlet pivotunda mood search Home'dan cikarildi (C.9b) ve kod
 * `components/Home/MoodSearchScreen/` altinda saklandi. Bu route onu Profile
 * altindaki "Pro Mode" girisine baglar ve **ilk kez** bir yetki kapisi koyar.
 *
 * Kapi: `isPremium || legacy_mood_access` — tek kaynak `useProModeAccess`.
 * Grandfathering (M0): relaunch oncesi acilmis hesaplar mood search'u ucretsiz
 * kullanmaya devam eder, paywall onlari atlar.
 *
 * ⚠️ Bu bir stack route'udur, `(tabs)/mood` DEGILDIR. `(tabs)/mood` donmus
 * Discover tab'idir (K-02) ve bu ekranla ilgisi yoktur.
 *
 * Dort durum, hicbiri bos ekran degil (K-42/K-43):
 *   loading — yetki okunuyor
 *   error   — okuma basarisiz; "kilitli" DEGIL, tekrar denenebilir
 *   locked  — yetki yok; tek "Chosy Pro" CTA'si
 *   allowed — MoodSearchScreen
 */
import React, { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

import MoodSearchScreen from '@/components/Home/MoodSearchScreen';
import ContextualPaywall from '@/components/paywalls/ContextualPaywall';
import { useContextualPaywall } from '@/components/paywalls/useContextualPaywall';
import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProModeAccess } from '@/hooks/useProModeAccess';
import { hapticLight } from '@/utils/haptics';
import { posthogAnalytics } from '@/services/posthog';

// ─── Ekran cercevesi ──────────────────────────────────────────────────────────

/**
 * Gate durumlarinin ortak kabugu — geri butonlu baslik + gradient zemin.
 * MoodSearchScreen kendi SafeAreaView'ini kurdugu icin yalnizca gate
 * durumlarinda kullanilir.
 */
function GateShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient
        colors={[Colors.background, Colors.backgroundGradient]}
        style={styles.gradient}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('proMode.title')}</Text>
          {/* Basligi ortalamak icin denge kutusu */}
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.body}>{children}</View>
      </LinearGradient>
    </SafeAreaView>
  );
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function ProModeScreen(): React.JSX.Element {
  const router = useRouter();
  const { t } = useLanguage();
  const { allowed, reason, loading, error } = useProModeAccess();
  const { triggerPaywall, paywallProps } = useContextualPaywall();

  // Ekran acilisi — yalnizca yetki VERILDIGINDE ve durum basina bir kez.
  // `reason === 'legacy'` grandfathering kohortunu isaretler; kohort davranisi
  // olcumsuz kalmasin diye premium'dan ayirt edilerek gonderilir.
  useEffect(() => {
    if (allowed) {
      posthogAnalytics.track('pro_mode_opened', { access_reason: reason });
    }
  }, [allowed, reason]);

  /**
   * Kilitli ekrandaki tek CTA. Orchestrator paywall'i gostermezse (cooldown,
   * A/B karari vb.) sessizce hicbir sey yapmayiz — tam ekran paywall'a duseriz.
   */
  const handleUpgrade = useCallback(async () => {
    void hapticLight();
    posthogAnalytics.track('pro_mode_paywall_shown', { source: 'pro_mode_locked' });

    const shown = await triggerPaywall({ type: 'profile_upgrade' });
    if (!shown) {
      router.push('/paywall' as never);
    }
  }, [triggerPaywall, router]);

  // ── 1) Yetki okunuyor ──────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, animation: 'slide_from_right' }} />
        <StatusBar style="light" backgroundColor={Colors.background} />
        <GateShell>
          <ActivityIndicator size="large" color={Colors.gold} />
        </GateShell>
      </>
    );
  }

  // ── 2) Okuma hatasi — "kilitli" ile karistirilmaz ───────────────────────
  if (error) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, animation: 'slide_from_right' }} />
        <StatusBar style="light" backgroundColor={Colors.background} />
        <GateShell>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textGrey} />
          <Text style={styles.stateTitle}>{t('proMode.errorTitle')}</Text>
          <Text style={styles.stateBody}>{t('proMode.errorBody')}</Text>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}>
            <Text style={styles.secondaryBtnText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </GateShell>
      </>
    );
  }

  // ── 3) Yetki yok — tek Chosy Pro CTA'si ────────────────────────────────
  if (!allowed) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, animation: 'slide_from_right' }} />
        <StatusBar style="light" backgroundColor={Colors.background} />
        <GateShell>
          <Ionicons name="color-wand-outline" size={48} color={Colors.gold} />
          <Text style={styles.stateTitle}>{t('proMode.lockedTitle')}</Text>
          <Text style={styles.stateBody}>{t('proMode.lockedBody')}</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => void handleUpgrade()}
            activeOpacity={0.85}>
            <Ionicons name="sparkles" size={18} color={Colors.textOnAccent} />
            <Text style={styles.primaryBtnText}>{t('profile.chosyPro')}</Text>
          </TouchableOpacity>
        </GateShell>
        <ContextualPaywall {...paywallProps} />
      </>
    );
  }

  // ── 4) Yetki var — mood search ─────────────────────────────────────────
  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: 'slide_from_right' }} />
      <MoodSearchScreen />
    </>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
  },
  headerTitle: {
    color: Colors.textWhite,
    fontSize: Theme.typography.h3.fontSize,
    lineHeight: Theme.typography.h3.lineHeight,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  /** Geri butonuyla ayni genislik — basligi optik olarak ortalar */
  headerSpacer: {
    width: 24,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: 83,
  },
  stateTitle: {
    color: Colors.textWhite,
    fontSize: Theme.typography.h2.fontSize,
    lineHeight: Theme.typography.h2.lineHeight,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  stateBody: {
    color: Colors.textGrey,
    fontSize: Theme.typography.body.fontSize,
    lineHeight: Theme.typography.body.lineHeight,
    textAlign: 'center',
    maxWidth: 300,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.accentPrimary,
  },
  primaryBtnText: {
    color: Colors.textOnAccent,
    fontSize: Theme.typography.body.fontSize,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.white10,
  },
  secondaryBtnText: {
    color: Colors.textWhite,
    fontSize: Theme.typography.body.fontSize,
    fontWeight: '600',
  },
});
