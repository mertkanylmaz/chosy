/**
 * Onboarding — 4 asamali ilk kullanim akisi.
 *
 * Asama 1 (slides): Interaktif swipe demo — tek ekran, kullanici Like/Skip ile ilerler
 * Asama 2 (calibration): 6 sorulu Taste Calibration
 * Asama 3 (taste_swipe): 6 film cold-start swipe — hybrid recommendation icin signal uretir
 * Asama 4 (reveal): Archetype Reveal animasyonu
 *
 * Akis:
 *   SwipeDemo Like/Skip/Continue → calibration phase
 *   Calibration complete → taste_swipe phase
 *   Taste swipe complete (6 film) → reveal phase
 *   Reveal "Let's Go" → finishOnboarding() → /(tabs)
 *   Skip (calibration asamasinda) → finishOnboarding()
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ViewToken } from 'react-native';
import { Image } from 'expo-image';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

import { Colors } from '@/constants/Colors';
import { logger } from '@/utils/logger';
import { posthogAnalytics } from '@/services/posthog';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/services/supabase';
import { getAppUserId } from '@/services/watchlist';
import { initUserPreferenceFromCalibration } from '@/services/userProfile';
import {
  cacheArchetypeId,
  cacheCalibrationVector,
  enqueueOperation,
} from '@/services/offlineQueue';
import { tasteProfileToVector } from '@/services/vectorEncoder';
import { registerForPushNotifications } from '@/services/pushNotifications';
import ReferralPromptSheet, { useReferralPrompt } from '@/components/ReferralPromptSheet';
import { TasteCalibration, ArchetypeReveal, TasteSwipe } from '@/components/Onboarding';
import type { CalibrationAnswer } from '@/components/Onboarding';
import { buildCalibrationProfile } from '@/components/Onboarding/TasteCalibration/questions';
import type { TasteProfile } from '@/types';

// ── Sabitler ─────────────────────────────────────────────────────────────────

/**
 * Kullanıcıya özgü onboarding key üretir.
 * gate.tsx ile aynı format — KRITIK: `chosy_onboarded_${userId}`
 */
async function getOnboardingKey(): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return `chosy_onboarded_${user.id}`;
  } catch {
    // fallback: global key (auth yoksa, nadir durum)
  }
  return 'chosy_onboarded';
}

/** Poster URL'leri — SwipeDemo merkez karti ve yan kartlar */
const POSTERS = [
  'https://image.tmdb.org/t/p/w185/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg',
  'https://image.tmdb.org/t/p/w185/3bhkrj58Vtu7enYsRolD1fZdja1.jpg',
  'https://image.tmdb.org/t/p/w185/vQWk5YBFWF4bZaofAbv0tShwBvQ.jpg',
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

      {/* Merkez poster — uygulamanin asil swipe kart tasarimina uygun */}
      <View style={[posterStyles.wrap, posterStyles.center]}>
        <Image
          source={{ uri: POSTERS[1] }}
          style={posterStyles.large}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)']}
          style={StyleSheet.absoluteFillObject}
        />
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
    borderRadius: 16,
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 14,
    marginHorizontal: 8,
    borderRadius: 16,
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
});

// ── Intro Slide Verileri ─────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Intro slide ikonu — Ionicons name */
interface IntroSlide {
  titleKey: string;
  taglineKey: string;
  descKey: string;
  icon: 'sparkles' | 'finger-print' | 'tv';
}

const INTRO_SLIDES: IntroSlide[] = [
  {
    titleKey: 'onboarding.slide1Title',
    taglineKey: 'onboarding.slide1Tagline',
    descKey: 'onboarding.slide1Desc',
    icon: 'sparkles',
  },
  {
    titleKey: 'onboarding.slide2Title',
    taglineKey: 'onboarding.slide2Tagline',
    descKey: 'onboarding.slide2Desc',
    icon: 'finger-print',
  },
  {
    titleKey: 'onboarding.slide3Title',
    taglineKey: 'onboarding.slide3Tagline',
    descKey: 'onboarding.slide3Desc',
    icon: 'tv',
  },
];

// ── Onboarding Phase ────────────────────────────────────────────────────────

type Phase = 'slides' | 'calibration' | 'taste_swipe' | 'reveal';

/**
 * Onboarding ana bileseni.
 * Uc asama: interaktif swipe demo → taste calibration → archetype reveal.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [phase, setPhase] = useState<Phase>('slides');
  const [revealArchetypeId, setRevealArchetypeId] = useState<number | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const flatListRef = useRef<FlatList<IntroSlide>>(null);
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;
  const referralPrompt = useReferralPrompt();
  /** Pending navigation — waits for referral prompt dismissal */
  const [pendingNavigate, setPendingNavigate] = useState(false);

  // ── PostHog: onboarding_started (mount) ───────────────────────────────────
  useEffect(() => {
    posthogAnalytics.track('onboarding_started');
  }, []);

  /**
   * AsyncStorage'a onboarding bitisini yazar.
   * finishOnboarding ve handleRevealFinish tarafindan paylasilan yardimci.
   */
  const markOnboardingComplete = useCallback(async () => {
    try {
      const key = await getOnboardingKey();
      await AsyncStorage.setItem(key, '1');
    } catch {
      logger.warn('[Onboarding] AsyncStorage write failed.');
    }

    // DB source of truth — reinstall sonrasi da korunur
    try {
      const appUserId = await getAppUserId();
      if (appUserId) {
        await supabase
          .from('users')
          .update({ onboarding_completed_at: new Date().toISOString() })
          .eq('id', appUserId);
      }
    } catch {
      logger.warn('[Onboarding] DB onboarding_completed_at write failed.');
    }
  }, []);

  /** Onboarding'i tamamla ve mood ekranina git — onboarding zincirini baslat */
  const finishOnboarding = useCallback(async () => {
    hapticSuccess();
    await markOnboardingComplete();
    router.replace({ pathname: '/(tabs)', params: { onboarding: '1' } } as never);
  }, [router, markOnboardingComplete]);

  /**
   * P8.2 — Kalibrasyon sonuclarini Supabase'e arka planda yazar.
   *
   * Iki islemi tek seferde yapar:
   *   1. archetype_id → users tablosuna
   *   2. TasteProfile → preferences_vector (cold-start duzeltmesi)
   */
  /**
   * P8.2 — Kalibrasyon sonuclarini kaydeder (offline-safe).
   *
   * Strateji:
   *   1. AsyncStorage'a hemen yaz (optimistic — UI aninda guncellenir)
   *   2. Supabase'e yazmayi dene
   *   3. Supabase basarisiz olursa offline queue'ya ekle (reconnect'te sync)
   */
  const saveCalibrationResultsAsync = useCallback(
    async (archetypeId: number | null, profile: TasteProfile) => {
      try {
        const appUserId = await getAppUserId();
        if (!appUserId) return;

        // ── 1. Local cache — her durumda (offline bile) ──────────────────
        if (archetypeId) {
          await cacheArchetypeId(archetypeId);
        }

        const vectorJson = JSON.stringify(tasteProfileToVector(profile));
        await cacheCalibrationVector(vectorJson);

        // ── 2. Supabase write — network varsa basarili olur ─────────────
        if (archetypeId) {
          const { error: archetypeError } = await supabase
            .from('users')
            .update({ archetype_id: archetypeId })
            .eq('id', appUserId);

          if (archetypeError) {
            logger.warn('[Onboarding] archetype_id write failed, queuing:', archetypeError.message);
            await enqueueOperation({
              type: 'save_archetype',
              userId: appUserId,
              payload: String(archetypeId),
            });
          }
        }

        // initUserPreferenceFromCalibration icinde Supabase write var
        // Basarisiz olursa vector'u offline queue'ya ekle
        try {
          await initUserPreferenceFromCalibration(appUserId, profile);
        } catch {
          logger.warn('[Onboarding] calibration vector write failed, queuing');
          await enqueueOperation({
            type: 'save_calibration_vector',
            userId: appUserId,
            payload: vectorJson,
          });
        }
      } catch (err) {
        logger.error('[Onboarding] saveCalibrationResultsAsync hata:', err);
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
    posthogAnalytics.track('onboarding_step_completed', { step: 1 });
    setPhase('calibration');
  }, []);

  /** Calibration tamamlandi → taste_swipe'a gec + P8.2: sonuclari DB'ye yaz */
  const handleCalibrationComplete = useCallback(
    (archetypeId: number | null, answers: CalibrationAnswer[]) => {
      posthogAnalytics.track('onboarding_step_completed', { step: 2 });
      setRevealArchetypeId(archetypeId);
      setPhase('taste_swipe');
      const calibrationProfile = buildCalibrationProfile(answers);
      void saveCalibrationResultsAsync(archetypeId, calibrationProfile);
    },
    [saveCalibrationResultsAsync],
  );

  /** Cold-start swipe tamamlandi → reveal'a gec */
  const handleTasteSwipeComplete = useCallback(() => {
    posthogAnalytics.track('onboarding_step_completed', { step: 3, type: 'taste_swipe' });
    setPhase('reveal');
  }, []);

  /**
   * Arketip reveal tamamlandi — mood arama ekranina yonlendir.
   *
   * Onboarding zinciri: reveal → mood (onboarding=1) → discover (5 film) → paywall
   * onboarded flag'i burda yazilir (gate.tsx tekrar onboarding'e yonlendirmesin).
   */
  const handleRevealFinish = useCallback(async () => {
    hapticSuccess();
    posthogAnalytics.track('onboarding_step_completed', { step: 4 });
    posthogAnalytics.track('archetype_revealed', { archetype_id: revealArchetypeId });
    await markOnboardingComplete();

    // Request push permission after value delivery (archetype revealed).
    // Fire-and-forget: rejection is silent — user can enable from Settings later.
    registerForPushNotifications().catch((err) => {
      logger.warn('[Onboarding] Push registration failed (non-blocking):', err);
    });

    // Show referral prompt (one-time) — navigation deferred until dismiss
    setPendingNavigate(true);
    referralPrompt.show();
  }, [markOnboardingComplete, referralPrompt]);

  /** Navigate to mood tab after referral prompt is dismissed (or immediately if already shown) */
  useEffect(() => {
    if (pendingNavigate && !referralPrompt.visible) {
      router.replace({ pathname: '/(tabs)', params: { onboarding: '1' } } as never);
    }
  }, [pendingNavigate, referralPrompt.visible, router]);

  /** Calibration skip → dogrudan bitir */
  const handleCalibrationSkip = useCallback(async () => {
    await finishOnboarding();
  }, [finishOnboarding]);

  // ── Intro Slides hooks (hooks kuralı: conditional return'dan önce) ──
  const isLastSlide = slideIndex === INTRO_SLIDES.length - 1;

  /** Viewability callback — aktif slide index'i günceller */
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setSlideIndex(viewableItems[0].index);
      }
    },
    [],
  );

  /** Scroll bittiğinde index'i güvenle güncelle — onViewableItemsChanged'in ateşlenmediği edge case'ler için */
  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      if (newIndex >= 0 && newIndex < INTRO_SLIDES.length) {
        setSlideIndex(newIndex);
      }
    },
    [],
  );

  /** FlatList'e kesin layout bilgisi ver — ilk render'da boş ekran sorununu önler */
  const getItemLayout = useCallback(
    (_data: unknown, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    [],
  );

  /** Next/Continue butonuna basıldı */
  const handleSlideNext = useCallback(() => {
    hapticLight();
    if (isLastSlide) {
      handleSwipeAction();
    } else {
      flatListRef.current?.scrollToIndex({ index: slideIndex + 1, animated: true });
    }
  }, [isLastSlide, slideIndex, handleSwipeAction]);

  /** Tek bir intro slide render */
  const renderSlide = useCallback(
    ({ item }: { item: IntroSlide }) => (
      <View style={[styles.demoContent, { width: SCREEN_WIDTH }]}>
        <View style={styles.slideIconWrap}>
          <Ionicons name={item.icon} size={64} color={Colors.accentPrimary} />
        </View>
        <Text style={styles.demoTitle}>{t(item.titleKey)}</Text>
        <Text style={styles.demoTagline}>{t(item.taglineKey)}</Text>
        <Text style={styles.demoDesc}>{t(item.descKey)}</Text>
      </View>
    ),
    [t],
  );

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

  // ── Taste Swipe Phase (cold-start) ──
  if (phase === 'taste_swipe') {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <TasteSwipe onComplete={handleTasteSwipeComplete} />
        </SafeAreaView>
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
        <ReferralPromptSheet
          visible={referralPrompt.visible}
          onDismiss={referralPrompt.dismiss}
        />
      </View>
    );
  }

  // ── Slides Phase → 3 Intro Slide + Pagination ──
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* Ust: Skip butonu — slide'ları atla, kalibrasyona git (arketip korunur) */}
        <View style={styles.topRow}>
          <View style={styles.topSpacer} />
          <TouchableOpacity onPress={handleSwipeAction} activeOpacity={0.7} style={styles.skipBtn}>
            <Text style={styles.skipText}>{t('common.skip')}</Text>
          </TouchableOpacity>
        </View>

        {/* Intro Slides — yatay FlatList */}
        <FlatList
          ref={flatListRef}
          data={INTRO_SLIDES}
          renderItem={renderSlide}
          keyExtractor={(_item, index) => `slide-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          getItemLayout={getItemLayout}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onMomentumScrollEnd={onMomentumScrollEnd}
          style={styles.slideList}
        />

        {/* Pagination dots */}
        <View style={styles.dotsRow}>
          {INTRO_SLIDES.map((_, i) => (
            <View
              key={`dot-${i}`}
              style={[
                styles.dot,
                i === slideIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Next / Continue butonu */}
        <View style={styles.buttonWrap}>
          <TouchableOpacity
            onPress={handleSlideNext}
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
                {isLastSlide ? t('common.continue') : t('common.next')}
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

  // Slide FlatList
  slideList: {
    flex: 1,
  },
  // Demo icerik alani (her slide) — height %100 ile FlatList yuksekligini doldurur
  demoContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    alignSelf: 'stretch',
    flex: 1,
  },

  // Slide ikon kapsayici
  slideIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(234,219,198,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },

  // Pagination dots
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    width: 24,
    backgroundColor: Colors.accentPrimary,
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
