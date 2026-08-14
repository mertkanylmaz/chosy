/**
 * Home sekmesi — duygu giris akisi + AI Processing + Mood Profile Result.
 *
 * UX Redesign v3 — Tab restructure:
 *   Home tab artik tam MoodScreen iceriyor (eskiden ayri Discover tab'daydı).
 *   Duplicate mood input kaldirildi — tek giris noktasi burasi.
 *
 * Asamalar:
 *   input      — Ekran basligi + Era/Quality chip filtreleri + metin girisi
 *                + Quick Moods + sabit alt "Find Movies" butonu
 *   processing — AIProcessingOverlay (modal overlay)
 *   result     — MoodProfileResult; "Browse Movies" → discover stack'e gecer
 *
 * UX Kararlari:
 *   - Logo hero kaldirildi → sade baslik + subtitle
 *   - "Find Movies" butonu sabit alt bar (klavye ile yukselir)
 *   - Quick Mood secimi → haptik + buton flash animasyon
 *   - "Any" chip varsayilan secili ve listeye ilk siraya alindi
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import MoodCardGrid from '@/components/Home/MoodCardGrid';
import FilterBottomSheet from '@/components/Home/FilterBottomSheet';
import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
// DISCOVER_GAMES import removed — games section only in Discover tab
import { useScalePress } from '@/hooks/useScalePress';
import { hapticLight, hapticMedium, hapticSelection } from '@/utils/haptics';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMood } from '@/contexts/MoodContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { setPendingSearchId, setSearchKeywords, setPendingMoodText } from '@/services/moodSearchState';
import { startPreload, clearPreload } from '@/services/recommendationPreload';
import { getMoodHistory } from '@/services/profileService';
import { parseMood } from '@/services/tasteParser';
import { saveSession } from '@/services/watchlist';
import { readAppUserId } from '@/services/auth-utils';
import { FilmFilters, TasteProfile } from '@/types';
import type { MoodHistoryItem } from '@/types/profile';
import { type ErrorType, toUserError } from '@/utils/errorHelpers';
import { yearRangeToEra } from '@/utils/filmFilters';
import { logger } from '@/utils/logger';
import { posthogAnalytics } from '@/services/posthog';

// ─── Tipler ───────────────────────────────────────────────────────────────────

/** Overlay asamalari */
type Phase = 'input' | 'processing' | 'result';

/** Pipeline ilerleme sinyali — AIProcessingOverlay'e aktarilir */
type PipelineStage = 'parsing' | 'done';

/** Year chip secenegi ID'si */
type YearChipId = 'pre1990' | '1990s' | '2000s' | '2010s' | '2020s' | '';

/** Rating chip secenegi ID'si */
type RatingChipId = '7' | '8' | 'top250' | '';

/** Minimum AI processing gosterme suresi (ms) */
const MIN_PROCESSING_MS = 1500;

// ─── Filter chip type aliases (used by FilterBottomSheet + handleFindMovies) ─


// ─── Ana ekran ────────────────────────────────────────────────────────────────

/**
 * Home sekmesi — mood search + AI processing + profil sonucu.
 * Onboarding'den gelen `onboarding` param'i ile ucretsiz ilk arama desteklenir.
 */
export default function HomeScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  /** Onboarding akisi: ArchetypeReveal'den gelen param — mood → discover → paywall zinciri */
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const isOnboarding = onboarding === '1';
  const { setMoodResult, setCurrentSessionId, setLastMoodText, setLastSearchId } = useMood();
  const { fullQuota, checkQuota, consumeQuota, isLoading: subLoading } = useSubscription();
  const { triggerPaywall, paywallProps } = useContextualPaywall();

  const [phase, setPhase] = useState<Phase>('input');
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('parsing');
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const { cardRef: moodShareRef, share: shareMoodCard, isCapturing: isMoodShareCapturing } = useShareCapture();
  /** Metin giris state'i */
  const [moodText, setMoodText] = useState('');
  /** Secili yil filtresi */
  const [yearChip, setYearChip] = useState<YearChipId>('');
  /** Secili IMDb filtresi */
  const [ratingChip, setRatingChip] = useState<RatingChipId>('');
  /** Hata durumu — inline hata mesaji gostermek icin */
  const [moodError, setMoodError] = useState<{ type: ErrorType; message: string } | null>(null);
  /** Kota doldu overlay gorunurlugu */
  const [showQuotaExhausted, setShowQuotaExhausted] = useState(false);
  /** Son kota sonucu — QuotaExhausted overlay'ine aktarilir */
  const [lastQuotaResult, setLastQuotaResult] = useState<import('@/constants/subscriptionPlans').QuotaStatus | null>(null);
  /** TextInput focus durumu — glow efekti icin */
  const [isFocused, setIsFocused] = useState(false);

  /** Son mood aramalari — discover tab content section */
  const [recentSearches, setRecentSearches] = useState<MoodHistoryItem[]>([]);

  const pendingFilters = useRef<FilmFilters | null>(null);

  // Ekran acildiginda kota bilgisini yenile
  useEffect(() => {
    checkQuota();
  }, [checkQuota]);

  // ── Tab focus'ta recent searches yukle ──────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      (async () => {
        // Kimlik OLUŞTURULMAZ, yalnızca okunur. Satır açma işi oturum
        // bootstrap'ına ait (`app/_layout.tsx` → SIGNED_IN → ensureAppUser).
        // Eski hâli burada `getAppUserId()` çağırıp INSERT deniyordu ve
        // hatayı boş `catch` ile yutuyordu — 87 kimliğin 3,5 ay boyunca
        // satırsız kalması bu sessizlik yüzünden görülemedi.
        const userId = await readAppUserId();
        if (!userId) return;

        try {
          const history = await getMoodHistory(userId);
          setRecentSearches(history.slice(0, 3));
        } catch (err) {
          logger.error('[HomeScreen] recent searches yüklenemedi:', err);
        }
      })();
    }, []),
  );

  const { animatedStyle: btnAnimStyle, onPressIn: btnPressIn, onPressOut: btnPressOut } = useScalePress(0.95);

  /**
   * Mood Card / Quick Mood secildiginde "Find Movies" butonunu kisa sure parlatir + scale pulse.
   * Reanimated SharedValue — dependency array'e gerek yok (stable ref gibi davranir).
   */
  const findBtnFlash = useSharedValue(1);
  const findBtnScale = useSharedValue(1);
  const findBtnFlashStyle = useAnimatedStyle(() => ({
    opacity: findBtnFlash.value,
    transform: [{ scale: findBtnScale.value }],
  }));

  /**
   * Surekli donen shimmer efekti — butonun uzerinde yavasca kayip gider.
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
    // skewX + translateX birlikte — static transform override problemini onler
    transform: [{ skewX: '-20deg' }, { translateX: shimmerPos.value }],
  }));

  /**
   * "Find Movies" → kota kontrolu → AI processing → profile result
   *
   * B+C hibrit paywall stratejisi:
   *   - Kota varsa: normal AI flow
   *   - Kota dolmussa: QuotaExhausted overlay (free → paywall, paid → bekleme mesaji)
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

    setPipelineStage('parsing');
    setPhase('processing');
    pendingFilters.current = filters;

    try {
      setMoodError(null);
      const [parseResult] = await Promise.all([
        parseMood(trimmed),
        new Promise<void>((resolve) => setTimeout(resolve, MIN_PROCESSING_MS)),
      ]);

      const { profile, searchId, searchKeywords } = parseResult;

      // parseMood bitti — overlay'e sinyal gönder
      setPipelineStage('done');

      if (filters.yearRange !== null) {
        profile.era_preference = yearRangeToEra(filters.yearRange);
      }

      // Sprint 1 v4.0: searchId'yi MoodContext'e kaydet — recommendations.ts kullanacak
      setLastSearchId(searchId);
      // Module-level store — React state/ref/effect race condition bypass
      setPendingSearchId(searchId);
      // Tematik keyword'ler — match_films_v3 keyword overlap boost icin
      setSearchKeywords(searchKeywords);
      // Orijinal mood metni — LLM re-ranker icin
      setPendingMoodText(trimmed);

      setTasteProfile(profile);

      // Recommendations preload — animasyonu beklemeden hemen baslat
      // searchId zaten setPendingSearchId ile set edildi, startPreload consume edecek
      // 350ms erken baslatma: kullanici profili okurken pipeline daha fazla sure kazanir
      startPreload(profile, filters);

      // Kısa gecikme — overlay fade-out tamamlansın, result mount olsun
      await new Promise<void>((resolve) => setTimeout(resolve, 350));
      setPhase('result');

      // Session'i arka planda kaydet — hata akisini engellemez
      readAppUserId().then((userId) => {
        if (userId) {
          saveSession(userId, trimmed, profile).then((sessionId) => {
            setCurrentSessionId(sessionId);
          });
        }
      });
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[HomeScreen] parseMood hatasi:', err instanceof Error ? err.message : err);
      }

      const errorCode = err instanceof Error && 'code' in err ? (err as { code: string }).code : 'unknown';
      posthogAnalytics.track('mood_search_failed', {
        error: err instanceof Error ? err.message : 'unknown',
        error_code: errorCode,
        mood_length: trimmed.length,
      });

      const userError = toUserError(err, 'mood');
      // APP_USER_MISSING metni Edge'den cevrilmemis gelir — t() ile degistir.
      const message = errorCode === 'APP_USER_MISSING'
        ? t('errors.accountSetupIncomplete')
        : userError.message;
      setMoodError({ type: userError.type, message });
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
   * Mood card secildiginde — metin doldur + haptik + buton flash + scale pulse.
   * MoodCardGrid'den gelen text zaten localized prompt.
   */
  const handleMoodCardSelect = useCallback(
    (text: string) => {
      hapticSelection();
      posthogAnalytics.track('mood_card_tapped', { mood_text: text.slice(0, 40) });
      setMoodText(text);
      // Opacity: dim → spring geri
      findBtnFlash.value = withSequence(
        withTiming(0.6, { duration: 80 }),
        withSpring(1, { damping: 10, stiffness: 220 }),
      );
      // Scale: hafif buyu → geri — "Buraya bas!" mesaji
      findBtnScale.value = withSequence(
        withSpring(1.04, { damping: 8, stiffness: 300 }),
        withSpring(1, { damping: 12, stiffness: 200 }),
      );
    },
    // findBtnFlash + findBtnScale stable SharedValue ref — ESLint uyarisi beklenmez
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** Recent search tap — text'i set et + submit */
  const handleRecentTap = useCallback((item: MoodHistoryItem) => {
    hapticLight();
    posthogAnalytics.track('discover_recent_search_tapped', { mood_text: item.mood_text });
    setMoodText(item.mood_text);
    // Kisa gecikme — state'in yerlesip handleFindMovies'in guncel moodText'i görmesi icin
    setTimeout(() => {
      // handleFindMovies moodText ref'ini kullanir, setState async oldugu icin
      // dogrudan text'i kullanmak yerine state'in settle etmesini bekliyoruz
    }, 100);
  }, []);

  // ── MoodProfileResult asamasi ──────────────────────────────────────────────
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

  // ── Input asamasi ──────────────────────────────────────────────────────────
  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.background} />
      {/* GEÇİCİ — C.2-2 cihaz testi için, TestFlight öncesi kaldırılacak */}
      {__DEV__ && (
        <TouchableOpacity
          onPress={() => router.push('/dev-gauntlet')}
          style={{
            position: 'absolute',
            top: 50,
            right: 12,
            zIndex: 999,
            backgroundColor: '#000',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 12 }}>🎬 Gauntlet Test</Text>
        </TouchableOpacity>
      )}
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

            {/* ── Filter trigger (bottom sheet) — above mood cards ── */}
            <FilterBottomSheet
              yearChip={yearChip}
              ratingChip={ratingChip}
              onYearChange={setYearChip}
              onRatingChange={setRatingChip}
            />

            {/* ── Mood Card Bento Grid ───────────────────────────── */}
            <MoodCardGrid
              activeMoodText={moodText}
              onSelect={handleMoodCardSelect}
            />

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

            {/* Games section removed — only shown in Discover tab */}

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

      <AIProcessingOverlay
        visible={phase === 'processing'}
        pipelineStage={pipelineStage}
        onRetry={() => {
          setPhase('input');
          setPipelineStage('parsing');
        }}
        t={t}
      />

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
    fontSize: Theme.typography.caption.fontSize,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  onboardingBannerHint: {
    color: Colors.textSecondary,
    fontSize: Theme.typography.micro.fontSize,
    lineHeight: Theme.typography.micro.lineHeight,
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
    fontSize: Theme.typography.body.fontSize,
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
    fontSize: Theme.typography.h3.fontSize,
    lineHeight: Theme.typography.h3.lineHeight,
    fontWeight: '700',
    color: Colors.textWhite,
    letterSpacing: -0.2,
  },

  // (Filter chips moved to FilterBottomSheet component)

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
    fontSize: Theme.typography.body.fontSize,
    color: Colors.textWhite,
    fontWeight: '500',
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
    fontSize: Theme.typography.caption.fontSize,
    lineHeight: Theme.typography.caption.lineHeight,
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
    fontSize: Theme.typography.h3.fontSize,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  findButtonContent: {
    alignItems: 'center',
    gap: 1,
  },
  findButtonQuota: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: Theme.typography.micro.fontSize,
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

  // (Quick Moods grid moved to MoodCardGrid component)
});
