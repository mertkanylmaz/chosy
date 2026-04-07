/**
 * TasteCalibration — 6 sorulu zevk kalibrasyon akışı.
 *
 * Soru geçişi:
 *   Seçim yapıldıktan 400ms sonra FadeOutLeft → FadeInRight animasyonu ile
 *   bir sonraki soruya geçilir. Son sorudan sonra onComplete çağrılır.
 *
 * Android geri butonu: önceki soruya döner (FadeInLeft animasyonu).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLanguage } from '@/contexts/LanguageContext';
import { computeArchetype } from '@/services/archetypeEngine';
import { ProgressBar } from '../ProgressBar';
import { QuestionCard } from '../QuestionCard';
import {
  buildCalibrationProfile,
  CALIBRATION_QUESTIONS,
  CalibrationAnswer,
} from './questions';
import { styles } from './styles';

// ─── Tip ──────────────────────────────────────────────────────────────────────

interface TasteCalibrationProps {
  /** Tüm sorular cevaplandığında çağrılır */
  onComplete: (archetypeId: number | null, answers: CalibrationAnswer[]) => void;
  /** Skip — doğrudan onComplete(null, []) çağırır */
  onSkip: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const TOTAL = CALIBRATION_QUESTIONS.length;

/**
 * 6 soruluk taste calibration akışı.
 * Her sorudan sonra otomatik geçiş yapar, son soruda sonucu hesaplar.
 */
export function TasteCalibration({ onComplete, onSkip }: TasteCalibrationProps) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<CalibrationAnswer[]>([]);
  /** Geri animasyonu tetiklemek için */
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  /** Soru unmount animasyonu sırasında input kilitle */
  const transitioning = useRef(false);

  /** Android geri butonu — önceki soruya dön */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (questionIndex > 0 && !transitioning.current) {
        transitioning.current = true;
        setDirection('back');
        setQuestionIndex((i) => i - 1);
        setAnswers((prev) => prev.slice(0, -1));
        setTimeout(() => {
          transitioning.current = false;
        }, 350);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [questionIndex]);

  const handleAnswer = useCallback(
    (optionIndex: number) => {
      if (transitioning.current) return;
      transitioning.current = true;

      const newAnswer: CalibrationAnswer = {
        questionId: CALIBRATION_QUESTIONS[questionIndex].id,
        optionIndex,
      };
      const newAnswers = [...answers, newAnswer];
      setAnswers(newAnswers);

      if (questionIndex < TOTAL - 1) {
        setDirection('forward');
        setQuestionIndex((i) => i + 1);
        setTimeout(() => {
          transitioning.current = false;
        }, 350);
      } else {
        // Son soru — profil hesapla ve bitir
        const profile = buildCalibrationProfile(newAnswers);
        const archetypeId = computeArchetype(profile);
        onComplete(archetypeId, newAnswers);
      }
    },
    [questionIndex, answers, onComplete],
  );

  const currentQuestion = CALIBRATION_QUESTIONS[questionIndex];

  /** Giriş animasyonu: ilerliyorsa sağdan, geriye gidiyorsa soldan */
  const enterAnim = direction === 'forward' ? FadeInRight.springify().damping(18) : FadeInLeft.springify().damping(18);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {/* Skip butonu */}
      <View style={styles.topRow}>
        <View style={styles.topSpacer} />
        <TouchableOpacity onPress={onSkip} activeOpacity={0.7} style={styles.skipBtn}>
          <Text style={styles.skipText}>{t('onboarding.skipCalibration')}</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressWrap}>
        <ProgressBar
          currentQuestion={questionIndex + 1}
          totalQuestions={TOTAL}
        />
      </View>

      {/* Soru kartı */}
      <Animated.View
        key={questionIndex}
        entering={enterAnim.duration(300)}
        exiting={FadeOutLeft.duration(200)}
        style={styles.cardWrap}
      >
        <QuestionCard
          question={currentQuestion}
          onAnswer={handleAnswer}
        />
      </Animated.View>

      {/* Mini dot progress */}
      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === questionIndex && styles.dotActive,
              i < questionIndex && styles.dotDone,
            ]}
          />
        ))}
      </View>
    </View>
  );
}
