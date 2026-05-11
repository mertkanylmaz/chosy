/**
 * Home sekmesi — kişiselleştirilmiş dashboard.
 *
 * Düzen (yeni hiyerarşi):
 *   - Floating header: logo + chosy.ai
 *   - GreetingWidget: saate göre dinamik selamlama
 *   - Hero Section: "Find a Mood" devasa CTA (birincil odak)
 *   - Film Kartları: Last Added + Today's Pick (yatay, de-emphasized)
 *   - Sinefil Profili: tam genişlik kart (text overflow düzeltildi)
 *
 * UX Kararları:
 *   - Hero en üstte, kullanıcıyı ana aksiyona yönlendirir
 *   - Film kartları ikincil bilgi — küçük, yatay sıra
 *   - Archetype kart: tam genişlik, numberOfLines + flex-wrap
 */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { GreetingWidget } from '@/components/Home';
import { getArchetype } from '@/constants/archetypes';
import { getHomeData, type HomeData } from '@/services/homeService';
import { getDailyMatch, getDailyMatchByPreferences } from '@/services/dailyMatch';
import { getLastParsedProfile } from '@/services/profileService';
import { getArchetypeProfile } from '@/services/archetypeEngine';
import { getAppUserId, getWatchlist } from '@/services/watchlist';
import { logger } from '@/utils/logger';
import { localizeGenre } from '@/utils/filmFilters';
import { hapticLight, hapticMedium, hapticSelection } from '@/utils/haptics';
import type { Film } from '@/types/film';

// ── Sabitler ─────────────────────────────────────────────────────────────────

const TMDB_BASE = 'https://image.tmdb.org/t/p/w500';
const RECALIBRATION_KEY = 'chosy_last_recalibration';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const { width: SCREEN_W } = Dimensions.get('window');


// ── Yardımcı ─────────────────────────────────────────────────────────────────

/**
 * Film için kart altında gösterilecek meta metni oluşturur.
 * Öncelik: moodTag[0] → runtime → sadece yıl
 *
 * @param film   - Film verisi
 * @param locale - Aktif uygulama dili ('en' | 'tr')
 */
function getFilmMeta(
  film: { year: number; moodTags?: string[]; runtime?: number },
  locale: string,
): string {
  const raw = film.moodTags?.[0];
  const tag = raw ? localizeGenre(raw, locale) : null;
  if (tag) return `${film.year} · ${tag}`;
  if (film.runtime) {
    const h = Math.floor(film.runtime / 60);
    const m = film.runtime % 60;
    const rt = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
    return `${film.year} · ${rt}`;
  }
  return `${film.year}`;
}

/**
 * Poster URL'sini kontrol eder; gerekirse TMDB base prefix ekler.
 */
function resolvePosterUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${TMDB_BASE}${url}`;
}

// ── Haftalık Limit ────────────────────────────────────────────────────────────

/**
 * Kullanıcının bu hafta yeniden kalibrasyon hakkı olup olmadığını kontrol eder.
 */
async function checkRecalibrationAllowed(): Promise<{ allowed: boolean; nextDate?: Date }> {
  try {
    const raw = await AsyncStorage.getItem(RECALIBRATION_KEY);
    if (!raw) return { allowed: true };

    const lastDate = new Date(raw);
    const nextDate = new Date(lastDate.getTime() + SEVEN_DAYS_MS);

    if (Date.now() >= nextDate.getTime()) return { allowed: true };
    return { allowed: false, nextDate };
  } catch {
    return { allowed: true };
  }
}

// ── Ana Ekran ─────────────────────────────────────────────────────────────────

/**
 * Home sekmesi — kişiselleştirilmiş dashboard.
 * Hiyerarşi: Hero CTA (birincil) → Film Kartları (ikincil) → Archetype (detay).
 */
export default function HomeScreen() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [dailyFilm, setDailyFilm] = useState<Film | null>(null);
  const [dailyLoading, setDailyLoading] = useState(true);

  /**
   * Home verilerini ve daily pick'i paralel yükler.
   */
  const loadData = useCallback(async () => {
    try {
      const data = await getHomeData();
      setHomeData(data);

      if (data.archetypeId) {
        try {
          const userId = await getAppUserId();
          if (userId) {
            // Watchlist + son profil paralel çek
            const [wl, lastProfile] = await Promise.all([
              getWatchlist(),
              getLastParsedProfile(userId),
            ]);
            const seenIds = wl.map((w) => w.film.id);

            // ── Kademeli cascade: sinefil kimliğine göre öneri ────────────
            // Priority 1: preferences_vector (swipe + kalibrasyon birikimi)
            let film = await getDailyMatchByPreferences(userId, seenIds);

            // Priority 2: son mood session profili
            if (!film) {
              film = await getDailyMatch(userId, lastProfile, seenIds);
            }

            // Priority 3: arketip kanonical profili (cold-start fallback)
            if (!film) {
              const archetypeProfile = getArchetypeProfile(data.archetypeId);
              film = await getDailyMatch(userId, archetypeProfile, seenIds);
            }

            setDailyFilm(film);
          }
        } catch (err) {
          logger.error('[HomeScreen] daily pick hatası:', err);
        }
      }
    } catch (err) {
      logger.error('[HomeScreen] veri yüklemesi hatası:', err);
    } finally {
      setDailyLoading(false);
    }
  }, []);

  /** Ekran her odaklandığında yeniden yükle */
  useFocusEffect(
    useCallback(() => {
      setDailyLoading(true);
      setDailyFilm(null);
      loadData();
    }, [loadData]),
  );

  // ── Archetype tıklaması (haftalık limit) ──────────────────────────────────

  /** Kalibrasyon limiti kontrolü + yönlendirme */
  async function handleArchetypeTap() {
    hapticSelection();
    const { allowed, nextDate } = await checkRecalibrationAllowed();

    if (!allowed && nextDate) {
      Alert.alert(
        t('home.retestWeeklyLimitTitle'),
        t('home.retestWeeklyLimit').replace('%{date}', nextDate.toLocaleDateString()),
      );
      return;
    }

    Alert.alert(
      t('home.retestTitle'),
      t('home.retestMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('home.retestConfirm'),
          onPress: async () => {
            hapticLight();
            try {
              await AsyncStorage.setItem(RECALIBRATION_KEY, new Date().toISOString());
            } catch (err) {
              logger.error('[HomeScreen] recalibration timestamp yazılamadı:', err);
            }
            router.push('/onboarding');
          },
        },
      ],
    );
  }

  // ── Türetilen veriler ─────────────────────────────────────────────────────

  const archetype = homeData?.archetypeId ? getArchetype(homeData.archetypeId) : null;
  const lastFilm = homeData?.lastFilm ?? null;
  const lastPosterUrl = resolvePosterUrl(lastFilm?.film.posterUrl);
  const dailyPosterUrl = resolvePosterUrl(dailyFilm?.posterUrl);

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* ── Floating Header ───────────────────────────────────────────────── */}
      <LinearGradient
        colors={[
          Colors.background,
          Colors.background,
          'rgba(10,10,10,0.9)',
          'rgba(10,10,10,0)',
        ]}
        locations={[0, 0.68, 0.85, 1]}
        style={styles.headerGradient}
        pointerEvents="box-none"
      >
        <View
          style={[styles.headerRow, { paddingTop: insets.top + 8 }]}
          pointerEvents="box-none"
        >
          <View style={styles.logoWrapper} pointerEvents="none">
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={styles.logoText}>chosy.ai</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Ana İçerik (scroll yok) ───────────────────────────────────────── */}
      <View
        style={[
          styles.mainContent,
          { paddingTop: insets.top + 56, paddingBottom: 83 },
        ]}
      >
        {/* Selamlama */}
        <GreetingWidget username={homeData?.displayName ?? null} />

        {/* ── HERO SECTION — Birincil Odak ───────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(50).duration(400).springify().damping(18)}
          style={styles.heroSection}
        >
          {/* Devasa gradient CTA butonu */}
          <TouchableOpacity
            onPress={() => { hapticMedium(); router.push('/(tabs)/mood'); }}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['#B8A38E', '#D4C4AE', '#EADBC6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.heroCta}
            >
              <View style={styles.heroCtaIconBg}>
                <Ionicons name="sparkles" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.heroCtaTextBlock}>
                <Text style={styles.heroCtaTitle}>{t('home.navMood')}</Text>
                <Text style={styles.heroCtaSubline}>{t('home.findMoodHint')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.55)" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ── FILM KARTLARI — İkincil bilgi, flex ile dolu alan ─────────── */}
        <Animated.View
          entering={FadeInDown.delay(110).duration(400).springify().damping(18)}
          style={styles.filmsSection}
        >
          {/* Last Added */}
          <View style={styles.filmCardWrap}>
            <Text style={styles.filmCardLabel}>{t('home.lastAdded')}</Text>
            {lastFilm && lastPosterUrl ? (
              <TouchableOpacity
                style={styles.filmCard}
                onPress={() => {
                  hapticLight();
                  router.push(`/film/${lastFilm.film.id}`);
                }}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: lastPosterUrl }}
                  style={styles.filmPoster}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
                {/* Gradient scrim — meta bilgi (yıl · tür) */}
                <LinearGradient
                  colors={['transparent', 'rgba(10,10,10,0.88)']}
                  style={styles.filmOverlay}
                >
                  <Text style={styles.filmMeta} numberOfLines={1}>
                    {getFilmMeta(lastFilm.film, language)}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={styles.filmCardEmpty}>
                <Ionicons name="bookmark-outline" size={22} color={Colors.textGrey} />
                <Text style={styles.filmCardEmptyText}>{t('home.noLastFilm')}</Text>
              </View>
            )}
          </View>

          {/* Today's Pick */}
          <View style={styles.filmCardWrap}>
            <Text style={styles.filmCardLabel}>{t('home.dailyPick')}</Text>
            {dailyLoading ? (
              <View style={[styles.filmCard, styles.filmCardSkeleton]} />
            ) : dailyFilm && dailyPosterUrl ? (
              <TouchableOpacity
                style={styles.filmCard}
                onPress={() => {
                  hapticLight();
                  router.push(`/film/${dailyFilm.id}`);
                }}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: dailyPosterUrl }}
                  style={styles.filmPoster}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
                {/* Gradient scrim — meta bilgi + eşleşme skoru */}
                <LinearGradient
                  colors={['transparent', 'rgba(10,10,10,0.88)']}
                  style={styles.filmOverlay}
                >
                  <View style={styles.filmMetaRow}>
                    <Text style={styles.filmMeta} numberOfLines={1}>
                      {getFilmMeta(dailyFilm, language)}
                    </Text>
                    {dailyFilm.matchScore > 0 && (
                      <View style={styles.matchBadge}>
                        <Text style={styles.matchBadgeText}>{dailyFilm.matchScore}%</Text>
                      </View>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={styles.filmCardEmpty}>
                <Ionicons name="film-outline" size={22} color={Colors.textGrey} />
                <Text style={styles.filmCardEmptyText} numberOfLines={2}>
                  {t('dailyMatch.noProfileHint')}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── SİNEFİL PROFİLİ — Tam genişlik, metin taşması giderildi ────── */}
        <Animated.View
          entering={FadeInDown.delay(170).duration(400).springify().damping(18)}
          style={styles.archetypeSection}
        >
          <Text style={styles.sectionLabel}>{t('home.sinephileTitle')}</Text>
          <TouchableOpacity
            style={[
              styles.archetypeCard,
              archetype
                ? { backgroundColor: archetype.colorDim, borderColor: archetype.colorPrimary + '40' }
                : undefined,
            ]}
            onPress={handleArchetypeTap}
            activeOpacity={0.8}
          >
            {archetype ? (
              <View style={styles.archetypeInner}>
                <Image source={archetype.image} style={styles.archetypeEmoji} contentFit="contain" />
                <View style={styles.archetypeTextBlock}>
                  <Text
                    style={[styles.archetypeName, { color: archetype.colorPrimary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {t(archetype.nameKey)}
                  </Text>
                  <Text style={styles.archetypeDesc} numberOfLines={2}>
                    {t(archetype.descKey)}
                  </Text>
                </View>
                <View style={styles.retestBadge}>
                  <Ionicons name="refresh-outline" size={18} color={Colors.textGrey} />
                </View>
              </View>
            ) : (
              <View style={styles.noArchetypeInner}>
                <Ionicons name="sparkles-outline" size={18} color={Colors.accentPrimary} />
                <View style={styles.noArchetypeTextBlock}>
                  <Text style={styles.noArchetypeTitle}>{t('home.noArchetype')}</Text>
                  <Text style={styles.noArchetypeHint} numberOfLines={2}>
                    {t('home.noArchetypeHint')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={Colors.textGrey} />
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Floating Header ──────────────────────────────────────────────────────
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 40,
    height: 40,
    opacity: 0.95,
  },
  logoText: {
    color: Colors.goldLight,
    fontSize: 22,
    fontFamily: 'PlayfairDisplay_400Regular',
    letterSpacing: 0.4,
  },

  // ── Ana İçerik ────────────────────────────────────────────────────────────
  mainContent: {
    flex: 1,
  },

  // ── Hero Section ──────────────────────────────────────────────────────────
  heroSection: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 2,
  },
  /** "What are you in the mood for?" etiketi */
  heroQuestion: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  /** Gradient CTA butonu */
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 14,
    shadowColor: '#D4C4AE',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  /** Sol taraftaki ikon arka planı */
  heroCtaIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCtaTextBlock: {
    flex: 1,
  },
  heroCtaTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.1,
    marginBottom: 2,
  },
  heroCtaSubline: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  // ── Film Kartları Bölümü ──────────────────────────────────────────────────
  /** Film kartları bölümü — flex: 1 ile kalan yüksekliği doldurur */
  filmsSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 14,
    flex: 1,
    alignItems: 'stretch',
  },
  /** Kart sarmalayıcı — label + kart dikey hizası */
  filmCardWrap: {
    flex: 1,
    gap: 6,
  },
  filmCardLabel: {
    fontSize: 9,
    color: Colors.textTertiary,
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  /** Film kartı — flex: 1 ile yüksekliği otomatik doldurur */
  filmCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.white10,
  },
  filmPoster: {
    flex: 1,
    backgroundColor: Colors.bgElevated,
  },
  /** Siyahdan şeffafa gradient scrim — metin okunabilirliği */
  filmOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 28,
  },
  /** Yıl · tür / süre tek satır meta bilgi */
  filmMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  filmMeta: {
    flex: 1,
    color: Colors.textGrey,
    fontSize: 11,
    fontWeight: '500',
  },
  filmCardSkeleton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: Colors.bgElevated,
    opacity: 0.5,
  },
  filmCardEmpty: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.white10,
    borderStyle: 'dashed',
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
  },
  filmCardEmptyText: {
    color: Colors.textGrey,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
  /** Eşleşme skoru rozeti — filmMetaRow içinde sağ tarafa hizalanır */
  matchBadge: {
    backgroundColor: Colors.accentPrimary,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexShrink: 0,
  },
  matchBadgeText: {
    color: Colors.textOnAccent,
    fontSize: 10,
    fontWeight: '700',
  },

  // ── Sinefil Profili Bölümü ────────────────────────────────────────────────
  archetypeSection: {
    paddingHorizontal: 16,
    marginTop: 14,
    gap: 6,
  },
  sectionLabel: {
    fontSize: 9,
    color: Colors.textTertiary,
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  archetypeCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.white10,
    backgroundColor: Colors.bgCard,
    padding: 14,
  },
  archetypeInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  archetypeEmoji: {
    width: 34,
    height: 34,
  },
  archetypeTextBlock: {
    flex: 1,
    minWidth: 0, // flex child text overflow engellemek için
  },
  archetypeName: {
    fontSize: 15,
    fontFamily: 'PlayfairDisplay_700Bold',
    marginBottom: 4,
    lineHeight: 20,
    flexShrink: 1,
  },
  archetypeDesc: {
    fontSize: 12,
    color: Colors.textWhite,
    lineHeight: 17,
    letterSpacing: 0.1,
    opacity: 0.72,
    flexShrink: 1,
  },
  retestBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.white05,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  noArchetypeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noArchetypeTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  noArchetypeTitle: {
    fontSize: 14,
    color: Colors.accentPrimary,
    fontWeight: '700',
    marginBottom: 3,
  },
  noArchetypeHint: {
    fontSize: 12,
    color: Colors.textGrey,
    lineHeight: 16,
    flexShrink: 1,
  },
});
