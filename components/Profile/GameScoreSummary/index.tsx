/**
 * GameScoreSummary — Profile icinde 2x2 oyun skor grid'i.
 *
 * Her oyun icin getGameStreak() (AsyncStorage tabanlı) cagirir.
 * Kartlar: emoji + isim + streak + en uzun streak.
 * Hic oynanmamissa "Henuz oynamadin" + "Oyna" CTA gosterir.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { getGameStreak } from '@/services/gameService';
import { posthogAnalytics } from '@/services/posthog';
import { logger } from '@/utils/logger';
import SkeletonLoader from '@/components/SkeletonLoader';
import type { GameStreakInfo } from '@/services/gameTypes';

import { styles } from './styles';

// ─── Oyun tanimlari ─────────────────────────────────────────────────────────

interface GameDef {
  type: string;
  titleKey: string;
  emoji: string;
  route: string;
}

const GAMES: GameDef[] = [
  { type: 'imposter', titleKey: 'games.imposter.title', emoji: '\uD83C\uDFAD', route: '/games/imposter' },
  { type: 'logline',  titleKey: 'games.logline.title',  emoji: '\uD83D\uDCDD', route: '/games/logline' },
  { type: 'quoted',   titleKey: 'games.quoted.title',   emoji: '\uD83D\uDCAC', route: '/games/quoted' },
  { type: 'fadein',   titleKey: 'games.fadein.title',   emoji: '\uD83C\uDFAC', route: '/games/fadein' },
];

// ─── GameScoreSummary ─────────────────────────────────────────────────────────

/**
 * 4 oyunun streak bilgisini gosteren 2x2 grid.
 * Profile ScrollView icinde gomulu olarak calisir.
 */
export default function GameScoreSummary() {
  const { t } = useLanguage();
  const router = useRouter();

  const [streaks, setStreaks] = useState<Record<string, GameStreakInfo>>({});
  const [loading, setLoading] = useState(true);

  /** Tum oyunlarin streak bilgisini paralel yukle */
  const loadStreaks = useCallback(async () => {
    try {
      const results = await Promise.all(
        GAMES.map((g) => getGameStreak(g.type)),
      );
      const map: Record<string, GameStreakInfo> = {};
      for (const r of results) {
        map[r.gameType] = r;
      }
      setStreaks(map);
    } catch (err) {
      logger.error('[GameScoreSummary] streak yukleme hatasi:', err);
      // Hata durumunda bos map — kartlar "—" gosterir
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStreaks();
  }, [loadStreaks]);

  /** Oyun kartina tap → navigate + analytics */
  const handleGamePress = useCallback(
    (game: GameDef) => {
      posthogAnalytics.track('profile_game_score_tapped', {
        game_type: game.type,
      });
      router.push(game.route as import('expo-router').Href);
    },
    [router],
  );

  // ── Loading skeleton ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.grid}>
          {GAMES.map((g) => (
            <SkeletonLoader
              key={g.type}
              height={100}
              borderRadius={16}
              style={styles.skeletonCard}
            />
          ))}
        </View>
      </View>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {GAMES.map((game) => {
          const streak = streaks[game.type];
          const played = streak ? streak.totalPlayed > 0 : false;

          return (
            <TouchableOpacity
              key={game.type}
              style={styles.card}
              onPress={() => handleGamePress(game)}
              activeOpacity={0.75}
            >
              {/* Emoji + oyun adi */}
              <View style={styles.cardHeader}>
                <Text style={styles.emoji}>{game.emoji}</Text>
                <Text style={styles.gameName} numberOfLines={1}>
                  {t(game.titleKey)}
                </Text>
              </View>

              {played && streak ? (
                <>
                  {/* Streak bilgisi */}
                  <View style={styles.streakRow}>
                    <Ionicons name="flame" size={14} color={Colors.gold} />
                    <Text style={styles.streakText}>
                      {t('profile.gamesStreak', { count: streak.currentStreak })}
                    </Text>
                  </View>
                  <Text style={styles.longestText}>
                    {t('profile.gamesLongest', { count: streak.longestStreak })}
                  </Text>
                </>
              ) : (
                <>
                  {/* Hic oynanmamis */}
                  <Text style={styles.notPlayedText}>
                    {t('profile.gamesNotPlayed')}
                  </Text>
                  <View style={styles.playCtaRow}>
                    <Text style={styles.playCta}>{t('profile.gamesPlay')}</Text>
                    <Ionicons name="arrow-forward" size={12} color={Colors.accentPrimary} />
                  </View>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
