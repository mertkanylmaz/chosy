/**
 * QuestionCard — Tek bir kalibrasyon sorusunu ve seçeneklerini gösterir.
 *
 * Seçim animasyonu:
 *   1. Basma: scale(0.97)
 *   2. Seçildi: border → accentPrimary, bg → accentDim
 *   3. İkon pulse: scale 1.0 → 1.2 → 1.0
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
import * as PhosphorIcons from 'phosphor-react-native';

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
  phosphorIcon: string;
  label: string;
  isSelected: boolean;
  isDisabled: boolean;
  onPress: () => void;
}

/**
 * Tek bir seçenek butonu — Phosphor ikonu + seçim durumuna göre stil değişir.
 */
function OptionButton({ phosphorIcon, label, isSelected, isDisabled, onPress }: OptionButtonProps) {
  const iconScale = useSharedValue(1);
  const btnScale = useSharedValue(1);

  const handlePress = useCallback(() => {
    btnScale.value = withSequence(
      withTiming(0.97, { duration: 100 }),
      withTiming(1.0, { duration: 100 }),
    );
    onPress();
  }, [btnScale, onPress]);

  /** Seçildiğinde ikon pulse */
  React.useEffect(() => {
    if (isSelected) {
      iconScale.value = withSequence(
        withTiming(1.2, { duration: 150 }),
        withTiming(1.0, { duration: 150 }),
      );
    }
  }, [isSelected, iconScale]);

  const btnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
    opacity: isDisabled && !isSelected
      ? withTiming(0.4, { duration: 200 })
      : withTiming(1,   { duration: 200 }),
  }));

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  // Resolve Phosphor icon component by name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = (PhosphorIcons as any)[phosphorIcon] as React.ComponentType<PhosphorIcons.IconProps> | undefined;

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
        <Animated.View style={[styles.optionImage, iconAnimStyle]}>
          {IconComponent && (
            <IconComponent
              size={28}
              color="#E8A838"
              weight="duotone"
            />
          )}
        </Animated.View>
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
      if (selectedIndex !== null) return;

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
            phosphorIcon={option.phosphorIcon}
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
