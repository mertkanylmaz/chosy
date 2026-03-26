/**
 * Film Detay ekranı — v2
 * Tasarım referansı: design-reference/06-film-detail.png
 *
 * Layout:
 *   - Tam ekran, arka plan #0A0E27
 *   - Backdrop (300px) + koyu gradient + position:absolute header butonları
 *   - Poster (180×270) marginTop:-100 ile backdrop'a biner
 *   - Film adı, Mood Match Score, AI açıklama (ortalanmış)
 *   - Mood Explanation bölümü, film bilgileri satırı, cast horizontal scroll
 *   - Alt sabit butonlar: Trailer (%40) + Add to watchlist (%55)
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';

import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { hapticMedium } from '@/utils/haptics';

import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Film } from '@/types/film';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/services/supabase';
import { addToWatchlist } from '@/services/watchlist';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/theme';
import SkeletonLoader from '@/components/SkeletonLoader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BACKDROP_HEIGHT = 300;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSTER_WIDTH = 180;
const POSTER_HEIGHT = 270;
const POSTER_OVERLAP = 100;

// ─── DB satır tipi ────────────────────────────────────────────────────────────

interface FilmDbRow {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  overview: string | null;
  runtime: number | null;
  vote_average: number | null;
  director: string | null;
  trailer_url: string | null;
  genres: string[] | null;
  cast_json: Array<{ name: string; profile_path?: string | null }> | null;
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

/** TMDb path → tam URL */
function toTmdbUrl(path: string | null, size = 'w780'): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

/** Dakika → "1h 40m" */
function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Oyuncu avatarı ───────────────────────────────────────────────────────────

interface CastAvatarProps {
  name: string;
  avatarUrl?: string;
}

/** Küçük yuvarlak oyuncu avatarı — fotoğraf yoksa baş harf */
function CastAvatar({ name, avatarUrl }: CastAvatarProps) {
  return (
    <View style={styles.castItem}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.castImage} contentFit="cover" cachePolicy="memory-disk" />
      ) : (
        <View style={[styles.castImage, styles.castPlaceholder]}>
          <Text style={styles.castInitial}>{name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.castName} numberOfLines={1}>
        {name.split(' ').slice(-1)[0]}
      </Text>
    </View>
  );
}

// ─── Header ikon butonu ───────────────────────────────────────────────────────

interface IconBtnProps {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  active?: boolean;
}

/** 40px koyu daire ikon butonu */
function IconBtn({ name, onPress, active = false }: IconBtnProps) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.iconBtn} activeOpacity={0.75}>
      <Ionicons name={name} size={20} color={active ? Colors.gold : Colors.textWhite} />
    </TouchableOpacity>
  );
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

/**
 * Film Detay ekranı.
 * route param: id → Supabase films.id (UUID)
 */
export default function FilmDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [film, setFilm] = useState<Film | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchlistAdded, setWatchlistAdded] = useState(false);

  useEffect(() => {
    if (!id || id === 'undefined' || !UUID_REGEX.test(id)) {
      if (__DEV__ && id) {
        // eslint-disable-next-line no-console
        console.warn('[FilmDetail] Geçersiz film id:', id);
      }
      setLoading(false);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from('films')
        .select(
          'id, title, year, poster_url, backdrop_url, overview, runtime, vote_average, director, trailer_url, genres, cast_json',
        )
        .eq('id', id)
        .single();

      if (__DEV__) {
        if (error) {
          // eslint-disable-next-line no-console
          console.log('[FilmDetail] fetch error:', error.message);
        }
      }

      if (!error && data) {
        const row = data as FilmDbRow;
        const cast = (row.cast_json ?? []).map((a) => ({
          name: a.name,
          avatarUrl: a.profile_path ? toTmdbUrl(a.profile_path, 'w185') : undefined,
        }));

        setFilm({
          id: row.id,
          title: row.title,
          year: row.year ?? 0,
          posterUrl: toTmdbUrl(row.poster_url),
          backdropUrl: toTmdbUrl(row.backdrop_url, 'w1280'),
          overview: row.overview ?? undefined,
          runtime: row.runtime ?? undefined,
          voteAverage: row.vote_average ?? undefined,
          director: row.director ?? undefined,
          trailerUrl: row.trailer_url ?? undefined,
          matchScore: 0,
          moodTags: row.genres?.slice(0, 4) ?? [],
          whyThisFilm: '',
          cast: cast.length > 0 ? cast : undefined,
        });
      }

      setLoading(false);
    })();
  }, [id]);

  const handleTrailer = () => {
    if (!film?.trailerUrl) return;
    Linking.openURL(film.trailerUrl).catch(() => {});
  };

  const handleAddToWatchlist = async () => {
    if (!film || watchlistAdded) return;
    hapticMedium();
    await addToWatchlist(film);
    setWatchlistAdded(true);
  };

  const handleShare = () => {
    if (!film) return;
    Share.share({
      message: t('filmDetail.shareMessage', { title: film.title, year: film.year }),
      title: film.title,
    }).catch(() => {});
  };

  // ── Yükleniyor ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.root}>
          {/* Backdrop skeleton */}
          <SkeletonLoader width="100%" height={BACKDROP_HEIGHT} borderRadius={0} />
          {/* Poster skeleton */}
          <View style={styles.posterSection}>
            <SkeletonLoader width={POSTER_WIDTH} height={POSTER_HEIGHT} borderRadius={16} />
          </View>
          {/* Metin skeleton'ları */}
          <View style={{ paddingHorizontal: 20, marginTop: 16, gap: 12 }}>
            <SkeletonLoader width="60%" height={32} borderRadius={8} style={{ alignSelf: 'center' }} />
            <SkeletonLoader width="40%" height={16} borderRadius={6} style={{ alignSelf: 'center' }} />
            <SkeletonLoader width="100%" height={14} borderRadius={6} />
            <SkeletonLoader width="90%" height={14} borderRadius={6} />
            <SkeletonLoader width="80%" height={14} borderRadius={6} />
          </View>
        </View>
      </>
    );
  }

  // ── Bulunamadı ───────────────────────────────────────────────────────────────
  if (!film) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={Colors.textWhite} />
          </TouchableOpacity>
          <Text style={styles.notFoundTitle}>{t('filmDetail.filmNotFoundTitle')}</Text>
          <Text style={styles.notFoundText}>{t('filmDetail.filmNotFoundText')}</Text>
        </View>
      </>
    );
  }

  const backdropUri = film.backdropUrl || film.posterUrl;
  const genreLabel = film.moodTags.join(', ');

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.root}>

        {/* ── Kaydırılabilir içerik ── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Backdrop bölümü ── */}
          <View style={styles.backdropContainer}>
            {backdropUri ? (
              <Image
                source={{ uri: backdropUri }}
                style={styles.backdropImage}
                contentFit="cover"
                blurRadius={18}
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.backdropImage, styles.backdropPlaceholder]} />
            )}
            {/* Altın warm tint overlay */}
            <LinearGradient
              colors={['rgba(212,168,67,0.06)', 'transparent']}
              style={StyleSheet.absoluteFill}
              locations={[0, 0.5]}
            />
            {/* Gradient overlay: üst transparent → alt #0A0E27 */}
            <LinearGradient
              colors={['transparent', 'rgba(10,14,39,0.65)', Colors.background]}
              style={StyleSheet.absoluteFill}
              locations={[0, 0.55, 1]}
            />
          </View>

          {/* ── Poster bölümü — backdrop'a biner, ZoomIn ile giriş ── */}
          <Animated.View style={styles.posterSection} entering={ZoomIn.duration(400).delay(100)}>
            <View style={styles.posterWrapper}>
              {film.posterUrl ? (
                <Image
                  source={{ uri: film.posterUrl }}
                  style={styles.poster}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={[styles.poster, styles.posterPlaceholder]}>
                  <Text style={styles.posterPlaceholderIcon}>🎬</Text>
                </View>
              )}

              {/* Eşleşme dairesi — poster sol alt */}
              {film.matchScore > 0 && (
                <View style={styles.matchCircle}>
                  <Text style={styles.matchCircleText}>%{film.matchScore}</Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* ── Film adı — FadeInDown ile giriş ── */}
          <Animated.Text style={styles.filmTitle} entering={FadeInDown.duration(350).delay(200)}>
            {film.title}
          </Animated.Text>

          {/* ── Mood Match Score etiketi ── */}
          {film.matchScore > 0 && (
            <Text style={styles.moodMatchLabel}>{t('filmDetail.moodMatchScore')}</Text>
          )}

          {/* ── AI açıklama (whyThisFilm) ── */}
          {!!film.whyThisFilm && (
            <Text style={styles.aiDescription}>{film.whyThisFilm}</Text>
          )}

          {/* ── Mood Explanation bölümü ── */}
          {!!film.overview && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('filmDetail.moodExplanation')}</Text>
              <Text style={styles.sectionBody}>{film.overview}</Text>
            </View>
          )}

          {/* ── Film bilgileri satırı ── */}
          <View style={styles.infoRow}>
            {!!film.director && (
              <View style={styles.infoItem}>
                <Ionicons name="film-outline" size={14} color={Colors.textWhite} />
                <Text style={styles.infoTextWhite}>{film.director}</Text>
              </View>
            )}
            {film.year > 0 && (
              <View style={styles.infoItem}>
                <Ionicons name="calendar-outline" size={14} color={Colors.textWhite} />
                <Text style={styles.infoTextWhite}>{film.year}</Text>
              </View>
            )}
            {film.voteAverage != null && (
              <View style={styles.infoItem}>
                <Ionicons name="star" size={14} color={Colors.imdbYellow} />
                <Text style={styles.infoTextImdb}>{film.voteAverage.toFixed(1)}</Text>
              </View>
            )}
            {!!genreLabel && (
              <View style={styles.infoItem}>
                <Ionicons name="pricetag-outline" size={14} color={Colors.textGrey} />
                <Text style={styles.infoTextGrey}>{genreLabel}</Text>
              </View>
            )}
            {film.runtime != null && (
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={14} color={Colors.textGrey} />
                <Text style={styles.infoTextGrey}>{formatRuntime(film.runtime)}</Text>
              </View>
            )}
          </View>

          {/* ── Başroller ── */}
          {film.cast != null && film.cast.length > 0 && (
            <View style={styles.castSection}>
              <Text style={styles.castHeading}>{t('filmDetail.cast')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.castList}
              >
                {film.cast.slice(0, 8).map((actor) => (
                  <CastAvatar
                    key={actor.name}
                    name={actor.name}
                    avatarUrl={actor.avatarUrl}
                  />
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>

        {/* ── Position absolute header butonları ── */}
        <View style={[styles.header, { top: insets.top + 16 }]}>
          <IconBtn name="arrow-back" onPress={() => router.back()} />
          <View style={styles.headerRight}>
            <IconBtn
              name={watchlistAdded ? 'heart' : 'heart-outline'}
              onPress={handleAddToWatchlist}
              active={watchlistAdded}
            />
            <IconBtn name="share-outline" onPress={handleShare} />
          </View>
        </View>

        {/* ── Sabit alt butonlar ── */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {film.trailerUrl ? (
            <TouchableOpacity
              style={styles.trailerBtn}
              onPress={handleTrailer}
              activeOpacity={0.8}
            >
              <Ionicons name="play" size={14} color={Colors.gold} style={styles.trailerIcon} />
              <Text style={styles.trailerBtnText}>{t('filmDetail.trailer')}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={handleAddToWatchlist}
            activeOpacity={0.85}
            disabled={watchlistAdded}
            style={[styles.watchlistBtnWrapper, !film.trailerUrl && styles.watchlistBtnFullWidth]}
          >
            <LinearGradient
              colors={watchlistAdded ? ['#3A3F55', '#2A2F45'] : [Colors.gold, Colors.goldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.watchlistBtn}
            >
              <Text style={[styles.watchlistBtnText, watchlistAdded && styles.watchlistBtnTextAdded]}>
                {watchlistAdded ? t('filmDetail.addedToWatchlist') : t('filmDetail.addToWatchlist')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

      </View>
    </>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Root
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Loading / not found
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 8,
  },
  notFoundText: {
    color: Colors.textGrey,
    fontSize: 15,
  },

  // ScrollView
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },

  // Backdrop
  backdropContainer: {
    width: SCREEN_WIDTH,
    height: BACKDROP_HEIGHT,
    overflow: 'hidden',
  },
  backdropImage: {
    width: SCREEN_WIDTH,
    height: BACKDROP_HEIGHT,
  },
  backdropPlaceholder: {
    backgroundColor: Colors.card,
  },

  // Poster bölümü
  posterSection: {
    alignItems: 'center',
    marginTop: -POSTER_OVERLAP,
    marginBottom: 8,
  },
  posterWrapper: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    position: 'relative',
  },
  poster: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 14,
  },
  posterPlaceholder: {
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  posterPlaceholderIcon: {
    fontSize: 48,
  },

  // Eşleşme dairesi
  matchCircle: {
    position: 'absolute',
    left: -14,
    bottom: -14,
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2.5,
    borderColor: Colors.gold,
    backgroundColor: 'rgba(10,14,39,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  matchCircleText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textWhite,
    letterSpacing: -0.5,
  },

  // Film adı
  filmTitle: {
    fontSize: 28,
    fontFamily: Typography.displayFont,
    color: Colors.gold,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    lineHeight: 36,
  },

  // Mood Match Score etiketi
  moodMatchLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textWhite,
    textAlign: 'center',
    marginTop: 4,
  },

  // AI açıklama
  aiDescription: {
    fontSize: 14,
    color: Colors.textLightGrey,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 16,
    lineHeight: 22,
  },

  // Mood Explanation bölümü
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Typography.displayFont,
    color: Colors.gold,
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 14,
    color: Colors.textLightGrey,
    lineHeight: 22,
  },

  // Film bilgileri satırı
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 20,
    paddingHorizontal: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoTextWhite: {
    fontSize: 14,
    color: Colors.textWhite,
  },
  infoTextImdb: {
    fontSize: 14,
    color: Colors.imdbYellow,
    fontWeight: '600',
  },
  infoTextGrey: {
    fontSize: 14,
    color: Colors.textGrey,
  },

  // Cast
  castSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  castHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 12,
  },
  castList: {
    gap: 12,
    paddingRight: 20,
  },
  castItem: {
    alignItems: 'center',
    gap: 6,
    width: 56,
  },
  castImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  castPlaceholder: {
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  castInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  castName: {
    fontSize: 12,
    color: Colors.textGrey,
    textAlign: 'center',
  },

  // Header butonları (position absolute)
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Alt sabit butonlar
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: 'rgba(10,14,39,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  trailerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '38%',
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    backgroundColor: 'rgba(212,168,67,0.08)',
    gap: 6,
  },
  trailerIcon: {
    marginRight: 2,
  },
  trailerBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.gold,
    letterSpacing: 0.3,
  },
  watchlistBtnWrapper: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  watchlistBtnFullWidth: {
    flex: 1,
  },
  watchlistBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchlistBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.background,
    letterSpacing: 0.3,
  },
  watchlistBtnTextAdded: {
    color: Colors.textGrey,
  },
});
