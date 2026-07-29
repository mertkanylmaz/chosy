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
import {
  Eye,
  BookmarkSimple,
  Lightbulb,
  ChartBar,
} from 'phosphor-react-native';
import type { IconProps } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { localizeGenre } from '@/utils/filmFilters';
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
 * Tek istatistik kutusu — Phosphor icon ile.
 */
function StatCard({
  value,
  label,
  IconComp,
  emptyHint,
}: {
  value: number;
  label: string;
  IconComp: React.ComponentType<IconProps>;
  /** 0 degerinde ciplak "0" yerine gosterilecek yonlendirme */
  emptyHint?: string;
}) {
  const isEmpty = value === 0;
  return (
    <View style={styles.statCard}>
      <View style={styles.statIconRow}>
        <IconComp size={14} color={Colors.textGrey} weight="duotone" />
      </View>
      <Text style={[styles.statValue, isEmpty && styles.statValueEmpty]}>{value}</Text>
      <Text style={styles.statLabel}>
        {isEmpty && emptyHint ? emptyHint : label}
      </Text>
    </View>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

/**
 * Discovery Stats kartı — P5.4 basitleştirilmiş versiyon.
 * Badge sistemi kaldırıldı; watchlist bazlı top 2 genre + top yönetmen eklendi.
 */
export default function DiscoveryStats({ stats, insights, loading }: Props) {
  const { t, language } = useLanguage();

  const discovered = (insights?.total_saves ?? 0) + (insights?.total_skips ?? 0);

  /** Watchlist'ten türetilen top 2 genre */
  const topGenres = insights?.saved_genre_distribution?.slice(0, 2) ?? [];

  return (
    <View style={styles.card}>
      {/* Başlık */}
      <View style={styles.header}>
        <ChartBar size={16} color={Colors.gold} weight="duotone" />
        <Text style={styles.headerTitle}>{t('profile.discoveryStats')}</Text>
      </View>

      {loading ? (
        <SkeletonContent />
      ) : !stats && discovered === 0 ? (
        <Text style={styles.empty}>{t('profile.statsNoInsights')}</Text>
      ) : (
        <>
          {/*
            Sira: gercekten dolu olanlar once. "Movies Watched" swipe turevi
            (`user_stats.total_discovered`) — oyundan/film detayindan eklenen
            filmler swipe satiri uretmedigi icin watchlist doluyken bile 0
            kalabiliyor. En sona alindi ve 0'da ciplak sayi yerine yonlendirme
            gosteriliyor.
          */}
          <View style={styles.grid}>
            <StatCard
              value={stats?.saved_films ?? 0}
              label={t('profile.statsMoviesSaved')}
              IconComp={BookmarkSimple}
            />
            <StatCard
              value={stats?.total_sessions ?? 0}
              label={t('profile.statsMoodSessions')}
              IconComp={Lightbulb}
            />
            <StatCard
              value={stats?.total_discovered ?? discovered}
              label={t('profile.statsMoviesWatched')}
              emptyHint={t('profile.statsMoviesWatchedEmpty')}
              IconComp={Eye}
            />
          </View>

          {/* Top 2 Genre */}
          {topGenres.length > 0 && (
            <View style={styles.insightsSection}>
              <Text style={styles.insightsLabel}>{t('profile.statsTopGenres')}</Text>
              <View style={styles.genreRow}>
                {topGenres.map((g) => (
                  <View key={g.genre} style={styles.genrePill}>
                    <Text style={styles.genrePillText}>{localizeGenre(g.genre, language)}</Text>
                    <Text style={styles.genrePct}>{g.percentage}%</Text>
                  </View>
                ))}
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
