/**
 * GameStateView — Oyunların ortak yükleme ve hata ekranı.
 *
 * Bugüne kadar her oyun kendi bloğunu yazıyordu; Logline'ın hata ekranında
 * retry butonu hiç yoktu (Hard Rule 5: her hata görünür durum + retry sunar).
 * Yükleme durumu DESIGN_SYSTEM'deki 1.5s pulse skeleton'ı kullanır.
 */
import React, { useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { CloudSlash } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/utils/haptics';

import { styles } from './styles';

interface GameStateViewProps {
  /** Hangi durum gösterilecek */
  state: 'loading' | 'error';
  /** Hata durumunda tekrar dene */
  onRetry?: () => void;
  /** Özel başlık (varsayılan: ortak oyun metinleri) */
  title?: string;
  /** Özel alt metin */
  subtitle?: string;
}

/**
 * Oyun ekranlarının yükleme/hata durumu. GameShell içinde render edilir.
 */
export function GameStateView({
  state,
  onRetry,
  title,
  subtitle,
}: GameStateViewProps): React.JSX.Element {
  const { t } = useLanguage();
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    if (state !== 'loading') return;
    // DESIGN_SYSTEM: skeleton shimmer 1.5s sonsuz pulse
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 750 }),
        withTiming(0.4, { duration: 750 }),
      ),
      -1,
      false,
    );
  }, [state, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  if (state === 'loading') {
    return (
      <View style={styles.container} accessibilityRole="progressbar">
        <View style={styles.skeletonGroup}>
          <Animated.View style={[styles.skeletonPoster, pulseStyle]} />
          <Animated.View style={[styles.skeletonLineWide, pulseStyle]} />
          <Animated.View style={[styles.skeletonLineNarrow, pulseStyle]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <CloudSlash size={44} weight="duotone" color={Colors.textTertiary} />
      </View>
      <Text style={styles.title}>{title ?? t('games.result.error_title')}</Text>
      <Text style={styles.subtitle}>{subtitle ?? t('games.result.error_subtitle')}</Text>
      {onRetry && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            hapticLight();
            onRetry();
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('games.result.retry')}
        >
          <Text style={styles.retryText}>{t('games.result.retry')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
