/**
 * Onboarding ekranı — 3 sayfalı FlatList tabanlı ilk kullanım akışı.
 *
 * Sayfa 0: Mood      — Altın halka illüstrasyonu + "Describe your mood."
 * Sayfa 1: Discover  — 3 film posteri karuseli + "Discover matching movies."
 * Sayfa 2: AI        — Spiral/halka görsel + "AI-powered recommendations"
 *
 * Son sayfadan sonra AsyncStorage flag set edilir, (tabs)'a navigate edilir.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { Typography, Radius, Shadows } from '@/constants/theme';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ONBOARDING_KEY = 'moodflix_onboarding_done';
const SLIDE_COUNT = 3;

/** Mock film poster URL'leri (TMDb w185) */
const POSTERS = [
  'https://image.tmdb.org/t/p/w185/eCOtqtfvn7mxGCGuBSnapSBgBBP.jpg',
  'https://image.tmdb.org/t/p/w185/aeMuA17vprY3QWlyIRVTiKHqD6z.jpg',
  'https://image.tmdb.org/t/p/w185/5MwkWH9tYHv3mV9OiQ0ZfahtXnj.jpg',
];

// ─── Görsel Bileşenler ────────────────────────────────────────────────────────

/**
 * Sayfa 0 — Altın halka illüstrasyonu: dış glow, kesik orta halka, parlak iç daire.
 */
function MoodRingVisual() {
  return (
    <View style={ringStyles.container}>
      {/* Dış glow halkası */}
      <View style={ringStyles.outerGlow} />
      {/* Kesik orta halka */}
      <View style={ringStyles.middleRing} />
      {/* İç daire + yıldız ikon */}
      <View style={ringStyles.innerCircle}>
        <Text style={ringStyles.innerIcon}>✦</Text>
      </View>
      {/* Yıldız süslemeleri */}
      <Text style={[ringStyles.star, { top: 8, right: 42, fontSize: 13, opacity: 0.85 }]}>★</Text>
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
    borderColor: 'rgba(212,168,67,0.6)',
    backgroundColor: 'rgba(212,168,67,0.04)',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 28,
    elevation: 14,
  },
  middleRing: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.28)',
    borderStyle: 'dashed',
  },
  innerCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(212,168,67,0.14)',
    borderWidth: 1.5,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 18,
    elevation: 10,
  },
  innerIcon: {
    color: Colors.gold,
    fontSize: 38,
  },
  star: {
    position: 'absolute',
    color: Colors.gold,
  },
});

/**
 * Sayfa 1 — 3 film posteri karuseli: ortadaki büyük (140×210), yanlar küçük (100×150) + döndürme.
 */
function PosterCarousel() {
  return (
    <View style={posterStyles.container}>
      {/* Sol poster — -5deg */}
      <View style={[posterStyles.wrap, posterStyles.left]}>
        <Image
          source={{ uri: POSTERS[0] }}
          style={posterStyles.small}
          resizeMode="cover"
        />
        <View style={posterStyles.dimOverlay} />
      </View>

      {/* Merkez poster — büyük, altın border */}
      <View style={[posterStyles.wrap, posterStyles.center]}>
        <Image
          source={{ uri: POSTERS[1] }}
          style={posterStyles.large}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)']}
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      {/* Sağ poster — +5deg */}
      <View style={[posterStyles.wrap, posterStyles.right]}>
        <Image
          source={{ uri: POSTERS[2] }}
          style={posterStyles.small}
          resizeMode="cover"
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
    opacity: 0.78,
  },
  center: {
    zIndex: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(212,168,67,0.45)',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
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
    opacity: 0.78,
  },
  small: {
    width: 100,
    height: 150,
    backgroundColor: Colors.card,
  },
  large: {
    width: 140,
    height: 210,
    backgroundColor: Colors.card,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,14,39,0.28)',
  },
});

/**
 * Sayfa 2 — AI işlem spirali: iç içe halkalar + parlak merkez nokta.
 */
function AIRingVisual() {
  return (
    <View style={aiStyles.container}>
      <View style={aiStyles.ring3} />
      <View style={aiStyles.ring2} />
      <View style={aiStyles.ring1} />
      <View style={aiStyles.center}>
        <Text style={aiStyles.centerIcon}>✦</Text>
      </View>
      <Text style={[aiStyles.dot, { top: 16, right: 56, fontSize: 8 }]}>●</Text>
      <Text style={[aiStyles.dot, { top: 64, right: 8, fontSize: 5 }]}>●</Text>
      <Text style={[aiStyles.dot, { bottom: 20, left: 52, fontSize: 6 }]}>●</Text>
      <Text style={[aiStyles.dot, { bottom: 46, right: 20, fontSize: 11 }]}>★</Text>
    </View>
  );
}

const aiStyles = StyleSheet.create({
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
    borderColor: 'rgba(212,168,67,0.18)',
  },
  ring2: {
    position: 'absolute',
    width: 165,
    height: 165,
    borderRadius: 83,
    borderWidth: 1.5,
    borderColor: 'rgba(212,168,67,0.38)',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  ring1: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1.5,
    borderColor: 'rgba(212,168,67,0.65)',
    backgroundColor: 'rgba(212,168,67,0.05)',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 10,
  },
  center: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(212,168,67,0.18)',
    borderWidth: 2,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 22,
    elevation: 12,
  },
  centerIcon: {
    color: Colors.gold,
    fontSize: 30,
  },
  dot: {
    position: 'absolute',
    color: Colors.gold,
    opacity: 0.6,
  },
});

// ─── Slide Tanımları ──────────────────────────────────────────────────────────

interface SlideItem {
  key: string;
  renderVisual: () => React.ReactElement;
  title: string;
  description: string;
}

const SLIDES: SlideItem[] = [
  {
    key: 'mood',
    renderVisual: () => <MoodRingVisual />,
    title: 'Describe your mood.',
    description: 'Tell us how you feel and we\u2019ll find the perfect movie for you.',
  },
  {
    key: 'discover',
    renderVisual: () => <PosterCarousel />,
    title: 'Discover matching movies.',
    description: 'Swipe through handpicked films that match your exact emotional state.',
  },
  {
    key: 'ai',
    renderVisual: () => <AIRingVisual />,
    title: 'AI-powered recommendations.',
    description: 'Our AI maps your mood to 12 emotional dimensions for perfect matches.',
  },
];

// ─── Pagination Dots ──────────────────────────────────────────────────────────

/**
 * Sayfa göstergesi noktaları — aktif: altın 24px genişlik, pasif: gri 8px.
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
    backgroundColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 4,
  },
  inactive: {
    width: 8,
    backgroundColor: '#6A6270',
  },
});

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

/**
 * Onboarding ana bileşeni.
 * Horizontal FlatList ile 3 sayfa — son sayfadan sonra (tabs)'a yönlendirir.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
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

  /** "Next" basıldığında sonraki sayfaya git ya da onboarding'i bitir. */
  const handleNext = useCallback(async () => {
    if (currentSlide < SLIDE_COUNT - 1) {
      flatListRef.current?.scrollToIndex({ index: currentSlide + 1, animated: true });
    } else {
      try {
        await AsyncStorage.setItem(ONBOARDING_KEY, '1');
      } catch {
        if (__DEV__) {
          console.error('[Onboarding] AsyncStorage write failed.');
        }
      }
      router.replace('/(tabs)');
    }
  }, [currentSlide, router]);

  const isLast = currentSlide === SLIDE_COUNT - 1;

  return (
    <LinearGradient
      colors={[Colors.background, Colors.backgroundGradient]}
      style={styles.gradient}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* Üst sabit "Onboarding" etiketi */}
        <Text style={styles.topLabel}>Onboarding</Text>
        {/* Altın accent çizgisi */}
        <View style={styles.topLabelUnderline} />

        {/* Sayfa içerikleri */}
        <FlatList<SlideItem>
          ref={flatListRef}
          data={SLIDES}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              {item.renderVisual()}
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>
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
              style={[styles.button, Shadows.button]}>
              <LinearGradient
                colors={[Colors.gold, Colors.goldDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}>
                <Text style={styles.buttonText}>
                  {isLast ? 'Get Started' : 'Next'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  topLabel: {
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.gold,
    fontSize: 22,
    textAlign: 'center',
    paddingTop: 12,
    paddingBottom: 4,
    letterSpacing: 0.5,
  },
  topLabelUnderline: {
    width: 40,
    height: 2,
    backgroundColor: Colors.gold,
    alignSelf: 'center',
    borderRadius: 1,
    marginBottom: 4,
    opacity: 0.6,
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    color: Colors.textWhite,
    fontSize: 24,
    fontFamily: Typography.displayFont,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 32,
    letterSpacing: 0.2,
  },
  description: {
    color: Colors.textGrey,
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 23,
  },
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
    height: 58,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: Colors.background,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.4,
    fontFamily: Typography.displayFont,
  },
});

declare const __DEV__: boolean;
