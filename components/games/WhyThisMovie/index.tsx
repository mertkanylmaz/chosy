/**
 * WhyThisMovieFunnel — Shared "Why This Movie?" card for all game result screens.
 *
 * Shown after game completion inside ResultCard. Provides context about
 * why the puzzle film was chosen, an optional fun fact, and CTAs to
 * navigate to the film detail page or add to watchlist.
 *
 * Analytics: fires view event on mount, film page event on CTA tap.
 */
import React, { useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Lightbulb, FilmReel, BookmarkSimple, CaretDown } from 'phosphor-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Sentry from '@sentry/react-native';

import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/services/supabase';
import { logger } from '@/utils/logger';
import { hapticLight } from '@/utils/haptics';
import { addToWatchlist } from '@/services/watchlist';
import {
  trackWhyThisMovieViewed,
  trackFilmPageOpened,
  trackWatchlistAdded,
} from '@/utils/gameAnalytics';
import { Colors } from '@/constants/Colors';
import { styles, ACCENT, CARET_UP_STYLE } from './styles';

interface WhyThisMovieFunnelProps {
  /** Why text (director/genre/year context) */
  whyText?: string;
  /** Fun fact / trivia */
  funFact?: string;
  /** Film info for CTA */
  filmTitle: string;
  /**
   * TMDb ID — used to resolve the Supabase film row when `filmUuid` is absent.
   * Games that already hold the row's UUID should pass `filmUuid` instead.
   */
  filmId?: number;
  /**
   * Supabase `films.id` (UUID). Preferred over `filmId`: skips the tmdb_id
   * lookup entirely. Spotlight/CineMetrics only have this, and previously
   * passed `filmId={0}` — every CTA silently queried `tmdb_id = 0` and failed.
   */
  filmUuid?: string;
  /** Game type for analytics */
  gameType: string;
}

/**
 * WhyThisMovieFunnel — contextual discovery card after game completion.
 */
export function WhyThisMovieFunnel({
  whyText,
  funFact,
  filmTitle,
  filmId,
  filmUuid,
  gameType,
}: WhyThisMovieFunnelProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const hasExplanation = Boolean(whyText || funFact);

  /**
   * Aciklamayi ac/kapat.
   *
   * `game_why_this_movie_viewed` artik mount'ta degil ilk acilista atiliyor —
   * kart varsayilan kapali oldugu icin mount "okundu" anlamina gelmiyor.
   */
  const hasTracked = useRef(false);
  const toggleExpanded = () => {
    hapticLight();
    setExpanded(prev => {
      if (!prev && !hasTracked.current) {
        hasTracked.current = true;
        trackWhyThisMovieViewed(gameType);
      }
      return !prev;
    });
  };

  /**
   * Filmi cozebiliyor muyuz? Ikisi de yoksa CTA'lar gosterilmez — eskiden
   * `filmId={0}` gecilip butonlar sessizce basarisiz oluyordu.
   */
  const canResolveFilm = Boolean(filmUuid) || (filmId != null && filmId > 0);

  // Graceful null — ne gosterilecek aciklama ne de acilacak film var
  if (!hasExplanation && !canResolveFilm) return null;

  /** Analitik icin kullanilan kimlik — UUID varsa o, yoksa TMDb numarasi */
  const analyticsFilmId: number | string = filmUuid ?? filmId ?? 0;

  /**
   * Cozum filminin Supabase satirini getirir.
   *
   * `filmUuid` verildiyse dogrudan `id` ile sorgular; aksi halde `tmdb_id`
   * uzerinden cozer.
   */
  const fetchFilmRow = async (columns: string) => {
    const query = supabase.from('films').select(columns);
    return filmUuid
      ? await query.eq('id', filmUuid).single()
      : await query.eq('tmdb_id', filmId).single();
  };

  /** Navigate to film detail page */
  const handleWatchTonight = async () => {
    hapticLight();
    trackFilmPageOpened(gameType, analyticsFilmId);

    // UUID elimizdeyse sorguya hic gerek yok
    if (filmUuid) {
      router.push(`/film/${filmUuid}`);
      return;
    }

    try {
      const { data, error } = await fetchFilmRow('id');
      const row = data as { id: string } | null;
      if (row?.id) {
        router.push(`/film/${row.id}`);
      } else {
        // Hard Rule 5: sessiz fallback yok
        const lookupErr = error ?? new Error(`Film not found: tmdb_id=${filmId}`);
        logger.warn(`[WhyThisMovie] Film UUID not found: tmdb_id=${filmId}`);
        Sentry.captureException(lookupErr, {
          tags: { game: gameType, action: 'film_page_open' },
        });
      }
    } catch (err) {
      logger.error('[WhyThisMovie] Film lookup error:', err);
      Sentry.captureException(err, { tags: { game: gameType, action: 'film_page_open' } });
    }
  };

  /**
   * Add the puzzle film to the watchlist.
   *
   * This is the "oyun → film keşfi" conversion — the button used to only
   * navigate, so the action its label promised never happened and the
   * funnel had no measurable end point.
   */
  const handleAddToWatchlist = async () => {
    if (added || isAdding) return;
    hapticLight();
    setIsAdding(true);
    try {
      const { data, error } = await fetchFilmRow(
        'id, title, year, poster_url, overview, runtime, vote_average, director',
      );
      const row = data as {
        id: string;
        title: string;
        year: number;
        poster_url: string | null;
        overview: string | null;
        runtime: number | null;
        vote_average: number | null;
        director: string | null;
      } | null;

      if (error || !row) {
        throw error ?? new Error(`Film not found: ${filmUuid ?? `tmdb_id=${filmId}`}`);
      }

      await addToWatchlist({
        id: row.id,
        title: row.title,
        year: row.year,
        posterUrl: row.poster_url ?? '',
        matchScore: 0,
        moodTags: [],
        whyThisFilm: whyText ?? '',
        overview: row.overview ?? undefined,
        runtime: row.runtime ?? undefined,
        voteAverage: row.vote_average ?? undefined,
        director: row.director ?? undefined,
      });

      trackWatchlistAdded(gameType, analyticsFilmId);
      setAdded(true);
    } catch (err) {
      // Hard Rule 5: sessiz fallback yok — Sentry + görünür durum
      logger.error('[WhyThisMovie] Watchlist add error:', err);
      Sentry.captureException(err, { tags: { game: gameType, action: 'watchlist_add' } });
      setAddError(true);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Animated.View entering={FadeInUp.delay(400).duration(400)} style={styles.container}>
      {/* CTA'lar once — hedef bu ekranda film izletmek */}
      {canResolveFilm && (
        <View style={styles.ctaColumn}>
          <TouchableOpacity
            style={styles.watchButton}
            onPress={handleWatchTonight}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <FilmReel size={18} color={Colors.textOnAccent} weight="duotone" />
            <Text style={styles.watchButtonText}>
              {t('games.why_this_movie.watch_tonight')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddToWatchlist}
            disabled={isAdding || added}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ disabled: isAdding || added }}
          >
            <BookmarkSimple
              size={16}
              color={added ? Colors.success : Colors.gold}
              weight={added ? 'fill' : 'duotone'}
            />
            <Text style={styles.addButtonText}>
              {added
                ? t('games.why_this_movie.added_watchlist')
                : addError
                  ? t('games.why_this_movie.add_failed')
                  : t('games.why_this_movie.add_watchlist')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Aciklama — varsayilan kapali, dikey yuksekligi bu kadar kisaltiyor */}
      {hasExplanation && (
        <>
          {canResolveFilm && <View style={styles.divider} />}
          <TouchableOpacity
            style={styles.headerToggle}
            onPress={toggleExpanded}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
          >
            <View style={styles.iconWrap}>
              <Lightbulb size={16} color={ACCENT} weight="duotone" />
            </View>
            <Text style={styles.headerTitle}>{t('games.why_this_movie.title')}</Text>
            <CaretDown
              size={16}
              color={Colors.textSecondary}
              weight="bold"
              style={expanded ? CARET_UP_STYLE : undefined}
            />
          </TouchableOpacity>

          {expanded && (
            <>
              {whyText ? (
                <Text style={styles.whyText}>&ldquo;{whyText}&rdquo;</Text>
              ) : null}

              {funFact ? (
                <View style={styles.funFactSection}>
                  <View style={styles.funFactHeader}>
                    <FilmReel size={14} color={Colors.textSecondary} weight="duotone" />
                    <Text style={styles.funFactLabel}>
                      {t('games.why_this_movie.fun_fact_title')}
                    </Text>
                  </View>
                  <Text style={styles.funFactText}>{funFact}</Text>
                </View>
              ) : null}
            </>
          )}
        </>
      )}
    </Animated.View>
  );
}
