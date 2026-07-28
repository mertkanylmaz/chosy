/**
 * DailyChest — Günlük tamamlama ilerlemesi ve sandık ödülü.
 *
 * Durum SUNUCUDAN gelir: kaç oyun tamamlandı, sandık açıldı mı, hangi ödüller
 * verildi. Daha önce bu ekran tamamen lokaldi — "açıldı" state'i istemcide
 * tutuluyor, vaat edilen ödüller hiç uygulanmıyordu.
 */
import React, { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import {
  Gift,
  ShieldCheck,
  Lightning,
  CheckCircle,
  CircleIcon as Circle,
} from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticHeavy } from '@/utils/haptics';
import { trackDailyChestOpened } from '@/utils/gameAnalytics';
import { getDailyChest } from '@/services/gameApi';
import { logger } from '@/utils/logger';
import type { DailyChestState } from '@/types/game';

import { styles } from './styles';

/**
 * DailyChest — 7 slot ilerleme çubuğu + hak edildiğinde sandık kartı.
 */
export function DailyChest(): React.JSX.Element | null {
  const { t } = useLanguage();
  const [state, setState] = useState<DailyChestState | null>(null);
  const [error, setError] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const loadChest = useCallback(async () => {
    try {
      setError(false);
      const puzzleDate = new Date().toLocaleDateString('en-CA');
      setState(await getDailyChest(puzzleDate));
    } catch (err) {
      // Hard Rule 5: sessiz fallback yok
      logger.error('[DailyChest] Durum yüklenemedi:', err);
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadChest();
    }, [loadChest]),
  );

  /** Sandığı aç — ödüller sunucuda uygulanır */
  const handleOpenChest = useCallback(async () => {
    if (!state?.unlocked || state.claimed || isClaiming) return;
    hapticHeavy();
    setIsClaiming(true);
    try {
      const puzzleDate = new Date().toLocaleDateString('en-CA');
      const claimed = await getDailyChest(puzzleDate, true);
      setState(claimed);
      trackDailyChestOpened();
    } catch (err) {
      logger.error('[DailyChest] Sandık açılamadı:', err);
      setError(true);
    } finally {
      setIsClaiming(false);
    }
  }, [state, isClaiming]);

  if (error) {
    return (
      <Animated.View entering={FadeInUp.duration(300)} style={styles.container}>
        <TouchableOpacity onPress={loadChest} activeOpacity={0.7} accessibilityRole="button" >
          <Text style={styles.progressText}>{t('games.hub.chest_error')}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (!state || state.total === 0) return null;

  const isComplete = state.unlocked;
  const rewards = state.rewards;

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
            completed: state.completed,
            total: state.total,
          })}
        </Text>
      </View>

      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {Array.from({ length: state.total }, (_, i) => {
          const isFilled = i < state.completed;
          return (
            <View key={i} style={[styles.dot, isFilled && styles.dotFilled]}>
              {isFilled ? (
                <CheckCircle size={16} weight="fill" color={Colors.gold} />
              ) : (
                <Circle size={16} weight="regular" color={Colors.textTertiary} />
              )}
            </View>
          );
        })}
      </View>

      {/* Chest card — yalnızca tüm oyunlar bitince */}
      {isComplete && (
        <View style={styles.chestCard}>
          {!state.claimed ? (
            <TouchableOpacity
              style={styles.chestButton}
              onPress={handleOpenChest}
              disabled={isClaiming}
              activeOpacity={0.7}
            accessibilityRole="button"
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

          {/* Ödül rozetleri — YALNIZCA gerçekten verilenler */}
          {state.claimed && rewards && (
            <View style={styles.rewardsRow}>
              {(rewards.streak_shield_count ?? 0) > 0 && (
                <View style={styles.rewardChip}>
                  <ShieldCheck size={14} weight="duotone" color={Colors.success} />
                  <Text style={styles.rewardText}>
                    {t('games.hub.chest_reward_shield')}
                  </Text>
                </View>
              )}
              {rewards.double_xp_tomorrow && (
                <View style={styles.rewardChip}>
                  <Lightning size={14} weight="duotone" color={Colors.warning} />
                  <Text style={styles.rewardText}>
                    {t('games.hub.chest_reward_xp')}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
}
