/**
 * DailyRoute — gunun oyun rotasi (Festival Layer).
 *
 * Mockup'taki dikey "metro hatti": her oyun bir dugum, tamamlananlar altin
 * muhur. Eskiden ayri bir kart olan "Onerilen Rota" buraya gomuldu — DNA'ya
 * en cok katki yapacak oynanmamis oyun "Buradan basla" olarak isaretlenir.
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { CaretRight, Check, X } from 'phosphor-react-native';
import type { IconProps } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/utils/haptics';
import { trackRecommendedRouteTapped } from '@/utils/gameAnalytics';

import { styles } from './styles';

/** Rotada gosterilen tek oyun */
export interface RouteGame {
  gameType: string;
  route: string;
  titleKey: string;
  descriptionKey: string;
  icon: React.ComponentType<IconProps>;
  played: boolean;
  solved: boolean;
  streak: number;
}

interface DailyRouteProps {
  games: RouteGame[];
  /** DNA etkisine gore onerilen oyun tipi — null ise hicbiri isaretlenmez */
  recommendedGameType: string | null;
}

/**
 * Gunun rotasini dikey hat olarak cizer. Bos liste gelirse null doner.
 */
export function DailyRoute({ games, recommendedGameType }: DailyRouteProps): React.JSX.Element | null {
  const { t } = useLanguage();
  const router = useRouter();

  if (games.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>{t('games.hub.route_title')}</Text>

      {games.map((game, index) => {
        const isFirst = index === 0;
        const isLast = index === games.length - 1;
        const isRecommended = !game.played && game.gameType === recommendedGameType;

        return (
          <Animated.View
            key={game.gameType}
            entering={FadeInUp.delay(index * 60).duration(280)}
            style={styles.row}
          >
            {/* Hat + dugum */}
            <View style={styles.rail}>
              <View style={[styles.railLine, isFirst && styles.railLineHidden]} />
              <View
                style={[
                  styles.node,
                  game.played && (game.solved ? styles.nodeSolved : styles.nodeMissed),
                  isRecommended && styles.nodeRecommended,
                ]}
              >
                {game.played ? (
                  game.solved ? (
                    <Check size={14} weight="bold" color={Colors.gold} />
                  ) : (
                    <X size={13} weight="bold" color={Colors.textTertiary} />
                  )
                ) : (
                  <game.icon
                    size={14}
                    weight="duotone"
                    color={isRecommended ? Colors.gold : Colors.textSecondary}
                  />
                )}
              </View>
              <View style={[styles.railLine, isLast && styles.railLineHidden]} />
            </View>

            {/* Oyun satiri */}
            <TouchableOpacity
              style={[styles.card, game.played && styles.cardPlayed]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t(game.titleKey)}
              onPress={() => {
                hapticLight();
                if (isRecommended) trackRecommendedRouteTapped(game.gameType);
                // Oyunlar FREE — kota/paywall yok (engagement oncelikli)
                router.push(game.route as never);
              }}
            >
              <View style={styles.info}>
                <Text style={styles.gameTitle} numberOfLines={1}>
                  {t(game.titleKey)}
                </Text>
                <Text style={styles.gameDescription} numberOfLines={2}>
                  {t(game.descriptionKey)}
                </Text>

                {isRecommended ? (
                  <Text style={styles.statusLabel}>{t('games.hub.route_recommended')}</Text>
                ) : null}
                {game.played ? (
                  <Text style={styles.statusLabel}>
                    {t(game.solved ? 'games.hub.route_solved' : 'games.hub.route_missed')}
                  </Text>
                ) : null}
                {game.streak > 0 ? (
                  <Text style={styles.streakText}>
                    {t('games.hub.streak_count', { count: game.streak })}
                  </Text>
                ) : null}
              </View>

              <View style={styles.playChevron}>
                <CaretRight size={16} weight="bold" color={Colors.textTertiary} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}
