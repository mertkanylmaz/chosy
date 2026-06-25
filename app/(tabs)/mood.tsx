/**
 * Discover sekmesi — film kesfet ekrani.
 *
 * UX Redesign v3: Mood search artik Home tab'da (index.tsx).
 * Bu tab browse/explore icerigi sunar:
 *   1. Bu Hafta Trend (DB: curation_tier='trending', trending_type='weekly_trending')
 *   2. Gunun Filmi (DailyPickSection)
 *   3. Yakinda Vizyonda (DB: curation_tier='trending', trending_type='upcoming')
 *   4. Sinefil Oyunlari (2x2 grid)
 *
 * Veri kaynagi: Supabase films tablosu (TMDB canli API cagirisi YOK).
 * sync-trending Edge Function haftalik olarak films tablosunu gunceller.
 * Her section bagimsiz: biri fail ederse digerleri calisir.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import * as Sentry from '@sentry/react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/utils/logger';
import { posthogAnalytics } from '@/services/posthog';
import { supabase } from '@/services/supabase';

import TrendingSection from '@/components/Discover/TrendingSection';
import type { DiscoverFilm } from '@/components/Discover/TrendingSection';
import UpcomingSection from '@/components/Discover/UpcomingSection';
import GamesSection from '@/components/Discover/GamesSection';
import DailyPickSection from '@/components/Home/DailyPickSection';

// ─── Bilesen ──────────────────────────────────────────────────────────────────

/**
 * Discover tab — film kesfet, ilham al.
 * Mood text input YOK — tamamen browse/explore.
 * Veri kaynagi: Supabase films tablosu (DB-only, TMDB API YOK).
 */
export default function DiscoverScreen() {
  const { t } = useLanguage();
  const router = useRouter();

  const [trending, setTrending] = useState<DiscoverFilm[]>([]);
  const [upcoming, setUpcoming] = useState<DiscoverFilm[]>([]);
  const [loading, setLoading] = useState(true);

  /** Tum discover verilerini DB'den paralel yukle */
  const loadDiscoverData = useCallback(async () => {
    setLoading(true);
    try {
      const [trendingRes, upcomingRes] = await Promise.all([
        supabase
          .from('films')
          .select('id, title, poster_url, vote_average, release_date')
          .eq('curation_tier', 'trending')
          .eq('trending_type', 'weekly_trending')
          .order('trending_added_at', { ascending: false })
          .limit(10),
        supabase
          .from('films')
          .select('id, title, poster_url, vote_average, release_date')
          .eq('curation_tier', 'trending')
          .eq('trending_type', 'upcoming')
          .gte('release_date', new Date().toISOString().split('T')[0])
          .order('release_date', { ascending: true })
          .limit(10),
      ]);

      if (trendingRes.error) {
        logger.warn('[Discover] Trending sorgu hatasi', trendingRes.error.message);
        Sentry.captureException(new Error(trendingRes.error.message), {
          tags: { feature: 'discover_trending_section' },
          extra: { code: trendingRes.error.code, details: trendingRes.error.details },
        });
      }
      if (upcomingRes.error) {
        logger.warn('[Discover] Upcoming sorgu hatasi', upcomingRes.error.message);
        Sentry.captureException(new Error(upcomingRes.error.message), {
          tags: { feature: 'discover_upcoming_section' },
          extra: { code: upcomingRes.error.code, details: upcomingRes.error.details },
        });
      }

      setTrending((trendingRes.data as DiscoverFilm[] | null) ?? []);
      setUpcoming((upcomingRes.data as DiscoverFilm[] | null) ?? []);
    } catch (err) {
      logger.warn('[Discover] Veri yuklenemedi', err);
      Sentry.captureException(err, {
        tags: { feature: 'discover_data_load' },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDiscoverData();
    posthogAnalytics.screen('discover_screen');
  }, [loadDiscoverData]);

  // ── Film navigasyonu ──────────────────────────────────────────────────────

  /** Trending film tiklama handler — id zaten internal UUID */
  const handleTrendingPress = useCallback(
    (filmId: string, title: string, position: number) => {
      posthogAnalytics.track('discover_trending_film_tapped', {
        film_id: filmId,
        film_title: title,
        position,
      });
      router.push(`/film/${filmId}` as never);
    },
    [router],
  );

  /** Upcoming film tiklama handler — id zaten internal UUID */
  const handleUpcomingPress = useCallback(
    (filmId: string, title: string, releaseDate: string) => {
      posthogAnalytics.track('discover_upcoming_film_tapped', {
        film_id: filmId,
        film_title: title,
        release_date: releaseDate,
      });
      router.push(`/film/${filmId}` as never);
    },
    [router],
  );

  /** Oyun tiklama analytics */
  const handleGamePress = useCallback((gameId: string) => {
    posthogAnalytics.track('discover_game_tapped', {
      game_id: gameId,
      source: 'discover_tab',
    });
  }, []);

  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.background} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Screen header */}
        <Animated.View
          entering={FadeInDown.duration(400).springify()}
          style={styles.headerContainer}
        >
          <Text style={styles.screenTitle}>{t('discoverTab.screenTitle')}</Text>
          <Text style={styles.screenSubtitle}>
            {t('discoverTab.screenSubtitle')}
          </Text>
        </Animated.View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section 1: Trending */}
          <TrendingSection
            movies={trending}
            loading={loading}
            onFilmPress={handleTrendingPress}
          />

          {/* Section 2: Upcoming */}
          <UpcomingSection
            movies={upcoming}
            loading={loading}
            onFilmPress={handleUpcomingPress}
          />

          {/* Section 3: Daily Pick */}
          <View style={styles.dailyPickWrapper}>
            <DailyPickSection />
          </View>

          {/* Section 4: Games */}
          <GamesSection onGamePress={handleGamePress} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerContainer: {
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
  },
  screenTitle: {
    ...Theme.typography.h1,
    marginBottom: Theme.spacing.xs,
  },
  screenSubtitle: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Theme.spacing.md,
    paddingBottom: 83 + Theme.spacing.lg,
  },
  dailyPickWrapper: {
    marginBottom: Theme.spacing.xl,
  },
});
