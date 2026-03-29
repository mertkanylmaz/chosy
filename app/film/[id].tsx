/**
 * Film Detay ekrani — Bottom Sheet tarzinda.
 *
 * Layout:
 *   - Drag handle + rounded top corners
 *   - Backdrop (blurred) + gradient overlay
 *   - Poster (180x270) overlap
 *   - Film adi, Match Score, meta bilgiler
 *   - "Why this film?" AI aciklama (lazy loaded)
 *   - Overview bolumu
 *   - Cast horizontal scroll
 *   - Sabit footer: Trailer + Add to Watchlist
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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

import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Film } from '@/types/film';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMood } from '@/contexts/MoodContext';
import { supabase } from '@/services/supabase';
import { addToWatchlist } from '@/services/watchlist';
import { explainBatch, type FilmForExplanation } from '@/services/matchExplanation';
import { Colors } from '@/constants/Colors';
import SkeletonLoader from '@/components/SkeletonLoader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BACKDROP_HEIGHT = 280;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSTER_WIDTH = 160;
const POSTER_HEIGHT = 240;
const POSTER_OVERLAP = 90;

// ── DB satir tipi ────────────────────────────────────────────────────────────

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

// ── Yardimcilar ──────────────────────────────────────────────────────────────

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

// ── Oyuncu avatari ───────────────────────────────────────────────────────────

interface CastAvatarProps {
  name: string;
  avatarUrl?: string;
}

/** Kucuk yuvarlak oyuncu avatari — fotograf yoksa bas harf */
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

// ── Info Chip ────────────────────────────────────────────────────────────────

/** Bilgi satiri icin tek chip */
function InfoChip({ icon, text, color }: { icon: string; text: string; color: string }) {
  return (
    <View style={styles.infoChip}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={13} color={color} />
      <Text style={[styles.infoChipText, { color }]}>{text}</Text>
    </View>
  );
}

// ── Ana ekran ────────────────────────────────────────────────────────────────

/**
 * Film Detay ekrani — bottom sheet tarzinda.
 * route param: id → Supabase films.id (UUID)
 */
export default function FilmDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const { currentProfile } = useMood();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [film, setFilm] = useState<Film | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [watchlistAdded, setWatchlistAdded] = useState(false);
  const [watchlistError, setWatchlistError] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);

  // ── Film verisi yukle ───────────────────────────────────────────────────────

  const loadFilm = useCallback(async () => {
    if (!id || id === 'undefined' || !UUID_REGEX.test(id)) {
      if (__DEV__ && id) {
        // eslint-disable-next-line no-console
        console.warn('[FilmDetail] Gecersiz film id:', id);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(false);

    try {
      const { data, error } = await supabase
        .from('films')
        .select(
          'id, title, year, poster_url, backdrop_url, overview, runtime, vote_average, director, trailer_url, genres, cast_json',
        )
        .eq('id', id)
        .single();

      if (error) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log('[FilmDetail] fetch error:', error.message);
        }
        // PGRST116 = row not found — gercek "not found", hata degil
        if (error.code !== 'PGRST116') {
          setLoadError(true);
        }
        setLoading(false);
        return;
      }

      if (data) {
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
    } catch (err) {
      if (__DEV__) {
        console.error('[FilmDetail] unexpected error:', err);
      }
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadFilm();
  }, [loadFilm]);

  // ── "Why this film?" aciklama yukle ─────────────────────────────────────────

  useEffect(() => {
    if (!film || !currentProfile || explanation != null) return;

    let active = true;
    setExplanationLoading(true);

    const filmForExplanation: FilmForExplanation = {
      filmId: film.id,
      dimensions: film.dimensions ?? null,
    };

    explainBatch(currentProfile, [filmForExplanation])
      .then((map) => {
        if (active && map[film.id]) {
          setExplanation(map[film.id]);
        }
      })
      .catch(() => {
        // Fallback: sessizce basa gec
      })
      .finally(() => {
        if (active) setExplanationLoading(false);
      });

    return () => { active = false; };
  }, [film, currentProfile, explanation]);

  // ── Aksiyonlar ──────────────────────────────────────────────────────────────

  const handleTrailer = () => {
    if (!film?.trailerUrl) return;
    Linking.openURL(film.trailerUrl).catch(() => {});
  };

  const handleAddToWatchlist = async () => {
    if (!film || watchlistAdded) return;
    hapticMedium();
    setWatchlistError(false);
    try {
      await addToWatchlist(film);
      setWatchlistAdded(true);
    } catch (err) {
      if (__DEV__) {
        console.error('[FilmDetail] watchlist add error:', err);
      }
      setWatchlistError(true);
      Alert.alert(
        t('errors.generic'),
        t('errors.watchlistSave'),
      );
    }
  };

  const handleShare = () => {
    if (!film) return;
    Share.share({
      message: t('filmDetail.shareMessage', { title: film.title, year: film.year }),
      title: film.title,
    }).catch(() => {});
  };

  // ── Yukleniyor ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.root}>
          <SkeletonLoader width="100%" height={BACKDROP_HEIGHT} borderRadius={0} />
          <View style={styles.posterSection}>
            <SkeletonLoader width={POSTER_WIDTH} height={POSTER_HEIGHT} borderRadius={16} />
          </View>
          <View style={styles.skeletonContent}>
            <SkeletonLoader width="60%" height={28} borderRadius={8} style={{ alignSelf: 'center' }} />
            <SkeletonLoader width="40%" height={14} borderRadius={6} style={{ alignSelf: 'center', marginTop: 10 }} />
            <SkeletonLoader width="100%" height={14} borderRadius={6} style={{ marginTop: 20 }} />
            <SkeletonLoader width="90%" height={14} borderRadius={6} style={{ marginTop: 8 }} />
            <SkeletonLoader width="80%" height={14} borderRadius={6} style={{ marginTop: 8 }} />
          </View>
        </View>
      </>
    );
  }

  // ── Hata durumu — network/server ────────────────────────────────────────────

  if (loadError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.notFoundContainer}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={Colors.textWhite} />
          </TouchableOpacity>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textGrey} style={{ marginBottom: 16 }} />
          <Text style={styles.notFoundTitle}>{t('errors.generic')}</Text>
          <Text style={styles.notFoundText}>{t('filmDetail.loadError')}</Text>
          <TouchableOpacity onPress={loadFilm} style={styles.retryButton} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>{t('errors.retry')}</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  // ── Bulunamadi ──────────────────────────────────────────────────────────────

  if (!film) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.notFoundContainer}>
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
  const genreLabel = film.moodTags.join(' · ');

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.root}>

        {/* ── Kaydirilabilir icerik ── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Backdrop bolumu ── */}
          <View style={styles.backdropContainer}>
            {backdropUri ? (
              <Image
                source={{ uri: backdropUri }}
                style={styles.backdropImage}
                contentFit="cover"
                blurRadius={16}
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.backdropImage, styles.backdropPlaceholder]} />
            )}
            {/* Violet tint overlay */}
            <LinearGradient
              colors={['rgba(139,92,246,0.08)', 'transparent']}
              style={StyleSheet.absoluteFill}
              locations={[0, 0.5]}
            />
            {/* Gradient: transparent → bg */}
            <LinearGradient
              colors={['transparent', 'rgba(10,10,10,0.7)', Colors.background]}
              style={StyleSheet.absoluteFill}
              locations={[0, 0.55, 1]}
            />

            {/* Drag handle */}
            <View style={styles.dragHandleArea}>
              <View style={styles.dragHandle} />
            </View>
          </View>

          {/* ── Poster — ZoomIn ile giris ── */}
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
                  <Ionicons name="film-outline" size={48} color={Colors.textTertiary} />
                </View>
              )}

              {/* Esleme dairesi — poster sol alt */}
              {film.matchScore > 0 && (
                <View style={styles.matchCircle}>
                  <Text style={styles.matchPercent}>{film.matchScore}</Text>
                  <Text style={styles.matchLabel}>match</Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* ── Film adi ── */}
          <Animated.Text style={styles.filmTitle} entering={FadeInDown.duration(350).delay(200)}>
            {film.title}
          </Animated.Text>

          {/* ── Meta satiri (chips) ── */}
          <Animated.View style={styles.metaRow} entering={FadeInDown.duration(300).delay(300)}>
            {film.year > 0 && (
              <InfoChip icon="calendar-outline" text={String(film.year)} color={Colors.textSecondary} />
            )}
            {film.runtime != null && (
              <InfoChip icon="time-outline" text={formatRuntime(film.runtime)} color={Colors.textSecondary} />
            )}
            {film.voteAverage != null && (
              <InfoChip icon="star" text={film.voteAverage.toFixed(1)} color={Colors.gold} />
            )}
            {!!film.director && (
              <InfoChip icon="film-outline" text={film.director} color={Colors.textSecondary} />
            )}
          </Animated.View>

          {/* ── Genre etiketleri ── */}
          {!!genreLabel && (
            <Text style={styles.genreText}>{genreLabel}</Text>
          )}

          {/* ── "Why this film?" bolumu ── */}
          {(explanation != null || explanationLoading) && (
            <Animated.View style={styles.whySection} entering={FadeIn.duration(400)}>
              <View style={styles.whySectionHeader}>
                <Ionicons name="sparkles" size={16} color={Colors.accentPrimary} />
                <Text style={styles.whySectionTitle}>{t('filmDetail.whyThisFilm')}</Text>
              </View>
              {explanationLoading ? (
                <SkeletonLoader width="100%" height={40} borderRadius={8} />
              ) : (
                <Text style={styles.whySectionBody}>{explanation}</Text>
              )}
            </Animated.View>
          )}

          {/* ── Overview ── */}
          {!!film.overview && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('filmDetail.moodExplanation')}</Text>
              <Text style={styles.sectionBody}>{film.overview}</Text>
            </View>
          )}

          {/* ── Basroller ── */}
          {film.cast != null && film.cast.length > 0 && (
            <View style={styles.castSection}>
              <Text style={styles.sectionTitle}>{t('filmDetail.cast')}</Text>
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

        {/* ── Position absolute header butonlari ── */}
        <View style={[styles.header, { top: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.75}>
            <Ionicons name="chevron-down" size={22} color={Colors.textWhite} />
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={handleAddToWatchlist}
              style={[styles.headerBtn, watchlistAdded && styles.headerBtnActive]}
              activeOpacity={0.75}
            >
              <Ionicons
                name={watchlistAdded ? 'heart' : 'heart-outline'}
                size={20}
                color={watchlistAdded ? Colors.accentPrimary : Colors.textWhite}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.headerBtn} activeOpacity={0.75}>
              <Ionicons name="share-outline" size={20} color={Colors.textWhite} />
            </TouchableOpacity>
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
              <Ionicons name="play" size={16} color={Colors.accentPrimary} />
              <Text style={styles.trailerBtnText}>{t('filmDetail.trailer')}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={handleAddToWatchlist}
            activeOpacity={0.85}
            disabled={watchlistAdded}
            style={[styles.watchlistBtnWrapper, !film.trailerUrl && styles.watchlistBtnFull]}
          >
            <LinearGradient
              colors={
                watchlistAdded
                  ? [Colors.bgElevated, Colors.bgCard]
                  : [Colors.accentPrimary, Colors.accentHover]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.watchlistBtn}
            >
              <Ionicons
                name={watchlistAdded ? 'checkmark' : 'bookmark-outline'}
                size={18}
                color={watchlistAdded ? Colors.textSecondary : Colors.textOnAccent}
                style={styles.watchlistBtnIcon}
              />
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

// ── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Root
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Drag handle
  dragHandleArea: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.bgSubtle,
  },

  // Loading skeleton
  skeletonContent: {
    paddingHorizontal: 20,
    marginTop: 16,
  },

  // Not found
  notFoundContainer: {
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
    backgroundColor: Colors.white10,
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
    color: Colors.textSecondary,
    fontSize: 15,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '700',
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
    backgroundColor: Colors.bgCard,
  },

  // Poster
  posterSection: {
    alignItems: 'center',
    marginTop: -POSTER_OVERLAP,
    marginBottom: 12,
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
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },

  // Match circle — violet accent
  matchCircle: {
    position: 'absolute',
    left: -12,
    bottom: -12,
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2.5,
    borderColor: Colors.accentPrimary,
    backgroundColor: 'rgba(10,10,10,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  matchPercent: {
    fontSize: 15,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.textWhite,
    letterSpacing: -0.5,
    lineHeight: 18,
  },
  matchLabel: {
    fontSize: 8,
    color: Colors.textTertiary,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    lineHeight: 10,
  },

  // Film title
  filmTitle: {
    fontSize: 26,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.textWhite,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 34,
  },

  // Meta row (chips)
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    paddingHorizontal: 20,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white05,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  infoChipText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Genre text
  genreText: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },

  // "Why this film?" section
  whySection: {
    marginTop: 24,
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: Colors.accentDim,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
  },
  whySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  whySectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.accentPrimary,
  },
  whySectionBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // Section (Overview etc)
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // Cast
  castSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  castList: {
    gap: 12,
    paddingRight: 20,
    marginTop: 4,
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
    borderColor: Colors.white10,
  },
  castPlaceholder: {
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  castInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  castName: {
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  // Header (position absolute)
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
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnActive: {
    backgroundColor: Colors.accentDim,
  },

  // Footer
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
    backgroundColor: 'rgba(10,10,10,0.97)',
    borderTopWidth: 1,
    borderTopColor: Colors.white10,
  },
  trailerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '38%',
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.accentPrimary,
    backgroundColor: Colors.accentDim,
    gap: 6,
  },
  trailerBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.accentPrimary,
    letterSpacing: 0.3,
  },
  watchlistBtnWrapper: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  watchlistBtnFull: {
    flex: 1,
  },
  watchlistBtn: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  watchlistBtnIcon: {
    marginRight: -2,
  },
  watchlistBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textOnAccent,
    letterSpacing: 0.3,
  },
  watchlistBtnTextAdded: {
    color: Colors.textSecondary,
  },
});
