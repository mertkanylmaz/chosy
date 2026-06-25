/**
 * TrendingSection — Bu haftanin trend filmleri (DB: curation_tier='trending').
 *
 * Horizontal FlatList, 10 poster kart.
 * Tap → film detaya gider (id zaten internal UUID — lookup gereksiz).
 */

import React from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPosterUrl } from '@/services/tmdb';

import { styles, POSTER_WIDTH } from './styles';

// ─── Tipler ──────────────────────────────────────────────────────────────────

/** DB'den gelen film satiri (films tablosu SELECT) */
export interface DiscoverFilm {
  /** Internal UUID — dogrudan /film/[id] navigasyonu icin */
  id: string;
  title: string;
  /** Tam poster URL (https://image.tmdb.org/...) veya null */
  poster_url: string | null;
  vote_average: number | null;
  release_date: string | null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TrendingSectionProps {
  /** Trend film listesi */
  movies: DiscoverFilm[];
  /** Yukleniyor durumu */
  loading: boolean;
  /** Film tiklama callback'i (internal UUID) */
  onFilmPress: (filmId: string, title: string, position: number) => void;
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

// ─── Film Kart ────────────────────────────────────────────────────────────────

interface FilmCardProps {
  movie: DiscoverFilm;
  index: number;
  onPress: (filmId: string, title: string, position: number) => void;
}

/** Tek film poster karti — gradient overlay + baslik */
function FilmCard({ movie, index, onPress }: FilmCardProps) {
  // poster_url zaten tam URL — getPosterUrl http ile baslayani aynen dondurur
  const posterUri = getPosterUrl(movie.poster_url, 'w342');
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : null;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => onPress(movie.id, movie.title, index)}
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

      {/* Rating badge */}
      {rating && (
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={10} color={Colors.imdbYellow} />
          <Text style={styles.ratingText}>{rating}</Text>
        </View>
      )}

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

/** Trending filmler section'i */
export default function TrendingSection({
  movies,
  loading,
  onFilmPress,
}: TrendingSectionProps) {
  const { t } = useLanguage();

  if (!loading && movies.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(100).duration(400).springify()}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('discoverTab.trendingTitle')}</Text>
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
          renderItem={({ item, index }) => (
            <FilmCard movie={item} index={index} onPress={onFilmPress} />
          )}
        />
      )}
    </Animated.View>
  );
}
