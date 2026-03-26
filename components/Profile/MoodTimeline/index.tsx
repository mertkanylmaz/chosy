/**
 * MoodTimeline — Kullanıcının son 10 mood oturumunu listeler.
 *
 * Her entry:
 *  - Tarih (gri, küçük) — "Mar 21, 2026" formatında
 *  - Mood metni (beyaz, bold) — maks 50 karakter, truncate
 *  - "X movies explored, Y saved" meta
 *  - Poster fan: o oturumdan ilk 3 kaydedilen filmin posteri (üst üste)
 *
 * Tıklanınca: şimdilik console.log (detay sayfası ileride)
 * Boş durum: "No mood history yet. Start exploring! ✨"
 */
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Colors } from '@/constants/Colors';
import SkeletonLoader from '@/components/SkeletonLoader';
import type { MoodHistoryItem } from '@/types/profile';

import { POSTER_DIMENSIONS, styles } from './styles';

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface Props {
  history: MoodHistoryItem[];
  loading: boolean;
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

const TMDB_BASE = 'https://image.tmdb.org/t/p/w185';

/**
 * ISO 8601 tarihini "Mar 21, 2026" formatına çevirir.
 */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * Metni maks N karakterde keserek "..." ekler.
 */
function truncate(text: string, max = 60): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '…';
}

// ─── Poster Fan ───────────────────────────────────────────────────────────────

/**
 * 1-3 film posterini fan şeklinde üst üste gösterir (60x90, 15px offset).
 */
function PosterFan({ posterUrls }: { posterUrls: (string | null)[] }) {
  const { w, h, offset } = POSTER_DIMENSIONS;
  const shown = posterUrls.slice(0, 3);
  const totalWidth = w + (shown.length - 1) * offset;

  return (
    <View style={[styles.posterStack, { width: totalWidth, height: h }]}>
      {shown.map((url, idx) => (
        <View
          key={idx}
          style={[
            styles.posterItem,
            {
              position: idx === 0 ? 'relative' : 'absolute',
              left: idx * offset,
              zIndex: shown.length - idx,
            },
          ]}>
          {url ? (
            <Image
              source={{ uri: `${TMDB_BASE}${url}` }}
              style={styles.posterImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.posterPlaceholder}>
              <Ionicons name="film-outline" size={14} color={Colors.textGrey} />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

// ─── Entry Kartı ──────────────────────────────────────────────────────────────

/**
 * Tek bir mood geçmişi kartı.
 */
function EntryCard({ item }: { item: MoodHistoryItem }) {
  function handlePress() {
    if (__DEV__) {
      console.log('[MoodTimeline] session pressed:', item.session_id);
    }
  }

  const posters: (string | null)[] = item.saved_posters ?? [];

  return (
    <TouchableOpacity
      style={styles.entryCard}
      onPress={handlePress}
      activeOpacity={0.75}>
      <View style={styles.entryLeft}>
        <Text style={styles.entryDate}>{formatDate(item.created_at)}</Text>
        <Text style={styles.entryMoodText} numberOfLines={2}>
          {truncate(item.mood_text)}
        </Text>
        <Text style={styles.entryMeta}>
          {item.total_swipes} movies explored, {item.saved_count} saved
        </Text>
      </View>

      {posters.length > 0 && <PosterFan posterUrls={posters} />}
    </TouchableOpacity>
  );
}

// ─── Ana Component ────────────────────────────────────────────────────────────

/**
 * MoodTimeline bölümü.
 */
export default function MoodTimeline({ history, loading }: Props) {
  const shown = history.slice(0, 5);

  function handleSeeAll() {
    if (__DEV__) {
      console.log('[MoodTimeline] See all pressed');
    }
  }

  return (
    <View style={styles.container}>
      {/* Başlık */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="time-outline" size={16} color={Colors.gold} />
          <Text style={styles.title}>Mood Timeline</Text>
        </View>
        {shown.length > 0 && (
          <TouchableOpacity onPress={handleSeeAll} activeOpacity={0.7}>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* İçerik */}
      {loading ? (
        <>
          <SkeletonLoader height={72} borderRadius={10} style={styles.skeletonRow} />
          <SkeletonLoader height={72} borderRadius={10} style={styles.skeletonRow} />
          <SkeletonLoader height={72} borderRadius={10} />
        </>
      ) : shown.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="sparkles-outline" size={28} color={Colors.textGrey} />
          <Text style={styles.emptyText}>
            No mood history yet. Start exploring! ✨
          </Text>
          <TouchableOpacity
            style={styles.goMoodButton}
            onPress={() => router.push('/(tabs)/mood')}
            activeOpacity={0.75}>
            <Text style={styles.goMoodButtonText}>Go to Mood</Text>
          </TouchableOpacity>
        </View>
      ) : (
        shown.map((item) => <EntryCard key={item.session_id} item={item} />)
      )}
    </View>
  );
}

declare const __DEV__: boolean;
