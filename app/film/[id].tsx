/**
 * Film Detay ekrani — modern redesign v2.
 *
 * Layout (yukaridan asagiya):
 *   - Hero: YouTube trailer (full-width 16:9) veya backdrop gorseli
 *   - Film baslik (tam genislik, sol hizali)
 *   - Meta inline: "1h 19m  •  2021  •  United States  ⭐ 9.7"
 *   - Genre pill'leri
 *   - Watch Trailer butonu (tam genislik, sadece trailer varsa)
 *   - CTA satiri: [I Watched It] [+ Watchlist] yan yana
 *   - "Why this film?" AI aciklama karti
 *   - Overview / Film konusu
 *   - Cast: yatay scroll portrait karti
 *   - Director & Crew
 *   - Watch On: streaming platform loglari
 *
 * Watchlist ekleme/cikartma: header sag heart ikonu + CTA satiri
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import YoutubePlayer from 'react-native-youtube-iframe';

import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { hapticMedium } from '@/utils/haptics';

import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Film } from '@/types/film';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMood } from '@/contexts/MoodContext';
import { supabase } from '@/services/supabase';
import {
  addToWatchlist,
  toggleWatched,
  getWatchedFilmIds,
  removeFromWatchlist,
  getWatchlist,
} from '@/services/watchlist';
import { explainBatch, type FilmForExplanation } from '@/services/matchExplanation';
import {
  fetchMovieDetails,
  fetchMovieWatchProviders,
  type TmdbCredits,
  type TmdbWatchProviders,
  type TmdbProvider,
} from '@/services/tmdb';
import { localizeGenre } from '@/utils/filmFilters';
import { Colors } from '@/constants/Colors';
import SkeletonLoader from '@/components/SkeletonLoader';
import { FilmShareCard, useShareCapture } from '@/components/ShareCards';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** YouTube 16:9 hero yuksekligi */
const HERO_HEIGHT = Math.round(SCREEN_WIDTH * (9 / 16));

/** Cast portrait kart boyutlari */
const CAST_CARD_WIDTH = 88;
const CAST_CARD_HEIGHT = 118;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── DB satir tipi ─────────────────────────────────────────────────────────────

interface FilmDbRow {
  id: string;
  tmdb_id: number | null;
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

// ── Yardimcilar ───────────────────────────────────────────────────────────────

/** TMDb path -> tam URL */
function toTmdbUrl(path: string | null, size = 'w780'): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

/** Dakika -> "1h 40m" */
function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Video listesinden en iyi YouTube trailer anahtarini secer.
 * Oncelik: official trailer > trailer > herhangi YouTube video.
 */
function pickYouTubeKey(
  videos: Array<{ site: string; type: string; official: boolean; key: string }>,
): string | null {
  const ytVideos = videos.filter((v) => v.site === 'YouTube');
  return (
    ytVideos.find((v) => v.official && v.type === 'Trailer')?.key ??
    ytVideos.find((v) => v.type === 'Trailer')?.key ??
    ytVideos[0]?.key ??
    null
  );
}

/**
 * Crew listesinden belirli bir job'i bulur.
 * Birden fazla esleme varsa ilkini dondurur.
 */
function findCrewByJob(crew: TmdbCredits['crew'], job: string): string | null {
  return crew.find((c) => c.job === job)?.name ?? null;
}

// ── Kucuk Sub-Bilesenler ─────────────────────────────────────────────────────

interface CastCardProps {
  name: string;
  character?: string;
  avatarUrl?: string;
}

/**
 * Portrait-rectangle oyuncu karti.
 * Yuvarlak cerceveli buyuk resim + isim + karakter/rol metni.
 */
function CastCard({ name, character, avatarUrl }: CastCardProps) {
  return (
    <View style={styles.castCard}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={styles.castCardImage}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.castCardImage, styles.castCardPlaceholder]}>
          <Ionicons name="person-outline" size={28} color={Colors.textTertiary} />
        </View>
      )}
      <Text style={styles.castCardName} numberOfLines={2}>
        {name}
      </Text>
      {!!character && (
        <Text style={styles.castCardCharacter} numberOfLines={2}>
          {character}
        </Text>
      )}
    </View>
  );
}

/** Genre etiket chip'i */
function GenreChip({ label }: { label: string }) {
  return (
    <View style={styles.genreChip}>
      <Text style={styles.genreChipText}>{label}</Text>
    </View>
  );
}

/** Streaming provider logo chip'i */
function ProviderLogo({ provider }: { provider: TmdbProvider }) {
  const uri = toTmdbUrl(provider.logo_path, 'w92');
  if (!uri) return null;
  return (
    <View style={styles.providerItem}>
      <Image
        source={{ uri }}
        style={styles.providerLogo}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <Text style={styles.providerName} numberOfLines={2}>
        {provider.provider_name}
      </Text>
    </View>
  );
}

// ── Ana Ekran ─────────────────────────────────────────────────────────────────

/**
 * Film Detay ekrani.
 * route param: id → Supabase films.id (UUID)
 */
export default function FilmDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useLanguage();
  const { currentProfile, presetMoodText, currentSessionId } = useMood();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Temel film verisi ───────────────────────────────────────────────────────
  const [film, setFilm] = useState<Film | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // ── TMDB zengin veri ────────────────────────────────────────────────────────
  const [youtubeKey, setYoutubeKey] = useState<string | null>(null);
  const [tmdbCredits, setTmdbCredits] = useState<TmdbCredits | null>(null);
  const [watchProviders, setWatchProviders] = useState<TmdbWatchProviders | null>(null);
  const [country, setCountry] = useState<string | null>(null);

  // ── Watchlist & izleme durumu ───────────────────────────────────────────────
  const [watchlistAdded, setWatchlistAdded] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const [isInWatchlist, setIsInWatchlist] = useState(false);

  // ── AI aciklama ─────────────────────────────────────────────────────────────
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);

  // ── YouTube oynatma durumu ────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);

  // ── Paylasim ────────────────────────────────────────────────────────────────
  const { cardRef: shareCardRef, share: shareFilmCard } = useShareCapture();

  // ── Film verisi yukle ───────────────────────────────────────────────────────

  const loadFilm = useCallback(async () => {
    if (!id || id === 'undefined' || !UUID_REGEX.test(id)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(false);

    try {
      const { data, error } = await supabase
        .from('films')
        .select(
          'id, tmdb_id, title, year, poster_url, backdrop_url, overview, runtime, vote_average, director, trailer_url, genres, cast_json',
        )
        .eq('id', id)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') setLoadError(true);
        setLoading(false);
        return;
      }

      if (data) {
        const row = data as FilmDbRow;

        // DB fallback degerler
        let enOverview = row.overview ?? undefined;
        let enTitle = row.title;
        let enPosterUrl = toTmdbUrl(row.poster_url);

        // DB cast — TMDB credits gelmezse kullanilir
        const dbCast = (row.cast_json ?? []).map((a) => ({
          name: a.name,
          avatarUrl: a.profile_path ? toTmdbUrl(a.profile_path, 'w185') : undefined,
        }));

        if (row.tmdb_id) {
          // Tek TMDB istegi — append_to_response=videos,credits ile
          const [tmdbDetails, providers] = await Promise.all([
            fetchMovieDetails(row.tmdb_id),
            fetchMovieWatchProviders(row.tmdb_id),
          ]);

          if (tmdbDetails) {
            if (tmdbDetails.overview) enOverview = tmdbDetails.overview;
            if (tmdbDetails.title) enTitle = tmdbDetails.title;
            if (tmdbDetails.poster_path) enPosterUrl = toTmdbUrl(tmdbDetails.poster_path);
            const firstCountry = tmdbDetails.production_countries?.[0];
            if (firstCountry) setCountry(firstCountry.name);

            // Credits — append_to_response ile gelen veri
            if (tmdbDetails.credits) setTmdbCredits(tmdbDetails.credits);

            // Videos — append_to_response ile gelen veri
            if (tmdbDetails.videos?.results) {
              const key = pickYouTubeKey(tmdbDetails.videos.results);
              if (key) setYoutubeKey(key);
            }
          }

          if (providers) setWatchProviders(providers);
        }

        setFilm({
          id: row.id,
          title: enTitle,
          year: row.year ?? 0,
          posterUrl: enPosterUrl,
          backdropUrl: toTmdbUrl(row.backdrop_url, 'w1280'),
          overview: enOverview,
          runtime: row.runtime ?? undefined,
          voteAverage: row.vote_average ?? undefined,
          director: row.director ?? undefined,
          trailerUrl: row.trailer_url ?? undefined,
          matchScore: 0,
          moodTags: row.genres?.slice(0, 4) ?? [],
          whyThisFilm: '',
          cast: dbCast.length > 0 ? dbCast : undefined,
        });
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadFilm();
  }, [loadFilm]);

  /** Izlendi durumu */
  useEffect(() => {
    if (!id || !UUID_REGEX.test(id)) return;
    getWatchedFilmIds()
      .then((set) => setIsWatched(set.has(id)))
      .catch(() => {});
  }, [id]);

  /** Watchlist kontrolu */
  useEffect(() => {
    if (!id || !UUID_REGEX.test(id)) return;
    getWatchlist()
      .then((list) => {
        const found = list.some((item) => item.film.id === id);
        setIsInWatchlist(found);
        if (found) setWatchlistAdded(true);
      })
      .catch(() => {});
  }, [id]);

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
        if (active && map[film.id]) setExplanation(map[film.id]);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setExplanationLoading(false);
      });

    return () => {
      active = false;
    };
  }, [film, currentProfile, explanation]);

  // ── Aksiyonlar ──────────────────────────────────────────────────────────────

  /** YouTube veya mevcut trailerUrl'i acar */
  const handleWatchNow = () => {
    const url = youtubeKey
      ? `https://www.youtube.com/watch?v=${youtubeKey}`
      : film?.trailerUrl ?? null;
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  };

  const handleAddToWatchlist = async () => {
    if (!film || watchlistAdded) return;
    hapticMedium();
    try {
      await addToWatchlist(film, currentSessionId);
      setWatchlistAdded(true);
      setIsInWatchlist(true);
    } catch {
      Alert.alert(t('errors.generic'), t('errors.watchlistSave'));
    }
  };

  const handleRemoveFromWatchlist = useCallback(() => {
    if (!film) return;
    Alert.alert(t('filmDetail.removeFromWatchlist'), t('filmDetail.removeConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: async () => {
          hapticMedium();
          const success = await removeFromWatchlist(film.id);
          if (success) {
            setIsInWatchlist(false);
            setWatchlistAdded(false);
          } else {
            Alert.alert(t('errors.generic'), t('errors.watchlistRemove'));
          }
        },
      },
    ]);
  }, [film, t]);

  const handleToggleWatched = useCallback(async () => {
    if (!film) return;
    hapticMedium();
    const newState = await toggleWatched(film.id);
    setIsWatched(newState);
  }, [film]);

  const handleShare = () => {
    if (!film) return;
    shareFilmCard();
  };

  // ── Yukleniyor ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.root}>
          <SkeletonLoader width="100%" height={HERO_HEIGHT} borderRadius={0} />
          <View style={styles.skeletonContent}>
            <SkeletonLoader width="75%" height={32} borderRadius={8} style={{ marginTop: 20 }} />
            <SkeletonLoader width="55%" height={14} borderRadius={6} style={{ marginTop: 12 }} />
            <SkeletonLoader width="100%" height={50} borderRadius={14} style={{ marginTop: 24 }} />
            <SkeletonLoader width="100%" height={50} borderRadius={14} style={{ marginTop: 10 }} />
          </View>
        </View>
      </>
    );
  }

  // ── Hata durumu ─────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.notFoundContainer}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={Colors.textWhite} />
          </TouchableOpacity>
          <Ionicons
            name="cloud-offline-outline"
            size={48}
            color={Colors.textGrey}
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.notFoundTitle}>{t('errors.generic')}</Text>
          <Text style={styles.notFoundText}>{t('filmDetail.loadError')}</Text>
          <TouchableOpacity onPress={loadFilm} style={styles.retryButton} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>{t('errors.retry')}</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

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

  // ── Hesaplamalar ─────────────────────────────────────────────────────────────

  const backdropUri = film.backdropUrl || film.posterUrl;
  const hasTrailer = !!(youtubeKey || film.trailerUrl);

  /**
   * Inline meta string parcalari.
   * Bos parcalar filtre edilir, aralarinda bullet separator konur.
   */
  const metaParts: string[] = [
    film.runtime != null ? formatRuntime(film.runtime) : '',
    film.year > 0 ? String(film.year) : '',
    country ?? '',
  ].filter(Boolean);

  interface DisplayCastMember {
    name: string;
    character?: string;
    avatarUrl?: string;
  }

  /** TMDB credits > DB cast_json fallback */
  const displayCast: DisplayCastMember[] =
    tmdbCredits && tmdbCredits.cast.length > 0
      ? tmdbCredits.cast.slice(0, 10).map((c) => ({
          name: c.name,
          character: c.character,
          avatarUrl: c.profile_path ? toTmdbUrl(c.profile_path, 'w185') : undefined,
        }))
      : (film.cast ?? []).map((c) => ({ name: c.name, avatarUrl: c.avatarUrl }));

  /** Kritik crew rolleri */
  const crewRows: Array<{ label: string; name: string }> = [];
  if (tmdbCredits) {
    const director =
      findCrewByJob(tmdbCredits.crew, 'Director') ?? film.director ?? null;
    const writer =
      findCrewByJob(tmdbCredits.crew, 'Screenplay') ??
      findCrewByJob(tmdbCredits.crew, 'Writer') ??
      null;
    const dop = findCrewByJob(tmdbCredits.crew, 'Director of Photography');
    const composer = findCrewByJob(tmdbCredits.crew, 'Original Music Composer');
    if (director) crewRows.push({ label: t('filmDetail.director'), name: director });
    if (writer) crewRows.push({ label: 'Screenplay', name: writer });
    if (dop) crewRows.push({ label: 'Cinematography', name: dop });
    if (composer) crewRows.push({ label: 'Music', name: composer });
  } else if (film.director) {
    crewRows.push({ label: t('filmDetail.director'), name: film.director });
  }

  /** Flatrate > rent > buy siralamasiyla birlesik provider listesi (tekrarsiz) */
  const allProviders: TmdbProvider[] = [];
  const seenIds = new Set<number>();
  const addProviders = (list?: TmdbProvider[]) => {
    list?.forEach((p) => {
      if (!seenIds.has(p.provider_id)) {
        seenIds.add(p.provider_id);
        allProviders.push(p);
      }
    });
  };
  addProviders(watchProviders?.flatrate);
  addProviders(watchProviders?.rent);
  addProviders(watchProviders?.buy);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.root}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── HERO: YouTube player, thumbnail veya backdrop ── */}
          <View style={styles.heroContainer}>
            {youtubeKey ? (
              <View style={styles.heroPlayer}>
                <YoutubePlayer
                  height={HERO_HEIGHT}
                  width={SCREEN_WIDTH}
                  videoId={youtubeKey}
                  play={isPlaying}
                  onChangeState={(state: string) => {
                    if (state === 'ended') setIsPlaying(false);
                  }}
                  webViewProps={{
                    injectedJavaScript: 'document.body.style.backgroundColor = "#0A0A0A";',
                  }}
                />
              </View>
            ) : backdropUri ? (
              <Image
                source={{ uri: backdropUri }}
                style={styles.heroImage}
                contentFit="cover"
                blurRadius={12}
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.heroImage, styles.heroPlaceholder]} />
            )}

            {/* Alt gradient — sadece video yokken */}
            {!youtubeKey && (
              <>
                <LinearGradient
                  colors={['transparent', 'rgba(10,10,10,0.85)', Colors.background]}
                  style={StyleSheet.absoluteFill}
                  locations={[0.45, 0.75, 1]}
                />
                <LinearGradient
                  colors={['rgba(234,219,198,0.06)', 'transparent']}
                  style={StyleSheet.absoluteFill}
                  locations={[0, 0.5]}
                />
              </>
            )}
          </View>

          {/* ── Film baslik ── */}
          <Animated.View
            style={styles.titleBlock}
            entering={FadeInDown.duration(350).delay(100)}
          >
            <Text style={styles.filmTitle} numberOfLines={3}>
              {film.title}
            </Text>
          </Animated.View>

          {/* ── Meta inline: "1h 19m • 2021 • United States  ⭐ 9.7" ── */}
          <Animated.View
            style={styles.metaRow}
            entering={FadeInDown.duration(300).delay(160)}
          >
            <Text style={styles.metaText}>
              {metaParts.join('  •  ')}
            </Text>
            {film.voteAverage != null && (
              <View style={styles.ratingPill}>
                <Text style={styles.ratingStar}>⭐</Text>
                <Text style={styles.ratingValue}>
                  {film.voteAverage.toFixed(1)}
                </Text>
              </View>
            )}
          </Animated.View>

          {/* ── Genre pill'leri ── */}
          {film.moodTags.length > 0 && (
            <Animated.View
              style={styles.genreRow}
              entering={FadeInDown.duration(300).delay(200)}
            >
              {film.moodTags.map((g) => (
                <GenreChip key={g} label={localizeGenre(g, language)} />
              ))}
            </Animated.View>
          )}

          {/* ── Watch Trailer — tam genislik, sadece trailer varsa ── */}
          {hasTrailer && (
            <Animated.View
              style={styles.trailerBtnWrapper}
              entering={FadeInUp.duration(300).delay(240)}
            >
              <TouchableOpacity
                onPress={handleWatchNow}
                activeOpacity={0.85}
                style={styles.trailerBtnTouchable}
              >
                <LinearGradient
                  colors={[Colors.accentPrimary, Colors.accentHover]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.trailerBtnGradient}
                >
                  <Ionicons name="play-circle" size={22} color={Colors.textOnAccent} />
                  <Text style={styles.trailerBtnText}>{t('filmDetail.watchNow')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── CTA satiri: [I Watched It]  [+ Watchlist] yan yana ── */}
          <Animated.View
            style={styles.ctaRow}
            entering={FadeInUp.duration(300).delay(280)}
          >
            {/* I Watched It — ikincil, solda */}
            <TouchableOpacity
              style={[
                styles.ctaWatched,
                isWatched && styles.ctaWatchedActive,
              ]}
              onPress={handleToggleWatched}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isWatched ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={20}
                color={isWatched ? Colors.success : Colors.textSecondary}
              />
              <Text
                style={[
                  styles.ctaWatchedText,
                  isWatched && styles.ctaWatchedTextActive,
                ]}
                numberOfLines={1}
              >
                {isWatched ? t('watchlist.markedWatched') : t('watchlist.markAsWatched')}
              </Text>
            </TouchableOpacity>

            {/* Add to Watchlist — birincil, sagda */}
            <TouchableOpacity
              style={[
                styles.ctaWatchlist,
                watchlistAdded && styles.ctaWatchlistAdded,
              ]}
              onPress={watchlistAdded ? undefined : handleAddToWatchlist}
              activeOpacity={watchlistAdded ? 1 : 0.85}
            >
              <Ionicons
                name={watchlistAdded ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={watchlistAdded ? Colors.textOnAccent : Colors.textOnAccent}
              />
              <Text style={styles.ctaWatchlistText} numberOfLines={1}>
                {watchlistAdded
                  ? t('filmDetail.addedToWatchlist')
                  : t('filmDetail.addToWatchlist')}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ── "Why this film?" AI aciklama ── */}
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

          {/* ── Overview / Film konusu ── */}
          {!!film.overview && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('filmDetail.moodExplanation')}</Text>
              <Text style={styles.sectionBody}>{film.overview}</Text>
            </View>
          )}

          {/* ── Cast: portrait kart ── */}
          {displayCast.length > 0 && (
            <View style={styles.castSection}>
              <Text style={styles.sectionTitle}>{t('filmDetail.cast')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.castList}
              >
                {displayCast.map((actor) => (
                  <CastCard
                    key={actor.name}
                    name={actor.name}
                    character={actor.character}
                    avatarUrl={actor.avatarUrl}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Director & Crew ── */}
          {crewRows.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('filmDetail.crew')}</Text>
              <View style={styles.crewList}>
                {crewRows.map((row) => (
                  <View key={row.label} style={styles.crewRow}>
                    <Text style={styles.crewLabel}>{row.label}</Text>
                    <Text style={styles.crewName}>{row.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Watch On (streaming platformlar) ── */}
          {allProviders.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('filmDetail.watchOn')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.providerList}
              >
                {allProviders.map((p) => (
                  <ProviderLogo key={p.provider_id} provider={p} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Listeden cikar linki — en altta ── */}
          {isInWatchlist && (
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={handleRemoveFromWatchlist}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
              <Text style={styles.removeBtnText}>{t('filmDetail.removeFromWatchlist')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* ── Header butonlari (position: absolute) ── */}
        <View style={[styles.header, { top: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerBtn}
            activeOpacity={0.75}
          >
            <Ionicons name="chevron-down" size={22} color={Colors.textWhite} />
          </TouchableOpacity>

          <View style={styles.headerRight}>
            {/* Watchlist heart */}
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

            {/* Paylasim */}
            <TouchableOpacity
              onPress={handleShare}
              style={styles.headerBtn}
              activeOpacity={0.75}
            >
              <Ionicons name="share-outline" size={20} color={Colors.textWhite} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Offscreen share card */}
      {film && (
        <FilmShareCard
          ref={shareCardRef}
          film={{
            title: film.title,
            year: film.year ?? null,
            genres: (film.moodTags ?? []).map((g) => localizeGenre(g, language)),
            voteAverage: film.voteAverage ?? null,
            posterUrl: film.posterUrl ?? null,
          }}
          moodText={presetMoodText ?? null}
        />
      )}
    </>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  skeletonContent: {
    paddingHorizontal: 20,
  },

  // ── Not found / error ────────────────────────────────────────────────────────
  notFoundContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
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
    textAlign: 'center',
  },
  notFoundText: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
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

  // ── ScrollView ───────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },

  // ── HERO ─────────────────────────────────────────────────────────────────────
  heroContainer: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
  },
  heroPlayer: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  heroPlaceholder: {
    backgroundColor: Colors.bgCard,
  },

  // ── Title block ──────────────────────────────────────────────────────────────
  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  filmTitle: {
    fontSize: 26,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.textWhite,
    lineHeight: 34,
    letterSpacing: -0.3,
  },

  // ── Meta inline ──────────────────────────────────────────────────────────────
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  metaText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.goldDim,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.25)',
  },
  ratingStar: {
    fontSize: 11,
  },
  ratingValue: {
    fontSize: 13,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.gold,
  },

  // ── Genre pill'leri ───────────────────────────────────────────────────────────
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  genreChip: {
    backgroundColor: Colors.accentDim,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(234,219,198,0.2)',
  },
  genreChipText: {
    fontSize: 12,
    color: Colors.accentPrimary,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // ── Watch Trailer butonu ──────────────────────────────────────────────────────
  trailerBtnWrapper: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  trailerBtnTouchable: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  trailerBtnGradient: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  trailerBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textOnAccent,
    letterSpacing: 0.4,
  },

  // ── CTA satiri: [I Watched It]  [+ Watchlist] ────────────────────────────────
  ctaRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 10,
  },

  /** I Watched It — ikincil, translucent */
  ctaWatched: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.white10,
    backgroundColor: Colors.white05,
    gap: 7,
  },
  ctaWatchedActive: {
    borderColor: Colors.success,
    backgroundColor: 'rgba(34,197,94,0.08)',
  },
  ctaWatchedText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  ctaWatchedTextActive: {
    color: Colors.success,
  },

  /** Add to Watchlist — birincil, dolu */
  ctaWatchlist: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.accentPrimary,
    gap: 7,
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaWatchlistAdded: {
    backgroundColor: Colors.bgElevated,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaWatchlistText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textOnAccent,
    letterSpacing: 0.2,
  },

  // ── "Why this film?" ──────────────────────────────────────────────────────────
  whySection: {
    marginTop: 24,
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: Colors.accentDim,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(234,219,198,0.2)',
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

  // ── Section genel ─────────────────────────────────────────────────────────────
  section: {
    marginTop: 28,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 14,
  },
  sectionBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // ── Cast: portrait karti ──────────────────────────────────────────────────────
  castSection: {
    marginTop: 28,
    paddingHorizontal: 20,
  },
  castList: {
    gap: 10,
    paddingRight: 20,
  },
  castCard: {
    width: CAST_CARD_WIDTH,
    alignItems: 'center',
    gap: 6,
  },
  castCardImage: {
    width: CAST_CARD_WIDTH,
    height: CAST_CARD_HEIGHT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.white10,
    backgroundColor: Colors.bgCard,
  },
  castCardPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  castCardName: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 15,
  },
  castCardCharacter: {
    fontSize: 10,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 14,
    fontStyle: 'italic',
  },

  // ── Director & Crew ───────────────────────────────────────────────────────────
  crewList: {
    gap: 10,
  },
  crewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.white05,
    borderRadius: 10,
  },
  crewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
    width: 90,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  crewName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // ── Watch On ──────────────────────────────────────────────────────────────────
  providerList: {
    gap: 14,
    paddingRight: 20,
  },
  providerItem: {
    alignItems: 'center',
    gap: 6,
    width: 64,
  },
  providerLogo: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.white10,
  },
  providerName: {
    fontSize: 10,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontWeight: '500',
  },

  // ── Remove from watchlist ─────────────────────────────────────────────────────
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginHorizontal: 20,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.05)',
    gap: 6,
  },
  removeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.error,
    letterSpacing: 0.2,
  },

  // ── Header overlay ────────────────────────────────────────────────────────────
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnActive: {
    backgroundColor: Colors.accentDim,
  },
});
