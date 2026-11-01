/** Yükleme / hata / aday bitti durumları. */
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';

import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { OutlineAction } from '@/components/gauntlet/OutlineAction';
import { PrimaryAction } from '@/components/gauntlet/PrimaryAction';
import { DISSOLVE_DURATION, EASE_OUT_QUART } from '@/constants/design/motion';
import { useLanguage } from '@/contexts/LanguageContext';

import { styles } from './styles';
import type { MoodErrorKind, MoodLoadingPhase } from './useMoodGauntlet';

const ERROR_KEYS: Record<MoodErrorKind, string> = {
  quota: 'moodGauntlet.errorQuota',
  busy: 'moodGauntlet.errorBusy',
  unavailable: 'moodGauntlet.errorUnavailable',
  network: 'moodGauntlet.errorNetwork',
  insufficient: 'moodGauntlet.errorInsufficient',
  generic: 'moodGauntlet.errorGeneric',
};

/** Aşama satırında yalnız bu üçü görünür; `another` ayrı, tek satırlık metindir. */
type StepPhase = Exclude<MoodLoadingPhase, 'another'>;
const PHASES: readonly StepPhase[] = ['reading', 'matching', 'picking'];
const PHASE_KEYS: Record<MoodLoadingPhase, string> = {
  reading: 'moodGauntlet.phaseReading',
  matching: 'moodGauntlet.phaseMatching',
  picking: 'moodGauntlet.phasePicking',
  another: 'moodGauntlet.loadingAnother',
};
const SILHOUETTES = [0, 1, 2, 3] as const;
const PULSE_STAGGER_MS = 160;

/** Poster silueti: opaklık nabzı, sıra sıra (karışma hissi). Reduce Motion'da sabit. */
function Silhouette({ index }: { index: number }): React.JSX.Element {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(reduced ? 0.5 : 0.25);
  useEffect(() => {
    if (reduced) {
      opacity.value = 0.5;
      return;
    }
    opacity.value = withDelay(
      index * PULSE_STAGGER_MS,
      withRepeat(
        withSequence(
          withTiming(0.6, { duration: DISSOLVE_DURATION.newContender * 2, easing: EASE_OUT_QUART }),
          withTiming(0.25, { duration: DISSOLVE_DURATION.newContender * 2, easing: EASE_OUT_QUART }),
        ),
        -1,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, index]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.loadingPoster, style]} />;
}

interface LoadingStageProps {
  /** Mood adı: profile_name; gelene kadar hızlı mood başlığı ya da kullanıcının kendi metni. */
  label: string | null;
  phase: MoodLoadingPhase;
}

export function LoadingStage({ label, phase }: LoadingStageProps): React.JSX.Element {
  const { t } = useLanguage();
  const another = phase === 'another';
  const active = another ? -1 : PHASES.indexOf(phase);
  return (
    <View
      style={styles.loadingRoot}
      accessibilityLiveRegion="polite"
      accessibilityLabel={t(PHASE_KEYS[phase])}
    >
      {label !== null && label.length > 0 && (
        <Text style={styles.loadingName} numberOfLines={3} accessibilityRole="header">
          {label}
        </Text>
      )}

      <View style={styles.loadingPosters} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {SILHOUETTES.map((i) => (
          <Silhouette key={i} index={i} />
        ))}
      </View>

      {another && <Text style={styles.loadingAnother}>{t('moodGauntlet.loadingAnother')}</Text>}

      {!another && (
      <View style={styles.phaseRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {PHASES.map((p, i) => {
          const state = i < active ? 'Done' : i === active ? 'Active' : 'Pending';
          return (
            <React.Fragment key={p}>
              {i > 0 && <View style={styles.phaseSep} />}
              <View style={styles.phaseItem}>
                <View style={[styles.phaseDot, styles[`phaseDot${state}`]]} />
                <Text style={[styles.phaseText, styles[`phaseText${state}`]]}>{t(PHASE_KEYS[p])}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
      )}
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
