/**
 * StageTransition — Aşama 1'den Aşama 2'ye geçiş overlay'i.
 *
 * Tam ekran yarı-saydam koyu arka plan üzerinde:
 * - "Investigation Complete" başlığı (FadeIn + scale)
 * - "{count} suspects remain" alt başlık (FadeInUp gecikimli)
 * - [Continue] butonu (FadeInUp gecikimli)
 * Teal aksan renk kullanır.
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ShieldCheck } from 'phosphor-react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  withTiming,
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { styles } from './styles';

// ─── Teal accent ─────────────────────────────────────────────────────────────
const TEAL = '#0D9488';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StageTransitionProps {
  /** Kalan şüpheli sayısı */
  remainingCount: number;
  /** Devam butonuna basıldığında çağrılır */
  onContinue: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * StageTransition — Aşama 1 → 2 geçişinde tam ekran animasyonlu overlay.
 */
export function StageTransition({ remainingCount, onContinue }: StageTransitionProps) {
  const { t } = useLanguage();

  return (
    <View style={styles.transitionOverlay}>
      {/* Teal glow arka plan efekti */}
      <View style={styles.transitionGlow} />

      {/* Başlık — FadeIn + scale */}
      <Animated.View
        entering={FadeIn.duration(400)}
        style={styles.transitionTitleWrap}
      >
        <ShieldCheck size={56} color={TEAL} weight="duotone" />
        <Text style={styles.transitionTitle}>
          {t('games.detective.stage_transition_title')}
        </Text>
      </Animated.View>

      {/* Alt başlık — FadeInUp gecikimli */}
      <Animated.Text
        entering={FadeInUp.delay(300).duration(400)}
        style={styles.transitionSubtitle}
      >
        {t('games.detective.stage_transition_subtitle', {
          count: String(remainingCount),
        })}
      </Animated.Text>

      {/* Devam butonu — FadeInUp */}
      <Animated.View entering={FadeInUp.delay(500).duration(400)}>
        <TouchableOpacity
          style={styles.transitionButton}
          onPress={onContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.transitionButtonText}>
            {t('games.detective.stage_transition_cta')}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
