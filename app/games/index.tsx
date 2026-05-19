/**
 * Games Hub — Günlük oyun listesi.
 *
 * 3 oyun kartı: Imposter, 5 İpucu, Acımasız Eleştiri.
 * Her kart: oyun durumu (oynandı/oynanmadı) + streak.
 */
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight, hapticHeavy } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { getCachedResult, getGameStreak, clearOldGameCaches, clearAllGameCaches } from '@/services/gameService';

interface GameCardData {
  gameType: string;
  route: string;
  titleKey: string;
  descriptionKey: string;
  icon: string;
  played: boolean;
  solved: boolean;
  streak: number;
}

const GAME_DEFINITIONS = [
  {
    gameType: 'fadein',
    route: '/games/fadein',
    titleKey: 'games.fadein.title',
    descriptionKey: 'games.fadein.description',
    icon: 'image',
  },
  {
    gameType: 'imposter',
    route: '/games/imposter',
    titleKey: 'games.imposter.title',
    descriptionKey: 'games.imposter.description',
    icon: 'people',
  },
  {
    gameType: 'logline',
    route: '/games/logline',
    titleKey: 'games.logline.title',
    descriptionKey: 'games.logline.description',
    icon: 'bulb',
  },
  {
    gameType: 'quoted',
    route: '/games/quoted',
    titleKey: 'games.quoted.title',
    descriptionKey: 'games.quoted.description',
    icon: 'chatbubble-ellipses',
  },
] as const;

export default function GamesHubScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [games, setGames] = useState<GameCardData[]>([]);
  const [totalStreak, setTotalStreak] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadGameStates();
    }, []),
  );

  const loadGameStates = useCallback(async () => {
    // Sadece eski versiyon cache'lerini temizle (bir kez calisir)
    await clearOldGameCaches();

    const cards: GameCardData[] = [];
    let maxStreak = 0;

    for (const def of GAME_DEFINITIONS) {
      const cachedResult = await getCachedResult(def.gameType);
      const streakInfo = await getGameStreak(def.gameType);

      cards.push({
        ...def,
        played: cachedResult !== null,
        solved: cachedResult?.solved ?? false,
        streak: streakInfo.currentStreak,
      });

      if (streakInfo.currentStreak > maxStreak) {
        maxStreak = streakInfo.currentStreak;
      }
    }

    setGames(cards);
    setTotalStreak(maxStreak);
  }, []);

  const playedCount = games.filter((g) => g.played).length;

  /** DEV: Title'a long press → tüm game cache'leri sıfırla (test için) */
  const handleResetCaches = useCallback(() => {
    Alert.alert(
      'Reset Games',
      'Tüm oyun cache\'leri silinecek. Bugünkü oyunlar sıfırlanır, yeni puzzle üretilir.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            hapticHeavy();
            await clearAllGameCaches();
            loadGameStates();
          },
        },
      ],
    );
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header — title'a long press: DEV reset */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            hapticLight();
            router.back();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('games.hub.title')}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleResetCaches}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="refresh" size={22} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Streak summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{playedCount}/{GAME_DEFINITIONS.length}</Text>
          <Text style={styles.summaryLabel}>{t('games.hub.played')}</Text>
        </View>
        {totalStreak > 0 && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>🔥 {totalStreak}</Text>
            <Text style={styles.summaryLabel}>{t('games.hub.streak')}</Text>
          </View>
        )}
      </View>

      {/* Game cards */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {games.map((game, index) => (
          <Animated.View key={game.gameType} entering={FadeInUp.delay(index * 100).duration(300)}>
            <TouchableOpacity
              style={[
                styles.gameCard,
                game.played && styles.gameCardPlayed,
              ]}
              onPress={() => {
                hapticLight();
                // Oyunlar FREE — kota/paywall yok (engagement oncelikli)
                router.push(game.route as never);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.gameIconContainer}>
                <Ionicons
                  name={game.icon as never}
                  size={28}
                  color={game.played ? Colors.textTertiary : Colors.accentPrimary}
                />
              </View>
              <View style={styles.gameInfo}>
                <Text style={[styles.gameTitle, game.played && styles.gameTitlePlayed]}>
                  {t(game.titleKey)}
                </Text>
                <Text style={styles.gameDescription}>
                  {t(game.descriptionKey)}
                </Text>
                {game.streak > 0 && (
                  <Text style={styles.gameStreak}>
                    🔥 {t('games.hub.streak_count', { count: game.streak })}
                  </Text>
                )}
              </View>
              <View style={styles.gameStatus}>
                {game.played ? (
                  <Ionicons
                    name={game.solved ? 'checkmark-circle' : 'close-circle'}
                    size={24}
                    color={game.solved ? Colors.success : Colors.error}
                  />
                ) : (
                  <View style={styles.playBadge}>
                    <Text style={styles.playText}>{t('games.hub.play')}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingBottom: 83,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md,
    height: 48,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Theme.spacing.xl,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
  },
  summaryItem: {
    alignItems: 'center',
    gap: 4,
  },
  summaryNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    padding: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  gameCardPlayed: {
    opacity: 0.6,
  },
  gameIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameInfo: {
    flex: 1,
    gap: 4,
  },
  gameTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  gameTitlePlayed: {
    color: Colors.textSecondary,
  },
  gameDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  gameStreak: {
    fontSize: 12,
    color: Colors.gold,
    marginTop: 2,
  },
  gameStatus: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    backgroundColor: Colors.accentPrimary,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.full,
  },
  playText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textOnAccent,
  },
});
