/**
 * Splash ekranı — uygulama ilk açılışında gösterilir.
 * Halka animasyonu (Reanimated), altın gradient buton, pagination dots.
 * AsyncStorage 'hasSeenSplash' flag'ine göre davranır.
 */
import React, { useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';

const SPLASH_KEY = 'hasSeenSplash';

// ─── Dönen halka bileşeni ─────────────────────────────────────────────────────

interface RingProps {
  size: number;
  borderColor: string;
  durationMs: number;
  clockwise?: boolean;
}

/**
 * Tek bir dönen halka.
 * @param size - Çap (px)
 * @param borderColor - Kenarlık rengi
 * @param durationMs - Tam tur süresi (ms)
 * @param clockwise - Saat yönünde mi?
 */
function Ring({ size, borderColor, durationMs, clockwise = true }: RingProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(clockwise ? 360 : -360, {
        duration: durationMs,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [rotation, durationMs, clockwise]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        styles.ring,
        animatedStyle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor,
        },
      ]}
    />
  );
}

// ─── Ana ekran ─────────────────────────────────────────────────────────────────

/**
 * Splash ekranı.
 * - Halka animasyonu ve altın gradient buton gösterir.
 * - 'hasSeenSplash' yoksa buton onboarding'e yönlendirir.
 * - Varsa doğrudan (tabs)'a yönlendirir.
 */
export default function SplashScreen() {
  const router = useRouter();

  /** Daha önce görüldüyse direkt (tabs)'a git */
  useEffect(() => {
    AsyncStorage.getItem(SPLASH_KEY).then((val) => {
      if (val) {
        router.replace('/(tabs)' as never);
      }
    });
  }, [router]);

  /** "Get Started" → splash görüldü olarak işaretle, onboarding'e git */
  async function handleGetStarted() {
    await AsyncStorage.setItem(SPLASH_KEY, 'true');
    router.replace('/onboarding');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[Colors.background, Colors.backgroundGradient]}
        style={styles.gradient}
      >
        {/* ─── Logo ─────────────────────────────────────────────────── */}
        <View style={styles.logoSection}>
          <Image
            source={require('../assets/images/icon.png')}
            style={styles.splashLogo}
            contentFit="contain"
          />
        </View>

        {/* ─── Halka animasyonu ─────────────────────────────────────── */}
        <View style={styles.ringsSection}>
          {/* En dış glow halkası */}
          <Ring size={240} borderColor="rgba(212,168,67,0.12)" durationMs={14000} clockwise />
          {/* Dış halka */}
          <Ring size={200} borderColor="rgba(212,168,67,0.25)" durationMs={11000} clockwise={false} />
          {/* Orta halka */}
          <Ring size={155} borderColor="rgba(212,168,67,0.5)" durationMs={8500} clockwise />
          {/* İç halka — en hızlı */}
          <Ring size={106} borderColor="rgba(212,168,67,0.85)" durationMs={6500} clockwise={false} />

          {/* Merkez glow */}
          <View style={styles.lumiGlow} />
          {/* Merkez yıldız ikonu */}
          <View style={styles.centerIcon}>
            <Text style={styles.centerIconText}>✦</Text>
          </View>
        </View>

        {/* ─── Alt metinler ─────────────────────────────────────────── */}
        <View style={styles.textSection}>
          <Text style={styles.taglineItalic}>Describe your mood.</Text>
          <Text style={styles.taglineSub}>Discover matching movies</Text>
        </View>

        {/* ─── Pagination dots ──────────────────────────────────────── */}
        <View style={styles.dotsRow}>
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={[styles.dot, styles.dotInactive]} />
        </View>

        {/* ─── Get Started butonu ───────────────────────────────────── */}
        <TouchableOpacity
          style={styles.buttonWrapper}
          onPress={handleGetStarted}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[Colors.gold, Colors.goldDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Get Started</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </SafeAreaView>
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
    alignItems: 'center',
  },

  // Logo
  logoSection: {
    marginTop: 64,
    alignItems: 'center',
  },
  splashLogo: {
    width: 200,
    height: 200,
    borderRadius: 28,
  },

  // Halkalar
  ringsSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  lumiGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(212,168,67,0.10)',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 10,
  },
  centerIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(212,168,67,0.15)',
    borderWidth: 1.5,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 12,
  },
  centerIconText: {
    color: Colors.gold,
    fontSize: 30,
  },

  // Metinler
  textSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  taglineItalic: {
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
    fontSize: 22,
    color: Colors.textWhite,
    letterSpacing: 0.4,
  },
  taglineSub: {
    marginTop: 10,
    fontSize: 14,
    color: Colors.textGrey,
    letterSpacing: 0.3,
  },

  // Pagination dots
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: Colors.gold,
  },
  dotInactive: {
    backgroundColor: Colors.tabInactive,
  },

  // Buton
  buttonWrapper: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 40,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  button: {
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: Colors.background,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
