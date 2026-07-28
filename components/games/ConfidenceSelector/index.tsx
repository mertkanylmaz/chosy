/**
 * ConfidenceSelector — Imposter guven bahsi secici.
 *
 * Oyuncu round'u kilitlemeden ONCE ne kadar emin oldugunu yatirir.
 * Yuksek guven dogruda odulu, yanlista cezayi buyutur — round'a
 * risk karari katmanini ekler (Tier 2.1).
 *
 * Seviyeler ve carpanlar sunucudan (app_config) gelir; burada
 * hardcode edilmez, boylece config tune edilince UI ile sunucu
 * ayrismaz. Skorlamada yetki her zaman sunucudadir.
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/utils/haptics';
import type { ImposterConfidenceConfig } from '@/types/game';

import { styles } from './styles';

interface ConfidenceSelectorProps {
  config: ImposterConfidenceConfig;
  /** Secili guven seviyesi */
  value: number;
  onChange: (confidence: number) => void;
  /** Submit ucusta / reveal aciksa etkilesim kapali */
  disabled?: boolean;
}

/** Carpani "1.5" gibi kisa gosterir — 2.0 yerine 2 */
export function formatFactor(factor: number): string {
  return Number.isInteger(factor) ? String(factor) : factor.toFixed(1);
}

/**
 * 3 segmentli guven secici + secilen bahsin carpan onizlemesi.
 */
export function ConfidenceSelector({
  config,
  value,
  onChange,
  disabled = false,
}: ConfidenceSelectorProps): React.ReactElement | null {
  const { t } = useLanguage();

  if (!config?.levels?.length) return null;

  const key = String(value);
  const win = config.correct_factor[key] ?? 1;
  const lose = config.wrong_factor[key] ?? 1;

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <Text style={styles.label}>{t('games.imposter.confidence_label')}</Text>

      <View style={styles.segments}>
        {config.levels.map((level) => {
          const isActive = level === value;
          return (
            <TouchableOpacity
              key={level}
              style={[styles.segment, isActive && styles.segmentActive]}
              onPress={() => {
                if (level === value) return;
                hapticLight();
                onChange(level);
              }}
              disabled={disabled}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive, disabled }}
              accessibilityLabel={t(`games.imposter.confidence_${level}`)}
            >
              <Text style={[styles.segmentValue, isActive && styles.segmentValueActive]}>
                %{level}
              </Text>
              <Text
                style={[styles.segmentText, isActive && styles.segmentTextActive]}
                numberOfLines={1}
              >
                {t(`games.imposter.confidence_${level}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Animated.Text key={key} entering={FadeIn.duration(200)} style={styles.preview}>
        {t('games.imposter.confidence_preview', {
          win: formatFactor(win),
          lose: formatFactor(lose),
        })}
      </Animated.Text>
    </View>
  );
}
