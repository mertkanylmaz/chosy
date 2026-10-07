/**
 * PendingWatchFeedbackCard — "Last night's film" (T3, State 1 + State 2).
 *
 * Home'un bir state'i: tab bar GÖRÜNÜR (Bible v1.46 K-03, Design OS §10.1 notu).
 * GauntletShell'in üstüne biner; ShellState'e yeni üye EKLENMEZ.
 *
 *   State 1 "Did you watch it?"  → Yes, I watched it · Not yet · [I watched
 *            something else — bayrak + handler yoksa ÇİZİLMEZ] · Skip (metin)
 *   State 2 "How was it?"        → Loved it · It was fine · Not for me · Back (metin)
 *
 * Satır yalnız satisfaction seçilince (loved/ok/disliked), Not yet'te
 * (`not_watched`) ya da Skip'te (`skipped`) yazılır — mantık
 * `feedbackFlow.ts`'te kilitli ve birim testli. Unmount hiçbir şey yazmaz:
 * kart yalnız bir cevap verilince `onRespond` çağırır.
 *
 * Poster State 1→2'de SABİT kalır; yalnız soru bloğu dissolve olur. Giriş:
 * poster → başlık → soru (kademeli). Reduce Motion'da hepsi 100ms cross-fade.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  Text,
  View,
  findNodeHandle,
  type LayoutChangeEvent,
} from 'react-native';

import { Image } from 'expo-image';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { DISSOLVE_DURATION, EASE_OUT_QUART, REDUCED_MOTION_DURATION } from '@/constants/design/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { posthogAnalytics } from '@/services/posthog';
import type { GauntletFilm, WatchFeedbackResponse } from '@/types/gauntlet';
import { hapticLight } from '@/utils/haptics';

import {
  INITIAL_FLOW,
  posterSize,
  reduceFlow,
  shownEvents,
  type FlowEvent,
  type FlowState,
  type FlowStep,
} from './feedbackFlow';
import { makeStyles } from './styles';
import { useIncreaseContrast } from './useIncreaseContrast';

interface PendingWatchFeedbackCardProps {
  film: GauntletFilm;
  onRespond: (response: WatchFeedbackResponse) => void;
  /**
   * "I watched something else" (State 3, T1b). Buton YALNIZ `watchedOtherEnabled`
   * true VE bu handler verildiyse çizilir: bayrak tek başına ölü bir buton
   * göstermesin. T1b bitene kadar çağıran yer ikisini de vermez.
   */
  watchedOtherEnabled?: boolean;
  onWatchedOther?: () => void;
}

/** Soru bloğu çıkışı — Geçiş'in kısa yarısı; Reduce Motion'da aynı değer. */
const QUESTION_OUT_MS = REDUCED_MOTION_DURATION.crossFade;
/** Kademe: poster → başlık → soru (§7 ritmi: titleDelay 200'ün yarısı, yavaş değil). */
const STAGGER_TITLE_MS = 120;
const STAGGER_QUESTION_MS = 240;

function FeedbackButton({
  label,
  onPress,
  disabled,
  styles,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  styles: ReturnType<typeof makeStyles>;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      {/* numberOfLines YOK: Dynamic Type XXL'de 2 satıra düşebilir, buton minHeight ile büyür. */}
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function TextLink({
  label,
  onPress,
  disabled,
  styles,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  styles: ReturnType<typeof makeStyles>;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      // 13pt metin (18pt satır) + 13 + 13 = 44pt: HIG asgari hedef.
      hitSlop={{ top: 13, bottom: 13, left: 24, right: 24 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.linkText, disabled && styles.disabled]}>{label}</Text>
    </Pressable>
  );
}

export function PendingWatchFeedbackCard({
  film,
  onRespond,
  watchedOtherEnabled = false,
  onWatchedOther,
}: PendingWatchFeedbackCardProps): React.JSX.Element {
  const { t } = useLanguage();
  const reducedMotion = useReducedMotion();
  const highContrast = useIncreaseContrast();
  const styles = useMemo(() => makeStyles(highContrast), [highContrast]);

  // Mantığın gerçek kaynağı ref (çift tap aynı karede de yutulur); state yalnız çizim için.
  const flowRef = useRef<FlowState>(INITIAL_FLOW);
  const [flow, setFlow] = useState<FlowState>(INITIAL_FLOW);
  // Çizilen adım, mantıktaki adımdan dissolve süresi kadar geride kalır.
  const [shownStep, setShownStep] = useState<FlowStep>('outcome');

  const [slot, setSlot] = useState({ width: 0, height: 0 });
  const poster = posterSize(slot.width, slot.height);

  const posterOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const questionOpacity = useSharedValue(0);
  const questionRef = useRef<Text>(null);
  const hasTransitioned = useRef(false);

  // Kart yalnızca pendingWatchFeedback doluyken mount edilir — mount = soru gösterildi.
  useEffect(() => {
    shownEvents(film.id).forEach((e) => posthogAnalytics.track(e.name, e.props));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Giriş: poster → başlık → soru. Reduce Motion: gecikmesiz 100ms cross-fade.
  useEffect(() => {
    const fade = reducedMotion
      ? { duration: REDUCED_MOTION_DURATION.crossFade }
      : { duration: DISSOLVE_DURATION.newContender, easing: EASE_OUT_QUART };
    const titleAt = reducedMotion ? 0 : STAGGER_TITLE_MS;
    const questionAt = reducedMotion ? 0 : STAGGER_QUESTION_MS;
    posterOpacity.value = withTiming(1, fade);
    titleOpacity.value = withDelay(titleAt, withTiming(1, fade));
    questionOpacity.value = withDelay(questionAt, withTiming(1, fade));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // State 1↔2 sonrası: soru yeniden belirir ve VoiceOver odağı soruya gider.
  useEffect(() => {
    if (!hasTransitioned.current) return;
    questionOpacity.value = withTiming(
      1,
      reducedMotion
        ? { duration: REDUCED_MOTION_DURATION.crossFade }
        : { duration: DISSOLVE_DURATION.newContender, easing: EASE_OUT_QUART },
    );
    const node = questionRef.current ? findNodeHandle(questionRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownStep]);

  const swapStep = useCallback(
    (next: FlowStep) => {
      hasTransitioned.current = true;
      questionOpacity.value = withTiming(0, { duration: QUESTION_OUT_MS }, (finished) => {
        // İkinci bir geçiş ilkini iptal ederse `finished` false: yalnız sonuncu uygular.
        if (finished) runOnJS(setShownStep)(next);
      });
    },
    [questionOpacity],
  );

  const press = useCallback(
    (event: FlowEvent) => {
      const result = reduceFlow(flowRef.current, event, film.id);
      if (!result.accepted) return;
      flowRef.current = result.state;
      void hapticLight();
      result.events.forEach((e) => posthogAnalytics.track(e.name, e.props));
      setFlow(result.state);
      if (result.emit) {
        onRespond(result.emit);
      } else {
        swapStep(result.state.step);
      }
    },
    [film.id, onRespond, swapStep],
  );

  const onSlotLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSlot((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  const posterStyle = useAnimatedStyle(() => ({ opacity: posterOpacity.value }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }));
  const questionStyle = useAnimatedStyle(() => ({ opacity: questionOpacity.value }));

  const locked = flow.submitted;
  const showWatchedOther = watchedOtherEnabled && onWatchedOther !== undefined;

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.labelRow, posterStyle]}>
          <View style={styles.hairline} />
          <Text style={styles.label} numberOfLines={1} accessibilityRole="header">
            {t('gauntlet.pendingFeedback.label')}
          </Text>
          <View style={styles.hairline} />
        </Animated.View>

        <View style={styles.posterSlot} onLayout={onSlotLayout}>
          <Animated.View style={posterStyle}>
            <Image
              source={{ uri: film.posterUrl }}
              style={[styles.poster, { width: poster.width, height: poster.height }]}
              contentFit="cover"
              accessible
              accessibilityLabel={t('gauntlet.pendingFeedback.posterA11y', {
                title: film.title,
                year: film.year,
              })}
            />
          </Animated.View>
        </View>

        <Animated.View style={[styles.titleBlock, titleStyle]}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {film.title}
          </Text>
          <Text style={styles.meta}>
            {t('gauntlet.tileMeta', { year: film.year, runtime: film.runtime })}
          </Text>
        </Animated.View>

        <Animated.View style={[styles.actionBlock, questionStyle]}>
          {shownStep === 'outcome' ? (
            <>
              <Text ref={questionRef} style={styles.question} accessibilityRole="header">
                {t('gauntlet.pendingFeedback.question')}
              </Text>
              <View style={styles.buttons}>
                <FeedbackButton
                  styles={styles}
                  label={t('gauntlet.pendingFeedback.yes')}
                  disabled={locked}
                  onPress={() => press('yes')}
                />
                <FeedbackButton
                  styles={styles}
                  label={t('gauntlet.pendingFeedback.notYet')}
                  disabled={locked}
                  onPress={() => press('not_yet')}
                />
                {showWatchedOther && (
                  <FeedbackButton
                    styles={styles}
                    label={t('gauntlet.pendingFeedback.watchedOther')}
                    disabled={locked}
                    onPress={() => onWatchedOther?.()}
                  />
                )}
              </View>
              <View style={styles.linkRow}>
                <TextLink
                  styles={styles}
                  label={t('gauntlet.pendingFeedback.skip')}
                  disabled={locked}
                  onPress={() => press('skip')}
                />
              </View>
            </>
          ) : (
            <>
              <Text ref={questionRef} style={styles.question} accessibilityRole="header">
                {t('gauntlet.pendingFeedback.satisfactionQuestion')}
              </Text>
              <View style={styles.buttons}>
                <FeedbackButton
                  styles={styles}
                  label={t('gauntlet.pendingFeedback.loved')}
                  disabled={locked}
                  onPress={() => press('loved')}
                />
                <FeedbackButton
                  styles={styles}
                  label={t('gauntlet.pendingFeedback.ok')}
                  disabled={locked}
                  onPress={() => press('ok')}
                />
                <FeedbackButton
                  styles={styles}
                  label={t('gauntlet.pendingFeedback.notForMe')}
                  disabled={locked}
                  onPress={() => press('disliked')}
                />
              </View>
              <View style={styles.linkRow}>
                <TextLink
                  styles={styles}
                  label={t('gauntlet.pendingFeedback.back')}
                  disabled={locked}
                  onPress={() => press('back')}
                />
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </ScrollView>
  );
}
