/**
 * Watchlist Roulette — 3 Variant Slot Machine.
 *
 * 5 faz:
 *   1. Hub: variant secimi (pure_random | mood_filtered | triple)
 *   2. MoodInput: mood-filtered icin mood girisi
 *   3. TripleFilter: triple icin 3 filtre girisi
 *   4. Spinning: 3 sutunlu slot machine animasyonu
 *   5. Result: film karti + aksiyonlar
 *
 * Stack screen olarak acilir (watchlist tab'indan navigate).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import SlotMachine, {
  buildReelPosters,
  REEL_LENGTH,
} from '@/components/Roulette/SlotMachine';
import { getWatchlist, getWatchedFilmIds, WatchlistItem } from '@/services/watchlist';
import {
  updateRouletteOutcome,
  RouletteResult,
} from '@/services/roulette';
import {
  spinPureRandom,
  spinMoodFiltered,
  spinTriple,
  acceptSlotSpin,
  getSlotTokenBalance,
  spendSlotToken,
  type SlotVariant,
  type SlotResult,
  type DurationFilter,
  type EraFilter,
} from '@/services/slotService';
import {
  trackSlotSpinInitiated,
  trackSlotSpinCompleted,
  trackSlotFilmAccepted,
  trackSlotFilmRerolled,
  trackSlotPremiumPaywallShown,
} from '@/services/analytics';
import { getAppUserId } from '@/services/watchlist';
import { hapticHeavy, hapticMedium, hapticSelection, hapticSuccess } from '@/utils/haptics';
import { preloadSlotSounds, playSpinSound, playStopSound, unloadSlotSounds } from '@/utils/sounds';
import { logger } from '@/utils/logger';

// ─── Sabitler ────────────────────────────────────────────────────────────────

type Phase = 'hub' | 'mood_input' | 'triple_filter' | 'spinning' | 'result';

/** Mood preset chip'leri */
const MOOD_PRESETS = [
  { key: 'cozy', labelKey: 'roulette.moodInput.presets.cozy' },
  { key: 'melancholic', labelKey: 'roulette.moodInput.presets.melancholic' },
  { key: 'adrenaline', labelKey: 'roulette.moodInput.presets.adrenaline' },
  { key: 'mindBending', labelKey: 'roulette.moodInput.presets.mindBending' },
  { key: 'romantic', labelKey: 'roulette.moodInput.presets.romantic' },
  { key: 'wild', labelKey: 'roulette.moodInput.presets.wild' },
] as const;

/** Duration chip'leri */
const DURATION_OPTIONS: { key: DurationFilter; labelKey: string }[] = [
  { key: 'any', labelKey: 'roulette.tripleFilter.durationAny' },
  { key: 'short', labelKey: 'roulette.tripleFilter.durationShort' },
  { key: 'medium', labelKey: 'roulette.tripleFilter.durationMedium' },
  { key: 'long', labelKey: 'roulette.tripleFilter.durationLong' },
];

/** Era chip'leri */
const ERA_OPTIONS: { key: EraFilter; labelKey: string }[] = [
  { key: 'any', labelKey: 'roulette.tripleFilter.eraAny' },
  { key: '2020s', labelKey: 'roulette.tripleFilter.era2020s' },
  { key: '2010s', labelKey: 'roulette.tripleFilter.era2010s' },
  { key: '2000s', labelKey: 'roulette.tripleFilter.era2000s' },
  { key: 'classic', labelKey: 'roulette.tripleFilter.eraClassic' },
];

// ─── RouletteScreen ──────────────────────────────────────────────────────────

export default function RouletteScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const { isPremium, consumeQuota } = useSubscription();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // ── Phase + variant state ───────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('hub');
  const [activeVariant, setActiveVariant] = useState<SlotVariant>('pure_random');
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [slotResult, setSlotResult] = useState<SlotResult | null>(null);
  const [spinError, setSpinError] = useState<string | null>(null);

  // ── Mood input state ────────────────────────────────────────────────────────
  const [moodText, setMoodText] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // ── Triple filter state ─────────────────────────────────────────────────────
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('any');
  const [eraFilter, setEraFilter] = useState<EraFilter>('any');
  const [tripleMoodText, setTripleMoodText] = useState('');

  // ── Token state ─────────────────────────────────────────────────────────────
  const [tokenBalance, setTokenBalance] = useState(0);

  // ── Slot reel verisi ────────────────────────────────────────────────────────
  const [reelData, setReelData] = useState<string[][]>([[], [], []]);
  const [stoppedReels, setStoppedReels] = useState(0);

  // ── Animations ──────────────────────────────────────────────────────────────
  const resultOpacity = useSharedValue(0);
  const resultTranslateY = useSharedValue(30);
  const glowOpacity = useSharedValue(0);

  // ── Yukleme + ses preload ─────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [data, watched] = await Promise.all([
          getWatchlist(),
          getWatchedFilmIds(),
        ]);
        setItems(data);
        setWatchedIds(watched);

        // Token balance (free user icin)
        const userId = await getAppUserId();
        if (userId) {
          const balance = await getSlotTokenBalance(userId);
          setTokenBalance(balance);
        }

        // Ses dosyalarini on-yukle (varsa)
        preloadSlotSounds();
      } finally {
        setLoading(false);
      }
    };
    load();

    // Cleanup — ses bellegi bosalt
    return () => { unloadSlotSounds(); };
  }, []);

  // ── Poster havuzu ───────────────────────────────────────────────────────────
  const allPosters = useMemo(() => {
    return items
      .filter((i) => !watchedIds.has(i.film.id) && i.film.posterUrl)
      .map((i) => i.film.posterUrl);
  }, [items, watchedIds]);

  const unwatchedCount = useMemo(
    () => items.filter((i) => !watchedIds.has(i.film.id)).length,
    [items, watchedIds],
  );

  // ── Reel durdugunda haptic + ses ────────────────────────────────────────────
  const handleReelStop = useCallback((reelIndex: number) => {
    playStopSound();
    if (reelIndex < 2) {
      hapticMedium();
    } else {
      hapticHeavy();
    }
    setStoppedReels((prev) => prev + 1);
  }, []);

  // ── Tum reeller durdugunda result goster ────────────────────────────────────
  useEffect(() => {
    if (stoppedReels >= 3 && result) {
      glowOpacity.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0.4, { duration: 300 }),
        withTiming(0.8, { duration: 200 }),
      );

      const timer = setTimeout(() => {
        hapticSuccess();
        setPhase('result');
        resultOpacity.value = withTiming(1, { duration: 400 });
        resultTranslateY.value = withTiming(0, {
          duration: 500,
          easing: Easing.out(Easing.back(1.2)),
        });
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [stoppedReels, result, glowOpacity, resultOpacity, resultTranslateY]);

  // ── Ortak spin baslat (animation icin) ──────────────────────────────────────
  const startSpinAnimation = useCallback((pickedResult: RouletteResult) => {
    setResult(pickedResult);
    setStoppedReels(0);

    if (allPosters.length >= 3 && pickedResult.film.posterUrl) {
      const reel1 = buildReelPosters(allPosters, pickedResult.film.posterUrl, REEL_LENGTH);
      const reel2 = buildReelPosters(allPosters, pickedResult.film.posterUrl, REEL_LENGTH + 2);
      const reel3 = buildReelPosters(allPosters, pickedResult.film.posterUrl, REEL_LENGTH + 4);
      setReelData([reel1, reel2, reel3]);
    }

    resultOpacity.value = 0;
    resultTranslateY.value = 30;
    glowOpacity.value = 0;

    hapticHeavy();
    playSpinSound();
    setPhase('spinning');
  }, [allPosters, resultOpacity, resultTranslateY, glowOpacity]);

  // ── Variant secimi ──────────────────────────────────────────────────────────
  const handleVariantSelect = useCallback((variant: SlotVariant) => {
    hapticSelection();
    setActiveVariant(variant);
    setSpinError(null);

    if (variant === 'pure_random') {
      // Direkt spin
      handlePureRandomSpin();
    } else if (variant === 'mood_filtered') {
      if (!isPremium) {
        trackSlotPremiumPaywallShown('mood_filtered');
        router.push('/paywall' as never);
        return;
      }
      setPhase('mood_input');
    } else if (variant === 'triple') {
      if (!isPremium) {
        trackSlotPremiumPaywallShown('triple');
        router.push('/paywall' as never);
        return;
      }
      setPhase('triple_filter');
    }
  }, [isPremium, router]);

  // ── Pure Random Spin ────────────────────────────────────────────────────────
  const handlePureRandomSpin = useCallback(async () => {
    trackSlotSpinInitiated('pure_random');

    try {
      // Edge Function kullan — server-side watched_at filtreleme + quota check
      const slotData = await spinPureRandom();
      setSlotResult(slotData);

      const rResult: RouletteResult = {
        film: slotData.film,
        candidateCount: slotData.candidateCount,
      };

      startSpinAnimation(rResult);
      trackSlotSpinCompleted('pure_random', slotData.film.id);
    } catch (err: unknown) {
      const errorObj = err as Record<string, unknown>;
      const errorCode = errorObj?.error as string | undefined;
      const errorMsg = err instanceof Error ? err.message : undefined;

      logger.error('[roulette] handlePureRandomSpin error:', { errorCode, errorMsg, err });

      if (errorCode === 'NEED_MORE_FILMS') {
        setSpinError(t('roulette.needMoreFilms', { min: errorObj.min ?? 3 }));
      } else if (errorCode === 'QUOTA_EXCEEDED') {
        // Token varsa kullan
        if (tokenBalance > 0) {
          const userId = await getAppUserId();
          if (userId) {
            const tokenResult = await spendSlotToken(userId);
            if (tokenResult.success) {
              setTokenBalance(tokenResult.balance);
              // Tekrar dene (token harcandiktan sonra)
              handlePureRandomSpin();
              return;
            }
          }
        }
        router.push('/paywall' as never);
      } else {
        setSpinError(errorCode || errorMsg || t('roulette.unknownError'));
      }
    }
  }, [startSpinAnimation, tokenBalance, router, t]);

  // ── Mood Filtered Spin ──────────────────────────────────────────────────────
  const handleMoodSpin = useCallback(async () => {
    const mood = selectedPreset || moodText.trim();
    if (!mood) return;

    trackSlotSpinInitiated('mood_filtered');

    try {
      const slotData = await spinMoodFiltered(mood);
      setSlotResult(slotData);

      // RouletteResult formatina cevir (animation icin)
      const rResult: RouletteResult = {
        film: slotData.film,
        candidateCount: slotData.candidateCount,
      };

      startSpinAnimation(rResult);
      trackSlotSpinCompleted('mood_filtered', slotData.film.id, slotData.matchScore);
    } catch (err: unknown) {
      const errorObj = err as Record<string, unknown>;
      const errorCode = errorObj?.error as string | undefined;
      const errorMsg = err instanceof Error ? err.message : undefined;

      logger.error('[roulette] handleMoodSpin error:', { errorCode, errorMsg, err });

      if (errorCode === 'NEED_MORE_FILMS') {
        setSpinError(t('roulette.needMoreFilms', { min: errorObj.min ?? 5 }));
      } else if (errorCode === 'QUOTA_EXCEEDED') {
        router.push('/paywall' as never);
      } else if (errorCode === 'PREMIUM_REQUIRED') {
        router.push('/paywall' as never);
      } else {
        setSpinError(errorCode || errorMsg || t('roulette.unknownError'));
      }
    }
  }, [moodText, selectedPreset, startSpinAnimation, router, t]);

  // ── Triple Spin ─────────────────────────────────────────────────────────────
  const handleTripleSpin = useCallback(async () => {
    trackSlotSpinInitiated('triple');

    try {
      const slotData = await spinTriple(
        durationFilter,
        tripleMoodText.trim() || undefined,
        eraFilter,
      );
      setSlotResult(slotData);

      const rResult: RouletteResult = {
        film: slotData.film,
        candidateCount: slotData.candidateCount,
      };

      startSpinAnimation(rResult);
      trackSlotSpinCompleted('triple', slotData.film.id);
    } catch (err: unknown) {
      const errorObj = err as Record<string, unknown>;
      const errorCode = errorObj?.error as string | undefined;
      const errorMsg = err instanceof Error ? err.message : undefined;

      logger.error('[roulette] handleTripleSpin error:', { errorCode, errorMsg, err });

      if (errorCode === 'NO_MATCHES') {
        setSpinError(t('roulette.tripleFilter.noMatches'));
      } else if (errorCode === 'QUOTA_EXCEEDED') {
        router.push('/paywall' as never);
      } else if (errorCode === 'PREMIUM_REQUIRED') {
        router.push('/paywall' as never);
      } else if (errorCode === 'NEED_MORE_FILMS') {
        setSpinError(t('roulette.needMoreFilms', { min: errorObj.min ?? 5 }));
      } else {
        setSpinError(errorCode || errorMsg || t('roulette.unknownError'));
      }
    }
  }, [durationFilter, eraFilter, tripleMoodText, startSpinAnimation, router, t]);

  // ── Spin Again ──────────────────────────────────────────────────────────────
  const handleSpinAgain = useCallback(() => {
    if (result) {
      updateRouletteOutcome(result.film.id, 'spin_again');
      trackSlotFilmRerolled(activeVariant);
    }
    hapticMedium();
    setResult(null);
    setSlotResult(null);
    setReelData([[], [], []]);
    setStoppedReels(0);
    setPhase('hub');
  }, [result, activeVariant]);

  // ── Accept ──────────────────────────────────────────────────────────────────
  const handleAccept = useCallback(() => {
    if (!result) return;
    hapticSuccess();
    updateRouletteOutcome(result.film.id, 'accepted');
    acceptSlotSpin(result.film.id, activeVariant);
    trackSlotFilmAccepted(activeVariant, result.film.id);
    router.push(`/film/${result.film.id}` as import('expo-router').Href);
  }, [result, activeVariant, router]);

  // ── Close ───────────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (result) {
      updateRouletteOutcome(result.film.id, 'closed');
    }
    router.back();
  }, [result, router]);

  // ── Back to hub ─────────────────────────────────────────────────────────────
  const handleBackToHub = useCallback(() => {
    hapticSelection();
    setSpinError(null);
    setPhase('hub');
  }, []);

  // ── Animated styles ─────────────────────────────────────────────────────────
  const resultInfoStyle = useAnimatedStyle(() => ({
    opacity: resultOpacity.value,
    transform: [{ translateY: resultTranslateY.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[Colors.background, Colors.backgroundGradient]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={phase === 'hub' || phase === 'spinning' || phase === 'result' ? handleClose : handleBackToHub}
          style={styles.closeBtn}
          activeOpacity={0.7}
        >
          <Ionicons
            name={phase === 'hub' || phase === 'spinning' || phase === 'result' ? 'close' : 'arrow-back'}
            size={24}
            color={Colors.textWhite}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('roulette.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* ── Phase: Hub — Variant Selection ── */}
      {phase === 'hub' && (
        <ScrollView
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Text style={styles.hubTitle}>{t('roulette.variantHub.title')}</Text>
            <Text style={styles.filmCount}>
              {t('roulette.candidateCount', { count: unwatchedCount })}
            </Text>
          </Animated.View>

          {/* Token balance (free user) */}
          {!isPremium && tokenBalance > 0 && (
            <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.tokenBar}>
              <Ionicons name="diamond-outline" size={16} color={Colors.gold} />
              <Text style={styles.tokenText}>
                {t('roulette.variantHub.tokenBalance', { count: tokenBalance })}
              </Text>
            </Animated.View>
          )}

          {/* Pure Random — herkese acik */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <TouchableOpacity
              style={styles.variantCard}
              onPress={() => handleVariantSelect('pure_random')}
              activeOpacity={0.8}
            >
              <View style={styles.variantIconContainer}>
                <Ionicons name="dice-outline" size={28} color={Colors.accentPrimary} />
              </View>
              <View style={styles.variantInfo}>
                <Text style={styles.variantTitle}>{t('roulette.variantHub.pureRandom')}</Text>
                <Text style={styles.variantDesc}>{t('roulette.variantHub.pureRandomDesc')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textLightGrey} />
            </TouchableOpacity>
          </Animated.View>

          {/* Mood Filtered — premium */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <TouchableOpacity
              style={styles.variantCard}
              onPress={() => handleVariantSelect('mood_filtered')}
              activeOpacity={0.8}
            >
              <View style={[styles.variantIconContainer, styles.variantIconPremium]}>
                <Ionicons name="heart-outline" size={28} color={Colors.gold} />
              </View>
              <View style={styles.variantInfo}>
                <View style={styles.variantTitleRow}>
                  <Text style={styles.variantTitle}>{t('roulette.variantHub.moodFiltered')}</Text>
                  {!isPremium && (
                    <View style={styles.premiumBadge}>
                      <Ionicons name="star" size={10} color={Colors.gold} />
                      <Text style={styles.premiumBadgeText}>{t('roulette.variantHub.premiumBadge')}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.variantDesc}>{t('roulette.variantHub.moodFilteredDesc')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textLightGrey} />
            </TouchableOpacity>
          </Animated.View>

          {/* Triple — premium */}
          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
            <TouchableOpacity
              style={styles.variantCard}
              onPress={() => handleVariantSelect('triple')}
              activeOpacity={0.8}
            >
              <View style={[styles.variantIconContainer, styles.variantIconPremium]}>
                <Ionicons name="options-outline" size={28} color={Colors.gold} />
              </View>
              <View style={styles.variantInfo}>
                <View style={styles.variantTitleRow}>
                  <Text style={styles.variantTitle}>{t('roulette.variantHub.triple')}</Text>
                  {!isPremium && (
                    <View style={styles.premiumBadge}>
                      <Ionicons name="star" size={10} color={Colors.gold} />
                      <Text style={styles.premiumBadgeText}>{t('roulette.variantHub.premiumBadge')}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.variantDesc}>{t('roulette.variantHub.tripleDesc')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textLightGrey} />
            </TouchableOpacity>
          </Animated.View>

          {/* Error message */}
          {spinError && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.errorBox}>
              <Ionicons name="warning-outline" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{spinError}</Text>
            </Animated.View>
          )}

          {/* Token hint (free user) */}
          {!isPremium && (
            <Animated.View entering={FadeInDown.delay(500).duration(400)} style={styles.tokenHint}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.textLightGrey} />
              <Text style={styles.tokenHintText}>{t('roulette.variantHub.tokenHint')}</Text>
            </Animated.View>
          )}
        </ScrollView>
      )}

      {/* ── Phase: Mood Input ── */}
      {phase === 'mood_input' && (
        <ScrollView
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Text style={styles.sectionTitle}>{t('roulette.moodInput.title')}</Text>
          </Animated.View>

          {/* Preset chips */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.chipRow}>
            {MOOD_PRESETS.map(({ key, labelKey }) => {
              const active = selectedPreset === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                  onPress={() => {
                    hapticSelection();
                    setSelectedPreset(active ? null : key);
                    if (!active) setMoodText('');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
                    {t(labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>

          {/* Custom text input */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.moodInputContainer}>
            <Text style={styles.filterLabel}>{t('roulette.moodInput.custom')}</Text>
            <TextInput
              style={styles.moodTextInput}
              placeholder={t('roulette.moodInput.placeholder')}
              placeholderTextColor={Colors.textLightGrey}
              value={moodText}
              onChangeText={(text) => {
                setMoodText(text);
                if (text.trim()) setSelectedPreset(null);
              }}
              multiline
              maxLength={200}
            />
          </Animated.View>

          {/* Error */}
          {spinError && (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{spinError}</Text>
            </View>
          )}

          {/* Spin button */}
          <Animated.View entering={FadeInUp.delay(400).duration(400)}>
            <TouchableOpacity
              style={[styles.spinButton, !(selectedPreset || moodText.trim()) && styles.spinButtonDisabled]}
              onPress={handleMoodSpin}
              disabled={!(selectedPreset || moodText.trim())}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles" size={22} color={Colors.textOnAccent} />
              <Text style={styles.spinButtonText}>{t('roulette.moodInput.spinWithMood')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      )}

      {/* ── Phase: Triple Filter ── */}
      {phase === 'triple_filter' && (
        <ScrollView
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Text style={styles.sectionTitle}>{t('roulette.tripleFilter.title')}</Text>
          </Animated.View>

          {/* Duration filter */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.filterSection}>
            <Text style={styles.filterLabel}>{t('roulette.tripleFilter.durationLabel')}</Text>
            <View style={styles.chipRow}>
              {DURATION_OPTIONS.map(({ key, labelKey }) => {
                const active = durationFilter === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                    onPress={() => { hapticSelection(); setDurationFilter(key); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
                      {t(labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {/* Era filter */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.filterSection}>
            <Text style={styles.filterLabel}>{t('roulette.tripleFilter.eraLabel')}</Text>
            <View style={styles.chipRow}>
              {ERA_OPTIONS.map(({ key, labelKey }) => {
                const active = eraFilter === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                    onPress={() => { hapticSelection(); setEraFilter(key); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
                      {t(labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {/* Mood filter (optional) */}
          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.filterSection}>
            <Text style={styles.filterLabel}>{t('roulette.tripleFilter.moodLabel')}</Text>
            <TextInput
              style={styles.moodTextInput}
              placeholder={t('roulette.moodInput.placeholder')}
              placeholderTextColor={Colors.textLightGrey}
              value={tripleMoodText}
              onChangeText={setTripleMoodText}
              maxLength={100}
            />
          </Animated.View>

          {/* Error */}
          {spinError && (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{spinError}</Text>
            </View>
          )}

          {/* Apply button */}
          <Animated.View entering={FadeInUp.delay(500).duration(400)}>
            <TouchableOpacity
              style={styles.spinButton}
              onPress={handleTripleSpin}
              activeOpacity={0.8}
            >
              <Ionicons name="options-outline" size={22} color={Colors.textOnAccent} />
              <Text style={styles.spinButtonText}>{t('roulette.tripleFilter.applyButton')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      )}

      {/* ── Phase: Spinning + Result ── */}
      {(phase === 'spinning' || phase === 'result') && result && (
        <View style={styles.slotResultContainer}>
          {phase === 'spinning' && (
            <Animated.Text
              entering={FadeIn.duration(300)}
              style={styles.spinningText}
            >
              {t('roulette.spinning')}
            </Animated.Text>
          )}

          <SlotMachine
            reelData={reelData}
            glowStyle={glowStyle}
            onReelStop={handleReelStop}
          />

          {phase === 'result' && (
            <Animated.View style={[styles.resultInfo, resultInfoStyle]}>
              <Text style={styles.resultTitle} numberOfLines={2}>
                {result.film.title}
              </Text>

              <View style={styles.resultMeta}>
                {result.film.year > 0 && (
                  <Text style={styles.resultMetaText}>{result.film.year}</Text>
                )}
                {result.film.runtime != null && (
                  <Text style={styles.resultMetaText}>{result.film.runtime} min</Text>
                )}
                {result.film.voteAverage != null && (
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={12} color={Colors.gold} />
                    <Text style={styles.ratingText}>
                      {result.film.voteAverage.toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Match score (mood-filtered variant) */}
              {slotResult?.matchScore != null && (
                <View style={styles.matchScoreBadge}>
                  <Ionicons name="sparkles" size={14} color={Colors.gold} />
                  <Text style={styles.matchScoreText}>
                    {t('roulette.matchScore', { score: Math.round(slotResult.matchScore * 100) })}
                  </Text>
                </View>
              )}

              {result.film.moodTags.length > 0 && (
                <View style={styles.resultTags}>
                  {result.film.moodTags.map((tag) => (
                    <View key={tag} style={styles.tagChip}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.resultActions}>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={handleAccept}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle" size={22} color={Colors.textOnAccent} />
                  <Text style={styles.acceptButtonText}>{t('roulette.accept')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.spinAgainButton}
                  onPress={handleSpinAgain}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh" size={20} color={Colors.accentPrimary} />
                  <Text style={styles.spinAgainText}>{t('roulette.spinAgain')}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* Loading */
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textGrey,
    fontSize: 16,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white05,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  headerSpacer: {
    width: 40,
  },

  /* Scroll + content */
  filterScroll: {
    flex: 1,
  },
  filterContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  /* Hub */
  hubTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textWhite,
    marginTop: Theme.spacing.md,
  },
  filmCount: {
    fontSize: 13,
    color: Colors.textLightGrey,
    marginTop: Theme.spacing.xs,
  },

  /* Token bar */
  tokenBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    backgroundColor: Colors.goldDim,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.goldGlow,
  },
  tokenText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gold,
  },

  /* Variant cards */
  variantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    marginTop: Theme.spacing.md,
    backgroundColor: Colors.cardSolid,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Theme.spacing.md,
  },
  variantIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantIconPremium: {
    backgroundColor: Colors.goldDim,
  },
  variantInfo: {
    flex: 1,
  },
  variantTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  variantTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  variantDesc: {
    fontSize: 13,
    color: Colors.textGrey,
    marginTop: 2,
  },

  /* Premium badge */
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: Colors.goldGlow,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.gold,
    textTransform: 'uppercase',
  },

  /* Token hint */
  tokenHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
  },
  tokenHintText: {
    fontSize: 12,
    color: Colors.textLightGrey,
  },

  /* Error */
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    flex: 1,
  },

  /* Section title */
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textWhite,
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },

  /* Filter section */
  filterSection: {
    marginTop: Theme.spacing.lg,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textWhite,
    marginBottom: Theme.spacing.sm,
  },

  /* Chips */
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Theme.borderRadius.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: Colors.accentPrimary,
  },
  chipInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.tabInactive,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Colors.textOnAccent,
  },
  chipTextInactive: {
    color: Colors.textGrey,
  },

  /* Mood input */
  moodInputContainer: {
    marginTop: Theme.spacing.lg,
  },
  moodTextInput: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    color: Colors.textWhite,
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
  },

  /* Spin button */
  spinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Theme.spacing.xl,
    paddingVertical: 16,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Colors.accentPrimary,
    gap: Theme.spacing.sm,
  },
  spinButtonDisabled: {
    backgroundColor: Colors.bgSubtle,
    opacity: 0.5,
  },
  spinButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textOnAccent,
  },

  /* Spinning + Result container */
  slotResultContainer: {
    flex: 1,
    alignItems: 'center',
  },
  spinningText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.accentPrimary,
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    letterSpacing: 1,
    textAlign: 'center',
  },

  /* Result info */
  resultInfo: {
    alignItems: 'center',
    marginTop: Theme.spacing.lg,
    paddingHorizontal: 20,
    width: '100%',
  },
  resultTitle: {
    fontSize: 24,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.textWhite,
    textAlign: 'center',
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
  },
  resultMetaText: {
    fontSize: 14,
    color: Colors.textGrey,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.gold,
  },

  /* Match score badge */
  matchScoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Theme.spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: Colors.goldDim,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: Colors.goldGlow,
  },
  matchScoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gold,
  },

  /* Result tags */
  resultTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Colors.white05,
    borderWidth: 1,
    borderColor: Colors.white10,
  },
  tagText: {
    fontSize: 12,
    color: Colors.textGrey,
  },

  /* Result actions */
  resultActions: {
    width: '100%',
    marginTop: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Colors.accentPrimary,
    gap: Theme.spacing.sm,
  },
  acceptButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textOnAccent,
  },
  spinAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.accentPrimary,
    backgroundColor: 'transparent',
    gap: Theme.spacing.sm,
  },
  spinAgainText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.accentPrimary,
  },
});
