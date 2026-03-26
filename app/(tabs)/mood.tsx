/**
 * Mood sekmesi — duygu giriş akışı + AI Processing + Mood Profile Result + Mood History.
 *
 * Aşamalar:
 *   input      — Lumi + filtreler + metin girişi + "Find Movies" + Mood History
 *   processing — AIProcessingOverlay (modal overlay)
 *   result     — MoodProfileResult; "Browse Movies" → Feed sekmesine geçer
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import AIProcessingOverlay from '@/components/AIProcessingOverlay';
import EmptyState from '@/components/EmptyState';
import Lumi from '@/components/Lumi';
import MoodProfileResult from '@/components/MoodProfileResult';
import { Colors } from '@/constants/Colors';
import { useStaggeredEntry } from '@/hooks/useStaggeredEntry';
import { useScalePress } from '@/hooks/useScalePress';
import { hapticMedium, hapticSelection } from '@/utils/haptics';
import { Locale } from '@/constants/i18n';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMood } from '@/contexts/MoodContext';
import { supabase } from '@/services/supabase';
import { getPosterUrl } from '@/services/tmdb';
import { getAppUserId } from '@/services/watchlist';
import { parseMood } from '@/services/tasteParser';
import { FilmFilters, TasteProfile } from '@/types';
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

const YEAR_CHIPS: { id: YearChipId; label: string }[] = [
  { id: 'pre1990', label: 'Classic' },
  { id: '1990s', label: '90s' },
  { id: '2000s', label: '2000s' },
  { id: '2010s', label: '2010s' },
  { id: '2020s', label: 'Recent' },
  { id: '', label: 'Any' },
];

const RATING_CHIPS: { id: RatingChipId; label: string }[] = [
  { id: '7', label: '7+' },
  { id: '8', label: '8+' },
  { id: 'top250', label: 'Top 250' },
  { id: '', label: 'Any' },
];

// ─── Mood History helpers ─────────────────────────────────────────────────────

/** Bir mood oturumunun görüntüleme verisi */
interface MoodSession {
  id: string;
  createdAt: string;
  rawInput: string;
  recommendationCount: number;
  posterUrls: string[];
}

/** Supabase swipes satır tipi */
interface SwipeRow {
  session_id: string;
  films: { poster_url: string | null } | { poster_url: string | null }[] | null;
}

/** ISO tarih string'ini uzun formata dönüştürür ("March 14, 2026"). */
function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Kullanıcının mood oturumlarını Supabase'den çeker.
 */
async function fetchMoodSessions(): Promise<MoodSession[]> {
  const appUserId = await getAppUserId();
  if (!appUserId) return [];

  const { data: sessionRows, error: sessErr } = await supabase
    .from('sessions')
    .select('id, created_at, raw_input')
    .eq('user_id', appUserId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (sessErr || !sessionRows || sessionRows.length === 0) return [];

  const sessionIds = sessionRows.map((s) => s.id as string);

  const { data: swipeRows } = await supabase
    .from('swipes')
    .select('session_id, films!film_id ( poster_url )')
    .in('session_id', sessionIds);

  const swipesBySession = new Map<string, SwipeRow[]>();
  for (const row of swipeRows ?? []) {
    const sid = row.session_id as string;
    if (!swipesBySession.has(sid)) swipesBySession.set(sid, []);
    swipesBySession.get(sid)!.push(row as SwipeRow);
  }

  return sessionRows.map((s) => {
    const swipes = swipesBySession.get(s.id as string) ?? [];
    const posterUrls = swipes
      .slice(0, 3)
      .map((sw) => {
        const f = sw.films;
        const path = Array.isArray(f) ? f[0]?.poster_url ?? null : f?.poster_url ?? null;
        return getPosterUrl(path, 'w92');
      })
      .filter((url): url is string => Boolean(url));

    return {
      id: s.id as string,
      createdAt: s.created_at as string,
      rawInput: (s.raw_input as string | null) ?? '',
      recommendationCount: swipes.length,
      posterUrls,
    };
  });
}

// ─── PosterStack ──────────────────────────────────────────────────────────────

/**
 * 2-3 film posterini fan açılmış şekilde gösterir.
 */
function PosterStack({ urls }: { urls: string[] }) {
  const count = Math.min(urls.length, 3);

  if (count === 0) {
    return (
      <View style={stackStyles.empty}>
        <Ionicons name="film-outline" size={18} color={Colors.textGrey} />
      </View>
    );
  }

  const STEP = 25;
  const containerWidth = 40 + STEP * (count - 1) + 12;
  const rotations = [-8, -2, 5];

  return (
    <View style={[stackStyles.container, { width: containerWidth }]}>
      {Array.from({ length: count }).map((_, i) => (
        <Image
          key={i}
          source={{ uri: urls[i] }}
          style={[
            stackStyles.poster,
            {
              left: i * STEP,
              transform: [{ rotate: `${rotations[i]}deg` }],
              zIndex: i + 1,
            },
          ]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ))}
    </View>
  );
}

const stackStyles = StyleSheet.create({
  container: {
    height: 76,
    position: 'relative',
  },
  poster: {
    position: 'absolute',
    width: 40,
    height: 60,
    borderRadius: 6,
    backgroundColor: Colors.card,
    top: 8,
  },
  empty: {
    width: 52,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white05,
    borderRadius: 8,
  },
});

// ─── MoodHistoryCard ──────────────────────────────────────────────────────────

interface MoodHistoryCardProps {
  session: MoodSession;
  index: number;
}

/**
 * Tek mood geçmişi kartı — useStaggeredEntry ile kademeli giriş.
 */
function MoodHistoryCard({ session, index }: MoodHistoryCardProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const animStyle = useStaggeredEntry(index + 6, { delay: 60 });

  return (
    <Animated.View style={animStyle}>
      <View style={styles.card}>
        {/* Sol: poster stack */}
        <View style={styles.cardLeft}>
          <PosterStack urls={session.posterUrls} />
        </View>

        {/* Orta: metin bilgileri */}
        <View style={styles.cardBody}>
          <Text style={styles.cardDate}>
            {formatDate(session.createdAt, language as Locale)}
          </Text>
          <Text style={styles.cardMood} numberOfLines={2}>
            {session.rawInput || '—'}
          </Text>
          <Text style={styles.cardStats}>
            {t('profile.recsGenerated', { count: session.recommendationCount })}
          </Text>
        </View>

        {/* Sağ: view butonu */}
        <TouchableOpacity
          style={styles.cardViewBtn}
          onPress={() => router.navigate('/(tabs)')}
          activeOpacity={0.7}
        >
          <Text style={styles.cardViewText}>{t('profile.view')}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

/**
 * Mood sekmesi — yeni tasarım.
 * Lumi maskot + filtreler + metin girişi + mood geçmişi.
 */
export default function MoodScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { setMoodResult } = useMood();

  const [phase, setPhase] = useState<Phase>('input');
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const [sessions, setSessions] = useState<MoodSession[]>([]);

  /** Metin giriş state'i */
  const [moodText, setMoodText] = useState('');
  /** Seçili yıl filtresi */
  const [yearChip, setYearChip] = useState<YearChipId>('');
  /** Seçili IMDb filtresi */
  const [ratingChip, setRatingChip] = useState<RatingChipId>('');
  /** Lumi duygu durumu — yazarken 'thinking', durduğunda 'idle' */
  const [lumiMood, setLumiMood] = useState<'idle' | 'thinking'>('idle');

  const pendingFilters = useRef<FilmFilters | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Giriş animasyonları ────────────────────────────────────────────────────
  const style0 = useStaggeredEntry(0);
  const style1 = useStaggeredEntry(1);
  const style2 = useStaggeredEntry(2);
  const style3 = useStaggeredEntry(3);
  const style4 = useStaggeredEntry(4);
  const style5 = useStaggeredEntry(5);
  const { animatedStyle: btnAnimStyle, onPressIn: btnPressIn, onPressOut: btnPressOut } = useScalePress(0.95);

  /** Typing timeout cleanup */
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  /** Sekmeye her odaklanıldığında geçmişi yenile */
  useFocusEffect(
    useCallback(() => {
      if (phase !== 'input') return;
      let active = true;
      fetchMoodSessions()
        .then((data) => {
          if (active) setSessions(data);
        })
        .catch((err) => {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.error('[MoodScreen] fetchMoodSessions hatası:', err);
          }
        });
      return () => {
        active = false;
      };
    }, [phase]),
  );

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
      const [profile] = await Promise.all([
        parseMood(trimmed),
        new Promise<void>((resolve) => setTimeout(resolve, MIN_PROCESSING_MS)),
      ]);

      if (filters.yearRange !== null) {
        profile.era_preference = yearRangeToEra(filters.yearRange);
      }

      setTasteProfile(profile);
      setPhase('result');
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[MoodScreen] parseMood hatası:', err instanceof Error ? err.message : err);
      }
      setPhase('input');
      Alert.alert(t('errors.generic'), t('errors.loadRecommendations'));
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

  // ── MoodProfileResult aşaması ──────────────────────────────────────────────
  if (phase === 'result' && tasteProfile) {
    return (
      <>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <MoodProfileResult
          profile={tasteProfile}
          onBack={() => setPhase('input')}
          onBrowseMovies={handleBrowseMovies}
        />
      </>
    );
  }

  const canSubmit = moodText.trim().length > 0 && phase !== 'processing';

  const lumiSpeechText =
    moodText.length === 0
      ? 'What kind of movie experience\nare you looking for?'
      : moodText.length < 10
        ? 'Tell me more...'
        : moodText.length < 30
          ? 'Interesting... I have some ideas'
          : 'I know exactly what you need';

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
                  <Text style={styles.filterLabel}>ERA</Text>
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
                            {chip.label}
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
                  <Text style={styles.filterLabel}>QUALITY</Text>
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
                            {chip.label}
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
                  placeholder="A rainy evening mood, something contemplative..."
                  placeholderTextColor={Colors.textGrey}
                  multiline
                  textAlignVertical="top"
                />
              </Animated.View>

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
                  <Text style={styles.findButtonText}>Find Movies</Text>
                </TouchableOpacity>
              </Animated.View>

              {/* ── Mood History ─────────────────────────────────────────────── */}
              <Animated.View style={style5}>
                <View style={styles.historySection}>
                  <Text style={styles.historyTitle}>{t('profile.moodHistory')}</Text>

                  {sessions.length === 0 ? (
                    <EmptyState
                      lumiMood="calm"
                      lumiSize="small"
                      title="Your mood journey starts here"
                      subtitle="Describe how you feel to get personalized recommendations"
                    />
                  ) : (
                    sessions.map((session, idx) => (
                      <MoodHistoryCard key={session.id} session={session} index={idx} />
                    ))
                  )}
                </View>
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        </LinearGradient>
      </SafeAreaView>

      <AIProcessingOverlay visible={phase === 'processing'} />
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

  // ─── History bölümü ────────────────────────────────────────────────────────

  historySection: {
    marginTop: 32,
  },
  historyTitle: {
    fontSize: 24,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.textWhite,
    paddingHorizontal: 20,
    marginBottom: 16,
  },

  // ─── History kartı ─────────────────────────────────────────────────────────

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardSolid,
    borderRadius: 14,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  cardLeft: {
    marginRight: 14,
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    justifyContent: 'center',
  },
  cardDate: {
    fontSize: 11,
    color: Colors.textGrey,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  cardMood: {
    fontSize: 15,
    color: Colors.textWhite,
    fontWeight: '700',
    lineHeight: 21,
    marginBottom: 4,
  },
  cardStats: {
    fontSize: 11,
    color: Colors.textGrey,
    lineHeight: 16,
  },
  cardViewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
    flexShrink: 0,
  },
  cardViewText: {
    fontSize: 14,
    color: Colors.gold,
    fontWeight: '700',
  },

  // ─── Boş durum ─────────────────────────────────────────────────────────────

  emptyState: {
    marginHorizontal: 20,
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    color: Colors.textWhite,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textGrey,
    textAlign: 'center',
    lineHeight: 20,
  },
});
