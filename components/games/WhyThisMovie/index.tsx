/**
 * WhyThisMovieFunnel — Shared "Why This Movie?" card for all game result screens.
 *
 * Shown after game completion inside ResultCard. Provides context about
 * why the puzzle film was chosen, an optional fun fact, and CTAs to
 * navigate to the film detail page or add to watchlist.
 *
 * Analytics: fires view event on mount, film page event on CTA tap.
 */
import React, { useEffect, useRef } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Lightbulb, FilmReel, BookmarkSimple } from 'phosphor-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/services/supabase';
import { logger } from '@/utils/logger';
import { hapticLight } from '@/utils/haptics';
import { trackWhyThisMovieViewed, trackFilmPageOpened } from '@/utils/gameAnalytics';
import { Colors } from '@/constants/Colors';
import { styles, TEAL } from './styles';

interface WhyThisMovieFunnelProps {
  /** Why text (director/genre/year context) */
  whyText?: string;
  /** Fun fact / trivia */
  funFact?: string;
  /** Film info for CTA */
  filmTitle: string;
  /** TMDb ID */
  filmId: number;
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
  gameType,
}: WhyThisMovieFunnelProps) {
  const { t } = useLanguage();
  const router = useRouter();

  // Track view once on mount
  const hasTracked = useRef(false);
  useEffect(() => {
    if (!hasTracked.current && (whyText || funFact)) {
      hasTracked.current = true;
      trackWhyThisMovieViewed(gameType);
    }
  }, []);

  // Graceful null — nothing to show
  if (!whyText && !funFact) return null;

  /** Navigate to film detail page via Supabase UUID lookup */
  const handleWatchTonight = async () => {
    hapticLight();
    trackFilmPageOpened(gameType, filmId);
    try {
      const { data } = await supabase
        .from('films')
        .select('id')
        .eq('tmdb_id', filmId)
        .single();
      if (data?.id) {
        router.push(`/film/${data.id}`);
      } else {
        logger.warn(`[WhyThisMovie] Film UUID not found: tmdb_id=${filmId}`);
      }
    } catch (err) {
      logger.error('[WhyThisMovie] Film lookup error:', err);
    }
  };

  return (
    <Animated.View entering={FadeInUp.delay(400).duration(400)} style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Lightbulb size={16} color={TEAL} weight="duotone" />
        </View>
        <Text style={styles.headerTitle}>{t('games.why_this_movie.title')}</Text>
      </View>

      {/* Why text */}
      {whyText ? (
        <Text style={styles.whyText}>&ldquo;{whyText}&rdquo;</Text>
      ) : null}

      {/* Fun fact */}
      {funFact ? (
        <View style={styles.funFactSection}>
          <View style={styles.funFactHeader}>
            <FilmReel size={14} color={Colors.textSecondary} weight="duotone" />
            <Text style={styles.funFactLabel}>{t('games.why_this_movie.fun_fact_title')}</Text>
          </View>
          <Text style={styles.funFactText}>{funFact}</Text>
        </View>
      ) : null}

      {/* Divider + CTAs */}
      <View style={styles.divider} />
      <View style={styles.ctaRow}>
        <TouchableOpacity
          style={styles.watchButton}
          onPress={handleWatchTonight}
          activeOpacity={0.7}
        >
          <Text style={styles.watchButtonText}>
            {t('games.why_this_movie.watch_tonight')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleWatchTonight}
          activeOpacity={0.7}
        >
          <BookmarkSimple size={16} color={Colors.accentPrimary} weight="duotone" />
          <Text style={styles.addButtonText}>
            {t('games.why_this_movie.add_watchlist')}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
