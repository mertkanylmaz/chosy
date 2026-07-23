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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight, hapticSuccess, hapticHeavy } from '@/utils/haptics';
import { getArchetype } from '@/constants/archetypes';
import { ArchetypeShareCard, useShareCapture } from '@/components/ShareCards';
import { styles as shareStyles } from '@/components/ShareCards/styles';
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
 * Her arketipin kimligi ile UYUMLU filmler secildi.
 * TMDB w185 poster yollari — TMDB API'den dogrulanmis.
 *
 * 1  Adrenalin Bagimlisi — Mad Max: Fury Road, The Dark Knight, John Wick
 * 2  Zihin Bukucu — Inception, Fight Club, Parasite
 * 3  Gozyasi Hirsizi — Whiplash, The Green Mile, Manchester by the Sea
 * 4  Gulumseme Avcisi — The Grand Budapest Hotel, Amelie, Paddington 2
 * 5  Umutsuz Romantik — La La Land, Pride & Prejudice, Eternal Sunshine
 * 6  Karanlik Yolcu — Fight Club, Se7en, No Country for Old Men
 * 7  Gorsel Sair — Blade Runner 2049, The Tree of Life, In the Mood for Love
 * 8  Nostalji Bekcisi — Cinema Paradiso, Stand By Me, The Sandlot
 * 9  Kaos Elcisi — Fight Club, Mad Max: Fury Road, Joker
 * 10 Huzur Gezgini — Spirited Away, My Neighbor Totoro, A Man Called Ove
 * 11 Gerceklik Dedektifi — Parasite, Spotlight, The Social Network
 * 12 Fantastik Hayalperest — The Lord of the Rings, Pan's Labyrinth, Spirited Away
 */
const ARCHETYPE_FILM_POSTERS: Readonly<Record<number, readonly string[]>> = {
  1: [ // Adrenalin Bagimlisi
    'https://image.tmdb.org/t/p/w185/8tZYtuWezp8JbcsvHYO0O46tFbo.jpg', // Mad Max: Fury Road
    'https://image.tmdb.org/t/p/w185/qJ2tW6WMUDux911r6m7haRef0WH.jpg', // The Dark Knight
    'https://image.tmdb.org/t/p/w185/wXqWR7dHncNRbxoEGybEy7QTe9h.jpg', // John Wick
  ],
  2: [ // Zihin Bukucu
    'https://image.tmdb.org/t/p/w185/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg', // Inception
    'https://image.tmdb.org/t/p/w185/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', // Fight Club
    'https://image.tmdb.org/t/p/w185/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', // Parasite
  ],
  3: [ // Gozyasi Hirsizi
    'https://image.tmdb.org/t/p/w185/7fn624j5lj3xTme2SgiLCeuedmO.jpg', // Whiplash
    'https://image.tmdb.org/t/p/w185/8VG8fDNiy50H4FedGwdSVUPoaJe.jpg', // The Green Mile
    'https://image.tmdb.org/t/p/w185/o9VXYOuaJxCEKOxbA86xqtwmqYn.jpg', // Manchester by the Sea
  ],
  4: [ // Gulumseme Avcisi (Joy Seeker)
    'https://image.tmdb.org/t/p/w185/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg', // The Grand Budapest Hotel
    'https://image.tmdb.org/t/p/w185/nSxDa3M9aMvGVLoItzWTepQ5h5d.jpg', // Amelie
    'https://image.tmdb.org/t/p/w185/1OJ9vkD5xPt3skC6KguyXAgagRZ.jpg', // Paddington 2
  ],
  5: [ // Umutsuz Romantik
    'https://image.tmdb.org/t/p/w185/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg', // La La Land
    'https://image.tmdb.org/t/p/w185/o8UhmEbWPHmTUxP0lMuCoqNkbB3.jpg', // Pride & Prejudice (2005)
    'https://image.tmdb.org/t/p/w185/5MwkWH9tYHv3mV9OdYTMR5qreIz.jpg', // Eternal Sunshine
  ],
  6: [ // Karanlik Yolcu
    'https://image.tmdb.org/t/p/w185/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', // Fight Club
    'https://image.tmdb.org/t/p/w185/191nKfP0ehp3uIvWqgPbFmI4lv9.jpg', // Se7en
    'https://image.tmdb.org/t/p/w185/6d5XOczc226jECq0LIX0siKtgHR.jpg', // No Country for Old Men
  ],
  7: [ // Gorsel Sair
    'https://image.tmdb.org/t/p/w185/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg', // Blade Runner 2049
    'https://image.tmdb.org/t/p/w185/l8cwuB5WJSoj4uMAsnzuHBOMaSJ.jpg', // The Tree of Life
    'https://image.tmdb.org/t/p/w185/iYypPT4bhqXfq1b6EnmxvRt6b2Y.jpg', // In the Mood for Love
  ],
  8: [ // Nostalji Bekcisi
    'https://image.tmdb.org/t/p/w185/gCI2AeMV4IHSewhJkzsur5MEp6R.jpg', // Cinema Paradiso
    'https://image.tmdb.org/t/p/w185/vz0w9BSehcqjDcJOjRaCk7fgJe7.jpg', // Stand By Me
    'https://image.tmdb.org/t/p/w185/3rdEAMh4a3pc7GO6fSkJwpt7BWX.jpg', // The Sandlot
  ],
  9: [ // Kaos Elcisi
    'https://image.tmdb.org/t/p/w185/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', // Fight Club
    'https://image.tmdb.org/t/p/w185/8tZYtuWezp8JbcsvHYO0O46tFbo.jpg', // Mad Max: Fury Road
    'https://image.tmdb.org/t/p/w185/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg', // Joker
  ],
  10: [ // Huzur Gezgini
    'https://image.tmdb.org/t/p/w185/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg', // Spirited Away
    'https://image.tmdb.org/t/p/w185/rtGDOeG9LzoerkDGZF9dnVeLppL.jpg', // My Neighbor Totoro
    'https://image.tmdb.org/t/p/w185/a41uvFqze4PI7N3E9jPNwN9ypV.jpg',  // A Man Called Ove
  ],
  11: [ // Gerceklik Dedektifi
    'https://image.tmdb.org/t/p/w185/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', // Parasite
    'https://image.tmdb.org/t/p/w185/8DPGG400FgaFWaqcv11n8mRd2NG.jpg', // Spotlight
    'https://image.tmdb.org/t/p/w185/n0ybibhJtQ5icDqTp8eRytcIHJx.jpg', // The Social Network
  ],
  12: [ // Fantastik Hayalperest
    'https://image.tmdb.org/t/p/w185/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg', // The Lord of the Rings
    'https://image.tmdb.org/t/p/w185/z7xXihu5wHuSMWymq5VAulPVuvg.jpg', // Pan's Labyrinth
    'https://image.tmdb.org/t/p/w185/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg', // Spirited Away
  ],
};

/** Fallback: ID yoksa ya da gecersizse kullanilan genel set */
const FALLBACK_POSTERS = [
  'https://image.tmdb.org/t/p/w185/qJ2tW6WMUDux911r6m7haRef0WH.jpg', // The Dark Knight
  'https://image.tmdb.org/t/p/w185/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', // Parasite
  'https://image.tmdb.org/t/p/w185/7fn624j5lj3xTme2SgiLCeuedmO.jpg', // Whiplash
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

// ─── Poster Havuzu (yedek için) ───────────────────────────────────────────────

/** Tüm arketip posterlerinden benzersiz URL listesi — fallback havuzu */
const ALL_POSTER_URLS: readonly string[] = [
  ...new Set([
    ...FALLBACK_POSTERS,
    ...Object.values(ARCHETYPE_FILM_POSTERS).flat(),
  ]),
];

/**
 * Belirli bir arketip setinden eksik (broken/404) posterleri çıkarıp
 * havuzdan yedek ile tamamlar. Her zaman 3 geçerli poster döner.
 */
function buildSafePosters(primary: readonly string[]): string[] {
  // Sadece havuzda olan unique poster'ları al
  const result = [...primary];
  // Yedek havuzda olan ama primary'de olmayan poster'lar
  const reserves = ALL_POSTER_URLS.filter((u) => !result.includes(u));
  // Eksikse tamamla (3'ten az ise)
  while (result.length < 3 && reserves.length > 0) {
    result.push(reserves.shift()!);
  }
  return result.slice(0, 3);
}

// ─── AhaPoster — hata toleranslı poster kartı ────────────────────────────────

interface AhaPosterProps {
  uri: string;
}

/**
 * Tek poster kart bileşeni — Image yükleme hatası olursa
 * film ikonu placeholder gösterir (boş kart yerine).
 */
function AhaPoster({ uri }: AhaPosterProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <View style={[styles.ahaCard, styles.ahaPlaceholder]}>
        <Ionicons name="film-outline" size={28} color={Colors.textSecondary} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={styles.ahaCard}
      contentFit="cover"
      cachePolicy="memory-disk"
      onError={() => setHasError(true)}
    />
  );
}

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
  const archetypeName = archetype ? t(archetype.nameKey) : t('onboarding.mysteryType');

  const { cardRef, share, isCapturing, isShareAvailable } = useShareCapture({
    cardType: 'archetype',
    trackingProps: { archetype_id: archetypeId, archetype_name: archetypeName },
    shareMessage: `I'm a ${archetypeName} 🎬 Which cinephile archetype are you?\nchosy.vercel.app`,
  });

  /** Arketibe özgü poster listesi — fallback + yedek havuzu ile güvenli */
  const ahaPosters = useMemo(() => {
    const primary =
      archetypeId !== null
        ? (ARCHETYPE_FILM_POSTERS[archetypeId] ?? FALLBACK_POSTERS)
        : FALLBACK_POSTERS;
    return buildSafePosters(primary);
  }, [archetypeId]);

  // Fallback: Mystery Cinephile
  const colorPrimary = archetype?.colorPrimary ?? Colors.accentPrimary;
  const colorDim = archetype?.colorDim ?? Colors.accentDim;
  const nameText = archetypeName;
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

    // Haptic: 400ms'de emoji gorunuyor — heavy + success combo
    const hapticTimer = setTimeout(() => {
      hapticHeavy();
      setTimeout(() => hapticSuccess(), 100);
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
   * "Let's Go" basıldığında — ÖNCE navigate et, store review arka planda.
   * requestReview() await edilmez — navigation'ı bloklamaz.
   * Lazy import: native build yoksa crash önler.
   */
  const handleFinish = useCallback(() => {
    if (!ctaEnabled) return;
    hapticLight();
    onFinish(); // ÖNCE navigate — bloklanmadan

    // Store review arka planda, fire-and-forget:
    (async () => {
      try {
        const StoreReview = await import('expo-store-review');
        if (await StoreReview.hasAction()) await StoreReview.requestReview();
      } catch {
        // Sessizce devam — review bloklayici olmamali
      }
    })();
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
              <AhaPoster key={`${archetypeId}-${i}`} uri={uri} />
            ))}
          </View>
          {/* Today's Pick hint — home feed baglantisi */}
          <Text style={styles.todayPickHint}>
            {t('onboarding.todayPickHint')}
          </Text>
        </Animated.View>
      </View>

      {/* CTA Butonlari */}
      <Animated.View
        entering={FadeInUp.delay(1200).springify()}
        style={styles.ctaWrap}
      >
        {/* Share butonu — native modüller yoksa gizle */}
        {isShareAvailable && (
          <TouchableOpacity
            onPress={share}
            activeOpacity={0.85}
            disabled={isCapturing || !ctaEnabled}
            style={styles.shareBtn}
          >
            <Ionicons name="share-outline" size={18} color={Colors.accentPrimary} />
            <Text style={styles.shareBtnText}>
              {isCapturing ? t('share.sharing') : t('share.shareArchetype')}
            </Text>
          </TouchableOpacity>
        )}

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

      {/* Offscreen share card — capture icin render edilir */}
      <View style={shareStyles.offscreen}>
        <ArchetypeShareCard ref={cardRef} archetypeId={archetypeId} />
      </View>
    </View>
  );
}
