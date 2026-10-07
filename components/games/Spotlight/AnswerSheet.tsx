/**
 * Spotlight cevap sayfasi (Sprint 1) — "Filmi bul".
 *
 * RN `Modal` alt sayfa, yeni bagimlilik yok. Modal arkadaki harf tahtasini
 * dokunulamaz kilar; sayfada yalniz sistem klavyesi vardir (iki klavye sistemi
 * ayni anda aktif olmaz).
 *
 * Kapatma yollari: acik Kapat dugmesi (VoiceOver kaydirarak kapatamaz), zemine
 * dokunma, Android geri, tutamac/baslik bandindan asagi kaydirma. Kaydirma
 * hareketi YALNIZ ust bantta dinlenir — sonuc listesinin kaydirmasi ile
 * cakismaz. Modal ayri bir yerel pencere oldugu icin kendi
 * GestureHandlerRootView'i gerekir.
 *
 * Arama veri kaynagi ve sozlesmesi degismez: icerik `FilmSearchInput`
 * (`layout="sheet"`).
 */
import React, { useEffect } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { X } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import {
  EASE_OUT_QUART,
  REDUCED_MOTION_DURATION,
  SPOTLIGHT_FOCUS_STEP,
} from '@/constants/design/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { FilmSearchInput } from '@/components/games/FilmSearchInput';
import type { FilmSearchResult } from '@/services/gameTypes';

import { answerSheetStyles as styles } from './answerSheetStyles';

/** Asagi kaydirma esigi: mesafe (pt) veya hiz (pt/sn) */
const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 800;

interface AnswerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (film: FilmSearchResult) => void;
  /** Tahmin istegi yolda — secim kilitli */
  busy: boolean;
  /** Daha once tahmin edilen filmler (soluk, dokunulamaz) */
  triedFilmIds: readonly string[];
  /** Yanlis tahmin sonrasi sakin satir; yoksa null */
  inlineNote: string | null;
}

export function AnswerSheet({
  visible,
  onClose,
  onSelect,
  busy,
  triedFilmIds,
  inlineNote,
}: AnswerSheetProps) {
  const { t } = useLanguage();
  const translateY = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  /** Esige varmayan kaydirma geri doner: ease-out, spring yok; Reduce Motion'da 100ms */
  const snapBackMs = reduceMotion ? REDUCED_MOTION_DURATION.crossFade : SPOTLIGHT_FOCUS_STEP.duration;

  useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible, translateY]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(onClose)();
      } else {
        translateY.value = withTiming(0, { duration: snapBackMs, easing: EASE_OUT_QUART });
      }
    });

  const sheetMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('games.spotlight.answer_close')}
        />
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <Animated.View style={[styles.sheet, sheetMotion]}>
            <GestureDetector gesture={pan}>
              <Animated.View style={styles.header}>
                <View style={styles.grabber} accessibilityElementsHidden importantForAccessibility="no" />
                <View style={styles.titleRow}>
                  <Text style={styles.title} accessibilityRole="header">
                    {t('games.spotlight.answer_title')}
                  </Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel={t('games.spotlight.answer_close')}
                  >
                    <X size={22} color={Colors.textPrimary} weight="bold" />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </GestureDetector>
            <View style={styles.body}>
              <FilmSearchInput
                layout="sheet"
                autoFocus
                catalogOnly
                // Satir secimi kendi haptigini calmaz — tahmin sonucu tek haptik (hapticMap.ts)
                silentSelect
                placeholder={t('games.spotlight.answer_placeholder')}
                onSelect={onSelect}
                disabled={busy}
                triedFilmIds={triedFilmIds}
                inlineNote={inlineNote}
              />
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}
