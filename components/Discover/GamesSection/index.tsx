/**
 * GamesSection — Sinefil oyunlari grid'i.
 *
 * ⚠️ C.6'da bulunan BUG: bu bileşen `app_config.games_enabled`'i HİÇ
 * okumuyordu — asagidaki `GAMES` modül seviyesi sabiti tek kaynaktı. Yani
 * hub'da (`app/games/index.tsx`) config ile gizlenen bir oyun burada
 * gorunmeye devam ediyordu; Quoted'in gizlenmesi de yalnizca listeden
 * elle cikarilmis olmasi sayesinde calisiyordu. Artik liste her odakta
 * lazy okunuyor (CLAUDE.md kural 6).
 *
 * Tanimlar SILINMEZ — dondurulan oyunlar flag geri acilinca donebilsin.
 * Tap → /games/[route]
 */

import React, { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Sentry from '@sentry/react-native';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { getEnabledGames } from '@/services/gameApi';
import { hapticLight } from '@/utils/haptics';

import { styles } from './styles';

// ─── Oyun Tanimlari ───────────────────────────────────────────────────────────

/**
 * Config okunamadiginda gosterilecek liste (C.6). Hub ekranindaki
 * `FALLBACK_ENABLED_GAMES` ile ayni urun karari: tek aktif bonus oyun.
 */
const FALLBACK_ENABLED_GAMES: readonly string[] = ['spotlight'];

const GAMES = [
  {
    id: 'fadein',
    route: '/games/fadein',
    titleKey: 'games.fadein.title',
    descKey: 'games.fadein.description',
    icon: 'image' as const,
  },
  {
    id: 'imposter',
    route: '/games/imposter',
    titleKey: 'games.imposter.title',
    descKey: 'games.imposter.description',
    icon: 'people' as const,
  },
  {
    id: 'logline',
    route: '/games/logline',
    titleKey: 'games.logline.title',
    descKey: 'games.logline.description',
    icon: 'bulb' as const,
  },
  {
    id: 'cinemetrics',
    route: '/games/cinemetrics',
    titleKey: 'games.cinemetrics.title',
    descKey: 'games.cinemetrics.description',
    icon: 'stats-chart' as const,
  },
  {
    id: 'spotlight',
    route: '/games/spotlight',
    titleKey: 'games.spotlight.title',
    descKey: 'games.spotlight.hub_description',
    icon: 'flashlight' as const,
  },
  {
    id: 'detective',
    route: '/games/detective',
    titleKey: 'games.detective.title',
    descKey: 'games.detective.hub_description',
    icon: 'search' as const,
  },
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface GamesSectionProps {
  /** Oyun tiklama analytics callback'i */
  onGamePress?: (gameId: string) => void;
}

// ─── Section ──────────────────────────────────────────────────────────────────

/** Sinefil oyunlari grid section'i */
export default function GamesSection({ onGamePress }: GamesSectionProps) {
  const { t } = useLanguage();
  const router = useRouter();

  /**
   * null = henuz okunmadi → hicbir kart cizilmez. Kapali bir oyunu bir kare
   * bile gostermektense bos beklemek dogru: aksi halde flag'in kapattigi
   * oyun her ekran acilisinda kisa sureligine goruunurdu.
   */
  const [enabledGames, setEnabledGames] = useState<readonly string[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // Lazy okuma (CLAUDE.md kural 6) — modul seviyesinde cache YOK.
      // Hata Sentry'ye getEnabledGames icinde dusuyor; null donerse
      // emniyet tarafi (yalniz Spotlight) gosterilir.
      void getEnabledGames()
        .then((enabled) => {
          if (!cancelled) setEnabledGames(enabled ?? FALLBACK_ENABLED_GAMES);
        })
        .catch((err) => {
          // getEnabledGames hatayi kendi yakalayip null donuyor; buraya
          // ancak beklenmedik bir runtime hatasi duser — yutulmaz.
          Sentry.captureException(err, { tags: { component: 'GamesSection' } });
          if (!cancelled) setEnabledGames(FALLBACK_ENABLED_GAMES);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const visibleGames = enabledGames
    ? GAMES.filter((game) => enabledGames.includes(game.id))
    : [];

  const handlePress = (game: (typeof GAMES)[number]) => {
    hapticLight();
    onGamePress?.(game.id);
    router.push(game.route as never);
  };

  // Gorunur oyun yoksa bolum HIC cizilmez — "Sinefil oyunlari" basligi
  // altinda bos bir izgara birakmak yerine bolum kapanir.
  if (visibleGames.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(500).duration(400).springify()}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('discoverTab.gamesTitle')}</Text>
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            router.push('/games' as never);
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.seeAllText}>{t('discoverTab.seeAll')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {visibleGames.map((game) => (
          <TouchableOpacity
            key={game.id}
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => handlePress(game)}
          >
            <Ionicons
              name={game.icon}
              size={24}
              color={Colors.accentPrimary}
              style={styles.cardIcon}
            />
            <Text style={styles.cardTitle} numberOfLines={1}>
              {t(game.titleKey)}
            </Text>
            <Text style={styles.cardDescription} numberOfLines={2}>
              {t(game.descKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}
