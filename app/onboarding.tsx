/**
 * Onboarding — 5 aşamalı ilk kullanım akışı (Premium Bumble).
 *
 * Aşama 1 (slides): 3 tanıtım slide — Feel it, Swipe it, Save it
 * Aşama 2 (calibration): 6 sorulu Taste Calibration
 * Aşama 3 (reveal): Archetype Reveal animasyonu
 *
 * Akış:
 *   Slide 2 "Continue" → calibration phase
 *   Calibration complete → reveal phase
 *   Reveal "Let's Go" → finishOnboarding() → /(tabs)
 *   Skip (her aşamada) → finishOnboarding()
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { Image } from 'expo-image';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/services/supabase';
import { TasteCalibration, ArchetypeReveal } from '@/components/Onboarding';
import type { CalibrationAnswer } from '@/components/Onboarding';

// ── Sabitler ─────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** gate.tsx ile ayni key — KRITIK */
const ONBOARDING_KEY = 'chosy_onboarded';
const SLIDE_COUNT = 3;

/** Mock film poster URL'leri (TMDb w185) */
const POSTERS = [
  'https://image.tmdb.org/t/p/w185/eCOtqtfvn7mxGCGuBSnapSBgBBP.jpg',
  'https://image.tmdb.org/t/p/w185/aeMuA17vprY3QWlyIRVTiKHqD6z.jpg',
  'https://image.tmdb.org/t/p/w185/5MwkWH9tYHv3mV9OiQ0ZfahtXnj.jpg',
];

// ── Gorsel Bilesenler ────────────────────────────────────────────────────────

/**
 * Sayfa 0 — Violet mood ring: dis glow, kesik orta halka, parlak ic daire.
 */
function MoodRingVisual() {
  return (
    <View style={ringStyles.container}>
      {/* Dis glow halkasi */}
      <View style={ringStyles.outerGlow} />
      {/* Kesik orta halka */}
      <View style={ringStyles.middleRing} />
      {/* Ic daire + sparkle ikon */}
      <View style={ringStyles.innerCircle}>
        <Ionicons name="sparkles" size={36} color={Colors.accentPrimary} />
      </View>
      {/* Dekoratif yildizlar */}
      <Text style={[ringStyles.star, { top: 8, right: 42, fontSize: 13, opacity: 0.85 }]}>✦</Text>
      <Text style={[ringStyles.star, { bottom: 22, right: 34, fontSize: 10, opacity: 0.65 }]}>✦</Text>
      <Text style={[ringStyles.star, { top: 42, left: 4, fontSize: 18, opacity: 0.4 }]}>·</Text>
      <Text style={[ringStyles.star, { bottom: 14, left: 50, fontSize: 10, opacity: 0.55 }]}>✦</Text>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  container: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  outerGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.4)',
    backgroundColor: 'rgba(139,92,246,0.04)',
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 28,
    elevation: 14,
  },
  middleRing: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
    borderStyle: 'dashed',
  },
  innerCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.accentDim,
    borderWidth: 1.5,
    borderColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 18,
    elevation: 10,
  },
  star: {
    position: 'absolute',
    color: Colors.accentPrimary,
  },
});

/**
 * Sayfa 1 — 3 film posteri karuseli: ortadaki buyuk, yanlar kucuk + dondurme.
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

      {/* Merkez poster — violet border */}
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
    height: 230,
    marginBottom: 36,
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
    width: 100,
    height: 150,
    backgroundColor: Colors.bgCard,
  },
  large: {
    width: 140,
    height: 210,
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

/**
 * Sayfa 2 — Koleksiyon goerseli: bookmark ikon + ic ice halkalar.
 */
function CollectionVisual() {
  return (
    <View style={collStyles.container}>
      <View style={collStyles.ring3} />
      <View style={collStyles.ring2} />
      <View style={collStyles.ring1} />
      <View style={collStyles.center}>
        <Ionicons name="bookmark" size={28} color={Colors.gold} />
      </View>
      {/* Film sayisi badge */}
      <View style={collStyles.badge}>
        <Text style={collStyles.badgeText}>12</Text>
      </View>
      {/* Dekoratif noktalar */}
      <Text style={[collStyles.dot, { top: 16, right: 56, fontSize: 8 }]}>●</Text>
      <Text style={[collStyles.dot, { top: 64, right: 8, fontSize: 5 }]}>●</Text>
      <Text style={[collStyles.dot, { bottom: 20, left: 52, fontSize: 6 }]}>●</Text>
    </View>
  );
}

const collStyles = StyleSheet.create({
  container: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  ring3: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.15)',
  },
  ring2: {
    position: 'absolute',
    width: 165,
    height: 165,
    borderRadius: 83,
    borderWidth: 1.5,
    borderColor: 'rgba(212,168,67,0.3)',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  ring1: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1.5,
    borderColor: 'rgba(212,168,67,0.5)',
    backgroundColor: 'rgba(212,168,67,0.05)',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  center: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.goldDim,
    borderWidth: 2,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 22,
    elevation: 12,
  },
  badge: {
    position: 'absolute',
    top: 68,
    right: 52,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  badgeText: {
    color: Colors.textOnAccent,
    fontSize: 12,
    fontWeight: '800',
  },
  dot: {
    position: 'absolute',
    color: Colors.gold,
    opacity: 0.5,
  },
});

// ── Slide Tanimlari ──────────────────────────────────────────────────────────

interface SlideItem {
  key: string;
  renderVisual: () => React.ReactElement;
  stepKey: string;
  titleKey: string;
  descKey: string;
}

const SLIDES: SlideItem[] = [
  {
    key: 'mood',
    renderVisual: () => <MoodRingVisual />,
    stepKey: 'onboarding.step1',
    titleKey: 'onboarding.title1',
    descKey: 'onboarding.desc1',
  },
  {
    key: 'discover',
    renderVisual: () => <PosterCarousel />,
    stepKey: 'onboarding.step2',
    titleKey: 'onboarding.title2',
    descKey: 'onboarding.desc2',
  },
  {
    key: 'collect',
    renderVisual: () => <CollectionVisual />,
    stepKey: 'onboarding.step3',
    titleKey: 'onboarding.title3',
    descKey: 'onboarding.desc3',
  },
];

// ── Pagination Dots ──────────────────────────────────────────────────────────

/**
 * Sayfa gostergesi — aktif: violet 24px genislik, pasif: zinc-500 8px.
 */
function PaginationDots({ current }: { current: number }) {
  return (
    <View style={dotsStyles.row}>
      {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
        <View
          key={i}
          style={[
            dotsStyles.dot,
            i === current ? dotsStyles.active : dotsStyles.inactive,
          ]}
        />
      ))}
    </View>
  );
}

const dotsStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  active: {
    width: 24,
    backgroundColor: Colors.accentPrimary,
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  inactive: {
    width: 8,
    backgroundColor: Colors.tabInactive,
  },
});

// ── Ana Ekran ────────────────────────────────────────────────────────────────

// ─── Onboarding Phase ────────────────────────────────────────────────────────

type Phase = 'slides' | 'calibration' | 'reveal';

/**
 * Onboarding ana bileşeni.
 * Üç aşama: tanıtım slide'ları → taste calibration → archetype reveal.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [phase, setPhase] = useState<Phase>('slides');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [revealArchetypeId, setRevealArchetypeId] = useState<number | null>(null);
  const flatListRef = useRef<FlatList<SlideItem>>(null);
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentSlide(viewableItems[0].index);
      }
    },
    [],
  );

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

  /** Arketip ID'sini Supabase'e arka planda yazar (bloklama olmaz) */
  const saveArchetypeAsync = useCallback((archetypeId: number | null) => {
    if (!archetypeId) return;
    supabase.auth.getUser().then(({ data: authData }) => {
      if (!authData.user) return;
      supabase
        .from('users')
        .update({ archetype_id: archetypeId })
        .eq('id', authData.user.id)
        .then(({ error: dbError }) => {
          if (dbError && __DEV__) {
            // eslint-disable-next-line no-console
            console.error('[Onboarding] archetype_id write failed:', dbError.message);
          }
        });
    });
  }, []);

  /** "Next" → sonraki slide ya da calibration'a geç */
  const handleNext = useCallback(async () => {
    hapticLight();
    if (currentSlide < SLIDE_COUNT - 1) {
      flatListRef.current?.scrollToIndex({ index: currentSlide + 1, animated: true });
    } else {
      // Son slide → calibration başlat
      setPhase('calibration');
    }
  }, [currentSlide]);

  /** Slide'larda skip → doğrudan bitir */
  const handleSlideSkip = useCallback(async () => {
    await finishOnboarding();
  }, [finishOnboarding]);

  /** Calibration tamamlandı → reveal'a geç */
  const handleCalibrationComplete = useCallback(
    (archetypeId: number | null, _answers: CalibrationAnswer[]) => {
      setRevealArchetypeId(archetypeId);
      setPhase('reveal');
      saveArchetypeAsync(archetypeId);
    },
    [saveArchetypeAsync],
  );

  /** Calibration skip → doğrudan bitir */
  const handleCalibrationSkip = useCallback(async () => {
    await finishOnboarding();
  }, [finishOnboarding]);

  const isLast = currentSlide === SLIDE_COUNT - 1;

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
          onFinish={finishOnboarding}
        />
      </View>
    );
  }

  // ── Slides Phase ──
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* Üst: Skip butonu */}
        <View style={styles.topRow}>
          <View style={styles.topSpacer} />
          {!isLast && (
            <TouchableOpacity onPress={handleSlideSkip} activeOpacity={0.7} style={styles.skipBtn}>
              <Text style={styles.skipText}>{t('common.skip')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Sayfa içerikleri */}
        <FlatList<SlideItem>
          ref={flatListRef}
          data={SLIDES}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              {item.renderVisual()}
              <Text style={styles.step}>{t(item.stepKey)}</Text>
              <Text style={styles.title}>{t(item.titleKey)}</Text>
              <Text style={styles.description}>{t(item.descKey)}</Text>
            </View>
          )}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          scrollEventThrottle={16}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig.current}
          style={styles.flatList}
        />

        {/* Alt: pagination dots + buton */}
        <View style={styles.bottom}>
          <PaginationDots current={currentSlide} />

          <View style={styles.buttonWrap}>
            <TouchableOpacity
              onPress={handleNext}
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

  // FlatList
  flatList: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  // Step label
  step: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accentPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  // Title
  title: {
    color: Colors.textWhite,
    fontSize: 28,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 36,
    letterSpacing: 0.2,
  },

  // Description
  description: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 24,
  },

  // Bottom
  bottom: {
    paddingBottom: 8,
  },
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
