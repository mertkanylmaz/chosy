/** Yükleme / hata / aday bitti durumları — tek dosya, üçü de kısa. */
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { OutlineAction } from '@/components/gauntlet/OutlineAction';
import { PrimaryAction } from '@/components/gauntlet/PrimaryAction';
import { color } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';

import { styles } from './styles';
import type { MoodErrorKind } from './useMoodGauntlet';

const ERROR_KEYS: Record<MoodErrorKind, string> = {
  quota: 'moodGauntlet.errorQuota',
  busy: 'moodGauntlet.errorBusy',
  unavailable: 'moodGauntlet.errorUnavailable',
  network: 'moodGauntlet.errorNetwork',
  insufficient: 'moodGauntlet.errorInsufficient',
  generic: 'moodGauntlet.errorGeneric',
};

export function LoadingStage({ text }: { text: string }): React.JSX.Element {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator color={color.text.secondary} />
      <Text style={styles.body}>{text}</Text>
    </View>
  );
}

interface ErrorStageProps {
  kind: MoodErrorKind;
  onRetry: () => void;
  onNewSearch: () => void;
}

export function ErrorStage({ kind, onRetry, onNewSearch }: ErrorStageProps): React.JSX.Element {
  const { t } = useLanguage();
  // Kota/yetersiz sonuç "aynı aramayı tekrarla" ile düzelmez → yalnız yeni arama.
  const retryable = kind !== 'quota' && kind !== 'insufficient';
  return (
    <View style={styles.center}>
      <Text style={styles.title} accessibilityRole="header">
        {t('moodGauntlet.errorTitle')}
      </Text>
      <Text style={styles.body}>{t(ERROR_KEYS[kind])}</Text>
      <View style={styles.actions}>
        {retryable && <PrimaryAction label={t('moodGauntlet.errorRetry')} onPress={onRetry} />}
        <OutlineAction label={t('moodGauntlet.newSearch')} onPress={onNewSearch} />
      </View>
    </View>
  );
}

export function ExhaustedStage({ onNewSearch }: { onNewSearch: () => void }): React.JSX.Element {
  const { t } = useLanguage();
  return (
    <View style={styles.center}>
      <Text style={styles.title} accessibilityRole="header">
        {t('moodGauntlet.exhaustedTitle')}
      </Text>
      <Text style={styles.body}>{t('moodGauntlet.exhaustedBody')}</Text>
      <View style={styles.actions}>
        <PrimaryAction label={t('moodGauntlet.newSearch')} onPress={onNewSearch} />
      </View>
    </View>
  );
}
