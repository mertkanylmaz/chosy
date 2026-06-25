/**
 * UpcomingSection — Yakinda vizyona girecek filmler (DB: trending_type='upcoming').
 *
 * Horizontal FlatList, poster + cikis tarihi badge.
 * Gecmis tarihli filmler DB sorgusunda filtreleniyor (gte release_date).
 */

import React from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useLanguage } from '@/contexts/LanguageContext';
import { getPosterUrl } from '@/services/tmdb';
import type { DiscoverFilm } from '@/components/Discover/TrendingSection';

import { styles, POSTER_WIDTH } from './styles';

// ─── Props ────────────────────────────────────────────────────────────────────

interface UpcomingSectionProps {
  /** Upcoming film listesi */
  movies: DiscoverFilm[];
  /** Yukleniyor durumu */
  loading: boolean;
  /** Film tiklama callback'i (internal UUID) */
  onFilmPress: (filmId: string, title: string, releaseDate: string) => void;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

/** Loading skeleton — 3 poster placeholder */
function SkeletonList() {
  return (
    <View style={[styles.listContent, { flexDirection: 'row' }]}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonCard} />
      ))}
    </View>
  );
}

// ─── Tarih Formatlama ─────────────────────────────────────────────────────────

/**
 * Cikis tarihini relatif badge text'e donusturur.
 *
 * @param dateStr - "YYYY-MM-DD" formatinda tarih
 * @param language - "en" | "tr"
 * @returns Badge text (orn: "3 days", "This Fri", "Jul 15")
 */
function formatRelativeDate(dateStr: string, language: string): string {
  const release = new Date(dateStr);
  const now = new Date();
  const diffMs = release.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return language === 'tr' ? 'Bugun' : 'Today';
  if (diffDays === 1) return language === 'tr' ? 'Yarin' : 'Tomorrow';
  if (diffDays <= 7) {
    return `${diffDays} ${language === 'tr' ? 'gun' : 'days'}`;
  }

  // 7+ gun → kisa tarih formati
  const months =
    language === 'tr'
      ? ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return `${months[release.getMonth()]} ${release.getDate()}`;
}

// ─── Film Kart ────────────────────────────────────────────────────────────────

interface FilmCardProps {
  movie: DiscoverFilm;
  language: string;
  onPress: (filmId: string, title: string, releaseDate: string) => void;
}

/** Upcoming film poster karti — tarih badge + baslik */
function FilmCard({ movie, language, onPress }: FilmCardProps) {
  // poster_url zaten tam URL — getPosterUrl http ile baslayani aynen dondurur
  const posterUri = getPosterUrl(movie.poster_url, 'w342');
  const relativeDate = movie.release_date
    ? formatRelativeDate(movie.release_date, language)
    : '';

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => onPress(movie.id, movie.title, movie.release_date ?? '')}
    >
      {posterUri ? (
        <Image
          source={{ uri: posterUri }}
          style={styles.poster}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
      ) : (
        <View style={styles.poster} />
      )}

      {/* Release date badge */}
      {relativeDate ? (
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeText}>{relativeDate}</Text>
        </View>
      ) : null}

      {/* Bottom gradient + title */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.gradientOverlay}
      >
        <Text style={styles.filmTitle} numberOfLines={1}>
          {movie.title}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

/** Upcoming filmler section'i */
export default function UpcomingSection({
  movies,
  loading,
  onFilmPress,
}: UpcomingSectionProps) {
  const { t, language } = useLanguage();

  if (!loading && movies.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(300).duration(400).springify()}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('discoverTab.upcomingTitle')}</Text>
      </View>

      {loading ? (
        <SkeletonList />
      ) : (
        <FlatList
          data={movies}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <FilmCard movie={item} language={language} onPress={onFilmPress} />
          )}
        />
      )}
    </Animated.View>
  );
}
