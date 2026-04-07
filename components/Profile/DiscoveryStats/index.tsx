/**
 * DiscoveryStats — Keşif istatistikleri kartı (P5.4 basitleştirilmiş).
 *
 * Badge sistemi kaldırıldı. İçerik:
 *  - 2×2 stat grid (keşfedilen, kaydedilen, oturum, favori tür)
 *  - Top 2 genre pill (SwipeInsight'tan, watchlist bazlı)
 *  - Top 1 yönetmen satırı (SwipeInsight'tan, watchlist bazlı)
 */
import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import SkeletonLoader from '@/components/SkeletonLoader';
import type { SwipeInsight, UserStats } from '@/types/profile';

import { styles } from './styles';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  stats: UserStats | null;
  insights: SwipeInsight | null;
  loading: boolean;
}

// ─── Yardımcı bileşenler ──────────────────────────────────────────────────────

/**
 * Tek istatistik kutusu.
 */
function StatCard({
  value,
  label,
  icon,
}: {
  value: string | number;
  label: string;
  icon: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIconRow}>
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={14}
          color={Colors.textGrey}
        />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

/**
 * Discovery Stats kartı — P5.4 basitleştirilmiş versiyon.
 * Badge sistemi kaldırıldı; watchlist bazlı top 2 genre + top yönetmen eklendi.
 */
export default function DiscoveryStats({ stats, insights, loading }: Props) {
  const { t } = useLanguage();

  const discovered = (insights?.total_saves ?? 0) + (insights?.total_skips ?? 0);

  /** Watchlist'ten türetilen top 2 genre */
  const topGenres = insights?.saved_genre_distribution?.slice(0, 2) ?? [];
  /** Watchlist'ten türetilen top 1 yönetmen */
  const topDirector = insights?.top_directors?.[0] ?? null;

  return (
    <View style={styles.card}>
      {/* Başlık */}
      <View style={styles.header}>
        <Ionicons name="stats-chart-outline" size={16} color={Colors.gold} />
        <Text style={styles.headerTitle}>{t('profile.discoveryStats')}</Text>
      </View>

      {loading ? (
        <SkeletonContent />
      ) : !stats && discovered === 0 ? (
        <Text style={styles.empty}>{t('profile.statsNoInsights')}</Text>
      ) : (
        <>
          {/* 2×2 stat grid */}
          <View style={styles.grid}>
            <StatCard
              value={stats?.total_discovered ?? discovered}
              label={t('profile.statsMoviesDiscovered')}
              icon="film-outline"
            />
            <StatCard
              value={stats?.saved_films ?? 0}
              label={t('profile.statsMoviesSaved')}
              icon="bookmark-outline"
            />
            <StatCard
              value={stats?.total_sessions ?? 0}
              label={t('profile.statsMoodSessions')}
              icon="bulb-outline"
            />
            <StatCard
              value={stats?.favorite_genre ?? '—'}
              label={t('profile.statsFavoriteGenreStat')}
              icon="star-outline"
            />
          </View>

          {/* Top 2 Genre */}
          {topGenres.length > 0 && (
            <View style={styles.insightsSection}>
              <Text style={styles.insightsLabel}>{t('profile.statsTopGenres')}</Text>
              <View style={styles.genreRow}>
                {topGenres.map((g) => (
                  <View key={g.genre} style={styles.genrePill}>
                    <Text style={styles.genrePillText}>{g.genre}</Text>
                    <Text style={styles.genrePct}>{g.percentage}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Top 1 Director */}
          {topDirector != null && (
            <View style={styles.directorRow}>
              <Ionicons name="videocam-outline" size={14} color={Colors.textGrey} />
              <View style={styles.directorInfo}>
                <Text style={styles.directorLabel}>{t('profile.statsFavoriteDirector')}</Text>
                <Text style={styles.directorName} numberOfLines={1}>
                  {topDirector.director}
                </Text>
              </View>
              <View style={styles.directorBadge}>
                <Text style={styles.directorBadgeText}>{topDirector.saved_count}</Text>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

/**
 * Yükleme durumu iskelet görseli.
 */
function SkeletonContent() {
  return (
    <View style={styles.skeletonGrid}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <SkeletonLoader height={80} borderRadius={12} />
        </View>
      ))}
    </View>
  );
}
