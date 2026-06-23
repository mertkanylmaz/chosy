/**
 * Mood sekmesi — duygu giriş akışı + AI Processing + Mood Profile Result.
 *
 * Aşamalar:
 *   input      — Ekran başlığı + Era/Quality chip filtreleri + metin girişi
 *                + Quick Moods + sabit alt "Find Movies" butonu
 *   processing — AIProcessingOverlay (modal overlay)
 *   result     — MoodProfileResult; "Browse Movies" → discover stack'e geçer
 *
 * UX Kararları:
 *   - Logo hero kaldırıldı → sade başlık + subtitle
 *   - "Find Movies" butonu sabit alt bar (klavye ile yükselir)
 *   - Quick Mood seçimi → haptik + buton flash animasyon
 *   - "Any" chip varsayılan seçili ve listeye ilk sıraya alındı
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  withRepeat,
  Easing,
} from 'react-native-reanimated';

import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';

import AIProcessingOverlay from '@/components/AIProcessingOverlay';
import MoodProfileResult from '@/components/MoodProfileResult';
import QuotaExhausted from '@/components/QuotaExhausted';
import ContextualPaywall from '@/components/paywalls/ContextualPaywall';
import { useContextualPaywall } from '@/components/paywalls/useContextualPaywall';
import { MoodShareCard, useShareCapture } from '@/components/ShareCards';
import { Colors } from '@/constants/Colors';
import { MoodIcons } from '@/constants/icons';
import { QUICK_CHIPS, DISCOVER_GAMES, type QuickChip } from '@/constants/quickChips';
import { useScalePress } from '@/hooks/useScalePress';
import { hapticLight, hapticMedium, hapticSelection } from '@/utils/haptics';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMood } from '@/contexts/MoodContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { setPendingSearchId, setSearchKeywords, setPendingMoodText } from '@/services/moodSearchState';
import { getMoodHistory } from '@/services/profileService';
import { parseMood } from '@/services/tasteParser';
import { saveSession, getAppUserId } from '@/services/watchlist';
import { FilmFilters, TasteProfile } from '@/types';
import type { MoodHistoryItem } from '@/types/profile';
import { type ErrorType, toUserError } from '@/utils/errorHelpers';
import { yearRangeToEra } from '@/utils/filmFilters';
import { logger } from '@/utils/logger';
import { posthogAnalytics } from '@/services/posthog';

// ─── Tipler ───────────────────────────────────────────────────────────────────

/** Overlay aşamaları */
type Phase = 'input' | 'processing' | 'result';

/** Year chip seçeneği ID'si */
type YearChipId = 'pre1990' | '1990s' | '2000s' | '2010s' | '2020s' | '';

/** Rating chip seçeneği ID'si */
type RatingChipId = '7' | '8' | 'top250' | '';

/** Minimum AI processing gösterme süresi (ms) */
const MIN_PROCESSING_MS = 1500;

// ─── Chip sabitleri ───────────────────────────────────────────────────────────

const YEAR_CHIPS: { id: YearChipId; labelKey: string }[] = [
  { id: 'pre1990', labelKey: 'mood.chipClassic' },
  { id: '1990s', labelKey: 'mood.chip90s' },
  { id: '2000s', labelKey: 'mood.chip2000s' },
  { id: '2010s', labelKey: 'mood.chip2010s' },
  { id: '2020s', labelKey: 'mood.chipRecent' },
  { id: '', labelKey: 'mood.chipAny' },
];

const RATING_CHIPS: { id: RatingChipId; labelKey: string }[] = [
  { id: '7', labelKey: 'mood.chip7plus' },
  { id: '8', labelKey: 'mood.chip8plus' },
  { id: 'top250', labelKey: 'mood.chipTop250' },
  { id: '', labelKey: 'mood.chipAny' },
];

// ─── Quick Moods ──────────────────────────────────────────────────────────────

interface QuickMoodItem {
  id: string;
  labelKey: string;
  promptKey: string;
}

const QUICK_MOODS: QuickMoodItem[] = [
  { id: 'rainy',    labelKey: 'mood.quickRainy',    promptKey: 'mood.quickRainyPrompt' },
  { id: 'date',     labelKey: 'mood.quickDate',     promptKey: 'mood.quickDatePrompt' },
  { id: 'thrill',   labelKey: 'mood.quickThrill',   promptKey: 'mood.quickThrillPrompt' },
  { id: 'laugh',    labelKey: 'mood.quickLaugh',    promptKey: 'mood.quickLaughPrompt' },
  { id: 'deep',     labelKey: 'mood.quickDeep',     promptKey: 'mood.quickDeepPrompt' },
  { id: 'nostalgia',labelKey: 'mood.quickNostalgia',promptKey: 'mood.quickNostalgiaPrompt' },
  { id: 'chill',    labelKey: 'mood.quickChill',    promptKey: 'mood.quickChillPrompt' },
  { id: 'cry',      labelKey: 'mood.quickCry',      promptKey: 'mood.quickCryPrompt' },
];


// ─── Ana ekran ────────────────────────────────────────────────────────────────

/**
 * Mood sekmesi — yeni tasarım.
 * chosy.ai logo hero + filtreler + Quick Moods + Browse by Genre + metin girişi.
 */
export default function MoodScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  /** Onboarding akisi: ArchetypeReveal'den gelen param — mood → discover → paywall zinciri */
  /** Prefill: Home'dan mood text ile navigate edildiginde otomatik search */
  const { onboarding, prefill } = useLocalSearchParams<{ onboarding?: string; prefill?: string }>();
  const isOnboarding = onboarding === '1';
  const { setMoodResult, setCurrentSessionId, setLastMoodText, setLastSearchId } = useMood();
  const { fullQuota, checkQuota, consumeQuota, isLoading: subLoading } = useSubscription();
  const { triggerPaywall, paywallProps } = useContextualPaywall();

  const [phase, setPhase] = useState<Phase>('input');
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const { cardRef: moodShareRef, share: shareMoodCard, isCapturing: isMoodShareCapturing } = useShareCapture();
  /** Metin giriş state'i */
  const [moodText, setMoodText] = useState('');
  /** Seçili yıl filtresi */
  const [yearChip, setYearChip] = useState<YearChipId>('');
  /** Seçili IMDb filtresi */
  const [ratingChip, setRatingChip] = useState<RatingChipId>('');
  /** Hata durumu — inline hata mesajı göstermek için */
  const [moodError, setMoodError] = useState<{ type: ErrorType; message: string } | null>(null);
  /** Kota doldu overlay gorunurlugu */
  const [showQuotaExhausted, setShowQuotaExhausted] = useState(false);
  /** Son kota sonucu — QuotaExhausted overlay'ine aktarilir */
  const [lastQuotaResult, setLastQuotaResult] = useState<import('@/constants/subscriptionPlans').QuotaStatus | null>(null);
  /** TextInput focus durumu — glow efekti için */
  const [isFocused, setIsFocused] = useState(false);

  /** Son mood aramalari — discover tab content section */
  const [recentSearches, setRecentSearches] = useState<MoodHistoryItem[]>([]);

  const pendingFilters = useRef<FilmFilters | null>(null);
  /** Prefill auto-submit: true olunca handleFindMovies tetiklenir */
  const [autoSubmitPending, setAutoSubmitPending] = useState(false);
  /** Prefill consume tracking — ayni param tekrar tetiklemesin */
  const prefillConsumed = useRef(false);

  // Ekran açıldığında kota bilgisini yenile
  useEffect(() => {
    checkQuota();
  }, [checkQuota]);

  // ── Tab focus'ta recent searches yukle ──────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const userId = await getAppUserId();
          if (!userId) return;
          const history = await getMoodHistory(userId);
          setRecentSearches(history.slice(0, 3));
        } catch {
          // Sessizce devam — recent searches opsiyonel
        }
      })();
    }, []),
  );

  // ── Home'dan prefill param ile otomatik arama ──────────────────────────────
  // prefill geldiginde: text'i set et, auto-submit flag'i ac.
  useEffect(() => {
    if (prefill && typeof prefill === 'string' && prefill.trim().length > 0 && !prefillConsumed.current) {
      prefillConsumed.current = true;
      setMoodText(prefill.trim());
      setAutoSubmitPending(true);
    }
  }, [prefill]);

  const { animatedStyle: btnAnimStyle, onPressIn: btnPressIn, onPressOut: btnPressOut } = useScalePress(0.95);

  /**
   * Quick Mood seçildiğinde "Find Movies" butonunu kısa süre parlatır + scale pulse.
   * Reanimated SharedValue — dependency array'e gerek yok (stable ref gibi davranır).
   */
  const findBtnFlash = useSharedValue(1);
  const findBtnScale = useSharedValue(1);
  const findBtnFlashStyle = useAnimatedStyle(() => ({
    opacity: findBtnFlash.value,
    transform: [{ scale: findBtnScale.value }],
  }));

  /**
   * Sürekli dönen shimmer efekti — butonun üzerinde yavaşça kayıp gider.
   * canSubmit false iken durdurulur (opacity 0).
   */
  const shimmerPos = useSharedValue(-200);
  useEffect(() => {
    shimmerPos.value = withRepeat(
      withTiming(400, { duration: 2000, easing: Easing.linear }),
      -1,
      false,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const shimmerStyle = useAnimatedStyle(() => ({
    // skewX + translateX birlikte — static transform override problemini önler
    transform: [{ skewX: '-20deg' }, { translateX: shimmerPos.value }],
  }));

  /**
   * "Find Movies" → kota kontrolü → AI processing → profile result
   *
   * B+C hibrit paywall stratejisi:
   *   - Kota varsa: normal AI flow
   *   - Kota dolmuşsa: QuotaExhausted overlay (free → paywall, paid → bekleme mesajı)
   */
  const handleFindMovies = useCallback(async () => {
    const trimmed = moodText.trim();
    if (!trimmed || phase === 'processing') return;

    hapticMedium();
    Keyboard.dismiss();
    posthogAnalytics.track('mood_searched', { mood_text_length: trimmed.length });

    // ── Kota kontrolu — RPC atomic consume ──────────────────────────────
    // Onboarding'de kota tuketme (ilk arama bedava)
    if (!isOnboarding) {
      const quotaResult = await consumeQuota('search');
      setLastQuotaResult(quotaResult);
      if (!quotaResult.allowed) {
        posthogAnalytics.track('quota_exhausted', { quota_type: 'search' });
        // Contextual paywall dene — gosterilmezse fallback QuotaExhausted
        const shown = await triggerPaywall({ type: 'quota_exhausted', quota: 'search' });
        if (!shown) {
          setShowQuotaExhausted(true);
        }
        return;
      }
    }

    const yearRange = yearChip ? (yearChip as FilmFilters['yearRange']) : null;
    let minRating: FilmFilters['minRating'] = null;
    if (ratingChip === '7') minRating = 7;
    else if (ratingChip === '8') minRating = 8;
    else if (ratingChip === 'top250') minRating = 'top250';

    const filters: FilmFilters = { yearRange, minRating, regions: [], directors: [] };

    setPhase('processing');
    pendingFilters.current = filters;

    try {
      setMoodError(null);
      const [parseResult] = await Promise.all([
        parseMood(trimmed),
        new Promise<void>((resolve) => setTimeout(resolve, MIN_PROCESSING_MS)),
      ]);

      const { profile, searchId, searchKeywords } = parseResult;

      if (filters.yearRange !== null) {
        profile.era_preference = yearRangeToEra(filters.yearRange);
      }

      // Sprint 1 v4.0: searchId'yi MoodContext'e kaydet — recommendations.ts kullanacak
      setLastSearchId(searchId);
      // Module-level store — React state/ref/effect race condition bypass
      setPendingSearchId(searchId);
      // Tematik keyword'ler — match_films_v3 keyword overlap boost için
      setSearchKeywords(searchKeywords);
      // Orijinal mood metni — LLM re-ranker için
      setPendingMoodText(trimmed);

      setTasteProfile(profile);
      setPhase('result');

      // Session'ı arka planda kaydet — hata akışı engellemez
      getAppUserId().then((userId) => {
        if (userId) {
          saveSession(userId, trimmed, profile).then((sessionId) => {
            setCurrentSessionId(sessionId);
          });
        }
      });
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[MoodScreen] parseMood hatası:', err instanceof Error ? err.message : err);
      }

      const errorCode = err instanceof Error && 'code' in err ? (err as { code: string }).code : 'unknown';
      posthogAnalytics.track('mood_search_failed', {
        error: err instanceof Error ? err.message : 'unknown',
        error_code: errorCode,
        mood_length: trimmed.length,
      });

      const userError = toUserError(err, 'mood');
      setMoodError({ type: userError.type, message: userError.message });
      setPhase('input');

      // Quota exceeded from edge function — show paywall
      if (userError.type === 'quota') {
        const shown = await triggerPaywall({ type: 'quota_exhausted', quota: 'search' });
        if (!shown) {
          setShowQuotaExhausted(true);
        }
      }
    }
  }, [moodText, yearChip, ratingChip, phase, t, consumeQuota, isOnboarding, triggerPaywall]);

  // ── isReadyToSearch: tum pre-condition'lar karsilandi mi ─────────────────
  // Subscription context yuklenmesi tamamlaninca search yapilabilir.
  const isReadyToSearch = !subLoading;

  // ── Prefill auto-submit: event-driven, sabit delay yok ─────────────────
  // isReadyToSearch true olunca aninla tetikler.
  // 3sn icinde ready olmazsa: autoSubmit iptal, kullanici manuel submit edebilir.
  useEffect(() => {
    if (!autoSubmitPending) return;

    // 3sn safety valve — network sorunu vb. durumda sessizce kaybolmasin
    const safetyTimer = setTimeout(() => {
      setAutoSubmitPending(false);
      logger.warn('[MoodScreen] prefill timeout — isReadyToSearch hala false, manuel submit bekleniyor');
    }, 3000);

    if (moodText.trim().length > 0 && phase === 'input' && isReadyToSearch) {
      clearTimeout(safetyTimer);
      setAutoSubmitPending(false);
      handleFindMovies();
    }

    return () => clearTimeout(safetyTimer);
  }, [autoSubmitPending, moodText, phase, isReadyToSearch, handleFindMovies]);

  /**
   * "Browse Movies" → MoodContext'e kaydet → Discover'a gec
   *
   * B hibrit paywall: Free kullanici ilk aramasini yaptiktan sonra
   * discover'a gonder, ama kota bittiyse sonraki "Find Movies"'te paywall goster.
   * Su anki arama zaten basarili oldu — discover'a gitmesini engelleme.
   *
   * Onboarding modu: discover'a onboarding=1 param'i gecilir → 5 film limiti aktif.
   */
  const handleBrowseMovies = useCallback(() => {
    if (!tasteProfile) return;
    // P7.1: LastSessionCard icin son mood metnini sakla
    const trimmedMood = moodText.trim();
    if (trimmedMood) setLastMoodText(trimmedMood);
    setMoodResult(
      tasteProfile,
      pendingFilters.current ?? { yearRange: null, minRating: null, regions: [], directors: [] },
    );
    setPhase('input');

    // Discover'a gonder — kota bilgisini yenile (badge guncellensin)
    checkQuota();
    if (isOnboarding) {
      // Onboarding akisi: discover 5 film limit + App Store review + paywall zinciri
      router.push({ pathname: '/discover', params: { onboarding: '1' } } as never);
    } else {
      router.push('/discover');
    }
  }, [tasteProfile, moodText, setMoodResult, setLastMoodText, router, checkQuota, isOnboarding]);

  /**
   * Quick Mood koleksiyonu tıklandığında — metni doldur + haptik + buton flash + scale pulse.
   */
  const handleQuickMood = useCallback(
    (text: string) => {
      hapticSelection();
      setMoodText(text);
      // Opacity: dim → spring geri
      findBtnFlash.value = withSequence(
        withTiming(0.6, { duration: 80 }),
        withSpring(1, { damping: 10, stiffness: 220 }),
      );
      // Scale: hafif büyü → geri — "Buraya bas!" mesajı
      findBtnScale.value = withSequence(
        withSpring(1.04, { damping: 8, stiffness: 300 }),
        withSpring(1, { damping: 12, stiffness: 200 }),
      );
    },
    // findBtnFlash + findBtnScale stable SharedValue ref — ESLint uyarısı beklenmez
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );


  /** Quick chip secildiginde — mood text'i set et + haptik */
  const handleQuickChip = useCallback((chip: QuickChip) => {
    hapticLight();
    posthogAnalytics.track('discover_quick_chip_tapped', { mood: chip.id });
    setMoodText(chip.prompt);
    // Flash buton efekti
    findBtnFlash.value = withSequence(
      withTiming(0.6, { duration: 80 }),
      withSpring(1, { damping: 10, stiffness: 220 }),
    );
    findBtnScale.value = withSequence(
      withSpring(1.04, { damping: 8, stiffness: 300 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Recent search tap — text'i set et + auto submit */
  const handleRecentTap = useCallback((item: MoodHistoryItem) => {
    hapticLight();
    posthogAnalytics.track('discover_recent_search_tapped', { mood_text: item.mood_text });
    setMoodText(item.mood_text);
    setAutoSubmitPending(true);
  }, []);

  /** Game card tap — navigate to game */
  const handleGameTap = useCallback((route: string, gameType: string) => {
    hapticLight();
    posthogAnalytics.track('discover_game_tapped', { game_id: gameType, source: 'discover_tab' });
    router.push(route as never);
  }, [router]);

  // ── MoodProfileResult aşaması ──────────────────────────────────────────────
  if (phase === 'result' && tasteProfile) {
    return (
      <>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <MoodProfileResult
          profile={tasteProfile}
          onBack={() => setPhase('input')}
          onBrowseMovies={handleBrowseMovies}
          onShareMood={shareMoodCard}
          isShareCapturing={isMoodShareCapturing}
        />
        {/* Offscreen mood share card — capture icin */}
        <MoodShareCard
          ref={moodShareRef}
          moodText={moodText}
          profile={{
            energyLevel: tasteProfile.energy_level,
            thematicDepth: tasteProfile.thematic_depth,
            endingPreference: tasteProfile.ending_preference,
          }}
        />
      </>
    );
  }

  const canSubmit = moodText.trim().length > 0 && phase !== 'processing';

  // ── Input aşaması ──────────────────────────────────────────────────────────
  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.background} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >

          {/* ── Onboarding: ucretsiz arama banner ────────────────── */}
          {isOnboarding && (
            <View style={styles.onboardingBanner}>
              <Ionicons name="sparkles" size={13} color={Colors.accentPrimary} />
              <View style={styles.onboardingBannerText}>
                <Text style={styles.onboardingBannerTitle}>{t('mood.onboardingFreeSearch')}</Text>
                <Text style={styles.onboardingBannerHint}>{t('mood.onboardingFreeHint')}</Text>
              </View>
            </View>
          )}

          {/* ── Compact Search Bar (sticky top) ─────────────────── */}
          <View style={styles.compactSearchBar}>
            <Ionicons name="search" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.compactInput}
              value={moodText}
              onChangeText={setMoodText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={t('mood.discoverSearchPlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              returnKeyType="search"
              onSubmitEditing={() => handleFindMovies()}
              blurOnSubmit
            />
            <Animated.View style={findBtnFlashStyle}>
              <TouchableOpacity
                style={[styles.compactSubmitBtn, !canSubmit && styles.compactSubmitBtnDisabled]}
                onPress={handleFindMovies}
                disabled={!canSubmit}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={canSubmit ? Colors.textOnAccent : Colors.textTertiary}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* ── Hata mesaji — search bar altinda ─────────────────── */}
          {moodError != null && (
            <View style={styles.errorBanner}>
              <Ionicons
                name={
                  moodError.type === 'network' ? 'cloud-offline-outline' :
                  moodError.type === 'quota' ? 'lock-closed-outline' :
                  'warning-outline'
                }
                size={18}
                color={Colors.error}
              />
              <Text style={styles.errorBannerText}>{moodError.message}</Text>
              <TouchableOpacity onPress={() => setMoodError(null)} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={18} color={Colors.textGrey} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Scrollable content ──────────────────────────────── */}
          <ScrollView
            style={styles.discoverScroll}
            contentContainerStyle={styles.discoverScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Era + Rating filter chips ─────────────────────── */}
            <View style={styles.filterBlock}>
              <Text style={styles.filterLabel}>{t('mood.eraLabel')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {[...YEAR_CHIPS].reverse().map((chip) => {
                  const active = yearChip === chip.id;
                  return (
                    <TouchableOpacity
                      key={chip.id || 'year-any'}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => { hapticSelection(); setYearChip(chip.id); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {t(chip.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.filterBlock}>
              <Text style={styles.filterLabel}>{t('mood.qualityLabel')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {[...RATING_CHIPS].reverse().map((chip) => {
                  const active = ratingChip === chip.id;
                  return (
                    <TouchableOpacity
                      key={chip.id || 'rating-any'}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => { hapticSelection(); setRatingChip(chip.id); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {t(chip.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── Quick Mood Chips — horizontal scroll ──────────── */}
            <View style={styles.discoverSection}>
              <Text style={styles.quickTitle}>{t('mood.quickMoodsTitle')}</Text>
              <FlatList
                data={QUICK_CHIPS}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.quickChipsRow}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.quickChipPill, moodText === item.prompt && styles.quickChipPillActive]}
                    onPress={() => handleQuickChip(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.quickChipPillText, moodText === item.prompt && styles.quickChipPillTextActive]}>
                      {t(item.labelKey)}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>

            {/* ── Quick Moods — 2-kolon grid ──────────────────────── */}
            <View style={styles.discoverSection}>
              <View style={styles.quickGrid}>
                {QUICK_MOODS.map((item) => {
                  const prompt = t(item.promptKey);
                  const isActive = moodText === prompt;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.quickGridCard, isActive && styles.quickCardActive]}
                      onPress={() => handleQuickMood(prompt)}
                      activeOpacity={0.7}
                    >
                      <Image
                        source={MoodIcons[item.id]}
                        style={styles.quickEmoji}
                        resizeMode="contain"
                      />
                      <Text
                        style={[styles.quickLabel, isActive && styles.quickLabelActive]}
                        numberOfLines={1}
                      >
                        {t(item.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Son Aramalar (conditional) ─────────────────────── */}
            {recentSearches.length > 0 && (
              <View style={styles.discoverSection}>
                <Text style={styles.discoverSectionTitle}>{t('mood.discoverRecentTitle')}</Text>
                {recentSearches.map((item) => (
                  <TouchableOpacity
                    key={item.session_id}
                    style={styles.recentItem}
                    onPress={() => handleRecentTap(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                    <Text style={styles.recentItemText} numberOfLines={1}>{item.mood_text}</Text>
                    <Ionicons name="arrow-forward" size={14} color={Colors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ── Sinefil Oyunlari section ──────────────────────── */}
            <View style={styles.discoverSection}>
              <Text style={styles.discoverSectionTitle}>{t('mood.discoverGamesTitle')}</Text>
              <View style={styles.gamesGrid}>
                {DISCOVER_GAMES.map((game) => (
                  <TouchableOpacity
                    key={game.gameType}
                    style={styles.gameCard}
                    onPress={() => handleGameTap(game.route, game.gameType)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.gameCardIcon}>
                      <Ionicons name={game.icon as never} size={24} color={Colors.accentPrimary} />
                    </View>
                    <Text style={styles.gameCardTitle}>{t(game.titleKey)}</Text>
                    <Text style={styles.gameCardDesc} numberOfLines={2}>{t(game.descriptionKey)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

          </ScrollView>

          {/* ── Sabit Alt Bar: Find Movies butonu ─────────────────── */}
          <View style={styles.bottomBar}>
            <Animated.View style={[btnAnimStyle, findBtnFlashStyle]}>
              <TouchableOpacity
                style={[styles.findButton, !canSubmit && styles.findButtonDisabled]}
                onPressIn={btnPressIn}
                onPressOut={btnPressOut}
                onPress={handleFindMovies}
                disabled={!canSubmit}
                activeOpacity={1}
              >
                <Ionicons
                  name="sparkles"
                  size={18}
                  color={canSubmit ? Colors.textOnAccent : 'rgba(255,255,255,0.4)'}
                />
                <View style={styles.findButtonContent}>
                  <Text style={styles.findButtonText}>{t('mood.findMovies')}</Text>
                  {fullQuota && !subLoading && (fullQuota.searches.limit - fullQuota.searches.used) > 0 && (
                    <Text style={styles.findButtonQuota}>
                      {t('mood.quotaLeft', { count: fullQuota.searches.limit - fullQuota.searches.used })}
                    </Text>
                  )}
                </View>
                {canSubmit && (
                  <Animated.View style={[styles.findButtonShimmer, shimmerStyle]} pointerEvents="none" />
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>

      <AIProcessingOverlay visible={phase === 'processing'} t={t} />

      {/* ── Kota Doldu Overlay (fallback) ────────────────────────── */}
      <QuotaExhausted
        visible={showQuotaExhausted}
        onClose={() => setShowQuotaExhausted(false)}
        quotaStatus={lastQuotaResult}
        onUpgrade={() => triggerPaywall({ type: 'quota_exhausted', quota: 'search' })}
      />

      {/* ── Contextual Paywall (orchestrator-driven) ─────────── */}
      <ContextualPaywall {...paywallProps} />
    </>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },

  // ─── Onboarding Banner ──────────────────────────────────────────────────────

  onboardingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 2,
    backgroundColor: Colors.accentPrimary + '18',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.accentPrimary + '35',
  },
  onboardingBannerText: {
    flex: 1,
    gap: 1,
  },
  onboardingBannerTitle: {
    color: Colors.accentPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  onboardingBannerHint: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },

  // ─── Compact Search Bar ─────────────────────────────────────────────────────

  compactSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    height: 48,
    backgroundColor: Colors.bgElevated,
    borderRadius: 24,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  compactInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textWhite,
    height: 48,
    padding: 0,
  },
  compactSubmitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  compactSubmitBtnDisabled: {
    backgroundColor: Colors.bgSubtle,
  },

  // ─── Discover Scroll Content ────────────────────────────────────────────────

  discoverScroll: {
    flex: 1,
  },
  discoverScrollContent: {
    paddingBottom: 180, // tab bar (83) + bottom bar (~90)
    gap: 20,
    paddingTop: 8,
  },
  discoverSection: {
    gap: 10,
    paddingHorizontal: 20,
  },
  discoverSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
    letterSpacing: -0.2,
  },

  // ─── Filtre ────────────────────────────────────────────────────────────────

  filterBlock: {
    marginTop: 0,
  },
  filterLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginBottom: 8,
    paddingHorizontal: 20,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  chipRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: Colors.accentPrimary,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.textOnAccent,
    fontWeight: '700',
  },

  // ─── Quick Chips (horizontal pill row) ──────────────────────────────────────

  quickChipsRow: {
    gap: 8,
  },
  quickChipPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  quickChipPillActive: {
    backgroundColor: Colors.accentPrimary + '30',
    borderColor: Colors.accentPrimary,
  },
  quickChipPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  quickChipPillTextActive: {
    color: Colors.accentPrimary,
    fontWeight: '700',
  },

  // ─── Recent Searches ────────────────────────────────────────────────────────

  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bgElevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  recentItemText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textWhite,
    fontWeight: '500',
  },

  // ─── Games Grid ─────────────────────────────────────────────────────────────

  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gameCard: {
    width: '48%',
    backgroundColor: Colors.bgElevated,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  gameCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  gameCardDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },

  // ─── Sabit Alt Bar ─────────────────────────────────────────────────────────

  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 90,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.white10,
    backgroundColor: Colors.background,
    gap: 10,
  },

  // ─── Hata banner ──────────────────────────────────────────────────────────

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  errorBannerText: {
    flex: 1,
    color: Colors.textWhite,
    fontSize: 13,
    lineHeight: 18,
  },

  // ─── Find Movies butonu ─────────────────────────────────────────────────────

  findButton: {
    backgroundColor: Colors.accentPrimary,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  findButtonDisabled: {
    backgroundColor: 'rgba(234,219,198,0.3)',
    shadowOpacity: 0,
    elevation: 0,
  },
  findButtonText: {
    color: Colors.textOnAccent,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  findButtonContent: {
    alignItems: 'center',
    gap: 1,
  },
  findButtonQuota: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  findButtonShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  // ─── Quick Moods (2-column grid) ───────────────────────────────────────────

  quickTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 2,
    paddingHorizontal: 20,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickGridCard: {
    width: '48%',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.bgElevated,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  quickCardActive: {
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.accentPrimary + '40',
  },
  quickEmoji: {
    width: 40,
    height: 40,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  quickLabelActive: {
    color: Colors.accentPrimary,
  },
});
