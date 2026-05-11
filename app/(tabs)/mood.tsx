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

import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

import AIProcessingOverlay from '@/components/AIProcessingOverlay';
import MoodProfileResult from '@/components/MoodProfileResult';
import QuotaExhausted from '@/components/QuotaExhausted';
import { MoodShareCard, useShareCapture } from '@/components/ShareCards';
import { Colors } from '@/constants/Colors';
import { MoodIcons } from '@/constants/icons';
import { useStaggeredEntry } from '@/hooks/useStaggeredEntry';
import { useScalePress } from '@/hooks/useScalePress';
import { hapticMedium, hapticSelection } from '@/utils/haptics';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMood } from '@/contexts/MoodContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { parseMood } from '@/services/tasteParser';
import { saveSession, getAppUserId } from '@/services/watchlist';
import { FilmFilters, TasteProfile } from '@/types';
import { type ErrorType, toUserError } from '@/utils/errorHelpers';
import { yearRangeToEra } from '@/utils/filmFilters';

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
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const isOnboarding = onboarding === '1';
  const { setMoodResult, setCurrentSessionId, setLastMoodText } = useMood();
  const { quota, checkQuota, recordSearch, status: subscriptionStatus, isLoading: subLoading } = useSubscription();

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
  /** Kota doldu overlay görünürlüğü */
  const [showQuotaExhausted, setShowQuotaExhausted] = useState(false);
  /** TextInput focus durumu — glow efekti için */
  const [isFocused, setIsFocused] = useState(false);

  const pendingFilters = useRef<FilmFilters | null>(null);

  // Ekran açıldığında kota bilgisini yenile
  useEffect(() => {
    checkQuota();
  }, [checkQuota]);

  // ── Giriş animasyonları ────────────────────────────────────────────────────
  const style0 = useStaggeredEntry(0); // ekran başlığı
  const style1 = useStaggeredEntry(1); // yıl chipleri
  const style2 = useStaggeredEntry(2); // rating chipleri
  const style3 = useStaggeredEntry(3); // text input
  const style4 = useStaggeredEntry(4); // quick moods

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

    // ── Kota kontrolü ─────────────────────────────────────────────────────
    const quotaResult = await checkQuota();
    if (!quotaResult.allowed) {
      setShowQuotaExhausted(true);
      return;
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
      const [profile] = await Promise.all([
        parseMood(trimmed),
        new Promise<void>((resolve) => setTimeout(resolve, MIN_PROCESSING_MS)),
      ]);

      if (filters.yearRange !== null) {
        profile.era_preference = yearRangeToEra(filters.yearRange);
      }

      setTasteProfile(profile);
      setPhase('result');

      // ── Basarili arama → kota sayacini artir (onboarding'de bedava) ────
      if (!isOnboarding) {
        await recordSearch();
      }

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
      const userError = toUserError(err, 'mood');
      setMoodError({ type: userError.type, message: userError.message });
      setPhase('input');
    }
  }, [moodText, yearChip, ratingChip, phase, t, checkQuota, recordSearch]);

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
        <LinearGradient
          colors={[Colors.background, Colors.backgroundGradient]}
          style={styles.gradient}
        >
          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >

            {/* ── Icerik — scroll yok, sigacak sekilde kompakt layout ── */}
            <View style={styles.content}>

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

              {/* ── Ekran Basligi ─────────────────────────────────────── */}
              <Animated.View style={[style0, styles.titleSection]}>
                <Text style={styles.screenTitle}>{t('mood.screenTitle')}</Text>
                <Text style={styles.screenSubtitle}>{t('mood.screenSubtitle')}</Text>
              </Animated.View>

              {/* ── Year filtresi ────────────────────────────────────────── */}
              <Animated.View style={style1}>
                <View style={styles.filterBlock}>
                  <Text style={styles.filterLabel}>{t('mood.eraLabel')}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    {/* "Any" önce — varsayılan seçili olduğu için başta görünür */}
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
              </Animated.View>

              {/* ── IMDb filtresi ────────────────────────────────────────── */}
              <Animated.View style={style2}>
                <View style={styles.filterBlock}>
                  <Text style={styles.filterLabel}>{t('mood.qualityLabel')}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    {/* "Any" önce */}
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
              </Animated.View>

              {/* ── Metin girişi ──────────────────────────────────────────── */}
              <Animated.View style={[style3, styles.textInputContainer]}>
                <TextInput
                  style={[
                    styles.textInput,
                    moodText.length > 0 && styles.textInputActive,
                    isFocused && styles.textInputFocused,
                  ]}
                  value={moodText}
                  onChangeText={(text) => { setMoodText(text); }}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder={t('moodInput.placeholder')}
                  placeholderTextColor="rgba(161,161,170,0.5)"
                  multiline
                  textAlignVertical="top"
                />
              </Animated.View>

              {/* ── Quick Moods — 2-kolon grid ──────────────────────────── */}
              <Animated.View style={[style4, styles.quickWrapper]}>
                <Text style={styles.quickTitle}>{t('mood.quickMoodsTitle')}</Text>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.quickScrollContent}
                  keyboardShouldPersistTaps="handled"
                >
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
                </ScrollView>
              </Animated.View>
            </View>

            {/* ── Sabit Alt Bar: Hata + Find Movies butonu ─────────────── */}
            <View style={styles.bottomBar}>
              {/* Hata mesajı — buton üzerinde, görünürse */}
              {moodError != null && (
                <View style={styles.errorBanner}>
                  <Ionicons
                    name={moodError.type === 'network' ? 'cloud-offline-outline' : 'warning-outline'}
                    size={18}
                    color={Colors.error}
                  />
                  <Text style={styles.errorBannerText}>{moodError.message}</Text>
                  <TouchableOpacity onPress={() => setMoodError(null)} activeOpacity={0.7}>
                    <Ionicons name="close-circle" size={18} color={Colors.textGrey} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Find Movies — tam genişlik, dikkat çekici, shimmer + kota */}
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
                    {quota && !subLoading && quota.remaining > 0 && (
                      <Text style={styles.findButtonQuota}>
                        {t('mood.quotaLeft', { count: quota.remaining })}
                      </Text>
                    )}
                  </View>
                  {/* Shimmer overlay — canSubmit'te kayıyor */}
                  {canSubmit && (
                    <Animated.View style={[styles.findButtonShimmer, shimmerStyle]} pointerEvents="none" />
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>

          </KeyboardAvoidingView>
        </LinearGradient>
      </SafeAreaView>

      <AIProcessingOverlay visible={phase === 'processing'} t={t} />

      {/* ── Kota Doldu Overlay ──────────────────────────────────── */}
      <QuotaExhausted
        visible={showQuotaExhausted}
        onClose={() => setShowQuotaExhausted(false)}
        quota={quota}
        subscriptionStatus={subscriptionStatus}
      />
    </>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  gradient: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },

  // ─── İçerik Alanı ──────────────────────────────────────────────────────────

  content: {
    flex: 1,
  },

  // ─── Onboarding Banner ──────────────────────────────────────────────────────

  /** Onboarding modunda "ilk arama bedava" bilgi sekidi */
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

  // ─── Ekran Başlığı ──────────────────────────────────────────────────────────

  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 0,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.accentPrimary,
    letterSpacing: -0.4,
  },
  screenSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // ─── Filtre ────────────────────────────────────────────────────────────────

  filterBlock: {
    marginTop: 14,
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
  /** Seçili olmayan chip — opak yüzey, border yok */
  chip: {
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  /** Seçili chip — tam dolu violet, border yok */
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

  // ─── TextInput ─────────────────────────────────────────────────────────────

  /** TextInput container */
  textInputContainer: {
    position: 'relative',
    marginTop: 8,
    marginHorizontal: 20,
  },
  textInput: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 16,
    height: 80,
    paddingTop: 12,
    paddingLeft: 14,
    paddingBottom: 12,
    paddingRight: 14,
    color: Colors.textWhite,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  /** Active state — mor tint üzerine opak yüzey */
  textInputActive: {
    backgroundColor: Colors.bgElevated,
  },
  /** Focus glow — kullanıcı yazmaya başladığında mor "AI dinliyor" hissi */
  textInputFocused: {
    borderWidth: 1.5,
    borderColor: Colors.accentPrimary,
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },

  // ─── Sabit Alt Bar ─────────────────────────────────────────────────────────

  bottomBar: {
    paddingHorizontal: 20,
    /** 83 = floating tab bar yüksekliği (bottom:10 + height:64 + 9px buffer) */
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

  // ─── Find Movies butonu — devasa, dikkat çekici ────────────────────────────

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
  /** Buton içinde kota metni — "3 left today" */
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
  /** Shimmer overlay — soldan sağa kayar, skewX shimmerStyle içinde */
  findButtonShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  // ─── Quick Moods ──────────────────────────────────────────────────────────

  /** Quick Moods wrapper — flex:1 ile kalan alanı alır, kendi içinde scroll */
  quickWrapper: {
    flex: 1,
    marginTop: 12,
    paddingHorizontal: 20,
  },
  quickTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 2,
  },
  /** ScrollView içeriği — grid wrapper + alt boşluk */
  quickScrollContent: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  /** 2-kolon grid container */
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  /** Grid kart — ~yarım genişlik, dikey düzen */
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
