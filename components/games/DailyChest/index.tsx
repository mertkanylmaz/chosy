/**
 * DailyChest — Progress bar + chest reward for completing all daily games.
 *
 * Shows 7 slots (filled for completed games), and when all 7 are done,
 * displays a golden chest card with rewards.
 */
import React, { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import {
  Gift,
  ShieldCheck,
  Lightning,
  Dna,
  CheckCircle,
  CircleIcon as Circle,
} from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticHeavy } from '@/utils/haptics';
import { trackDailyChestOpened } from '@/utils/gameAnalytics';
import { logger } from '@/utils/logger';

import { styles } from './styles';

interface DailyChestProps {
  /** Total games available */
  totalGames: number;
  /** Number of games completed today */
  completedGames: number;
  /** Game types that are completed (for slot icons) */
  completedGameTypes: string[];
  /** Whether chest has already been claimed today */
  chestClaimed?: boolean;
}

/**
 * DailyChest — Visual progress bar with 7 slots + chest animation on completion.
 */
export function DailyChest({
  totalGames,
  completedGames,
  completedGameTypes,
  chestClaimed: initialClaimed = false,
}: DailyChestProps): React.JSX.Element {
  const { t } = useLanguage();
  const [claimed, setClaimed] = useState(initialClaimed);

  const isComplete = completedGames >= totalGames;

  /** Handle chest open — fire analytics + mark as claimed */
  const handleOpenChest = useCallback(() => {
    if (claimed) return;
    hapticHeavy();
    trackDailyChestOpened();
    setClaimed(true);
    logger.log('[DailyChest] Chest opened');
  }, [claimed]);

  return (
    <Animated.View
      entering={FadeInUp.delay(50).duration(400)}
      style={[styles.container, isComplete && styles.containerComplete]}
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Gift
            size={20}
            weight="duotone"
            color={isComplete ? Colors.gold : Colors.textSecondary}
          />
          <Text style={styles.title}>{t('games.hub.chest_title')}</Text>
        </View>
        <Text
          style={[
            styles.progressText,
            isComplete && styles.progressTextComplete,
          ]}
        >
          {t('games.hub.chest_progress', {
            completed: completedGames,
            total: totalGames,
          })}
        </Text>
      </View>

      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {Array.from({ length: totalGames }, (_, i) => {
          const isFilled = i < completedGames;
          return (
            <View
              key={i}
              style={[styles.dot, isFilled && styles.dotFilled]}
            >
              {isFilled ? (
                <CheckCircle size={16} weight="fill" color={Colors.gold} />
              ) : (
                <Circle size={16} weight="regular" color={Colors.textTertiary} />
              )}
            </View>
          );
        })}
      </View>

      {/* Chest card — only when all games completed */}
      {isComplete && (
        <View style={styles.chestCard}>
          {!claimed ? (
            <TouchableOpacity
              style={styles.chestButton}
              onPress={handleOpenChest}
              activeOpacity={0.7}
            >
              <Gift size={22} weight="fill" color={Colors.bgPrimary} />
              <Text style={styles.chestButtonText}>
                {t('games.hub.chest_open')}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.claimedRow}>
              <CheckCircle size={20} weight="fill" color={Colors.success} />
              <Text style={styles.claimedText}>
                {t('games.hub.chest_claimed')}
              </Text>
            </View>
          )}

          {/* Reward chips */}
          <View style={styles.rewardsRow}>
            <View style={styles.rewardChip}>
              <Dna size={14} weight="duotone" color={Colors.info} />
              <Text style={styles.rewardText}>
                {t('games.hub.chest_reward_dna')}
              </Text>
            </View>
            <View style={styles.rewardChip}>
              <ShieldCheck size={14} weight="duotone" color={Colors.success} />
              <Text style={styles.rewardText}>
                {t('games.hub.chest_reward_shield')}
              </Text>
            </View>
            <View style={styles.rewardChip}>
              <Lightning size={14} weight="duotone" color={Colors.warning} />
              <Text style={styles.rewardText}>
                {t('games.hub.chest_reward_xp')}
              </Text>
            </View>
          </View>
        </View>
      )}
    </Animated.View>
  );
}
