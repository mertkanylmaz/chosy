/**
 * ResultCard — Oyun sonuc ekrani (v2 UX overhaul).
 *
 * Iyilestirmeler:
 * - Film adi kesilmez (numberOfLines kaldirildi, flexWrap: wrap)
 * - Butonlar acik label + ikon (Share Score / Add to Watchlist)
 * - Yil etiketi: "Release Year: 2025"
 * - Coskulu baslik: "Great Guess!" / "So Close!"
 * - Deneme baglami: "Solved in 4/6 guesses"
 * - Streak gorsel + XP gostergesi
 *
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
  /** Kac denemede */
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
  /** Oyun adi (paylasim icin) */
  gameTitle: string;
  /** Oyun tipi (share card emoji grid icin) */
  gameType?: 'imposter' | 'logline' | 'quoted' | 'fadein';
}

/** XP hesaplama — erken tahmin = daha fazla XP */
function calculateXP(solved: boolean, attempts: number, maxAttempts: number): number {
  if (!solved) return 2;
  const remaining = maxAttempts - attempts;
  return 10 + remaining * 5;
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
  const xp = calculateXP(solved, attempts, maxAttempts);

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
        {/* ── Status Hero ── */}
        <View style={styles.statusSection}>
          <View style={[styles.statusIconRing, solved ? styles.statusIconRingSuccess : styles.statusIconRingFail]}>
            <Ionicons
              name={solved ? 'checkmark-circle' : 'close-circle'}
              size={44}
              color={solved ? Colors.success : Colors.error}
            />
          </View>
          <Text style={styles.statusTitle}>
            {solved ? t('games.result.solved') : t('games.result.failed')}
          </Text>
          <Text style={styles.statusSubtitle}>
            {solved
              ? t('games.result.solved_detail', { attempts, maxAttempts })
              : t('games.result.failed_detail', { maxAttempts })}
          </Text>
        </View>

        {/* ── XP Badge ── */}
        <Animated.View entering={FadeInUp.delay(150).duration(300)} style={styles.xpBadge}>
          <Ionicons name="star" size={16} color={Colors.gold} />
          <Text style={styles.xpText}>+{xp} XP</Text>
        </Animated.View>

        {/* ── Film Info ── */}
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
            <Text style={styles.filmTitle} numberOfLines={3}>
              {filmTitle}
            </Text>
            {filmYear > 0 && (
              <View style={styles.yearRow}>
                <Ionicons name="calendar-outline" size={13} color={Colors.textTertiary} />
                <Text style={styles.filmYearLabel}>
                  {t('games.result.release_year', { year: filmYear })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Streak ── */}
        {streak > 0 && (
          <Animated.View entering={FadeInUp.delay(200).duration(300)} style={styles.streakRow}>
            <View style={styles.streakBadge}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakCount}>{streak}</Text>
            </View>
            <Text style={styles.streakText}>
              {t('games.result.streak', { count: streak })}
            </Text>
          </Animated.View>
        )}

        {/* ── Actions ── */}
        <View style={styles.actions}>
          {isShareAvailable && (
            <TouchableOpacity
              style={[styles.shareButton, isCapturing && styles.shareButtonDisabled]}
              onPress={() => {
                hapticLight();
                share();
              }}
              disabled={isCapturing}
              activeOpacity={0.7}
            >
              <Ionicons name="share-outline" size={18} color={Colors.accentPrimary} />
              <Text style={styles.shareText}>
                {t('games.result.share_score')}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.watchlistButton}
            activeOpacity={0.7}
            onPress={async () => {
              hapticHeavy();
              try {
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
            <Ionicons name="bookmark-outline" size={18} color={Colors.textOnAccent} />
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
    alignSelf: 'stretch' as const,
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 16,
  },

  // ── Status Hero ──
  statusSection: {
    alignItems: 'center',
    gap: 6,
  },
  statusIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statusIconRingSuccess: {
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  statusIconRingFail: {
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  statusSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },

  // ── XP Badge ──
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: Colors.goldDim,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
  },
  xpText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold,
  },

  // ── Film Info ──
  filmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderRadius: Theme.borderRadius.md,
    padding: 12,
  },
  poster: {
    width: 80,
    height: 120,
    borderRadius: Theme.borderRadius.sm,
  },
  filmInfo: {
    flex: 1,
    paddingLeft: 14,
    gap: 6,
  },
  filmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
    fontFamily: 'PlayfairDisplay_700Bold',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  filmYearLabel: {
    fontSize: 13,
    color: Colors.textTertiary,
  },

  // ── Streak ──
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 10,
    backgroundColor: Colors.goldDim,
    borderRadius: Theme.borderRadius.md,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakEmoji: {
    fontSize: 20,
  },
  streakCount: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.gold,
  },
  streakText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.gold,
  },

  // ── Actions ──
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accentPrimary,
  },
  shareButtonDisabled: {
    opacity: 0.5,
  },
  shareText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accentPrimary,
  },
  watchlistButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Colors.accentPrimary,
  },
  watchlistText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textOnAccent,
  },
});
