/**
 * DiscoveryStats — Keşif istatistikleri kartı (P5.4 basitleştirilmiş).
 *
 * Badge sistemi kaldırıldı. İçerik:
 *  - 2×2 stat grid (keşfedilen, kaydedilen, oturum, favori tür)
 *  - Top 2 genre pill (SwipeInsight'tan, watchlist bazlı)
 *  - Top 1 yönetmen satırı (SwipeInsight'tan, watchlist bazlı)
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Eye,
  BookmarkSimple,
  Lightbulb,
  ChartBar,
  CaretRight,
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
 *
 * `onPress` verilirse kutu dokunulabilir olur. Bu yalnizca Pro Mode turevi
 * sayaclar icindir (asagidaki not): sayaci besleyen yuzeye goturur.
 *
 * Dokunulabilir kutuda affordance ikilidir: sag ustte chevron + etiketin
 * altinda `hint` satiri. Chevron tek basina "bu kart bir yere gidiyor" der
 * ama NEREYE gittigini soylemez; sayaci 0 olan kullanicinin ihtiyaci olan
 * da tam olarak o. Statik kutularda ikisi de cizilmez.
 */
function StatCard({
  value,
  label,
  IconComp,
  hint,
  onPress,
}: {
  value: number;
  label: string;
  IconComp: React.ComponentType<IconProps>;
  /** Dokunulabilir kutularda etiketin altinda gosterilen yonlendirme */
  hint?: string;
  /** Verilirse kutu dokunulabilir olur ve bu hedefe goturur */
  onPress?: () => void;
}) {
  const isEmpty = value === 0;
  const body = (
    <>
      <View style={styles.statIconRow}>
        <IconComp size={14} color={Colors.textGrey} weight="duotone" />
        {onPress && <CaretRight size={12} weight="bold" color={Colors.textGrey} />}
      </View>
      <Text style={[styles.statValue, isEmpty && styles.statValueEmpty]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {onPress && hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.statCard}>{body}</View>;
  }

  return (
    <TouchableOpacity
      style={styles.statCard}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label} — ${hint}` : label}>
      {body}
    </TouchableOpacity>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

/**
 * Discovery Stats kartı — P5.4 basitleştirilmiş versiyon.
 * Badge sistemi kaldırıldı; watchlist bazlı top 2 genre + top yönetmen eklendi.
 */
export default function DiscoveryStats({ stats, insights, loading }: Props) {
  const { t, language } = useLanguage();
  const router = useRouter();

  /**
   * "Mood Sessions" ve "Movies Watched" sayaclarinin hedefi (C.9d, CTO karari).
   *
   * Ikisi de artik kendiliginden dolmuyor: `total_sessions` yalnizca
   * `sessions` tablosuna yazan mood search'ten gelir ve mood search C.9c'de
   * Pro Mode arkasina alindi; `total_discovered` ise `swipes` tablosunu sayar
   * ve o tabloya yazan client yolu kalmadi. Kartlar bugune kadar HICBIR yere
   * gitmiyordu (bilesende tek `onPress` yoktu) — dokunus hedefi burada
   * eklendi, sayaci besleyen tek yuzey Pro Mode oldugu icin oraya gider.
   */
  const goProMode = React.useCallback(() => {
    router.push('/pro-mode' as never);
  }, [router]);

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
            kalabiliyor. En sona alindi; sayinin altindaki `hint` satiri ile
            chevron sayaci besleyen yuzeye (Pro Mode) yonlendirir.
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
              hint={t('profile.statsExploreInPro')}
              IconComp={Lightbulb}
              onPress={goProMode}
            />
            <StatCard
              value={stats?.total_discovered ?? discovered}
              label={t('profile.statsMoviesWatched')}
              hint={t('profile.statsExploreInPro')}
              IconComp={Eye}
              onPress={goProMode}
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
