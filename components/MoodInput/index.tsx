import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  View,
} from 'react-native';

import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { hapticMedium } from '@/utils/haptics';

import FilterChips, { ChipOption } from '@/components/FilterChips/FilterChips';
import styles, { COLORS } from './styles';
import { useLanguage } from '@/contexts/LanguageContext';
import { FilmFilters } from '@/types';
import { BOUNCE_CONFIG, SPRING_CONFIG, TIMING_CONFIG, TYPING_SPEED_MS } from '@/constants/animations';

/** Mood emoji'leri ve çeviri anahtarları */
const MOOD_EMOJIS = [
  { emoji: '😊', labelKey: 'moodInput.moods.happy' },
  { emoji: '😢', labelKey: 'moodInput.moods.sad' },
  { emoji: '😱', labelKey: 'moodInput.moods.thriller' },
  { emoji: '😡', labelKey: 'moodInput.moods.angry' },
  { emoji: '🤔', labelKey: 'moodInput.moods.thoughtful' },
  { emoji: '😴', labelKey: 'moodInput.moods.tired' },
  { emoji: '🥰', labelKey: 'moodInput.moods.romantic' },
  { emoji: '🎬', labelKey: 'moodInput.moods.cinematic' },
];


const MAX_CHARS = 200;

/** Boş FilmFilters sabiti */
const EMPTY_FILTERS: FilmFilters = {
  yearRange: null,
  minRating: null,
  regions: [],
  directors: [],
};

interface MoodInputProps {
  /** Film arama akışı başlatıldığında çağrılır */
  onSubmit: (text: string, filters: FilmFilters) => Promise<void>;
}

/**
 * Kullanıcının ruh halini ve filtre tercihlerini girebileceği ana bileşen.
 * Animasyonlar: focus border rengi, placeholder typing, submit bounce.
 * useReducedMotion ile erişilebilirlik desteklenir.
 */
const MoodInput = React.memo(function MoodInput({ onSubmit }: MoodInputProps) {
  const { t } = useLanguage();
  const isReducedMotion = useReducedMotion();

  const [text, setText] = useState('');
  const [selectedEmojis, setSelectedEmojis] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<FilmFilters>(EMPTY_FILTERS);

  // Typing animation state
  const [typedPlaceholder, setTypedPlaceholder] = useState('');
  const [typingDone, setTypingDone] = useState(false);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const placeholderFullRef = useRef(t('moodInput.placeholder'));

  // Reanimated shared values
  const focusProgress = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  const cursorOpacity = useSharedValue(1);

  const inputRef = useRef<TextInput>(null);

  // ─── Placeholder typing animasyonu ──────────────────────────────────────────

  useEffect(() => {
    if (isReducedMotion) {
      setTypedPlaceholder(placeholderFullRef.current);
      setTypingDone(true);
      return;
    }

    let idx = 0;
    setTypedPlaceholder('');
    setTypingDone(false);

    typingRef.current = setInterval(() => {
      idx++;
      if (idx <= placeholderFullRef.current.length) {
        setTypedPlaceholder(placeholderFullRef.current.slice(0, idx));
      } else {
        setTypingDone(true);
        if (typingRef.current) clearInterval(typingRef.current);
      }
    }, TYPING_SPEED_MS);

    return () => {
      if (typingRef.current) clearInterval(typingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Cursor blink ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isReducedMotion || typingDone) {
      cursorOpacity.value = 0;
      return;
    }
    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 400 }),
        withTiming(1, { duration: 400 }),
      ),
      -1,
      false,
    );
  }, [typingDone, isReducedMotion, cursorOpacity]);

  // ─── Animated styles ─────────────────────────────────────────────────────────

  const inputBorderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusProgress.value,
      [0, 1],
      [COLORS.white10, COLORS.gold],
    ),
  }));

  const buttonScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  // ─── Focus handlers ──────────────────────────────────────────────────────────

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    focusProgress.value = withTiming(1, TIMING_CONFIG);
  }, [focusProgress]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    focusProgress.value = withTiming(0, TIMING_CONFIG);
  }, [focusProgress]);

  // ─── Filtre seçenek listeleri (i18n) ─────────────────────────────────────

  const yearOptions: ChipOption[] = [
    { id: '', label: t('filters.any') },
    { id: 'pre1990', label: t('filters.year.pre1990') },
    { id: '1990s', label: t('filters.year.1990s') },
    { id: '2000s', label: t('filters.year.2000s') },
    { id: '2010s', label: t('filters.year.2010s') },
    { id: '2020s', label: t('filters.year.2020s') },
  ];

  const ratingOptions: ChipOption[] = [
    { id: '', label: t('filters.any') },
    { id: '7', label: t('filters.rating.7plus') },
    { id: '8', label: t('filters.rating.8plus') },
    { id: 'top250', label: t('filters.rating.top250') },
  ];

  // ─── Yıl seçimi: id string → YearRangeFilter ─────────────────────────────

  const handleYearSelect = useCallback((ids: string[]) => {
    const id = ids[0] ?? null;
    const yearRange = id ? (id as FilmFilters['yearRange']) : null;
    setFilters((prev) => ({ ...prev, yearRange }));
  }, []);

  const handleRatingSelect = useCallback((ids: string[]) => {
    const id = ids[0] ?? null;
    let minRating: FilmFilters['minRating'] = null;
    if (id === '7') minRating = 7;
    else if (id === '8') minRating = 8;
    else if (id === 'top250') minRating = 'top250';
    setFilters((prev) => ({ ...prev, minRating }));
  }, []);

  // ─── Seçili chip id helpers ───────────────────────────────────────────────

  const yearSelected = filters.yearRange ? [filters.yearRange] : [];
  const ratingSelected = filters.minRating !== null ? [String(filters.minRating)] : [];

  // ─── Emoji ───────────────────────────────────────────────────────────────

  /** Emoji seçilince toggle eder ve input'a ekler */
  const handleEmojiPress = useCallback(
    (emoji: string, label: string) => {
      const isSelected = selectedEmojis.includes(emoji);

      if (isSelected) {
        setSelectedEmojis((prev) => prev.filter((e) => e !== emoji));
        setText((prev) =>
          prev
            .replace(`[${label}]`, '')
            .replace(/\s+/g, ' ')
            .trim(),
        );
      } else {
        setSelectedEmojis((prev) => [...prev, emoji]);
        setText((prev) => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed} [${label}]` : `[${label}]`;
        });
      }
    },
    [selectedEmojis],
  );

  // ─── Submit ───────────────────────────────────────────────────────────────

  /** parse-taste → recommend akışını başlatır */
  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    Keyboard.dismiss();

    if (!isReducedMotion) {
      buttonScale.value = withSequence(
        withSpring(0.92, BOUNCE_CONFIG),
        withSpring(1.0, SPRING_CONFIG),
      );
    }

    hapticMedium();

    setIsLoading(true);
    try {
      await onSubmit(trimmed, filters);
    } finally {
      setIsLoading(false);
    }
  }, [text, isLoading, onSubmit, filters, isReducedMotion, buttonScale]);

  const canSubmit = text.trim().length > 0 && !isLoading;
  const showAnimatedPlaceholder = text === '' && !isFocused;

  return (
    <ScrollView
      style={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{t('moodInput.title')}</Text>
      <Text style={styles.subtitle}>{t('moodInput.subtitle')}</Text>

      {/* ── Filtreler ──────────────────────────────────────────────────────── */}
      <View style={styles.filtersContainer}>
        <FilterChips
          label={t('filters.yearRange')}
          options={yearOptions}
          selected={yearSelected}
          multiple={false}
          onSelect={handleYearSelect}
        />
        <FilterChips
          label={t('filters.imdbRating')}
          options={ratingOptions}
          selected={ratingSelected}
          multiple={false}
          onSelect={handleRatingSelect}
        />
      </View>

      {/* ── Metin girişi ───────────────────────────────────────────────────── */}
      <Animated.View style={[styles.inputContainer, inputBorderStyle]}>
        {/* Animasyonlu placeholder — yalnızca metin boş ve odaklanılmamışken */}
        {showAnimatedPlaceholder && (
          <View style={styles.placeholderOverlay} pointerEvents="none">
            <Text style={styles.animatedPlaceholderText}>
              {typedPlaceholder}
              <Animated.Text style={cursorStyle}>|</Animated.Text>
            </Text>
          </View>
        )}

        <TextInput
          ref={inputRef}
          style={styles.textInput}
          placeholder=""
          placeholderTextColor={COLORS.textGrey}
          value={text}
          onChangeText={(v) => setText(v.slice(0, MAX_CHARS))}
          multiline
          onFocus={handleFocus}
          onBlur={handleBlur}
          returnKeyType="default"
          blurOnSubmit={false}
        />

        {/* Karakter sayacı — sağ alt */}
        <Text style={[styles.charCount, text.length >= MAX_CHARS * 0.9 && styles.charCountWarning]}>
          {text.length}/{MAX_CHARS}
        </Text>
      </Animated.View>

      {/* ── Emoji seçici ───────────────────────────────────────────────────── */}
      <Text style={styles.emojiLabel}>{t('moodInput.emojiLabel')}</Text>
      <View style={styles.emojiRow}>
        {MOOD_EMOJIS.map(({ emoji, labelKey }) => {
          const label = t(labelKey);
          const isSelected = selectedEmojis.includes(emoji);
          return (
            <TouchableOpacity
              key={emoji}
              style={[
                styles.emojiButton,
                isSelected && styles.emojiButtonSelected,
              ]}
              onPress={() => handleEmojiPress(emoji, label)}
              activeOpacity={0.7}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Submit butonu — bounce animasyonlu ─────────────────────────────── */}
      <Animated.View style={buttonScaleStyle}>
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.background} />
              <Text style={styles.loadingText}>{t('moodInput.loading')}</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>{t('moodInput.submitButton')}</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
});

export default MoodInput;
