/**
 * ArchetypeReveal — Kalibrasyon sonucu tam ekran animasyonlu reveal.
 *
 * Stagger animasyon sırası:
 *   0ms   Arkaplan gradient fade
 *   200ms Parçacıklar (yıldızlar)
 *   400ms Emoji dairesi (spring bounce) + hapticSuccess
 *   500ms Glow ring
 *   700ms Arketip adı (FadeInUp)
 *   900ms Açıklama (FadeInUp)
 *   1200ms CTA butonu (FadeInUp) — tıklanabilir hale gelir
 *
 * archetypeId null ise "Mystery Cinephile" fallback gösterilir.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { ARCHETYPES_MAP, getArchetype } from '@/constants/archetypes';
import { styles } from './styles';

// ─── Tip ──────────────────────────────────────────────────────────────────────

interface ArchetypeRevealProps {
  /** 1-12 arketip ID veya null (Mystery Cinephile) */
  archetypeId: number | null;
  /** "Let's Go" butonuna basıldığında */
  onFinish: () => void;
}

// ─── Parçacıklar ──────────────────────────────────────────────────────────────

interface ParticleConfig {
  char: string;
  top: string;
  left: string;
  fontSize: number;
  opacity: number;
}

const PARTICLES: ParticleConfig[] = [
  { char: '✦', top: '12%', left: '15%', fontSize: 14, opacity: 0.7 },
  { char: '·', top: '18%', left: '75%', fontSize: 18, opacity: 0.5 },
  { char: '✧', top: '25%', left: '88%', fontSize: 10, opacity: 0.6 },
  { char: '✦', top: '35%', left: '5%', fontSize: 10, opacity: 0.4 },
  { char: '·', top: '60%', left: '90%', fontSize: 16, opacity: 0.5 },
  { char: '✦', top: '72%', left: '8%', fontSize: 8, opacity: 0.6 },
  { char: '✧', top: '78%', left: '80%', fontSize: 12, opacity: 0.45 },
  { char: '·', top: '85%', left: '22%', fontSize: 14, opacity: 0.35 },
];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Arketip reveal animasyonu.
 * Tüm animasyonlar Reanimated native thread'de çalışır.
 */
export function ArchetypeReveal({ archetypeId, onFinish }: ArchetypeRevealProps) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [ctaEnabled, setCtaEnabled] = useState(false);

  const archetype = archetypeId !== null ? getArchetype(archetypeId) : null;

  // Fallback: Mystery Cinephile
  const colorPrimary = archetype?.colorPrimary ?? Colors.accentPrimary;
  const colorDim = archetype?.colorDim ?? Colors.accentDim;
  const icon = archetype?.icon ?? '✦';
  const nameText = archetype
    ? t(archetype.nameKey)
    : t('onboarding.mysteryType');
  const descText = archetype
    ? t(archetype.descKey)
    : t('onboarding.mysteryDesc');

  // Emoji dairesi animasyonu
  const emojiScale = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.8);

  useEffect(() => {
    // Emoji: 400ms gecikmeli spring bounce
    emojiScale.value = withDelay(
      400,
      withSequence(
        withSpring(1.15, { damping: 8, stiffness: 200 }),
        withSpring(1.0, { damping: 12, stiffness: 200 }),
      ),
    );
    // Glow ring: 500ms
    glowOpacity.value = withDelay(500, withTiming(1, { duration: 400 }));
    glowScale.value = withDelay(500, withSpring(1.0, { damping: 12 }));

    // Haptic: 400ms'de emoji göründüğünde
    const hapticTimer = setTimeout(() => {
      hapticSuccess();
    }, 400);

    // CTA: 1200ms'de tıklanabilir
    const ctaTimer = setTimeout(() => {
      setCtaEnabled(true);
    }, 1200);

    return () => {
      clearTimeout(hapticTimer);
      clearTimeout(ctaTimer);
    };
  }, [emojiScale, glowOpacity, glowScale]);

  const emojiCircleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emojiScale.value }],
  }));

  const glowRingStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const handleFinish = useCallback(() => {
    if (!ctaEnabled) return;
    hapticLight();
    onFinish();
  }, [ctaEnabled, onFinish]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
      {/* Arkaplan gradient */}
      <LinearGradient
        colors={[Colors.background, colorDim as string, Colors.background]}
        locations={[0, 0.4, 1]}
        style={styles.gradient}
      />

      {/* Parçacıklar */}
      {PARTICLES.map((p, i) => (
        <Animated.Text
          key={i}
          entering={FadeInUp.delay(200 + i * 60).duration(800)}
          style={[
            styles.particle,
            {
              top: p.top as `${number}%`,
              left: p.left as `${number}%`,
              fontSize: p.fontSize,
              opacity: p.opacity,
              color: colorPrimary,
            },
          ]}
        >
          {p.char}
        </Animated.Text>
      ))}

      {/* Merkez içerik */}
      <View style={styles.centerContent}>
        {/* Glow ring */}
        <Animated.View
          style={[
            styles.glowRing,
            { borderColor: `${colorPrimary}4D` },
            glowRingStyle,
          ]}
        />

        {/* Emoji dairesi */}
        <Animated.View
          style={[
            styles.emojiCircle,
            { borderColor: colorPrimary, backgroundColor: colorDim as string },
            emojiCircleStyle,
          ]}
        >
          <Text style={styles.emojiText}>{icon}</Text>
        </Animated.View>

        {/* Arketip adı */}
        <Animated.Text
          entering={FadeInUp.delay(700).springify()}
          style={styles.archetypeName}
        >
          {nameText}
        </Animated.Text>

        {/* Açıklama */}
        <Animated.Text
          entering={FadeInUp.delay(900).duration(300)}
          style={styles.archetypeDesc}
        >
          {descText}
        </Animated.Text>
      </View>

      {/* CTA Butonu */}
      <Animated.View
        entering={FadeInUp.delay(1200).springify()}
        style={styles.ctaWrap}
      >
        <TouchableOpacity
          onPress={handleFinish}
          activeOpacity={0.85}
          disabled={!ctaEnabled}
          style={[styles.ctaBtn, !ctaEnabled && styles.ctaBtnDisabled]}
        >
          <LinearGradient
            colors={[Colors.accentPrimary, Colors.accentHover]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>{t('onboarding.letsGo')}</Text>
            <Text style={styles.ctaStar}>★</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
