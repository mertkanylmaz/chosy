/**
 * Mood sekmesi — duygu giriş akışı + AI Processing + Mood Profile Result.
 *
 * Aşamalar:
 *   input      — Lumi + filtreler + metin girişi + "Find Movies"
 *   processing — AIProcessingOverlay (modal overlay)
 *   result     — MoodProfileResult; "Browse Movies" → Feed sekmesine geçer
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
import Animated from 'react-native-reanimated';

import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import AIProcessingOverlay from '@/components/AIProcessingOverlay';
import Lumi from '@/components/Lumi';
import MoodProfileResult from '@/components/MoodProfileResult';
import { MoodShareCard, useShareCapture } from '@/components/ShareCards';
import { Colors } from '@/constants/Colors';
import { useStaggeredEntry } from '@/hooks/useStaggeredEntry';
import { useScalePress } from '@/hooks/useScalePress';
import { hapticMedium, hapticSelection } from '@/utils/haptics';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMood } from '@/contexts/MoodContext';
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
  emoji: string;
  labelKey: string;
  promptKey: string;
}

const QUICK_MOODS: QuickMoodItem[] = [
  { id: 'rainy', emoji: '🌧️', labelKey: 'mood.quickRainy', promptKey: 'mood.quickRainyPrompt' },
  { id: 'date', emoji: '💕', labelKey: 'mood.quickDate', promptKey: 'mood.quickDatePrompt' },
  { id: 'thrill', emoji: '⚡', labelKey: 'mood.quickThrill', promptKey: 'mood.quickThrillPrompt' },
  { id: 'laugh', emoji: '😂', labelKey: 'mood.quickLaugh', promptKey: 'mood.quickLaughPrompt' },
  { id: 'deep', emoji: '🧠', labelKey: 'mood.quickDeep', promptKey: 'mood.quickDeepPrompt' },
  { id: 'nostalgia', emoji: '✨', labelKey: 'mood.quickNostalgia', promptKey: 'mood.quickNostalgiaPrompt' },
  { id: 'chill', emoji: '🍿', labelKey: 'mood.quickChill', promptKey: 'mood.quickChillPrompt' },
  { id: 'cry', emoji: '😢', labelKey: 'mood.quickCry', promptKey: 'mood.quickCryPrompt' },
];

// ─── Browse by Genre ──────────────────────────────────────────────────────────

interface GenreItem {
  id: string;
  emoji: string;
  labelKey: string;
  promptKey: string;
}

const GENRES: GenreItem[] = [
  { id: 'action', emoji: '💥', labelKey: 'mood.genreAction', promptKey: 'mood.genreActionPrompt' },
  { id: 'drama', emoji: '🎭', labelKey: 'mood.genreDrama', promptKey: 'mood.genreDramaPrompt' },
  { id: 'comedy', emoji: '😄', labelKey: 'mood.genreComedy', promptKey: 'mood.genreComedyPrompt' },
  { id: 'scifi', emoji: '🚀', labelKey: 'mood.genreSciFi', promptKey: 'mood.genreSciFiPrompt' },
  { id: 'horror', emoji: '👻', labelKey: 'mood.genreHorror', promptKey: 'mood.genreHorrorPrompt' },
  { id: 'romance', emoji: '💗', labelKey: 'mood.genreRomance', promptKey: 'mood.genreRomancePrompt' },
  { id: 'thriller', emoji: '🔪', labelKey: 'mood.genreThriller', promptKey: 'mood.genreThrillerPrompt' },
  { id: 'animation', emoji: '🎨', labelKey: 'mood.genreAnimation', promptKey: 'mood.genreAnimationPrompt' },
  { id: 'documentary', emoji: '📽️', labelKey: 'mood.genreDocumentary', promptKey: 'mood.genreDocumentaryPrompt' },
  { id: 'mystery', emoji: '🔍', labelKey: 'mood.genreMystery', promptKey: 'mood.genreMysteryPrompt' },
  { id: 'war', emoji: '⚔️', labelKey: 'mood.genreWar', promptKey: 'mood.genreWarPrompt' },
  { id: 'fantasy', emoji: '🧙', labelKey: 'mood.genreFantasy', promptKey: 'mood.genreFantasyPrompt' },
];

// ─── Ana ekran ────────────────────────────────────────────────────────────────

/**
 * Mood sekmesi — yeni tasarım.
 * Lumi maskot + filtreler + Quick Moods + Browse by Genre + metin girişi.
 */
export default function MoodScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { setMoodResult, setCurrentSessionId } = useMood();

  const [phase, setPhase] = useState<Phase>('input');
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const { cardRef: moodShareRef, share: shareMoodCard, isCapturing: isMoodShareCapturing } = useShareCapture();
  /** Metin giriş state'i */
  const [moodText, setMoodText] = useState('');
  /** Seçili yıl filtresi */
  const [yearChip, setYearChip] = useState<YearChipId>('');
  /** Seçili IMDb filtresi */
  const [ratingChip, setRatingChip] = useState<RatingChipId>('');
  /** Lumi duygu durumu — yazarken 'thinking', durduğunda 'idle' */
  const [lumiMood, setLumiMood] = useState<'idle' | 'thinking'>('idle');
  /** Hata durumu — inline hata mesajı göstermek için */
  const [moodError, setMoodError] = useState<{ type: ErrorType; message: string } | null>(null);

  const pendingFilters = useRef<FilmFilters | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Giriş animasyonları ────────────────────────────────────────────────────
  const style0 = useStaggeredEntry(0);
  const style1 = useStaggeredEntry(1);
  const style2 = useStaggeredEntry(2);
  const style3 = useStaggeredEntry(3);
  const style4 = useStaggeredEntry(4);
  const styleQuickMoods = useStaggeredEntry(5);
  const style5 = useStaggeredEntry(6);
  const { animatedStyle: btnAnimStyle, onPressIn: btnPressIn, onPressOut: btnPressOut } = useScalePress(0.95);

  /** Typing timeout cleanup */
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  /**
   * "Find Movies" → AI processing → profile result
   */
  const handleFindMovies = useCallback(async () => {
    const trimmed = moodText.trim();
    if (!trimmed || phase === 'processing') return;

    hapticMedium();
    Keyboard.dismiss();

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
  }, [moodText, yearChip, ratingChip, phase, t]);

  /**
   * "Browse Movies" → MoodContext'e kaydet → Feed sekmesine geç
   */
  const handleBrowseMovies = useCallback(() => {
    if (!tasteProfile) return;
    setMoodResult(
      tasteProfile,
      pendingFilters.current ?? { yearRange: null, minRating: null, regions: [], directors: [] },
    );
    setPhase('input');
    router.replace('/(tabs)');
  }, [tasteProfile, setMoodResult, router]);

  /**
   * Quick Mood koleksiyonu tıklandığında — metni doldur
   */
  const handleQuickMood = useCallback((text: string) => {
    hapticSelection();
    setMoodText(text);
  }, []);

  /**
   * Genre kartı tıklandığında — genre prompt'u text input'a doldur
   */
  const handleGenreTap = useCallback((genre: GenreItem) => {
    hapticSelection();
    setMoodText(t(genre.promptKey));
  }, [t]);

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

  const lumiSpeechText =
    moodText.length === 0
      ? t('mood.speechDefault')
      : moodText.length < 10
        ? t('mood.speechShort')
        : moodText.length < 30
          ? t('mood.speechMedium')
          : t('mood.speechReady');

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
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces
            >
              {/* ── Lumi Hero ─────────────────────────────────────────────── */}
              <Animated.View style={style0}>
                <View style={styles.lumiHero}>
                  <View style={styles.lumiGlow} />
                  <Lumi
                    size="medium"
                    mood={lumiMood}
                    showGlow
                  />
                  <View style={styles.speechBubble}>
                    <Text style={styles.speechText}>{lumiSpeechText}</Text>
                  </View>
                </View>
              </Animated.View>

              {/* ── Year filtresi ───────────────────────────────────────────── */}
              <Animated.View style={style1}>
                <View style={styles.filterBlock}>
                  <Text style={styles.filterLabel}>{t('mood.eraLabel')}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    {YEAR_CHIPS.map((chip) => {
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

              {/* ── IMDb filtresi ────────────────────────────────────────────── */}
              <Animated.View style={style2}>
                <View style={styles.filterBlock}>
                  <Text style={styles.filterLabel}>{t('mood.qualityLabel')}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    {RATING_CHIPS.map((chip) => {
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

              {/* ── Lumi typing indicator ───────────────────────────────────── */}
              <Animated.View style={style3}>
                <View style={styles.lumiInputIndicator}>
                  <Lumi size="medium" mood={lumiMood} showGlow />
                </View>

                {/* ── Metin girişi ─────────────────────────────────────────────── */}
                <TextInput
                  style={[styles.textInput, moodText.length > 0 && styles.textInputActive]}
                  value={moodText}
                  onChangeText={(text) => {
                    setMoodText(text);
                    setLumiMood('thinking');
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = setTimeout(() => setLumiMood('idle'), 1000);
                  }}
                  placeholder={t('moodInput.placeholder')}
                  placeholderTextColor={Colors.textGrey}
                  multiline
                  textAlignVertical="top"
                />
              </Animated.View>

              {/* ── Hata mesajı (inline) ──────────────────────────────────────── */}
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

              {/* ── Find Movies butonu ───────────────────────────────────────── */}
              <Animated.View style={[style4, btnAnimStyle]}>
                <TouchableOpacity
                  style={[styles.findButton, moodText.trim().length < 3 && styles.findButtonDisabled]}
                  onPressIn={btnPressIn}
                  onPressOut={btnPressOut}
                  onPress={handleFindMovies}
                  disabled={!canSubmit}
                  activeOpacity={1}
                >
                  <Text style={styles.findButtonText}>{t('mood.findMovies')}</Text>
                </TouchableOpacity>
              </Animated.View>

              {/* ── Quick Moods ──────────────────────────────────────────────── */}
              <Animated.View style={styleQuickMoods}>
                <View style={styles.quickSection}>
                  <Text style={styles.quickTitle}>{t('mood.quickMoodsTitle')}</Text>
                  <Text style={styles.quickSubtitle}>{t('mood.quickMoodsSubtitle')}</Text>
                  <View style={styles.quickGrid}>
                    {QUICK_MOODS.map((item) => {
                      const prompt = t(item.promptKey);
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.quickCard,
                            moodText === prompt && styles.quickCardActive,
                          ]}
                          onPress={() => handleQuickMood(prompt)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.quickEmoji}>{item.emoji}</Text>
                          <Text
                            style={[
                              styles.quickLabel,
                              moodText === prompt && styles.quickLabelActive,
                            ]}
                            numberOfLines={1}
                          >
                            {t(item.labelKey)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </Animated.View>

              {/* ── Browse by Genre ─────────────────────────────────────────── */}
              <Animated.View style={style5}>
                <View style={styles.genreSection}>
                  <Text style={styles.sectionTitle}>{t('mood.browseByGenre')}</Text>
                  <Text style={styles.sectionSubtitle}>{t('mood.browseByGenreSubtitle')}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.genreScroll}
                  >
                    {GENRES.map((genre) => (
                      <TouchableOpacity
                        key={genre.id}
                        style={styles.genreCard}
                        onPress={() => handleGenreTap(genre)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.genreEmoji}>{genre.emoji}</Text>
                        <Text style={styles.genreLabel}>{t(genre.labelKey)}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </Animated.View>

            </ScrollView>
          </KeyboardAvoidingView>
        </LinearGradient>
      </SafeAreaView>

      <AIProcessingOverlay visible={phase === 'processing'} t={t} />
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },

  // ─── Lumi Hero ─────────────────────────────────────────────────────────────

  lumiHero: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 8,
  },
  lumiGlow: {
    position: 'absolute',
    top: 10,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(212,168,67,0.06)',
  },
  speechBubble: {
    marginTop: 16,
    backgroundColor: 'rgba(26,31,53,0.8)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.15)',
  },
  speechText: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    color: Colors.textWhite,
    textAlign: 'center',
    lineHeight: 26,
  },

  // ─── Filtre ────────────────────────────────────────────────────────────────

  filterBlock: {
    marginTop: 16,
  },
  filterLabel: {
    fontSize: 11,
    color: Colors.textGrey,
    marginBottom: 8,
    paddingHorizontal: 20,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chipRow: {
    paddingHorizontal: 20,
  },
  chip: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.chipInactiveBorder,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: Colors.chipActiveBg,
    borderColor: Colors.chipActiveBg,
  },
  chipText: {
    fontSize: 13,
    color: Colors.chipInactiveText,
  },
  chipTextActive: {
    color: Colors.chipActiveText,
    fontWeight: '600',
  },

  // ─── Lumi typing indicator ────────────────────────────────────────────────

  lumiInputIndicator: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },

  // ─── TextInput ─────────────────────────────────────────────────────────────

  textInput: {
    backgroundColor: 'rgba(26,31,53,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.15)',
    borderRadius: 16,
    height: 100,
    padding: 16,
    color: Colors.textWhite,
    fontSize: 14,
    textAlignVertical: 'top',
    marginTop: 16,
    marginHorizontal: 20,
  },
  textInputActive: {
    borderColor: 'rgba(212,168,67,0.5)',
  },

  // ─── Hata banner ──────────────────────────────────────────────────────────

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 12,
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

  // ─── Find Movies butonu ────────────────────────────────────────────────────

  findButton: {
    backgroundColor: Colors.gold,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginHorizontal: 20,
  },
  findButtonDisabled: {
    backgroundColor: 'rgba(212,168,67,0.3)',
  },
  findButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },

  // ─── Quick Moods ──────────────────────────────────────────────────────────

  quickSection: {
    marginTop: 28,
    paddingHorizontal: 20,
  },
  quickTitle: {
    fontSize: 20,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.textWhite,
    marginBottom: 4,
  },
  quickSubtitle: {
    fontSize: 13,
    color: Colors.textGrey,
    marginBottom: 14,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white05,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  quickCardActive: {
    borderColor: Colors.accentPrimary,
    backgroundColor: Colors.accentDim,
  },
  quickEmoji: {
    fontSize: 18,
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textGrey,
  },
  quickLabelActive: {
    color: Colors.accentPrimary,
  },

  // ─── Section başlıkları ────────────────────────────────────────────────────

  sectionTitle: {
    fontSize: 20,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.textWhite,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.textGrey,
    marginBottom: 14,
  },

  // ─── Genre bölümü ──────────────────────────────────────────────────────────

  genreSection: {
    marginTop: 28,
    paddingLeft: 20,
  },
  genreScroll: {
    paddingRight: 20,
    gap: 10,
  },
  genreCard: {
    width: 90,
    height: 90,
    backgroundColor: Colors.white05,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.white10,
  },
  genreEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  genreLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },

});
