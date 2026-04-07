/**
 * WatchlistPreview — Son 5 kaydedilen film + izleme ilerleme çubuğu (P5.4).
 *
 * P5.4 eklemeleri:
 *  - "X of Y watched" progress bar (accentPrimary fill, bgElevated track)
 *  - AsyncStorage tabanlı izlendi takibi (key: moodflix_watched_v1)
 *  - Poster kartına köşe ✓ toggle butonu
 *
 * Her film:
 *  - 80×120 poster + film adı (2 satır maks) + izlendi toggle
 *
 * "See all →" → watchlist sekmesine navigate eder.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/utils/logger';
import SkeletonLoader from '@/components/SkeletonLoader';
import type { WatchlistItem } from '@/services/watchlist';

import { POSTER_H, POSTER_W, styles } from './styles';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const TMDB_BASE = 'https://image.tmdb.org/t/p/w185';
/** AsyncStorage key — izlenen film ID seti */
const WATCHED_KEY = 'moodflix_watched_v1';

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface Props {
  items: WatchlistItem[];
  loading: boolean;
}

// ─── AsyncStorage yardımcıları ────────────────────────────────────────────────

/**
 * Kaydedilmiş izlenen film ID'lerini yükler.
 * Hata durumunda boş Set döner.
 */
async function loadWatchedIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(WATCHED_KEY);
    if (!raw) return new Set<string>();
    return new Set<string>(JSON.parse(raw) as string[]);
  } catch {
    return new Set<string>();
  }
}

/**
 * İzlenen film ID setini AsyncStorage'a kaydeder.
 */
async function persistWatchedIds(ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(WATCHED_KEY, JSON.stringify(Array.from(ids)));
  } catch (err) {
    logger.error('[WatchlistPreview] persistWatchedIds hata:', err);
  }
}

// ─── İlerleme çubuğu ─────────────────────────────────────────────────────────

interface WatchProgressProps {
  watched: number;
  total: number;
  label: string;
}

/**
 * "X of Y watched" yatay ilerleme çubuğu.
 * Track: bgElevated · Fill: accentPrimary
 */
function WatchProgress({ watched, total, label }: WatchProgressProps) {
  const pct = total > 0 ? Math.min(watched / total, 1) : 0;
  const fillWidth = `${Math.round(pct * 100)}%` as `${number}%`;

  return (
    <View style={styles.progressContainer}>
      <Text style={styles.progressLabel}>{label}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: fillWidth }]} />
      </View>
    </View>
  );
}

// ─── Poster kartı ─────────────────────────────────────────────────────────────

interface PosterCardProps {
  item: WatchlistItem;
  isWatched: boolean;
  onToggle: (filmId: string) => void;
}

/**
 * Tek film poster kartı + sol üst köşede izlendi toggle butonu.
 */
function PosterCard({ item, isWatched, onToggle }: PosterCardProps) {
  const posterUri = item.film.posterUrl
    ? `${TMDB_BASE}${item.film.posterUrl}`
    : null;

  return (
    <View style={styles.posterCard}>
      {/* Poster görseli */}
      {posterUri ? (
        <Image
          source={{ uri: posterUri }}
          style={[styles.posterImage, isWatched && styles.posterWatched]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.posterPlaceholder, isWatched && styles.posterWatched]}>
          <Ionicons name="film-outline" size={24} color={Colors.textGrey} />
        </View>
      )}

      {/* İzlendi toggle — sağ üst köşe */}
      <TouchableOpacity
        style={[styles.watchedToggle, isWatched && styles.watchedToggleActive]}
        onPress={() => onToggle(item.film.id)}
        activeOpacity={0.75}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        <Ionicons
          name={isWatched ? 'checkmark-circle' : 'checkmark-circle-outline'}
          size={18}
          color={isWatched ? Colors.accentPrimary : Colors.textGrey}
        />
      </TouchableOpacity>

      <Text style={styles.filmTitle} numberOfLines={2}>
        {item.film.title}
      </Text>
    </View>
  );
}

// ─── Ana Component ────────────────────────────────────────────────────────────

/**
 * WatchlistPreview bölümü — P5.4: progress bar + izlendi toggle.
 */
export default function WatchlistPreview({ items, loading }: Props) {
  const { t } = useLanguage();

  const shown = items.slice(0, 5);
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());

  // ─── AsyncStorage'dan izlenen ID'leri yükle ───────────────────────────
  useEffect(() => {
    loadWatchedIds().then(setWatchedIds);
  }, []);

  // ─── İzlendi toggle ─────────────────────────────────────────────────
  const handleToggle = useCallback((filmId: string) => {
    setWatchedIds((prev) => {
      const next = new Set(prev);
      if (next.has(filmId)) {
        next.delete(filmId);
      } else {
        next.add(filmId);
      }
      persistWatchedIds(next);
      return next;
    });
  }, []);

  // ─── İzleme ilerleme hesabı ──────────────────────────────────────────
  const totalCount = items.length;
  const watchedCount = items.filter((i) => watchedIds.has(i.film.id)).length;

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
          <Text style={styles.title}>{t('profile.recentlySaved')}</Text>
        </View>
        {shown.length > 0 && (
          <TouchableOpacity onPress={handleSeeAll} activeOpacity={0.7}>
            <Text style={styles.seeAll}>{t('profile.seeAll')}</Text>
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
            {t('profile.watchlistPreviewEmpty')}
          </Text>
        </View>
      ) : (
        <>
          {/* İzleme ilerleme çubuğu */}
          <WatchProgress
            watched={watchedCount}
            total={totalCount}
            label={t('profile.watchlistProgress', {
              watched: watchedCount,
              total: totalCount,
            })}
          />

          {/* Poster horizontal scroll */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {shown.map((item) => (
              <PosterCard
                key={item.film.id}
                item={item}
                isWatched={watchedIds.has(item.film.id)}
                onToggle={handleToggle}
              />
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}
