/**
 * SwipeIntelligence — Kullanıcının swipe davranışından çıkarılan insight'lar.
 *
 * 3-4 insight kartı gösterir:
 *  - Skip edilen genre yüzdesi
 *  - Kaydedilen dominant genre
 *  - En çok kaydedilen yönetmen
 *  - Genel save/skip oranı
 *
 * Veri: profileService.getSwipeInsights() çıktısı (SwipeInsight tipi)
 */
import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colors';
import SkeletonLoader from '@/components/SkeletonLoader';
import type { SwipeInsight } from '@/types/profile';

import { styles } from './styles';

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface InsightCardData {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}

interface Props {
  insights: SwipeInsight | null;
  loading: boolean;
}

// ─── Yardımcı: insight listesi üret ──────────────────────────────────────────

/**
 * SwipeInsight verisinden gösterilecek insight metinlerini üretir.
 */
function buildInsights(insights: SwipeInsight): InsightCardData[] {
  const list: InsightCardData[] = [];

  const total = insights.total_saves + insights.total_skips;

  // 1. Save oranı
  if (total > 0) {
    const saveRate = Math.round((insights.total_saves / total) * 100);
    list.push({
      icon: 'heart-outline',
      text: `You save ${saveRate}% of the films you discover`,
    });
  }

  // 2. En çok kaydettiğin genre
  if (insights.saved_genre_distribution.length > 0) {
    const top = insights.saved_genre_distribution[0];
    list.push({
      icon: 'film-outline',
      text: `You save ${top.percentage}% ${top.genre} films`,
    });
  }

  // 3. Skip edilen baskın genre
  if (insights.skipped_signals.length > 0) {
    const skipGenre = insights.skipped_signals[0];
    const skipCount = insights.total_skips;
    if (skipCount > 0) {
      list.push({
        icon: 'arrow-forward-outline',
        text: `You often skip ${skipGenre} films`,
      });
    }
  }

  // 4. En çok kaydedilen yönetmen
  if (insights.top_directors.length > 0) {
    const dir = insights.top_directors[0];
    list.push({
      icon: 'person-outline',
      text: `Your top director: ${dir.director}`,
    });
  }

  return list;
}

// ─── Progress Needed ──────────────────────────────────────────────────────────

const UNLOCK_THRESHOLD = 10;

/**
 * Kaç film daha gerektiğini gösteren progress bar.
 */
function ProgressNeeded({ count }: { count: number }) {
  const clamped = Math.min(count, UNLOCK_THRESHOLD);
  const progress = clamped / UNLOCK_THRESHOLD;

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { flex: progress }]} />
        <View style={{ flex: 1 - progress }} />
      </View>
      <Text style={styles.progressLabel}>
        {clamped}/{UNLOCK_THRESHOLD} films needed
      </Text>
    </View>
  );
}

// ─── Insight Kartı ────────────────────────────────────────────────────────────

/**
 * Tek bir insight satırı — sol altın accent çizgili kart.
 */
function InsightCard({ icon, text }: InsightCardData) {
  return (
    <View style={styles.insightCard}>
      <View style={styles.insightIcon}>
        <Ionicons name={icon} size={15} color={Colors.gold} />
      </View>
      <Text style={styles.insightText}>{text}</Text>
    </View>
  );
}

// ─── Ana Component ────────────────────────────────────────────────────────────

/**
 * SwipeIntelligence bölümü.
 * Yeterli veri yoksa teşvik edici boş durum gösterir.
 */
export default function SwipeIntelligence({ insights, loading }: Props) {
  return (
    <View style={styles.container}>
      {/* Başlık */}
      <View style={styles.header}>
        <Ionicons name="analytics-outline" size={16} color={Colors.gold} />
        <Text style={styles.title}>Swipe Intelligence</Text>
      </View>

      {/* İçerik */}
      {loading ? (
        <>
          <SkeletonLoader height={52} borderRadius={10} style={styles.skeletonRow} />
          <SkeletonLoader height={52} borderRadius={10} style={styles.skeletonRow} />
          <SkeletonLoader height={52} borderRadius={10} />
        </>
      ) : !insights || insights.total_saves + insights.total_skips < 3 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="film-outline" size={28} color={Colors.textGrey} />
          <Text style={styles.emptyText}>
            Keep swiping to unlock your insights! 🎬
          </Text>
          <ProgressNeeded count={insights ? insights.total_saves + insights.total_skips : 0} />
        </View>
      ) : (
        buildInsights(insights).map((item, idx) => (
          <InsightCard key={idx} icon={item.icon} text={item.text} />
        ))
      )}
    </View>
  );
}
