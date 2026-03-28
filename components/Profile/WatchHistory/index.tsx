/**
 * WatchHistory — Kullanıcının swipe geçmişi liste kartı.
 *
 * İçerik:
 *   - 3 mini stat kutusu (total swipes, save rate, top genre)
 *   - Filter tabs: All / Saved / Skipped
 *   - Paginated film listesi (poster + bilgi + yön badge)
 *   - Load more butonu
 *
 * States:
 *   - loading: Skeleton
 *   - empty: Teşvik mesajı
 *   - active: Normal görünüm
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import SkeletonLoader from '@/components/SkeletonLoader';
import { getSwipeHistory } from '@/services/history';
import type {
  SwipeHistoryItem,
  SwipeHistoryParams,
  UserStats,
} from '@/services/history';

import { POSTER_H, POSTER_W, styles } from './styles';

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  /** history.ts'den gelen kullanıcı istatistikleri */
  historyStats: UserStats | null;
  /** İlk yükleme durumu */
  loading: boolean;
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

type FilterDirection = 'all' | 'right' | 'left';

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

/** Tarih string'ini göreceli metne çevirir */
function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Top genre'yi hesapla */
function getTopGenre(topGenres: Record<string, number> | undefined): string {
  if (!topGenres) return '—';
  const entries = Object.entries(topGenres);
  if (entries.length === 0) return '—';
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

// ─── Film Row ─────────────────────────────────────────────────────────────────

/** Tek film satırı */
function FilmRow({ item }: { item: SwipeHistoryItem }) {
  const isSaved = item.direction === 'right';

  return (
    <View style={styles.filmRow}>
      {/* Poster */}
      {item.posterUrl ? (
        <Image
          source={{ uri: item.posterUrl }}
          style={styles.posterImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.posterPlaceholder}>
          <Ionicons name="film-outline" size={20} color={Colors.textTertiary} />
        </View>
      )}

      {/* Film bilgisi */}
      <View style={styles.filmInfo}>
        <Text style={styles.filmTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.filmMeta}>
          {item.year ?? '—'}
          {item.voteAverage ? ` · ★ ${item.voteAverage.toFixed(1)}` : ''}
          {' · '}
          {formatRelativeDate(item.swipedAt)}
        </Text>
        {item.genres && item.genres.length > 0 && (
          <Text style={styles.filmGenres} numberOfLines={1}>
            {item.genres.slice(0, 3).join(', ')}
          </Text>
        )}
        <View style={styles.directionBadge}>
          <View
            style={[
              styles.directionDot,
              isSaved ? styles.directionDotSaved : styles.directionDotSkipped,
            ]}
          />
          <Text style={styles.directionText}>
            {isSaved ? 'Saved' : 'Skipped'}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Ana Component ────────────────────────────────────────────────────────────

/**
 * Watch History kartı.
 * Mini stats + filtrelenebilir sayfalanmış film listesi.
 */
export default function WatchHistory({ historyStats, loading }: Props) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<FilterDirection>('all');
  const [items, setItems] = useState<SwipeHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // ── Swipe geçmişi yükle ─────────────────────────────────────────────────

  const loadHistory = useCallback(
    async (pageNum: number, direction: FilterDirection, append: boolean) => {
      setListLoading(true);
      try {
        const params: SwipeHistoryParams = {
          page: pageNum,
          pageSize: PAGE_SIZE,
          direction: direction === 'all' ? null : direction,
        };
        const result = await getSwipeHistory(params);

        if (append) {
          setItems((prev) => [...prev, ...result.items]);
        } else {
          setItems(result.items);
        }
        setTotal(result.total);
        setHasMore(result.hasMore);
      } catch {
        // Sessizce devam et
      } finally {
        setListLoading(false);
      }
    },
    [],
  );

  // İlk yükleme + filtre değişikliğinde reset
  useEffect(() => {
    if (loading) return;
    setPage(1);
    loadHistory(1, filter, false);
  }, [filter, loading, loadHistory]);

  // ── Sonraki sayfa ───────────────────────────────────────────────────────

  const handleLoadMore = useCallback(() => {
    if (listLoading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadHistory(nextPage, filter, true);
  }, [page, filter, listLoading, hasMore, loadHistory]);

  // ── Filter tab değiştir ────────────────────────────────────────────────

  const handleFilterChange = useCallback((dir: FilterDirection) => {
    setFilter(dir);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  const topGenre = getTopGenre(historyStats?.topGenres);
  const saveRate = historyStats?.saveRate ?? 0;
  const totalSwipes = historyStats?.totalSwipes ?? 0;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="time-outline" size={16} color={Colors.accentPrimary} />
          <Text style={styles.headerTitle}>
            {t('profile.watchHistory') ?? 'Watch History'}
          </Text>
        </View>
        {totalSwipes > 0 && (
          <Text style={styles.totalCount}>
            {totalSwipes} {t('profile.watchHistoryFilms') ?? 'films'}
          </Text>
        )}
      </View>

      {loading ? (
        /* Skeleton */
        <SkeletonContent />
      ) : totalSwipes === 0 ? (
        /* Empty state */
        <View style={styles.emptyContainer}>
          <Ionicons name="film-outline" size={32} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>
            {t('profile.watchHistoryEmpty') ?? 'Start swiping to build your history!'}
          </Text>
        </View>
      ) : (
        <>
          {/* Mini stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalSwipes}</Text>
              <Text style={styles.statLabel}>
                {t('profile.watchHistoryTotal') ?? 'Total'}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: Colors.success }]}>
                {saveRate}%
              </Text>
              <Text style={styles.statLabel}>
                {t('profile.watchHistorySaveRate') ?? 'Save Rate'}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: Colors.gold }]}>
                {topGenre}
              </Text>
              <Text style={styles.statLabel}>
                {t('profile.watchHistoryTopGenre') ?? 'Top Genre'}
              </Text>
            </View>
          </View>

          {/* Filter tabs */}
          <View style={styles.filterRow}>
            {(['all', 'right', 'left'] as FilterDirection[]).map((dir) => {
              const isActive = filter === dir;
              const label =
                dir === 'all'
                  ? t('profile.watchHistoryAll') ?? 'All'
                  : dir === 'right'
                    ? t('profile.watchHistorySaved') ?? 'Saved'
                    : t('profile.watchHistorySkipped') ?? 'Skipped';

              return (
                <TouchableOpacity
                  key={dir}
                  style={[styles.filterTab, isActive && styles.filterTabActive]}
                  onPress={() => handleFilterChange(dir)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      isActive && styles.filterTabTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Film listesi */}
          <View style={styles.filmList}>
            {items.map((item) => (
              <FilmRow key={item.swipeId} item={item} />
            ))}
          </View>

          {/* Loading indicator (list) */}
          {listLoading && items.length > 0 && (
            <ActivityIndicator
              size="small"
              color={Colors.accentPrimary}
              style={{ marginTop: 12 }}
            />
          )}

          {/* Load more */}
          {hasMore && !listLoading && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={handleLoadMore}
              activeOpacity={0.7}
            >
              <Text style={styles.loadMoreText}>
                {t('profile.watchHistoryLoadMore') ?? 'Load More'}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonContent() {
  return (
    <View style={styles.skeletonList}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <SkeletonLoader width={POSTER_W} height={POSTER_H} borderRadius={8} />
          <View style={styles.skeletonInfo}>
            <SkeletonLoader width="70%" height={16} borderRadius={4} />
            <SkeletonLoader width="50%" height={12} borderRadius={4} />
            <SkeletonLoader width="40%" height={12} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}
