/**
 * QuestionCard — Tek bir kalibrasyon sorusunu ve seçeneklerini gösterir.
 *
 * Seçim animasyonu:
 *   1. Basma: scale(0.97)
 *   2. Seçildi: border → accentPrimary, bg → accentDim
 *   3. Ikon pulse: scale 1.0 → 1.2 → 1.0
 *   4. Haptic: light → medium (200ms sonra)
 *   5. Diğerleri: opacity 0.4
 *   6. Geçiş: 400ms → parent'a iletilir
 */

import React, { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { hapticLight, hapticMedium } from '@/utils/haptics';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CalibrationQuestion } from '../TasteCalibration/questions';
import { styles } from './styles';

// ─── Tip ──────────────────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: CalibrationQuestion;
  /** Seçenek seçildiğinde çağrılır; gecikme (400ms) sonrasında tetiklenir */
  onAnswer: (optionIndex: number) => void;
}

// ─── Option Button ────────────────────────────────────────────────────────────

interface OptionButtonProps {
  emoji: string;
  label: string;
  isSelected: boolean;
  isDisabled: boolean;
  onPress: () => void;
}

/**
 * Tek bir seçenek butonu — seçim durumuna göre stil değişir.
 */
function OptionButton({ emoji, label, isSelected, isDisabled, onPress }: OptionButtonProps) {
  const emojiScale = useSharedValue(1);
  const btnScale = useSharedValue(1);

  const handlePress = useCallback(() => {
    // Scale animasyonu
    btnScale.value = withSequence(
      withTiming(0.97, { duration: 100 }),
      withTiming(1.0, { duration: 100 }),
    );
    onPress();
  }, [btnScale, onPress]);

  // Seçildiğinde emoji pulse
  React.useEffect(() => {
    if (isSelected) {
      emojiScale.value = withSequence(
        withTiming(1.2, { duration: 150 }),
        withTiming(1.0, { duration: 150 }),
      );
    }
  }, [isSelected, emojiScale]);

  const btnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
    opacity: isDisabled && !isSelected ? withTiming(0.4, { duration: 200 }) : withTiming(1, { duration: 200 }),
  }));

  const emojiAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emojiScale.value }],
  }));

  return (
    <Animated.View style={btnAnimStyle}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.9}
        disabled={isDisabled}
        style={[
          styles.optionBtn,
          isSelected && styles.optionBtnSelected,
        ]}
      >
        <Animated.Text style={[styles.optionEmoji, emojiAnimStyle]}>{emoji}</Animated.Text>
        <Text style={styles.optionLabel}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Bir soruyu ve seçeneklerini gösterir.
 * Seçim yapıldıktan 400ms sonra onAnswer çağrılır.
 */
export function QuestionCard({ question, onAnswer }: QuestionCardProps) {
  const { t } = useLanguage();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleOptionPress = useCallback(
    (index: number) => {
      if (selectedIndex !== null) return; // Zaten seçilmiş

      setSelectedIndex(index);
      hapticLight();

      setTimeout(() => {
        hapticMedium();
      }, 200);

      setTimeout(() => {
        onAnswer(index);
      }, 400);
    },
    [selectedIndex, onAnswer],
  );

  return (
    <View style={styles.card}>
      <Text style={styles.scenario}>{t(question.scenarioKey)}</Text>

      <View style={styles.optionsContainer}>
        {question.options.map((option, index) => (
          <OptionButton
            key={`${question.id}-${index}`}
            emoji={option.emoji}
            label={t(option.labelKey)}
            isSelected={selectedIndex === index}
            isDisabled={selectedIndex !== null}
            onPress={() => handleOptionPress(index)}
          />
        ))}
      </View>
    </View>
  );
}
