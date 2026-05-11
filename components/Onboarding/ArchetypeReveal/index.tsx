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

import React, { useCallback, useEffect, useState } from 'react';
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
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { getArchetype } from '@/constants/archetypes';
import { styles } from './styles';

// ─── Tip ──────────────────────────────────────────────────────────────────────

interface ArchetypeRevealProps {
  /** 1-12 arketip ID veya null (Mystery Cinephile) */
  archetypeId: number | null;
  /** "Let's Go" butonuna basıldığında */
  onFinish: () => void;
}

// ─── Arketip bazli film posterleri ───────────────────────────────────────────

/**
 * Her sinefil arketipine ozel 3 filmlik poster seti.
 * Skorlama mantigi ile tutarli: her arketip kendi "imza" filmlerini gosterir.
 * TMDB w185 poster yollari — expo-image cache ile yuklenir.
 *
 * 1  Adrenalin Bagimlisi — aksiyon/gerilim (Mad Max, Dark Knight, Inception)
 * 2  Zihin Bukucu — karmasik/dogrusal olmayan (Inception, Fight Club, Parasite)
 * 3  Gozyasi Hirsizi — duygusal/dram (Whiplash, Shawshank, La La Land)
 * 4  Gulumseme Avcisi — neşeli/hafif (Shawshank + roster filmleri)
 * 5  Umutsuz Romantik — ask/tath-ac (La La Land, Whiplash + roster)
 * 6  Karanlik Yolcu — karanlik/trajik (Fight Club, Parasite, Dark Knight)
 * 7  Gorsel Sair — estetik/sinematik (Interstellar, Parasite + roster)
 * 8  Nostalji Bekcisi — klasik/sicak (Shawshank, Whiplash + roster)
 * 9  Kaos Elcisi — kaotik/ham (Fight Club, Mad Max, Dark Knight)
 * 10 Huzur Gezgini — sakin/dogal (Spirited Away, Whiplash + roster)
 * 11 Gerceklik Dedektifi — ham/diyalog (Parasite, Whiplash, Fight Club)
 * 12 Fantastik Hayalperest — epik/macera (Inception, Interstellar, LotR)
 */
const ARCHETYPE_FILM_POSTERS: Readonly<Record<number, readonly string[]>> = {
  1: [ // Adrenalin Bagimlisi
    'https://image.tmdb.org/t/p/w185/8tZYtuWezp8JbcsvHYO0O46tFbo.jpg', // Mad Max: Fury Road
    'https://image.tmdb.org/t/p/w185/qJ2tW6WMUDux911r6m7haRef0WH.jpg', // The Dark Knight
    'https://image.tmdb.org/t/p/w185/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg', // Inception
  ],
  2: [ // Zihin Bukucu
    'https://image.tmdb.org/t/p/w185/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg', // Inception
    'https://image.tmdb.org/t/p/w185/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', // Fight Club
    'https://image.tmdb.org/t/p/w185/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', // Parasite
  ],
  3: [ // Gozyasi Hirsizi
    'https://image.tmdb.org/t/p/w185/lIv1QinFqz4dlp5U4lQ6HaiskOZ.jpg', // Whiplash
    'https://image.tmdb.org/t/p/w185/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg', // The Shawshank Redemption
    'https://image.tmdb.org/t/p/w185/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg', // La La Land
  ],
  4: [ // Gulumseme Avcisi
    'https://image.tmdb.org/t/p/w185/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg', // The Shawshank Redemption
    'https://image.tmdb.org/t/p/w185/aeMuA17vprY3QWlyIRVTiKHqD6z.jpg', // Roster film
    'https://image.tmdb.org/t/p/w185/5MwkWH9tYHv3mV9OiQ0ZfahtXnj.jpg', // Roster film
  ],
  5: [ // Umutsuz Romantik
    'https://image.tmdb.org/t/p/w185/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg', // La La Land
    'https://image.tmdb.org/t/p/w185/eCOtqtfvn7mxGCGuBSnapSBgBBP.jpg', // Roster film
    'https://image.tmdb.org/t/p/w185/lIv1QinFqz4dlp5U4lQ6HaiskOZ.jpg', // Whiplash
  ],
  6: [ // Karanlik Yolcu
    'https://image.tmdb.org/t/p/w185/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', // Fight Club
    'https://image.tmdb.org/t/p/w185/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', // Parasite
    'https://image.tmdb.org/t/p/w185/qJ2tW6WMUDux911r6m7haRef0WH.jpg', // The Dark Knight
  ],
  7: [ // Gorsel Sair
    'https://image.tmdb.org/t/p/w185/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', // Interstellar
    'https://image.tmdb.org/t/p/w185/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', // Parasite
    'https://image.tmdb.org/t/p/w185/aeMuA17vprY3QWlyIRVTiKHqD6z.jpg', // Roster film
  ],
  8: [ // Nostalji Bekcisi
    'https://image.tmdb.org/t/p/w185/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg', // The Shawshank Redemption
    'https://image.tmdb.org/t/p/w185/5MwkWH9tYHv3mV9OiQ0ZfahtXnj.jpg', // Roster film
    'https://image.tmdb.org/t/p/w185/eCOtqtfvn7mxGCGuBSnapSBgBBP.jpg', // Roster film
  ],
  9: [ // Kaos Elcisi
    'https://image.tmdb.org/t/p/w185/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', // Fight Club
    'https://image.tmdb.org/t/p/w185/8tZYtuWezp8JbcsvHYO0O46tFbo.jpg', // Mad Max: Fury Road
    'https://image.tmdb.org/t/p/w185/qJ2tW6WMUDux911r6m7haRef0WH.jpg', // The Dark Knight
  ],
  10: [ // Huzur Gezgini
    'https://image.tmdb.org/t/p/w185/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg', // Spirited Away
    'https://image.tmdb.org/t/p/w185/aeMuA17vprY3QWlyIRVTiKHqD6z.jpg', // Roster film
    'https://image.tmdb.org/t/p/w185/lIv1QinFqz4dlp5U4lQ6HaiskOZ.jpg', // Whiplash
  ],
  11: [ // Gerceklik Dedektifi
    'https://image.tmdb.org/t/p/w185/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', // Parasite
    'https://image.tmdb.org/t/p/w185/lIv1QinFqz4dlp5U4lQ6HaiskOZ.jpg', // Whiplash
    'https://image.tmdb.org/t/p/w185/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', // Fight Club
  ],
  12: [ // Fantastik Hayalperest
    'https://image.tmdb.org/t/p/w185/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg', // Inception
    'https://image.tmdb.org/t/p/w185/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', // Interstellar
    'https://image.tmdb.org/t/p/w185/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg', // The Lord of the Rings
  ],
};

/** Fallback: ID yoksa ya da gecersizse kullanilan genel set */
const FALLBACK_POSTERS = [
  'https://image.tmdb.org/t/p/w185/qJ2tW6WMUDux911r6m7haRef0WH.jpg', // The Dark Knight
  'https://image.tmdb.org/t/p/w185/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', // Parasite
  'https://image.tmdb.org/t/p/w185/lIv1QinFqz4dlp5U4lQ6HaiskOZ.jpg', // Whiplash
];

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

  /** Arketibe ozgu poster listesi — fallback genel set */
  const ahaPosters =
    archetypeId !== null
      ? (ARCHETYPE_FILM_POSTERS[archetypeId] ?? FALLBACK_POSTERS)
      : FALLBACK_POSTERS;

  // Fallback: Mystery Cinephile
  const colorPrimary = archetype?.colorPrimary ?? Colors.accentPrimary;
  const colorDim = archetype?.colorDim ?? Colors.accentDim;
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

  /**
   * "Let's Go" basıldığında — dopamin zirvesinde App Store review iste,
   * ardından onFinish() ile ana sayfaya geç.
   * Lazy import: native build yoksa crash önler.
   */
  const handleFinish = useCallback(async () => {
    if (!ctaEnabled) return;
    hapticLight();
    try {
      const StoreReview = await import('expo-store-review');
      const isAvailable = await StoreReview.hasAction();
      if (isAvailable) await StoreReview.requestReview();
    } catch {
      // Sessizce devam — review bloklayici olmamali
    }
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
          {archetype ? (
            <Image
              source={archetype.image}
              style={styles.emojiImage}
              contentFit="contain"
            />
          ) : (
            <Text style={styles.emojiText}>✦</Text>
          )}
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

        {/* Aha moment — arketipe ozel 3 film posteri */}
        <Animated.View
          entering={FadeInUp.delay(1400).duration(400)}
          style={styles.ahaSection}
        >
          <Text style={styles.ahaTitle}>{t('onboarding.ahaFor')}</Text>
          <View style={styles.ahaRow}>
            {ahaPosters.map((uri, i) => (
              <Image
                key={i}
                source={{ uri }}
                style={styles.ahaCard}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ))}
          </View>
          {/* Today's Pick hint — home feed baglantisi */}
          <Text style={styles.todayPickHint}>
            {t('onboarding.todayPickHint')}
          </Text>
        </Animated.View>
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
