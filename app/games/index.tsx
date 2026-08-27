/**
 * Games Hub — gunun sinema ritueli (Festival Layer).
 *
 * Kompozisyon: hero → gunun temasi → gunluk odul → gunun rotasi → DNA.
 * Bu dosya yalnizca veri toplar; gorsel parcalar components/games/ altinda.
 */
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowClockwise,
  CaretLeft,
  ChartBar,
  ChatCircleDots,
  Flashlight,
  ImageSquare,
  Lightbulb,
  MagnifyingGlass,
  UsersThree,
} from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCinemaDna } from '@/hooks/useCinemaDna';
import { hapticLight, hapticHeavy } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { rankByDnaImpact } from '@/utils/gameRecommendation';
import {
  getCachedResult,
  getGameStreak,
  clearOldGameCaches,
  clearAllGameCaches,
} from '@/services/gameService';
import { getStreakInfo } from '@/services/gamification';
import { getEnabledGames, resetGameProgress } from '@/services/gameApi';
import { getUserDisplayName } from '@/services/homeService';
import { DnaSummaryCard } from '@/components/games/DnaSummaryCard';
import { DailyChest } from '@/components/games/DailyChest';
import { DailyThemeCard } from '@/components/games/DailyThemeCard';
import { DailyRoute, type RouteGame } from '@/components/games/DailyRoute';
import { HubHero } from '@/components/games/HubHero';

/**
 * Config okunamadiginda gosterilecek liste (C.6, PRODUCT_OS §7.4).
 *
 * Bu bir "varsayilan oyun listesi" DEGIL — tek aktif bonus oyunun adi.
 * Gorunurlugun tek dogruluk kaynagi hala `app_config.games_enabled`;
 * burasi yalnizca okuma basarisiz oldugunda devreye giren emniyet tarafi.
 */
const FALLBACK_ENABLED_GAMES: readonly string[] = ['spotlight'];

/**
 * Rota tanimlari. C.6'da DONDURULAN oyunlarin satirlari SILINMEZ — kod ve
 * rota duruyor, gorunurlugu `games_enabled` belirliyor. Liste kisaltilirsa
 * flag geri acildiginda kart geri gelmez.
 */
const GAME_DEFINITIONS = [
  {
    gameType: 'detective',
    route: '/games/detective',
    titleKey: 'games.detective.title',
    descriptionKey: 'games.detective.hub_description',
    icon: MagnifyingGlass,
  },
  {
    gameType: 'spotlight',
    route: '/games/spotlight',
    titleKey: 'games.spotlight.title',
    descriptionKey: 'games.spotlight.hub_description',
    icon: Flashlight,
  },
  {
    gameType: 'fadein',
    route: '/games/fadein',
    titleKey: 'games.fadein.title',
    descriptionKey: 'games.fadein.description',
    icon: ImageSquare,
  },
  {
    gameType: 'imposter',
    route: '/games/imposter',
    titleKey: 'games.imposter.title',
    descriptionKey: 'games.imposter.description',
    icon: UsersThree,
  },
  {
    gameType: 'logline',
    route: '/games/logline',
    titleKey: 'games.logline.title',
    descriptionKey: 'games.logline.description',
    icon: Lightbulb,
  },
  {
    gameType: 'quoted',
    route: '/games/quoted',
    titleKey: 'games.quoted.title',
    descriptionKey: 'games.quoted.description',
    icon: ChatCircleDots,
  },
  {
    gameType: 'cinemetrics',
    route: '/games/cinemetrics',
    titleKey: 'games.cinemetrics.title',
    descriptionKey: 'games.cinemetrics.description',
    icon: ChartBar,
  },
] as const;

export default function GamesHubScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { dna, progress, reload: reloadDna } = useCinemaDna();

  const [games, setGames] = useState<RouteGame[]>([]);
  const [totalStreak, setTotalStreak] = useState(0);
  const [freezesRemaining, setFreezesRemaining] = useState(0);
  const [displayName, setDisplayName] = useState<string | null>(null);
  /** DEV sıfırlama uçuşta — çift tetiklemeyi engeller */
  const [isResetting, setIsResetting] = useState(false);

  const loadGameStates = useCallback(async () => {
    // Sadece eski versiyon cache'lerini temizle (bir kez calisir)
    await clearOldGameCaches();

    // Aktif oyun listesi sunucudan — dondurulmus oyunlar gizlenir.
    //
    // C.6: config okunamazsa artik TAM LISTE gosterilmez. Eski davranis
    // (fallback = hepsi) budamadan sonra tersine dondu: bir okuma hatasi
    // dondurulmus alti oyunu geri acardi. Yeni fallback SPOTLIGHT_ONLY —
    // urun karari neyse o. Hata yine Sentry'ye dusuyor (getEnabledGames),
    // sessiz degil.
    const enabled = await getEnabledGames();
    const visibleGames = GAME_DEFINITIONS.filter((def) =>
      (enabled ?? FALLBACK_ENABLED_GAMES).includes(def.gameType),
    );

    const cards: RouteGame[] = [];
    let maxStreak = 0;

    for (const def of visibleGames) {
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

    const streakInfo = await getStreakInfo();
    if (streakInfo) {
      setFreezesRemaining(streakInfo.freezesRemaining);
    }

    setDisplayName(await getUserDisplayName());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGameStates();
      reloadDna();
    }, [loadGameStates, reloadDna]),
  );

  const playedCount = games.filter((g) => g.played).length;

  // DNA'daki en buyuk bosugu kapatacak oynanmamis oyun — rotada isaretlenir
  const recommendedGameType =
    rankByDnaImpact(
      dna,
      games.filter((g) => g.played).map((g) => g.gameType),
      games.map((g) => g.gameType),
    )[0]?.gameType ?? null;

  /**
   * TEST: bugünkü oyun ilerlemesini sıfırla.
   *
   * Yalnızca yerel cache'i silmek yetmiyordu — asıl durum sunucudaki
   * `game_scores`'ta ve oyun yine "oynandı" görünüyordu. Bu yüzden önce
   * sunucu ilerlemesi silinir (dev-reset-games, allowlist korumalı),
   * sonra yerel cache temizlenir.
   *
   * Buton yalnızca __DEV__ altında render edilir.
   */
  const handleResetProgress = useCallback(() => {
    Alert.alert(
      'Bugünü sıfırla',
      'Bugünkü oyun ilerlemen silinecek ve hepsini yeniden oynayabileceksin. Bulmacalar aynı kalır.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: async () => {
            if (isResetting) return;
            setIsResetting(true);
            hapticHeavy();
            try {
              const res = await resetGameProgress();
              await clearAllGameCaches();
              await loadGameStates();
              await reloadDna();
              Alert.alert(
                'Sıfırlandı',
                res.reset > 0
                  ? `${res.reset} oyun ilerlemesi silindi. Hepsini yeniden oynayabilirsin.`
                  : `Bugün silinecek ilerleme bulunamadı.\n\nHesap: ${res.user_id}\n\nOyunlar hâlâ "oynandı" görünüyorsa bu ID allowlist'te olsa bile skorlar başka bir hesaba ait demektir.`,
              );
            } catch (err) {
              // Sessiz fallback YASAK — hata görünür olmalı.
              // Sunucunun gerçek mesajı gösteriliyor: 403 ise allowlist'e
              // eklenecek users.id doğrudan bu metinde geliyor.
              // K-43: bu blok bilerek t() dışında bırakıldı. Buton yalnızca
              // __DEV__ altında render edilir (bkz. render, `{__DEV__ ? ...}`),
              // metinler son kullanıcıya hiç basılmaz — Kural 7 kapsamı dışı.
              logger.error('[hub] Reset başarısız:', err);
              Alert.alert(
                'Sıfırlanamadı',
                err instanceof Error && err.message
                  ? err.message
                  : 'Sunucu ilerlemesi silinemedi.',
              );
            } finally {
              setIsResetting(false);
            }
          },
        },
      ],
    );
  }, [isResetting, loadGameStates, reloadDna]);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          // Sabit 83 (tab bar payı) kaldırıldı — hub da tab bar'ın içinde değil
          paddingBottom: Math.max(insets.bottom, Theme.spacing.sm),
        },
      ]}
    >
      {/* Header — sag butona basis: DEV reset */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerSlot}
          onPress={() => {
            hapticLight();
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('games.common.back')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <CaretLeft size={24} color={Colors.textWhite} weight="duotone" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">
          {t('games.hub.title')}
        </Text>
        {__DEV__ ? (
          <TouchableOpacity
            style={styles.headerSlot}
            onPress={handleResetProgress}
            disabled={isResetting}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Bugünü sıfırla"
          >
            <ArrowClockwise
              size={20}
              color={isResetting ? Colors.textTertiary : Colors.gold}
              weight="duotone"
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSlot} />
        )}
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <HubHero
          dna={dna}
          progress={progress}
          displayName={displayName}
          playedCount={playedCount}
          totalGames={games.length}
          streak={totalStreak}
          freezes={freezesRemaining}
        />

        <View style={styles.section}>
          <DailyThemeCard />
        </View>

        <View style={styles.section}>
          <DailyChest />
        </View>

        <DailyRoute games={games} recommendedGameType={recommendedGameType} />

        <DnaSummaryCard dna={dna} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  /** paddingTop/paddingBottom runtime'da insets ile veriliyor */
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  /** GameShell header'ı ile hizalı — hub→oyun geçişinde başlık zıplamasın */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.sm,
    minHeight: 56,
  },
  headerSlot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Theme.typography.eyebrow,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: Theme.spacing.xl,
  },
  section: {
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.md,
  },
});
