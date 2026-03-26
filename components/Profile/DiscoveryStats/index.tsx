/**
 * DiscoveryStats — Kullanıcının film keşif istatistikleri kartı.
 *
 * 2×2 grid stat kartları + kapsamlı badge sistemi:
 * - 6 swipe bazlı badge (discover/save sayısı)
 * - 3 session bazlı badge
 * - 7 genre bazlı badge
 * Kazanılmış: altın arka plan. Kazanılmamış: soluk, 🔒, tıklayınca ipucu.
 */
import React from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colors';
import SkeletonLoader from '@/components/SkeletonLoader';
import type { SwipeInsight, UserStats } from '@/types/profile';

import { styles } from './styles';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  stats: UserStats | null;
  insights: SwipeInsight | null;
  loading: boolean;
}

// ─── Badge Tanımları ──────────────────────────────────────────────────────────

interface BadgeDefinition {
  /** Benzersiz kimlik */
  id: string;
  /** Emoji dahil görüntülenen etiket */
  label: string;
  /** Kazanılma koşulu */
  check: (stats: UserStats) => boolean;
  /** Kazanılmamışsa Alert metni */
  hint: string;
}

/** Tüm uygulama badge'leri — swipe, session ve genre bazlı */
const ALL_BADGES: BadgeDefinition[] = [
  // ── Swipe bazlı ──────────────────────────────────────────────────────────
  {
    id: 'explorer',
    label: 'Explorer 🗺️',
    check: (s) => s.total_discovered >= 10,
    hint: 'Discover 10 movies to unlock Explorer!',
  },
  {
    id: 'film_buff',
    label: 'Film Buff 🎞️',
    check: (s) => s.total_discovered >= 50,
    hint: 'Discover 50 movies to unlock Film Buff!',
  },
  {
    id: 'cinema_addict',
    label: 'Cinema Addict 🎬',
    check: (s) => s.total_discovered >= 100,
    hint: 'Discover 100 movies to unlock Cinema Addict!',
  },
  {
    id: 'collector',
    label: 'Collector 📚',
    check: (s) => s.total_saved >= 5,
    hint: 'Save 5 movies to unlock Collector!',
  },
  {
    id: 'film_collector',
    label: 'Film Collector 🏆',
    check: (s) => s.total_saved >= 20,
    hint: 'Save 20 movies to unlock Film Collector!',
  },
  {
    id: 'curator',
    label: 'Curator 👑',
    check: (s) => s.total_saved >= 50,
    hint: 'Save 50 movies to unlock Curator!',
  },
  // ── Session bazlı ─────────────────────────────────────────────────────────
  {
    id: 'regular',
    label: 'Regular 🔄',
    check: (s) => s.total_sessions >= 3,
    hint: 'Have 3 mood sessions to unlock Regular!',
  },
  {
    id: 'mood_explorer',
    label: 'Mood Explorer 🔮',
    check: (s) => s.total_sessions >= 10,
    hint: 'Have 10 mood sessions to unlock Mood Explorer!',
  },
  {
    id: 'mood_master',
    label: 'Mood Master 🧠',
    check: (s) => s.total_sessions >= 25,
    hint: 'Have 25 mood sessions to unlock Mood Master!',
  },
  // ── Genre bazlı ───────────────────────────────────────────────────────────
  {
    id: 'deep_thinker',
    label: 'Deep Thinker 💭',
    check: (s) => s.favorite_genre === 'Drama',
    hint: 'Watch more Drama films to unlock Deep Thinker!',
  },
  {
    id: 'thrill_seeker',
    label: 'Thrill Seeker 👻',
    check: (s) => s.favorite_genre === 'Horror',
    hint: 'Watch more Horror films to unlock Thrill Seeker!',
  },
  {
    id: 'joy_finder',
    label: 'Joy Finder 😂',
    check: (s) => s.favorite_genre === 'Comedy',
    hint: 'Watch more Comedy films to unlock Joy Finder!',
  },
  {
    id: 'romantic_soul',
    label: 'Romantic Soul 💕',
    check: (s) => s.favorite_genre === 'Romance',
    hint: 'Watch more Romance films to unlock Romantic Soul!',
  },
  {
    id: 'futurist',
    label: 'Futurist 🚀',
    check: (s) => s.favorite_genre === 'Science Fiction',
    hint: 'Watch more Sci-Fi films to unlock Futurist!',
  },
  {
    id: 'animation_lover',
    label: 'Animation Lover 🎨',
    check: (s) => s.favorite_genre === 'Animation',
    hint: 'Watch more Animation films to unlock Animation Lover!',
  },
  {
    id: 'truth_seeker',
    label: 'Truth Seeker 🔍',
    check: (s) => s.favorite_genre === 'Documentary',
    hint: 'Watch more Documentaries to unlock Truth Seeker!',
  },
];

// ─── Yardımcı bileşenler ──────────────────────────────────────────────────────

/** Tek istatistik kutusu */
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

/** Badge'lerin gösterildiği yatay kaydırma bölümü */
function BadgesSection({ stats }: { stats: UserStats }) {
  const earnedCount = ALL_BADGES.filter((b) => b.check(stats)).length;

  function handleBadgePress(badge: BadgeDefinition, isEarned: boolean) {
    if (!isEarned) {
      Alert.alert('Badge Locked 🔒', badge.hint);
    }
  }

  return (
    <View style={styles.badgesSection}>
      <Text style={styles.badgesCount}>
        Badges ({earnedCount}/{ALL_BADGES.length})
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.badgesScrollContent}>
        {ALL_BADGES.map((badge) => {
          const isEarned = badge.check(stats);
          return (
            <TouchableOpacity
              key={badge.id}
              style={[styles.badgePill, isEarned ? styles.earnedBadge : styles.unearnedBadge]}
              onPress={() => handleBadgePress(badge, isEarned)}
              activeOpacity={0.75}>
              <Text
                style={[
                  styles.badgePillText,
                  isEarned ? styles.earnedBadgeText : styles.unearnedBadgeText,
                ]}>
                {isEarned ? badge.label : `🔒 ${badge.label}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

/**
 * Discovery Stats kartı.
 * İstatistik grid'i ve genişletilmiş achievement badge sistemi.
 */
export default function DiscoveryStats({ stats, insights, loading }: Props) {
  const discovered = (insights?.total_saves ?? 0) + (insights?.total_skips ?? 0);

  return (
    <View style={styles.card}>
      {/* Başlık */}
      <View style={styles.header}>
        <Ionicons name="stats-chart-outline" size={16} color={Colors.gold} />
        <Text style={styles.headerTitle}>Discovery Stats</Text>
      </View>

      {loading ? (
        <SkeletonContent />
      ) : !stats && discovered === 0 ? (
        <Text style={styles.empty}>Start exploring to see your stats!</Text>
      ) : (
        <>
          {/* 2×2 grid */}
          <View style={styles.grid}>
            <StatCard
              value={stats?.total_discovered ?? discovered}
              label="Movies Discovered"
              icon="film-outline"
            />
            <StatCard
              value={stats?.saved_films ?? 0}
              label="Movies Saved"
              icon="bookmark-outline"
            />
            <StatCard
              value={stats?.total_sessions ?? 0}
              label="Mood Sessions"
              icon="bulb-outline"
            />
            <StatCard
              value={stats?.favorite_genre ?? '—'}
              label="Favorite Genre"
              icon="star-outline"
            />
          </View>

          {/* Badge bölümü */}
          {stats && <BadgesSection stats={stats} />}
        </>
      )}
    </View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

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
