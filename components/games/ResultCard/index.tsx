/**
 * ResultCard — Oyun sonuç ekranı.
 *
 * Başarı/başarısızlık durumu, film bilgisi, streak, paylaşım + watchlist butonları.
 * Share: useShareCapture + GameShareCard ile PNG capture.
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
import { supabase } from '@/services/supabase';
import { logger } from '@/utils/logger';
import { GameShareCard, useShareCapture } from '@/components/ShareCards';

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
  /** Oyun tipi (share card emoji grid için) */
  gameType?: 'imposter' | 'pinpoint' | 'roast';
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
  gameType,
}: ResultCardProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const { cardRef, share, isCapturing, isShareAvailable } = useShareCapture();

  const posterUrl = getPosterUrl(filmPosterPath, 'w342');

  return (
    <>
      {/* Offscreen share card — PNG capture icin */}
      <View style={styles.offscreen} pointerEvents="none">
        <GameShareCard
          ref={cardRef}
          gameTitle={gameTitle}
          solved={solved}
          attempts={attempts}
          maxAttempts={maxAttempts}
          filmTitle={filmTitle}
          filmYear={filmYear}
          streak={streak}
          gameType={gameType ?? 'imposter'}
        />
      </View>

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
          {isShareAvailable && (
            <TouchableOpacity
              style={[styles.shareButton, isCapturing && styles.shareButtonDisabled]}
              onPress={() => {
                hapticLight();
                share();
              }}
              disabled={isCapturing}
            >
              <Ionicons name="share-outline" size={20} color={Colors.textWhite} />
              <Text style={styles.shareText}>{t('games.result.share')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.watchlistButton}
            onPress={async () => {
              hapticHeavy();
              try {
                // tmdb_id → UUID lookup (film detail sayfasi UUID bekliyor)
                const { data } = await supabase
                  .from('films')
                  .select('id')
                  .eq('tmdb_id', filmId)
                  .single();
                if (data?.id) {
                  router.push(`/film/${data.id}`);
                } else {
                  logger.warn(`[ResultCard] Film UUID bulunamadi: tmdb_id=${filmId}`);
                }
              } catch (err) {
                logger.error('[ResultCard] Film lookup hatasi:', err);
              }
            }}
          >
            <Ionicons name="add" size={20} color={Colors.textOnAccent} />
            <Text style={styles.watchlistText}>
              {t('games.result.add_watchlist')}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    opacity: 0,
  },
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
  shareButtonDisabled: {
    opacity: 0.5,
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
