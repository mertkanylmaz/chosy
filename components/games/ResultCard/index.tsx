/**
 * ResultCard — Oyun sonuç ekranı.
 *
 * Başarı/başarısızlık durumu, film bilgisi, streak, paylaşım + watchlist butonları.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight, hapticHeavy } from '@/utils/haptics';
import { getPosterUrl } from '@/services/tmdb';

interface ResultCardProps {
  /** Bildi mi? */
  solved: boolean;
  /** Kaç denemede */
  attempts: number;
  /** Maksimum deneme */
  maxAttempts: number;
  /** Film bilgisi */
  filmTitle: string;
  filmYear: number;
  filmPosterPath: string | null;
  filmId: number;
  /** Streak */
  streak: number;
  /** Oyun adı (paylaşım için) */
  gameTitle: string;
  /** Paylaşım butonu callback */
  onShare?: () => void;
}

export function ResultCard({
  solved,
  attempts,
  maxAttempts,
  filmTitle,
  filmYear,
  filmPosterPath,
  filmId,
  streak,
  gameTitle,
  onShare,
}: ResultCardProps) {
  const { t } = useLanguage();
  const router = useRouter();

  const posterUrl = getPosterUrl(filmPosterPath, 'w342');

  return (
    <Animated.View entering={FadeInUp.duration(400)} style={styles.container}>
      {/* Status */}
      <View style={styles.statusRow}>
        <Ionicons
          name={solved ? 'checkmark-circle' : 'close-circle'}
          size={48}
          color={solved ? Colors.success : Colors.error}
        />
        <Text style={styles.statusText}>
          {solved
            ? t('games.result.solved')
            : t('games.result.failed')}
        </Text>
        {solved && (
          <Text style={styles.attemptsText}>
            {attempts}/{maxAttempts}
          </Text>
        )}
      </View>

      {/* Film */}
      <View style={styles.filmRow}>
        {posterUrl && (
          <Image
            source={{ uri: posterUrl }}
            style={styles.poster}
            contentFit="cover"
            transition={200}
          />
        )}
        <View style={styles.filmInfo}>
          <Text style={styles.filmTitle} numberOfLines={2}>
            {filmTitle}
          </Text>
          <Text style={styles.filmYear}>{filmYear}</Text>
        </View>
      </View>

      {/* Streak */}
      {streak > 0 && (
        <View style={styles.streakRow}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakText}>
            {t('games.result.streak', { count: streak })}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {onShare && (
          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => {
              hapticLight();
              onShare();
            }}
          >
            <Ionicons name="share-outline" size={20} color={Colors.textWhite} />
            <Text style={styles.shareText}>{t('games.result.share')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.watchlistButton}
          onPress={() => {
            hapticHeavy();
            router.push(`/film/${filmId}`);
          }}
        >
          <Ionicons name="add" size={20} color={Colors.textOnAccent} />
          <Text style={styles.watchlistText}>
            {t('games.result.add_watchlist')}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.lg,
  },
  statusRow: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  statusText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  attemptsText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filmRow: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    alignItems: 'center',
  },
  poster: {
    width: 60,
    height: 90,
    borderRadius: Theme.borderRadius.sm,
  },
  filmInfo: {
    flex: 1,
    gap: 4,
  },
  filmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  filmYear: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Colors.goldDim,
    borderRadius: Theme.borderRadius.md,
  },
  streakEmoji: {
    fontSize: 20,
  },
  streakText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gold,
  },
  actions: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accentPrimary,
  },
  shareText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textWhite,
  },
  watchlistButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Colors.accentPrimary,
  },
  watchlistText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textOnAccent,
  },
});
