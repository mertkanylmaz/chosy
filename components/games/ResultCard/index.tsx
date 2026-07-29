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
import { Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import {
  CalendarBlank,
  CheckCircle,
  Fire,
  ShareNetwork,
  Star,
  XCircle,
} from 'phosphor-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/utils/haptics';
import { getPosterUrl } from '@/services/tmdb';
import { GameShareCard, useShareCapture } from '@/components/ShareCards';
import { DnaXpReveal } from '@/components/games/DnaXpReveal';
import { formatFactor } from '@/components/games/ConfidenceSelector';
import type { DnaSignal } from '@/components/games/DnaXpReveal';
import { PlayNextBridge } from '@/components/games/PlayNextBridge';
import { WhyThisMovieFunnel } from '@/components/games/WhyThisMovie';
import {
  trackResultCardViewed,
  trackShareRendered,
  trackShareCompleted,
} from '@/utils/gameAnalytics';
import type { DimensionProgress, RankProgress } from '@/types/game';

import { styles } from './styles';

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
  /** TMDb poster yolu — `filmPosterUrl` verilmediyse kullanilir */
  filmPosterPath?: string | null;
  /**
   * Tam poster URL'i. Spotlight/CineMetrics/Detective sunucudan hazir URL
   * aliyor, TMDb yolu tasimıyor.
   */
  filmPosterUrl?: string | null;
  /** TMDb ID — `filmUuid` yoksa kesif kartinin film cozumu icin kullanilir */
  filmId?: number;
  /** Supabase `films.id` — varsa tmdb_id aramasi atlanir */
  filmUuid?: string;
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
  /** Bir sonraki bulmacaya kalan sure (hh:mm:ss) — verilirse gosterilir */
  countdown?: string;
  /** Geri sayim etiketi (varsayilan: games.result.next_puzzle) */
  countdownLabel?: string;
  /** "Hub'a don" eylemi — verilirse buton gosterilir */
  onBackToHub?: () => void;
  /** Sonuc basligi yerine oyuna ozel mesaj (orn. "3 tahminde buldun!") */
  resultMessage?: string;
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
  filmPosterUrl,
  filmId,
  filmUuid,
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
  countdown,
  countdownLabel,
  onBackToHub,
  resultMessage,
}: ResultCardProps) {
  const { t } = useLanguage();
  const { cardRef, share, isCapturing, isShareAvailable } = useShareCapture();

  // Hazir URL varsa TMDb yolu cozumlemesine gerek yok
  const posterUrl = filmPosterUrl ?? getPosterUrl(filmPosterPath ?? null, 'w342');
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
        {/* ── Perde: cozum filmi kahraman, kesif hedefi bu ── */}
        <View style={styles.filmHero}>
          {posterUrl && (
            <Image
              source={{ uri: posterUrl }}
              style={styles.poster}
              contentFit="cover"
              transition={200}
            />
          )}
          <Text style={styles.filmTitle}>{filmTitle}</Text>
          {filmYear > 0 && (
            <View style={styles.yearRow}>
              <CalendarBlank size={13} color={Colors.textTertiary} weight="duotone" />
              <Text style={styles.filmYearLabel}>
                {t('games.result.release_year', { year: filmYear })}
              </Text>
            </View>
          )}
        </View>

        {/* ── Durum — semantik renk yalnizca ikon ve metinde, yuzeyde degil ── */}
        <View style={styles.statusSection}>
          <View style={styles.statusRow}>
            {solved ? (
              <CheckCircle size={16} weight="duotone" color={Colors.gold} />
            ) : (
              <XCircle size={16} weight="duotone" color={Colors.textTertiary} />
            )}
            <Text style={[styles.statusTitle, solved && styles.statusTitleSolved]}>
              {solved ? t('games.result.solved') : t('games.result.failed')}
            </Text>
          </View>
          <Text style={styles.statusSubtitle}>
            {resultMessage ??
              (solved
                ? t('games.result.solved_detail', { attempts, maxAttempts })
                : t('games.result.failed_detail', { maxAttempts }))}
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

        {/* ── Kesif koprusu — birincil CTA'lar burada ── */}
        {whyThisMovie && (
          <WhyThisMovieFunnel
            whyText={whyThisMovie.why_text}
            funFact={whyThisMovie.fun_fact}
            filmTitle={filmTitle}
            filmId={filmId}
            filmUuid={filmUuid}
            gameType={gameType ?? 'unknown'}
          />
        )}

        {/* ── Streak + guven bahsi — ikincil bilgi, CTA'lardan sonra ── */}
        {streak > 0 && (
          <Animated.View entering={FadeInUp.delay(200).duration(300)} style={styles.streakRow}>
            {/* Emoji yerine Phosphor duotone — oyun ekranlarinda tek ikon dili */}
            <Fire size={16} weight="duotone" color={Colors.gold} />
            <Text style={styles.streakCount}>{streak}</Text>
            <Text style={styles.streakText}>
              {t('games.result.streak', { count: streak })}
            </Text>
          </Animated.View>
        )}

        {confidenceFactor != null && confidenceFactor !== 1 && (
          <Animated.View entering={FadeInUp.delay(220).duration(300)} style={styles.confidenceRow}>
            <Text style={styles.confidenceLabel}>
              {t('games.imposter.confidence_multiplier')}
            </Text>
            <Text style={styles.confidenceValue}>×{formatFactor(confidenceFactor)}</Text>
          </Animated.View>
        )}

        {/* ── Actions ── */}
        <View style={styles.actions}>
          {isShareAvailable && (
            <TouchableOpacity
              style={[styles.shareButton, isCapturing && styles.shareButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('games.result.share_score')}
              accessibilityState={{ disabled: isCapturing }}
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
              <ShareNetwork size={18} color={Colors.gold} weight="duotone" />
              <Text style={styles.shareText}>
                {t('games.result.share_score')}
              </Text>
            </TouchableOpacity>
          )}
          {onBackToHub && (
            <TouchableOpacity
              style={styles.hubButton}
              accessibilityRole="button"
              onPress={() => {
                hapticLight();
                onBackToHub();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.hubText}>{t('games.result.back_to_hub')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Bir sonraki bulmacaya geri sayim ── */}
        {countdown ? (
          <View style={styles.countdownSection}>
            <Text style={styles.countdownLabel}>
              {countdownLabel ?? t('games.result.next_puzzle_label')}
            </Text>
            <Text style={styles.countdownTime}>{countdown}</Text>
          </View>
        ) : null}

        {/* ── Play Next Bridge ── */}
        {gameType && (
          <PlayNextBridge currentGame={gameType} />
        )}
      </Animated.View>
    </>
  );
}
