/**
 * WatchlistPreview — Son 5 kaydedilen filmi yatay scroll ile gösterir.
 *
 * Her film:
 *  - 80x120 poster
 *  - Film adı (küçük, beyaz, 2 satır maks)
 *
 * "See all →" → watchlist sekmesine navigate eder.
 * Boş durum: "Save movies from the feed to see them here"
 */
import React from 'react';
import {
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Colors } from '@/constants/Colors';
import SkeletonLoader from '@/components/SkeletonLoader';
import type { WatchlistItem } from '@/services/watchlist';

import { POSTER_H, POSTER_W, styles } from './styles';

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface Props {
  items: WatchlistItem[];
  loading: boolean;
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const TMDB_BASE = 'https://image.tmdb.org/t/p/w185';

// ─── Poster Kartı ─────────────────────────────────────────────────────────────

/**
 * Tek film poster kartı.
 */
function PosterCard({ item }: { item: WatchlistItem }) {
  const posterUri = item.film.posterUrl
    ? `${TMDB_BASE}${item.film.posterUrl}`
    : null;

  return (
    <View style={styles.posterCard}>
      {posterUri ? (
        <Image
          source={{ uri: posterUri }}
          style={styles.posterImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.posterPlaceholder}>
          <Ionicons name="film-outline" size={24} color={Colors.textGrey} />
        </View>
      )}
      <Text style={styles.filmTitle} numberOfLines={2}>
        {item.film.title}
      </Text>
    </View>
  );
}

// ─── Ana Component ────────────────────────────────────────────────────────────

/**
 * WatchlistPreview bölümü.
 */
export default function WatchlistPreview({ items, loading }: Props) {
  const shown = items.slice(0, 5);

  /** Watchlist sekmesine git */
  function handleSeeAll() {
    router.push('/(tabs)/watchlist');
  }

  return (
    <View style={styles.container}>
      {/* Başlık */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="bookmark-outline" size={16} color={Colors.gold} />
          <Text style={styles.title}>Recently Saved</Text>
        </View>
        {shown.length > 0 && (
          <TouchableOpacity onPress={handleSeeAll} activeOpacity={0.7}>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* İçerik */}
      {loading ? (
        <View style={styles.skeletonRow}>
          {[0, 1, 2].map((i) => (
            <SkeletonLoader
              key={i}
              width={POSTER_W}
              height={POSTER_H}
              borderRadius={8}
            />
          ))}
        </View>
      ) : shown.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bookmark-outline" size={28} color={Colors.textGrey} />
          <Text style={styles.emptyText}>
            Save movies from the feed to see them here
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {shown.map((item) => (
            <PosterCard key={item.film.id} item={item} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
