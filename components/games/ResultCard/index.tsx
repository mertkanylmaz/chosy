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
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  BookmarkSimple,
  CalendarBlank,
  CheckCircle,
  ShareNetwork,
  Star,
  XCircle,
} from 'phosphor-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight, hapticHeavy } from '@/utils/haptics';
import { getPosterUrl } from '@/services/tmdb';
import { supabase } from '@/services/supabase';
import { logger } from '@/utils/logger';
import { GameShareCard, useShareCapture } from '@/components/ShareCards';
import { DnaXpReveal } from '@/components/games/DnaXpReveal';
import { formatFactor } from '@/components/games/ConfidenceSelector';
import type { DnaSignal } from '@/components/games/DnaXpReveal';
import { PlayNextBridge } from '@/components/games/PlayNextBridge';
import { WhyThisMovieFunnel } from '@/components/games/WhyThisMovie';
import {
  trackResultCardViewed,
  trackFilmPageOpened,
  trackShareRendered,
  trackShareCompleted,
} from '@/utils/gameAnalytics';
import type { DimensionProgress, RankProgress } from '@/types/game';

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
  gameType?: 'imposter' | 'logline' | 'quoted' | 'fadein' | 'cinemetrics' | 'spotlight' | 'detective';
  /** Gunun bulmaca numarasi — paylasim kartinda film adi YERINE gosterilir */
  puzzleNo?: number;
  /** Server-side XP (Edge Function'dan — varsa local hesaplama yerine bunu goster) */
  xpAwarded?: number;
  /** DNA guncellendi mi */
  dnaUpdated?: boolean;
  /** DNA sinyal detaylari */
  dnaSignals?: DnaSignal[];
  /** Imposter guven bahsi carpani — 1 ise gosterilmez */
  confidenceFactor?: number | null;
  /** DNA boyut before/after degerleri (server destegiyle) */
  dimensionProgress?: DimensionProgress[];
  /** Rank ilerleme bilgisi (server destegiyle) */
  rankProgress?: RankProgress;
  /** WhyThisMovie funnel data (server-side) */
  whyThisMovie?: {
    why_text?: string;
    fun_fact?: string;
  };
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
  puzzleNo,
  xpAwarded,
  confidenceFactor,
  dnaUpdated,
  dnaSignals,
  dimensionProgress,
  rankProgress,
  whyThisMovie,
}: ResultCardProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const { cardRef, share, isCapturing, isShareAvailable } = useShareCapture();

  const posterUrl = getPosterUrl(filmPosterPath, 'w342');
  // Use server XP if provided, otherwise fall back to local calculation
  const xp = xpAwarded ?? calculateXP(solved, attempts, maxAttempts);
  const hasDnaReveal = xpAwarded != null; // Edge Function path provides xpAwarded

  // Track result card view once on mount
  const hasTrackedView = useRef(false);
  useEffect(() => {
    if (!hasTrackedView.current) {
      hasTrackedView.current = true;
      trackResultCardViewed(gameType ?? 'unknown', solved);
    }
  }, []);

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
          streak={streak}
          gameType={gameType ?? 'imposter'}
          puzzleNo={puzzleNo}
        />
      </View>

      <Animated.View entering={FadeInUp.duration(400)} style={styles.container}>
        {/* ── Status Hero ── */}
        <View style={styles.statusSection}>
          <View style={[styles.statusIconRing, solved ? styles.statusIconRingSuccess : styles.statusIconRingFail]}>
            {solved ? (
              <CheckCircle size={44} weight="duotone" color={Colors.success} />
            ) : (
              <XCircle size={44} weight="duotone" color={Colors.error} />
            )}
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

        {/* ── XP + DNA Reveal ── */}
        {hasDnaReveal ? (
          <DnaXpReveal
            xpAwarded={xp}
            dnaUpdated={dnaUpdated ?? false}
            dnaSignals={dnaSignals}
            solved={solved}
            dimensionProgress={dimensionProgress}
            rankProgress={rankProgress}
          />
        ) : (
          <Animated.View entering={FadeInUp.delay(150).duration(300)} style={styles.xpBadge}>
            <Star size={16} color={Colors.gold} weight="duotone" />
            <Text style={styles.xpText}>+{xp} XP</Text>
          </Animated.View>
        )}

        {/* ── Guven bahsi kirilimi — notr bahiste gizli ── */}
        {confidenceFactor != null && confidenceFactor !== 1 && (
          <Animated.View entering={FadeInUp.delay(220).duration(300)} style={styles.confidenceRow}>
            <Text style={styles.confidenceLabel}>
              {t('games.imposter.confidence_multiplier')}
            </Text>
            <Text style={styles.confidenceValue}>×{formatFactor(confidenceFactor)}</Text>
          </Animated.View>
        )}

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
                <CalendarBlank size={13} color={Colors.textTertiary} weight="duotone" />
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

        {/* ── Why This Movie? ── */}
        {whyThisMovie && (
          <WhyThisMovieFunnel
            whyText={whyThisMovie.why_text}
            funFact={whyThisMovie.fun_fact}
            filmTitle={filmTitle}
            filmId={filmId}
            gameType={gameType ?? 'unknown'}
          />
        )}

        {/* ── Actions ── */}
        <View style={styles.actions}>
          {isShareAvailable && (
            <TouchableOpacity
              style={[styles.shareButton, isCapturing && styles.shareButtonDisabled]}
              onPress={async () => {
                hapticLight();
                trackShareRendered(gameType ?? 'unknown');
                const shared = await share();
                if (shared) {
                  trackShareCompleted(gameType ?? 'unknown', 'image');
                }
              }}
              disabled={isCapturing}
              activeOpacity={0.7}
            >
              <ShareNetwork size={18} color={Colors.accentPrimary} weight="duotone" />
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
              trackFilmPageOpened(gameType ?? 'unknown', filmId);
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
            <BookmarkSimple size={18} color={Colors.textOnAccent} weight="duotone" />
            <Text style={styles.watchlistText}>
              {t('games.result.add_watchlist')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Play Next Bridge ── */}
        {gameType && (
          <PlayNextBridge currentGame={gameType} />
        )}
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
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    marginTop: 6,
  },
  confidenceLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textTertiary,
  },
  confidenceValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.gold,
  },
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
