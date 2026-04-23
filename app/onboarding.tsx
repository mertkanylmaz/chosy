/**
 * Onboarding — 3 aşamalı ilk kullanım akışı.
 *
 * Aşama 1 (slides): Interaktif swipe demo — tek ekran, kullanıcı Like/Skip ile ilerler
 * Aşama 2 (calibration): 6 sorulu Taste Calibration
 * Aşama 3 (reveal): Archetype Reveal animasyonu
 *
 * Akış:
 *   SwipeDemo Like/Skip/Continue → calibration phase
 *   Calibration complete → reveal phase
 *   Reveal "Let's Go" → finishOnboarding() → /(tabs)
 *   Skip (her aşamada) → finishOnboarding()
 */
import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as StoreReview from 'expo-store-review';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/services/supabase';
import { getAppUserId } from '@/services/watchlist';
import { initUserPreferenceFromCalibration } from '@/services/userProfile';
import { TasteCalibration, ArchetypeReveal } from '@/components/Onboarding';
import type { CalibrationAnswer } from '@/components/Onboarding';
import { buildCalibrationProfile } from '@/components/Onboarding/TasteCalibration/questions';
import type { TasteProfile } from '@/types';

// ── Sabitler ─────────────────────────────────────────────────────────────────

/** gate.tsx ile ayni key — KRITIK */
const ONBOARDING_KEY = 'chosy_onboarded';

/** Poster URL'leri — SwipeDemo merkez karti ve yan kartlar */
const POSTERS = [
  'https://image.tmdb.org/t/p/w185/eCOtqtfvn7mxGCGuBSnapSBgBBP.jpg',
  'https://image.tmdb.org/t/p/w185/aeMuA17vprY3QWlyIRVTiKHqD6z.jpg',
  'https://image.tmdb.org/t/p/w185/5MwkWH9tYHv3mV9OiQ0ZfahtXnj.jpg',
];

// ── Poster Karuseli ──────────────────────────────────────────────────────────

/**
 * 3 film posteri karuseli — ortadaki büyük, yanlar küçük + swipe hint ikonlar.
 */
function PosterCarousel() {
  return (
    <View style={posterStyles.container}>
      {/* Sol poster */}
      <View style={[posterStyles.wrap, posterStyles.left]}>
        <Image
          source={{ uri: POSTERS[0] }}
          style={posterStyles.small}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <View style={posterStyles.dimOverlay} />
      </View>

      {/* Merkez poster — violet border + swipe hints */}
      <View style={[posterStyles.wrap, posterStyles.center]}>
        <Image
          source={{ uri: POSTERS[1] }}
          style={posterStyles.large}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)']}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Swipe hint overlays */}
        <View style={posterStyles.swipeHintRight}>
          <Ionicons name="heart" size={20} color={Colors.swipeRight} />
        </View>
        <View style={posterStyles.swipeHintLeft}>
          <Ionicons name="close" size={20} color={Colors.swipeLeft} />
        </View>
      </View>

      {/* Sag poster */}
      <View style={[posterStyles.wrap, posterStyles.right]}>
        <Image
          source={{ uri: POSTERS[2] }}
          style={posterStyles.small}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <View style={posterStyles.dimOverlay} />
      </View>
    </View>
  );
}

const posterStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 210,
    marginBottom: 28,
  },
  wrap: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  left: {
    transform: [{ rotate: '-5deg' }, { translateY: 18 }],
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 6,
    opacity: 0.75,
  },
  center: {
    zIndex: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.4)',
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 14,
    marginHorizontal: 8,
  },
  right: {
    transform: [{ rotate: '5deg' }, { translateY: 18 }],
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 6,
    opacity: 0.75,
  },
  small: {
    width: 90,
    height: 135,
    backgroundColor: Colors.bgCard,
  },
  large: {
    width: 130,
    height: 195,
    backgroundColor: Colors.bgCard,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.25)',
  },
  swipeHintRight: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(34,197,94,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeHintLeft: {
    position: 'absolute',
    left: 8,
    top: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Onboarding Phase ────────────────────────────────────────────────────────

type Phase = 'slides' | 'calibration' | 'reveal';

/**
 * Onboarding ana bileseni.
 * Uc asama: interaktif swipe demo → taste calibration → archetype reveal.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [phase, setPhase] = useState<Phase>('slides');
  const [revealArchetypeId, setRevealArchetypeId] = useState<number | null>(null);

  /** Onboarding'i tamamla ve (tabs)'a git */
  const finishOnboarding = useCallback(async () => {
    hapticSuccess();
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('[Onboarding] AsyncStorage write failed.');
      }
    }
    router.replace('/(tabs)');
  }, [router]);

  /**
   * P8.2 — Kalibrasyon sonuclarini Supabase'e arka planda yazar.
   *
   * Iki islemi tek seferde yapar:
   *   1. archetype_id → users tablosuna
   *   2. TasteProfile → preferences_vector (cold-start duzeltmesi)
   */
  const saveCalibrationResultsAsync = useCallback(
    async (archetypeId: number | null, profile: TasteProfile) => {
      try {
        const appUserId = await getAppUserId();
        if (!appUserId) return;

        if (archetypeId) {
          const { error: archetypeError } = await supabase
            .from('users')
            .update({ archetype_id: archetypeId })
            .eq('id', appUserId);
          if (archetypeError && __DEV__) {
            // eslint-disable-next-line no-console
            console.error('[Onboarding] archetype_id write failed:', archetypeError.message);
          }
        }

        await initUserPreferenceFromCalibration(appUserId, profile);
      } catch (err) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.error('[Onboarding] saveCalibrationResultsAsync hata:', err);
        }
      }
    },
    [],
  );

  /**
   * SwipeDemo aksiyonu — Like veya Skip butonuna basildiginda.
   * Haptic + calibration asamasina gec.
   */
  const handleSwipeAction = useCallback(() => {
    hapticLight();
    setPhase('calibration');
  }, []);

  /** Calibration tamamlandi → reveal'a gec + P8.2: sonuclari DB'ye yaz */
  const handleCalibrationComplete = useCallback(
    (archetypeId: number | null, answers: CalibrationAnswer[]) => {
      setRevealArchetypeId(archetypeId);
      setPhase('reveal');
      const calibrationProfile = buildCalibrationProfile(answers);
      void saveCalibrationResultsAsync(archetypeId, calibrationProfile);
    },
    [saveCalibrationResultsAsync],
  );

  /**
   * Arketip reveal tamamlandi — App Store review trigger.
   *
   * Bu an kullanici:
   *   1. Arketibini gorup kendini ozel hissetti (aha moment)
   *   2. Arketibine ozel filmlerle karsilasti
   *   3. Uygulamanin degerini deneyimledi
   *
   * iOS/Android rate-limit: 3 popup/yil — sadece bu noktada tetiklenir.
   */
  const handleRevealFinish = useCallback(async () => {
    try {
      const isAvailable = await StoreReview.hasAction();
      if (isAvailable) {
        await StoreReview.requestReview();
      }
    } catch {
      // Sessizce devam et — review hata verse de onboarding bitmeli
    }
    await finishOnboarding();
  }, [finishOnboarding]);

  /** Calibration skip → dogrudan bitir */
  const handleCalibrationSkip = useCallback(async () => {
    await finishOnboarding();
  }, [finishOnboarding]);

  // ── Calibration Phase ──
  if (phase === 'calibration') {
    return (
      <View style={styles.root}>
        <TasteCalibration
          onComplete={handleCalibrationComplete}
          onSkip={handleCalibrationSkip}
        />
      </View>
    );
  }

  // ── Reveal Phase ──
  if (phase === 'reveal') {
    return (
      <View style={styles.root}>
        <ArchetypeReveal
          archetypeId={revealArchetypeId}
          onFinish={handleRevealFinish}
        />
      </View>
    );
  }

  // ── Slides Phase → Interaktif SwipeDemo ──
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* Ust: Skip butonu */}
        <View style={styles.topRow}>
          <View style={styles.topSpacer} />
          <TouchableOpacity onPress={finishOnboarding} activeOpacity={0.7} style={styles.skipBtn}>
            <Text style={styles.skipText}>{t('common.skip')}</Text>
          </TouchableOpacity>
        </View>

        {/* Demo icerik */}
        <View style={styles.demoContent}>
          <PosterCarousel />
          <Text style={styles.demoTitle}>{t('onboarding.swipeTryTitle')}</Text>
          <Text style={styles.demoTagline}>{t('onboarding.swipeTryTagline')}</Text>
          <Text style={styles.demoDesc}>{t('onboarding.swipeTryDesc')}</Text>
        </View>

        {/* Like / Skip aksiyonlari */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionSkip}
            onPress={handleSwipeAction}
            activeOpacity={0.75}
          >
            <Ionicons name="close-circle" size={24} color={Colors.swipeLeft} />
            <Text style={styles.actionSkipText}>{t('onboarding.swipeTrySkip')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionLike}
            onPress={handleSwipeAction}
            activeOpacity={0.75}
          >
            <Ionicons name="heart-circle" size={24} color={Colors.swipeRight} />
            <Text style={styles.actionLikeText}>{t('onboarding.swipeTryLike')}</Text>
          </TouchableOpacity>
        </View>

        {/* Continue butonu */}
        <View style={styles.buttonWrap}>
          <TouchableOpacity
            onPress={handleSwipeAction}
            activeOpacity={0.85}
            style={styles.button}
          >
            <LinearGradient
              colors={[Colors.accentPrimary, Colors.accentHover]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>
                {t('common.continue')}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.textOnAccent} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

// ── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safe: {
    flex: 1,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  topSpacer: {
    flex: 1,
  },
  skipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },

  // Demo icerik alani
  demoContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  demoTitle: {
    color: Colors.textWhite,
    fontSize: 26,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 34,
    letterSpacing: 0.2,
  },
  demoTagline: {
    color: Colors.accentPrimary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: -4,
    textTransform: 'uppercase',
  },
  demoDesc: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 24,
  },

  // Like / Skip aksiyonlari
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  actionSkip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 14,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  actionLike: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: 14,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  actionSkipText: {
    color: Colors.swipeLeft,
    fontSize: 15,
    fontWeight: '600',
  },
  actionLikeText: {
    color: Colors.swipeRight,
    fontSize: 15,
    fontWeight: '600',
  },

  // Continue butonu
  buttonWrap: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  button: {
    borderRadius: 14,
    overflow: 'hidden',
    height: 56,
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: Colors.textOnAccent,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});

declare const __DEV__: boolean;
