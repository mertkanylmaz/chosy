/**
 * Film Detay ekrani — redesign v3 (dark glassmorphism).
 *
 * Layout (yukaridan asagiya):
 *   - Blurred poster background (absoluteFill, blurRadius=28)
 *   - Trailer section: rounded card, YouTube thumbnail/backdrop, kirmizi play butonu,
 *     TRAILER label gradient, glassmorphic bookmark+share butonlari (sag ust)
 *   - Action row: WATCH NOW + WATCHED pill butonlari
 *   - Info card (bottom sheet, karanlik, top-radius 30):
 *       Meta row (runtime • year • country) + rating pill
 *       Buyuk uppercase baslik (PlayfairDisplay_900Black)
 *       Genre chip'leri (yatay scroll)
 *       "Why this film?" AI karti (varsa)
 *       WATCH ON section (provider ikonlari + JustWatch atfi)
 *       SYNOPSIS
 *       CASTING (yatay FlatList, portrait foto)
 *       DIRECTOR & CREW (yatay FlatList, foto + rol)
 *       Remove watchlist linki (varsa)
 *       TMDB attribution footer
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  Dimensions,
  FlatList,
  Linking,
  ScrollView,
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
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';

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
import { hapticMedium } from '@/utils/haptics';
import { tasteSignals } from '@/services/tasteSignalService';
import { posthogAnalytics } from '@/services/posthog';
import { logger } from '@/utils/logger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Trailer bolumu genisligi (yatay margin hesabi) */
const TRAILER_WIDTH = SCREEN_WIDTH - 32;
/** Trailer bolumu yuksekligi — 16:9 oran */
const TRAILER_HEIGHT = Math.round(TRAILER_WIDTH * (9 / 16));

/** Cast/crew kart boyutlari — 4:5 oran */
const CAST_CARD_WIDTH = 82;
const CAST_CARD_HEIGHT = 103;

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

/** Ekranda gosterilen crew satiri */
interface CrewDisplayItem {
  label: string;
  name: string;
  avatarUrl?: string;
}

// ── Yardimcilar ───────────────────────────────────────────────────────────────

/** TMDb path → tam URL donusturur */
function toTmdbUrl(path: string | null, size = 'w780'): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

/**
 * Dakikay "2H22" / "45M" formatina donusturur.
 * Tasarim: buyuk harf, sifir dolgulu dakika.
 */
function formatRuntimeShort(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}H${m.toString().padStart(2, '0')}`;
  return `${m}M`;
}

/**
 * YouTube trailer anahtarini secer.
 * Oncelik: official trailer > trailer > ilk YouTube video.
 */
function pickYouTubeKey(
  videos: Array<{ site: string; type: string; official: boolean; key: string }>,
): string | null {
  const yt = videos.filter((v) => v.site === 'YouTube');
  return (
    yt.find((v) => v.official && v.type === 'Trailer')?.key ??
    yt.find((v) => v.type === 'Trailer')?.key ??
    yt[0]?.key ??
    null
  );
}

// ── Sub-bilesenler ────────────────────────────────────────────────────────────

/** Section baslik satiri — opsiyonel sag element destekler */
function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
      {right}
    </View>
  );
}

/** Genre etiket pill */
function GenreChip({ label }: { label: string }) {
  return (
    <View style={styles.genreChip}>
      <Text style={styles.genreChipText}>{label}</Text>
    </View>
  );
}

interface CastCardProps {
  name: string;
  character?: string;
  avatarUrl?: string;
}

/**
 * Portrait oyuncu karti.
 * 4:5 oran foto + isim + karakter (opsiyonel).
 */
function CastCard({ name, character, avatarUrl }: CastCardProps) {
  return (
    <View style={styles.personCard}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={styles.personCardImg}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.personCardImg, styles.personCardPlaceholder]}>
          <Ionicons name="person-outline" size={26} color={Colors.textTertiary} />
        </View>
      )}
      <Text style={styles.personCardName} numberOfLines={1}>
        {name}
      </Text>
      {!!character && (
        <Text style={styles.personCardRole} numberOfLines={1}>
          {character}
        </Text>
      )}
    </View>
  );
}

/**
 * Crew karti — cast karti ile ayni gorsel, rol etiketi altinda.
 */
function CrewCard({
  name,
  role,
  avatarUrl,
}: {
  name: string;
  role: string;
  avatarUrl?: string;
}) {
  return (
    <View style={styles.personCard}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={styles.personCardImg}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.personCardImg, styles.personCardPlaceholder]}>
          <Ionicons name="person-outline" size={26} color={Colors.textTertiary} />
        </View>
      )}
      <Text style={styles.personCardName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.personCardRole} numberOfLines={1}>
        {role}
      </Text>
    </View>
  );
}

/** Streaming platform ikon karti */
function ProviderIcon({ provider }: { provider: TmdbProvider }) {
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

/**
 * Resmi TMDB logo SVG'si — style class'lari inline fill'e donusturulmus,
 * react-native-svg SvgXml ile render edilir.
 * Kaynak: themoviedb.org/about/logos-attribution
 */
const TMDB_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 273.42 35.52"><defs><linearGradient id="tmdb-grad" y1="17.76" x2="273.42" y2="17.76" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#90cea1"/><stop offset="0.56" stop-color="#3cbec9"/><stop offset="1" stop-color="#00b3e5"/></linearGradient></defs><g><g><path fill="url(#tmdb-grad)" d="M191.85,35.37h63.9A17.67,17.67,0,0,0,273.42,17.7h0A17.67,17.67,0,0,0,255.75,0h-63.9A17.67,17.67,0,0,0,174.18,17.7h0A17.67,17.67,0,0,0,191.85,35.37ZM10.1,35.42h7.8V6.92H28V0H0v6.9H10.1Zm28.1,0H46V8.25h.1L55.05,35.4h6L70.3,8.25h.1V35.4h7.8V0H66.45l-8.2,23.1h-.1L50,0H38.2ZM89.14.12h11.7a33.56,33.56,0,0,1,8.08,1,18.52,18.52,0,0,1,6.67,3.08,15.09,15.09,0,0,1,4.53,5.52,18.5,18.5,0,0,1,1.67,8.25,16.91,16.91,0,0,1-1.62,7.58,16.3,16.3,0,0,1-4.38,5.5,19.24,19.24,0,0,1-6.35,3.37,24.53,24.53,0,0,1-7.55,1.15H89.14Zm7.8,28.2h4a21.66,21.66,0,0,0,5-.55A10.58,10.58,0,0,0,110,26a8.73,8.73,0,0,0,2.68-3.35,11.9,11.9,0,0,0,1-5.08,9.87,9.87,0,0,0-1-4.52,9.17,9.17,0,0,0-2.63-3.18A11.61,11.61,0,0,0,106.22,8a17.06,17.06,0,0,0-4.68-.63h-4.6ZM133.09.12h13.2a32.87,32.87,0,0,1,4.63.33,12.66,12.66,0,0,1,4.17,1.3,7.94,7.94,0,0,1,3,2.72,8.34,8.34,0,0,1,1.15,4.65,7.48,7.48,0,0,1-1.67,5,9.13,9.13,0,0,1-4.43,2.82V17a10.28,10.28,0,0,1,3.18,1,8.51,8.51,0,0,1,2.45,1.85,7.79,7.79,0,0,1,1.57,2.62,9.16,9.16,0,0,1,.55,3.2,8.52,8.52,0,0,1-1.2,4.68,9.32,9.32,0,0,1-3.1,3A13.38,13.38,0,0,1,152.32,35a22.5,22.5,0,0,1-4.73.5h-14.5Zm7.8,14.15h5.65a7.65,7.65,0,0,0,1.78-.2,4.78,4.78,0,0,0,1.57-.65,3.43,3.43,0,0,0,1.13-1.2,3.63,3.63,0,0,0,.42-1.8A3.3,3.3,0,0,0,151,8.6a3.42,3.42,0,0,0-1.23-1.13A6.07,6.07,0,0,0,148,6.9a9.9,9.9,0,0,0-1.85-.18h-5.3Zm0,14.65h7a8.27,8.27,0,0,0,1.83-.2,4.67,4.67,0,0,0,1.67-.7,3.93,3.93,0,0,0,1.23-1.3,3.8,3.8,0,0,0,.47-1.95,3.16,3.16,0,0,0-.62-2,4,4,0,0,0-1.58-1.18,8.23,8.23,0,0,0-2-.55,15.12,15.12,0,0,0-2.05-.15h-5.9Z"/></g></g></svg>`;

/** TMDB attribution footer — resmi SVG logo ile */
function TmdbFooter({ text }: { text: string }) {
  return (
    <View style={styles.tmdbFooter}>
      <Text style={styles.tmdbAttributionText}>{text}</Text>
      <View style={styles.tmdbLogoWrap}>
        <SvgXml xml={TMDB_LOGO_SVG} width={90} height={12} />
      </View>
    </View>
  );
}

// ── Ana Ekran ─────────────────────────────────────────────────────────────────

/**
 * Film Detay ekrani v3.
 * route param: id → Supabase films.id (UUID)
 */
export default function FilmDetailScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const { t, language } = useLanguage();
  const { currentProfile, presetMoodText, currentSessionId } = useMood();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Temel film verisi ────────────────────────────────────────────────────────
  const [film, setFilm] = useState<Film | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // ── TMDB zengin veri ─────────────────────────────────────────────────────────
  const [youtubeKey, setYoutubeKey] = useState<string | null>(null);
  const [tmdbCredits, setTmdbCredits] = useState<TmdbCredits | null>(null);
  const [watchProviders, setWatchProviders] = useState<TmdbWatchProviders | null>(null);
  const [country, setCountry] = useState<string | null>(null);

  // ── Watchlist & izleme ───────────────────────────────────────────────────────
  const [watchlistAdded, setWatchlistAdded] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const [isInWatchlist, setIsInWatchlist] = useState(false);

  // ── AI aciklama ──────────────────────────────────────────────────────────────
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);

  // ── YouTube thumbnail fallback ───────────────────────────────────────────────
  /**
   * YouTube thumbnail kalite fallback seviyesi.
   * 0 = maxresdefault (1280×720) → 1 = hqdefault (480×360) → 2 = backdrop/poster
   * Eski filmler icin maxresdefault 404 donebilir; onError ile bir sonraki seviyeye dusuler.
   */
  const [thumbnailFallbackLevel, setThumbnailFallbackLevel] = useState(0);

  // ── Paylasim ─────────────────────────────────────────────────────────────────
  const { cardRef: shareCardRef, share: shareFilmCard } = useShareCapture();

  // ── Film verisi yukle ────────────────────────────────────────────────────────

  const loadFilm = useCallback(async () => {
    if (!id || id === 'undefined' || !UUID_REGEX.test(id)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(false);
    setThumbnailFallbackLevel(0);

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

        let enOverview = row.overview ?? undefined;
        let enTitle = row.title;
        let enPosterUrl = toTmdbUrl(row.poster_url);

        const dbCast = (row.cast_json ?? []).map((a) => ({
          name: a.name,
          // profile_path "/xyz.jpg" formatinda; temel URL dogrudan ekleniyor
          avatarUrl: a.profile_path
            ? `https://image.tmdb.org/t/p/w185${a.profile_path}`
            : undefined,
        }));

        if (row.tmdb_id) {
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
            if (tmdbDetails.credits) setTmdbCredits(tmdbDetails.credits);
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

  /** Push notification acildi — analytics (daily_pick, weekend_pick, mood_recall) */
  useEffect(() => {
    const notifSources = ['daily_pick', 'weekend_pick', 'mood_recall'] as const;
    if (!source || !id || !notifSources.includes(source as typeof notifSources[number])) return;

    posthogAnalytics.track('notification_opened', { film_id: id, source });

    // notification_log'da opened=true yapmak icin:
    // RLS sadece SELECT izin veriyor, UPDATE icin service_role gerekli.
    // Bu yuzden sadece PostHog event yeterli — server-side analytics ile eslestirilir.
    logger.log(`[FilmDetail] Opened from ${source} notification:`, id);
  }, [source, id]);

  /** Izlendi kontrolu */
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

  /** AI aciklama yukle */
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

  // ── Detail view dwell-time taste signal ────────────────────────────────────
  // Mount → unmount arası aktif süreyi ölçer, AppState background/foreground
  // geçişlerini hesaba katar. Sprint 2 TASK 2.1.G2.
  useEffect(() => {
    if (!id || !UUID_REGEX.test(id)) return;

    let accumulatedMs = 0;
    let lastActiveStart: number | null = Date.now();

    const recordIfActive = () => {
      if (lastActiveStart !== null) {
        accumulatedMs += Date.now() - lastActiveStart;
        lastActiveStart = null;
      }
    };

    const handleAppStateChange = (next: AppStateStatus) => {
      if (next === 'active') {
        if (lastActiveStart === null) lastActiveStart = Date.now();
      } else {
        recordIfActive();
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      recordIfActive();
      sub.remove();

      if (accumulatedMs >= 1000) {
        tasteSignals.recordDetailView(id, accumulatedMs).catch(() => {});
      }
    };
  }, [id]);

  // ── Aksiyonlar ───────────────────────────────────────────────────────────────

  /** YouTube veya trailerUrl'i acar */
  const handleWatchNow = () => {
    const url = youtubeKey
      ? `https://www.youtube.com/watch?v=${youtubeKey}`
      : film?.trailerUrl ?? null;
    if (url) Linking.openURL(url).catch(() => {});
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
    if (film) shareFilmCard();
  };

  // ── Yukleniyor ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.root}>
          <View style={{ paddingTop: insets.top + 60, paddingHorizontal: 16 }}>
            <SkeletonLoader
              width={TRAILER_WIDTH}
              height={TRAILER_HEIGHT}
              borderRadius={20}
            />
          </View>
          <View style={[styles.infoCard, { marginTop: 14 }]}>
            <SkeletonLoader width="70%" height={14} borderRadius={6} />
            <SkeletonLoader
              width="90%"
              height={38}
              borderRadius={8}
              style={{ marginTop: 12 }}
            />
            <SkeletonLoader
              width="100%"
              height={52}
              borderRadius={26}
              style={{ marginTop: 24 }}
            />
            <SkeletonLoader
              width="100%"
              height={52}
              borderRadius={26}
              style={{ marginTop: 10 }}
            />
          </View>
        </View>
      </>
    );
  }

  // ── Hata durumu ──────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { position: 'absolute', top: insets.top + 12, left: 16 }]}
          >
            <Ionicons name="chevron-down" size={22} color={Colors.textWhite} />
          </TouchableOpacity>
          <Ionicons
            name="cloud-offline-outline"
            size={48}
            color={Colors.textGrey}
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.errorTitle}>{t('errors.generic')}</Text>
          <Text style={styles.errorText}>{t('filmDetail.loadError')}</Text>
          <TouchableOpacity onPress={loadFilm} style={styles.retryBtn} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>{t('errors.retry')}</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  if (!film) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { position: 'absolute', top: insets.top + 12, left: 16 }]}
          >
            <Ionicons name="chevron-down" size={22} color={Colors.textWhite} />
          </TouchableOpacity>
          <Text style={styles.errorTitle}>{t('filmDetail.filmNotFoundTitle')}</Text>
          <Text style={styles.errorText}>{t('filmDetail.filmNotFoundText')}</Text>
        </View>
      </>
    );
  }

  // ── Hesaplamalar ──────────────────────────────────────────────────────────────

  const hasTrailer = !!(youtubeKey || film.trailerUrl);

  /**
   * Trailer bolumu icin gorsel URI — fallback zinciri:
   *   0: YouTube maxresdefault.jpg (1280×720, bazi eski filmler 404 donebilir)
   *   1: YouTube hqdefault.jpg     (480×360, her zaman mevcut)
   *   2: backdrop veya poster      (TMDB CDN)
   */
  const thumbnailUri: string | null = (() => {
    if (!youtubeKey) return film.backdropUrl || film.posterUrl || null;
    if (thumbnailFallbackLevel === 0)
      return `https://img.youtube.com/vi/${youtubeKey}/maxresdefault.jpg`;
    if (thumbnailFallbackLevel === 1)
      return `https://img.youtube.com/vi/${youtubeKey}/hqdefault.jpg`;
    return film.backdropUrl || film.posterUrl || null;
  })();

  /** maxresdefault 404 aldiysa bir sonraki fallback seviyesine gec */
  const handleThumbnailError = () => {
    if (youtubeKey && thumbnailFallbackLevel < 2) {
      setThumbnailFallbackLevel((prev) => prev + 1);
    }
  };

  /** Meta satirı: "2H22 • 1994 • UNITED STATES" */
  const metaParts = [
    film.runtime != null ? formatRuntimeShort(film.runtime) : null,
    film.year > 0 ? String(film.year) : null,
    country ? country.toUpperCase() : null,
  ].filter(Boolean) as string[];

  /** TMDB credits > DB cast_json fallback */
  interface DisplayCastMember {
    name: string;
    character?: string;
    avatarUrl?: string;
  }

  /**
   * profile_path daima "/abc.jpg" formatinda gelir.
   * toTmdbUrl yerine dogrudan URL insa edilerek edge-case'ler onleniyor.
   */
  const tmdbImgBase = 'https://image.tmdb.org/t/p/w185';

  const displayCast: DisplayCastMember[] =
    tmdbCredits && tmdbCredits.cast.length > 0
      ? tmdbCredits.cast.slice(0, 10).map((c) => ({
          name: c.name,
          character: c.character,
          avatarUrl: c.profile_path ? `${tmdbImgBase}${c.profile_path}` : undefined,
        }))
      : (film.cast ?? []).map((c) => ({ name: c.name, avatarUrl: c.avatarUrl }));

  /** Director / Producer / Composer — foto ile */
  const crewDisplay: CrewDisplayItem[] = [];
  if (tmdbCredits) {
    const findCrew = (job: string) => tmdbCredits.crew.find((c) => c.job === job);
    const director = findCrew('Director');
    const producer = findCrew('Producer') ?? findCrew('Executive Producer');
    const composer = findCrew('Original Music Composer');
    if (director)
      crewDisplay.push({
        label: t('filmDetail.director'),
        name: director.name,
        avatarUrl: director.profile_path ? `${tmdbImgBase}${director.profile_path}` : undefined,
      });
    if (producer)
      crewDisplay.push({
        label: 'Producer',
        name: producer.name,
        avatarUrl: producer.profile_path ? `${tmdbImgBase}${producer.profile_path}` : undefined,
      });
    if (composer)
      crewDisplay.push({
        label: 'Music',
        name: composer.name,
        avatarUrl: composer.profile_path ? `${tmdbImgBase}${composer.profile_path}` : undefined,
      });
  } else if (film.director) {
    crewDisplay.push({ label: t('filmDetail.director'), name: film.director });
  }

  /** Flatrate > rent > buy siralamasiyla tekrarsiz provider listesi */
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

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.root}>
        {/* ── Blurred poster background ── */}
        {film.posterUrl ? (
          <Image
            source={{ uri: film.posterUrl }}
            style={StyleSheet.absoluteFillObject}
            blurRadius={28}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : null}
        {/* Karanlik overlay — readability */}
        <View style={[StyleSheet.absoluteFillObject, styles.bgDim]} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Back button icin bosluk */}
          <View style={{ height: insets.top + 56 }} />

          {/* ──────────────── TRAILER SECTION ──────────────── */}
          <Animated.View
            style={styles.trailerWrapper}
            entering={FadeInDown.duration(420)}
          >
            {/*
             * Trailer thumbnail — daima statik gorsel, basin YouTube'da acar.
             * Inline YoutubePlayer kaldirildi: native module rebuild gerektiriyor
             * ve WebView overhead'i ekliyor. Linking.openURL daha guvenilir.
             */}
            <TouchableOpacity
              activeOpacity={hasTrailer ? 0.85 : 1}
              onPress={hasTrailer ? handleWatchNow : undefined}
              style={styles.trailerTouchable}
            >
              {thumbnailUri ? (
                <Image
                  source={{ uri: thumbnailUri }}
                  style={styles.trailerImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  onError={handleThumbnailError}
                />
              ) : (
                <View style={[styles.trailerImage, styles.trailerPlaceholder]} />
              )}

              {/* Kirmizi YouTube play butonu — her zaman goster (film bilgisi yuklendi) */}
              <View style={styles.redPlayOverlay}>
                <View style={[styles.redPlayBtn, !hasTrailer && styles.redPlayBtnDisabled]}>
                  <Ionicons
                    name="play"
                    size={24}
                    color={Colors.textWhite}
                    style={{ marginLeft: 3 }}
                  />
                </View>
              </View>

              {/* Alt gradient + TRAILER etiketi */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.80)']}
                style={styles.trailerGradient}
                locations={[0.25, 1]}
                pointerEvents="none"
              >
                <Text style={styles.trailerLabel}>
                  {t('filmDetail.trailer').toUpperCase()}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Glassmorphic bookmark + share butonlari (sag ust) */}
            <View style={styles.trailerTopRight}>
                <TouchableOpacity
                  style={[styles.glassBtn, watchlistAdded && styles.glassBtnActive]}
                  onPress={handleAddToWatchlist}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={watchlistAdded ? 'bookmark' : 'bookmark-outline'}
                    size={17}
                    color={watchlistAdded ? Colors.accentPrimary : Colors.textWhite}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.glassBtn}
                  onPress={handleShare}
                  activeOpacity={0.75}
                >
                  <Ionicons name="share-outline" size={17} color={Colors.textWhite} />
                </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ──────────────── ACTION BUTTONS ROW ──────────────── */}
          <Animated.View
            style={styles.actionRow}
            entering={FadeInDown.duration(380).delay(80)}
          >
            {/* WATCH NOW */}
            <TouchableOpacity
              style={[styles.actionBtn, !hasTrailer && styles.actionBtnDisabled]}
              onPress={handleWatchNow}
              activeOpacity={hasTrailer ? 0.8 : 1}
            >
              <Ionicons
                name="play-circle-outline"
                size={17}
                color={hasTrailer ? Colors.textWhite : Colors.textTertiary}
              />
              <Text
                style={[
                  styles.actionBtnText,
                  !hasTrailer && styles.actionBtnTextDisabled,
                ]}
              >
                {t('filmDetail.watchNow').toUpperCase()}
              </Text>
            </TouchableOpacity>

            {/* WATCHED */}
            <TouchableOpacity
              style={[styles.actionBtn, isWatched && styles.actionBtnWatched]}
              onPress={handleToggleWatched}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isWatched ? 'checkmark-circle' : 'eye-outline'}
                size={17}
                color={isWatched ? Colors.success : Colors.textWhite}
              />
              <Text
                style={[
                  styles.actionBtnText,
                  isWatched && styles.actionBtnTextWatched,
                ]}
              >
                {t('filmDetail.watchedBtn').toUpperCase()}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ──────────────── MAIN INFO CARD (bottom sheet) ──────────────── */}
          <Animated.View
            style={styles.infoCard}
            entering={FadeInDown.duration(400).delay(140)}
          >
            {/* Meta row: "2H22 • 1994 • UNITED STATES" + rating */}
            <View style={styles.metaRow}>
              <Text style={styles.metaText} numberOfLines={1}>
                {metaParts.join('  •  ')}
              </Text>
              {film.voteAverage != null && (
                <View style={styles.ratingPill}>
                  <Text style={styles.ratingStar}>★</Text>
                  <Text style={styles.ratingValue}>
                    {film.voteAverage.toFixed(1)}
                  </Text>
                </View>
              )}
            </View>

            {/* Film baslik — buyuk, uppercase */}
            <Text style={styles.filmTitle}>{film.title.toUpperCase()}</Text>

            {/* Genre chip'leri */}
            {film.moodTags.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.genreRow}
              >
                {film.moodTags.map((g) => (
                  <GenreChip key={g} label={localizeGenre(g, language)} />
                ))}
              </ScrollView>
            )}

            {/* ── "Why this film?" AI aciklama ── */}
            {(explanation != null || explanationLoading) && (
              <Animated.View style={styles.whyCard} entering={FadeIn.duration(400)}>
                <View style={styles.whyHeader}>
                  <Ionicons name="sparkles" size={15} color={Colors.accentPrimary} />
                  <Text style={styles.whyTitle}>{t('filmDetail.whyThisFilm')}</Text>
                </View>
                {explanationLoading ? (
                  <SkeletonLoader width="100%" height={36} borderRadius={8} />
                ) : (
                  <Text style={styles.whyBody}>{explanation}</Text>
                )}
              </Animated.View>
            )}

            {/* ── WATCH ON ── */}
            {allProviders.length > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  title={t('filmDetail.watchOn').toUpperCase()}
                  right={<Text style={styles.justWatchText}>JustWatch</Text>}
                />
                <FlatList<TmdbProvider>
                  data={allProviders}
                  keyExtractor={(p) => String(p.provider_id)}
                  renderItem={({ item }) => <ProviderIcon provider={item} />}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )}

            {/* ── SYNOPSIS ── */}
            {!!film.overview && (
              <View style={styles.section}>
                <SectionHeader title={t('filmDetail.synopsis').toUpperCase()} />
                <Text style={styles.synopsisText}>{film.overview}</Text>
              </View>
            )}

            {/* ── CASTING ── */}
            {displayCast.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title={t('filmDetail.cast').toUpperCase()} />
                <FlatList<DisplayCastMember>
                  data={displayCast}
                  keyExtractor={(c, i) => `cast-${c.name}-${i}`}
                  renderItem={({ item }) => (
                    <CastCard
                      name={item.name}
                      character={item.character}
                      avatarUrl={item.avatarUrl}
                    />
                  )}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )}

            {/* ── DIRECTOR & CREW ── */}
            {crewDisplay.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title={t('filmDetail.directorAndCrew').toUpperCase()} />
                <FlatList<CrewDisplayItem>
                  data={crewDisplay}
                  keyExtractor={(c, i) => `crew-${c.name}-${i}`}
                  renderItem={({ item }) => (
                    <CrewCard
                      name={item.name}
                      role={item.label}
                      avatarUrl={item.avatarUrl}
                    />
                  )}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )}

            {/* ── Listeden cikar ── */}
            {isInWatchlist && (
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={handleRemoveFromWatchlist}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.error} />
                <Text style={styles.removeBtnText}>
                  {t('filmDetail.removeFromWatchlist')}
                </Text>
              </TouchableOpacity>
            )}

            {/* ── TMDB Footer ── */}
            <TmdbFooter text={t('filmDetail.tmdbAttribution')} />
          </Animated.View>
        </ScrollView>

        {/* ── Geri butonu (absolute, her zaman gorunur) ── */}
        <View style={[styles.headerBar, { top: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.75}
          >
            <Ionicons name="chevron-down" size={22} color={Colors.textWhite} />
          </TouchableOpacity>
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
  // ── Root ─────────────────────────────────────────────────────────────────────
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  /** Blurred arkaplan uzerine karanlik saydam katman */
  bgDim: {
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  scroll: {
    flex: 1,
  },

  // ── Error / not found ─────────────────────────────────────────────────────────
  errorContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryBtnText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '700',
  },

  // ── Header (back button) ─────────────────────────────────────────────────────
  headerBar: {
    position: 'absolute',
    left: 16,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Trailer section ───────────────────────────────────────────────────────────
  /** Dis cerceve — yuvarlatilmis, overflow hidden */
  trailerWrapper: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    height: TRAILER_HEIGHT,
    backgroundColor: Colors.bgCard,
  },
  trailerTouchable: {
    flex: 1,
  },
  trailerImage: {
    width: '100%',
    height: TRAILER_HEIGHT,
  },
  trailerPlaceholder: {
    backgroundColor: Colors.bgElevated,
  },
  /** Merkez kirmizi play butonu overlay'i */
  redPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Klasik YouTube kirmizi daire */
  redPlayBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FF0000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 10,
  },
  /** Trailer bulunamadiysa soluk gri play butonu */
  redPlayBtnDisabled: {
    backgroundColor: 'rgba(100,100,100,0.6)',
    shadowOpacity: 0,
    elevation: 0,
  },
  /** Alt gradient — TRAILER etiketini barindiran alan */
  trailerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 88,
    justifyContent: 'flex-end',
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  /** "TRAILER" buyuk yazisi */
  trailerLabel: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.textWhite,
    letterSpacing: 8,
    opacity: 0.92,
  },
  /** Sag ust glassmorphic buton grubu */
  trailerTopRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  /** Cam efekti dairesel buton */
  glassBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Aktif (bookmarked) cam buton */
  glassBtnActive: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accentPrimary,
  },

  // ── Action buttons row ────────────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
  },
  /** Pill sekilli aksiyon butonu */
  actionBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(28,28,32,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnDisabled: {
    opacity: 0.42,
  },
  /** Izlendi aktif durumu */
  actionBtnWatched: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: Colors.success,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textWhite,
    letterSpacing: 1.2,
  },
  actionBtnTextDisabled: {
    color: Colors.textTertiary,
  },
  actionBtnTextWatched: {
    color: Colors.success,
  },

  // ── Info card (bottom sheet) ──────────────────────────────────────────────────
  infoCard: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: 16,
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 24,
    minHeight: 400,
  },

  // ── Meta row ─────────────────────────────────────────────────────────────────
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  metaText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textGrey,
    letterSpacing: 1.2,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.goldDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.3)',
  },
  ratingStar: {
    fontSize: 11,
    color: Colors.gold,
  },
  ratingValue: {
    fontSize: 13,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.gold,
  },

  // ── Film baslik ───────────────────────────────────────────────────────────────
  filmTitle: {
    fontSize: 28,
    fontFamily: 'PlayfairDisplay_900Black',
    color: Colors.textWhite,
    letterSpacing: -0.3,
    lineHeight: 36,
    marginBottom: 16,
  },

  // ── Genre chips ───────────────────────────────────────────────────────────────
  genreRow: {
    gap: 8,
    paddingRight: 4,
    marginBottom: 4,
  },
  genreChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: Colors.accentDim,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(234,219,198,0.2)',
  },
  genreChipText: {
    fontSize: 12,
    color: Colors.accentPrimary,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // ── "Why this film?" AI karti ─────────────────────────────────────────────────
  whyCard: {
    marginTop: 20,
    padding: 16,
    backgroundColor: Colors.accentDim,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(234,219,198,0.2)',
  },
  whyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  whyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.accentPrimary,
  },
  whyBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // ── Section genel ─────────────────────────────────────────────────────────────
  section: {
    marginTop: 28,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textWhite,
    letterSpacing: 1.8,
  },
  justWatchText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '500',
  },

  // ── Yatay FlatList ────────────────────────────────────────────────────────────
  horizontalListContent: {
    gap: 12,
    paddingRight: 4,
  },

  // ── Synopsis metni ────────────────────────────────────────────────────────────
  synopsisText: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 26,
  },

  // ── Cast / Crew kart (paylasilanlar) ──────────────────────────────────────────
  personCard: {
    width: CAST_CARD_WIDTH,
    alignItems: 'center',
    gap: 5,
  },
  personCardImg: {
    width: CAST_CARD_WIDTH,
    height: CAST_CARD_HEIGHT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.white10,
    backgroundColor: Colors.bgElevated,
  },
  personCardPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  personCardName: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 15,
    width: CAST_CARD_WIDTH,
  },
  personCardRole: {
    fontSize: 10,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 14,
    fontStyle: 'italic',
    width: CAST_CARD_WIDTH,
  },

  // ── Provider ikonlari ─────────────────────────────────────────────────────────
  providerItem: {
    alignItems: 'center',
    gap: 6,
    width: 70,
  },
  providerLogo: {
    width: 60,
    height: 60,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.white10,
    backgroundColor: Colors.bgElevated,
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
    marginTop: 28,
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

  // ── TMDB footer ───────────────────────────────────────────────────────────────
  tmdbFooter: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    gap: 10,
  },
  tmdbAttributionText: {
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 17,
  },
  /** SvgXml logo etrafindaki saydam kutu */
  tmdbLogoWrap: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.bgElevated,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.white10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
