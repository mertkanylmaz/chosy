/**
 * Home sekmesi — mood-first, ilham veren, minimal dashboard.
 *
 * UX Redesign v2 — Section'lar:
 *   1. Compact Header: logo + archetype badge
 *   2. Hero Mood Input: buyuk TextInput + animated placeholder
 *   3. Quick Mood Chips: yatay scroll pill'ler
 *   4. Son Aramalar: son 3 mood session (conditional)
 *   5. Bugunun Filmi: Today's Pick kart (conditional)
 *   6. Watchlist Strip: yatay poster strip (conditional)
 *
 * Kaldirilan: GreetingWidget, eski Hero CTA, Games Widget,
 *   Referral CTA, Archetype section, Last Added kart
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn, FadeOut } from 'react-native-reanimated';

import * as Sentry from '@sentry/react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { getArchetype } from '@/constants/archetypes';
import { QUICK_CHIPS, type QuickChip } from '@/constants/quickChips';
import { getHomeData, type HomeData } from '@/services/homeService';
import { getDailyMatch, getDailyMatchByPreferences } from '@/services/dailyMatch';
import { getLastParsedProfile, getMoodHistory } from '@/services/profileService';
import { getArchetypeProfile } from '@/services/archetypeEngine';
import { getAppUserId, getWatchlist } from '@/services/watchlist';
import SkeletonLoader from '@/components/SkeletonLoader';
import { logger } from '@/utils/logger';
import { localizeGenre } from '@/utils/filmFilters';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { posthogAnalytics } from '@/services/posthog';
import type { Film } from '@/types/film';
import type { MoodHistoryItem } from '@/types/profile';
import type { WatchlistItem } from '@/services/watchlist';

// ── Sabitler ─────────────────────────────────────────────────────────────────

const TMDB_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_W185 = 'https://image.tmdb.org/t/p/w185';
const { width: SCREEN_W } = Dimensions.get('window');
/** Placeholder rotation interval (ms) */
const PLACEHOLDER_INTERVAL = 3000;

// ── Yardimci ─────────────────────────────────────────────────────────────────

/** Poster URL cozumle */
function resolvePoster(url: string | undefined | null, size: 'w500' | 'w185' = 'w500'): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${size === 'w185' ? TMDB_W185 : TMDB_BASE}${url}`;
}

// ── Ana Ekran ────────────────────────────────────────────────────────────────

/**
 * Home sekmesi — mood-first, minimal dashboard.
 */
export default function HomeScreen() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [dailyFilm, setDailyFilm] = useState<Film | null>(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [moodHistory, setMoodHistory] = useState<MoodHistoryItem[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  /** Section skeleton gorunurlugu — ilk yuklemede true, veri gelince false */
  const [sectionsLoading, setSectionsLoading] = useState(true);

  // ── Hero input state ────────────────────────────────────────────────────────
  const [moodText, setMoodText] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // ── Placeholder texts ────────────────────────────────────────────────────────
  // i18n-js array dot-notation desteklemiyor (t('key.0') calismaz).
  // Locale JSON'daki array'i dil bazli dogrudan import ediyoruz.
  const placeholders = useMemo(() => {
    const localeData = language === 'tr'
      ? require('../../locales/tr.json')
      : require('../../locales/en.json');
    const arr = localeData?.home?.heroPlaceholders;
    if (Array.isArray(arr) && arr.length > 0) return arr as string[];
    return [
      'a rainy evening mood...',
      'something mind-bending',
      'fun night with friends',
      'a nostalgic journey',
      'edge-of-seat thriller',
      'heartwarming feel-good',
    ];
  }, [language]);

  // Placeholder rotation — placeholders.length'e gore doner
  useEffect(() => {
    const len = placeholders.length;
    const timer = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % len);
    }, PLACEHOLDER_INTERVAL);
    return () => clearInterval(timer);
  }, [placeholders.length]);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const [data, userId] = await Promise.all([
        getHomeData(),
        getAppUserId(),
      ]);
      setHomeData(data);

      if (!userId) { setSectionsLoading(false); return; }

      // Paralel yukle: mood history, watchlist — bireysel hata izolasyonu
      const [historyResult, wlResult] = await Promise.allSettled([
        getMoodHistory(userId),
        getWatchlist(),
      ]);

      if (historyResult.status === 'fulfilled') {
        setMoodHistory(historyResult.value.slice(0, 3));
      } else {
        Sentry.captureException(historyResult.reason, {
          tags: { screen: 'HomeScreen', fn: 'loadData.getMoodHistory' },
        });
        logger.error('[HomeScreen] getMoodHistory hatasi:', historyResult.reason);
      }

      const wl = wlResult.status === 'fulfilled' ? wlResult.value : [];
      if (wlResult.status === 'rejected') {
        Sentry.captureException(wlResult.reason, {
          tags: { screen: 'HomeScreen', fn: 'loadData.getWatchlist' },
        });
        logger.error('[HomeScreen] getWatchlist hatasi:', wlResult.reason);
      }
      setWatchlistItems(wl.slice(0, 6));
      setSectionsLoading(false);

      // Daily pick cascade
      if (data.archetypeId) {
        try {
          const seenIds = wl.map((w) => w.film.id);
          const lastProfile = await getLastParsedProfile(userId);

          let film = await getDailyMatchByPreferences(userId, seenIds);
          if (!film) {
            film = await getDailyMatch(userId, lastProfile, seenIds);
          }
          if (!film) {
            const archetypeProfile = getArchetypeProfile(data.archetypeId);
            film = await getDailyMatch(userId, archetypeProfile, seenIds);
          }
          setDailyFilm(film);
        } catch (err) {
          logger.error('[HomeScreen] daily pick hatasi:', err);
        }
      }
    } catch (err) {
      logger.error('[HomeScreen] veri yukleme hatasi:', err);
      setSectionsLoading(false);
    } finally {
      setDailyLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setDailyLoading(true);
      setDailyFilm(null);
      loadData();

      // Analytics
      const sections: string[] = ['header', 'hero', 'quick_moods'];
      // Note: conditional sections will be tracked after data loads
      posthogAnalytics.track('home_screen_viewed', { sections_visible: sections.join(',') });
    }, [loadData]),
  );

  // ── Mood submit (Home → Discover tab) ───────────────────────────────────────

  /** Mood text'i ile Discover tab'a navigate et */
  const submitMood = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    hapticMedium();
    Keyboard.dismiss();

    posthogAnalytics.track('home_mood_input_submitted', {
      text: trimmed,
      source: 'typed',
    });

    // Discover (mood) tab'a prefill param ile navigate
    router.push({
      pathname: '/(tabs)/mood',
      params: { prefill: trimmed },
    } as never);

    // Input'u temizle (geri donunce bos olsun)
    setMoodText('');
  }, [router]);

  /** Quick mood chip tap */
  const handleQuickChip = useCallback((chip: QuickChip) => {
    hapticLight();
    posthogAnalytics.track('home_quick_mood_tapped', { mood: chip.id });
    submitMood(chip.prompt);
  }, [submitMood]);

  /** Recent search tap */
  const handleRecentSearch = useCallback((item: MoodHistoryItem) => {
    hapticLight();
    posthogAnalytics.track('home_recent_search_tapped', { mood_text: item.mood_text });
    submitMood(item.mood_text);
  }, [submitMood]);

  // ── Turetilen veriler ──────────────────────────────────────────────────────

  const archetype = homeData?.archetypeId ? getArchetype(homeData.archetypeId) : null;
  const dailyPosterUrl = resolvePoster(dailyFilm?.posterUrl);
  const hasRecentSearches = moodHistory.length > 0;
  const hasWatchlist = watchlistItems.length > 0;
  const hasDailyFilm = !dailyLoading && dailyFilm != null;

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 12, paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Section 1: Compact Header ──────────────────────────────── */}
        <View style={styles.headerRow}>
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={styles.logoText}>chosy</Text>
          </View>

          {/* Archetype badge — tappable, Profile'a navigate */}
          <TouchableOpacity
            style={styles.archetypeBadge}
            onPress={() => { hapticLight(); router.push('/(tabs)/profile'); }}
            activeOpacity={0.8}
          >
            {archetype ? (
              <Image source={archetype.image} style={styles.archetypeBadgeIcon} contentFit="contain" />
            ) : (
              <Ionicons name="person-circle-outline" size={28} color={Colors.textGrey} />
            )}
          </TouchableOpacity>
        </View>

        {/* ── Section 2: Hero Mood Input ─────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(50).duration(400).springify().damping(18)}
          style={styles.heroCard}
        >
          <Text style={styles.heroLabel}>{t('home.heroPlaceholder')}</Text>
          <View style={styles.heroInputRow}>
            <TextInput
              ref={inputRef}
              style={styles.heroInput}
              value={moodText}
              onChangeText={setMoodText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholders[placeholderIndex]}
              placeholderTextColor={Colors.textTertiary}
              multiline
              returnKeyType="search"
              onSubmitEditing={() => submitMood(moodText)}
              blurOnSubmit
            />
            {/* Submit button */}
            <TouchableOpacity
              style={[
                styles.heroSubmitBtn,
                moodText.trim().length === 0 && styles.heroSubmitBtnDisabled,
              ]}
              onPress={() => submitMood(moodText)}
              disabled={moodText.trim().length === 0}
              activeOpacity={0.8}
            >
              <Ionicons
                name="arrow-forward"
                size={20}
                color={moodText.trim().length > 0 ? Colors.textOnAccent : Colors.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Section 3: Quick Mood Chips ─────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400).springify().damping(18)}
          style={styles.quickChipsSection}
        >
          <FlatList
            data={QUICK_CHIPS}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.quickChipsContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.quickChip}
                onPress={() => handleQuickChip(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickChipText}>{t(item.labelKey)}</Text>
              </TouchableOpacity>
            )}
          />
        </Animated.View>

        {/* ── Section 4: Son Aramalar (skeleton + conditional) ──────── */}
        {sectionsLoading && (
          <View style={styles.section}>
            <SkeletonLoader width={130} height={16} borderRadius={6} style={{ marginLeft: 16 }} />
            <View style={styles.skeletonRow}>
              <SkeletonLoader width={160} height={90} borderRadius={14} />
              <SkeletonLoader width={160} height={90} borderRadius={14} />
            </View>
          </View>
        )}
        {!sectionsLoading && hasRecentSearches && (
          <Animated.View
            entering={FadeInDown.delay(150).duration(400).springify().damping(18)}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>{t('home.recentSearches')}</Text>
            <FlatList
              data={moodHistory}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.session_id}
              contentContainerStyle={styles.recentSearchContent}
              renderItem={({ item }) => {
                const posters = (item.saved_posters ?? []).slice(0, 3);
                return (
                  <TouchableOpacity
                    style={styles.recentCard}
                    onPress={() => handleRecentSearch(item)}
                    activeOpacity={0.8}
                  >
                    {/* Poster stack — ust uste binmis */}
                    <View style={styles.posterStack}>
                      {posters.map((p, i) => {
                        const uri = resolvePoster(p, 'w185');
                        return uri ? (
                          <Image
                            key={i}
                            source={{ uri }}
                            style={[
                              styles.stackPoster,
                              { left: i * 14, zIndex: 3 - i },
                            ]}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                          />
                        ) : null;
                      })}
                      {posters.length === 0 && (
                        <View style={styles.stackPosterEmpty}>
                          <Ionicons name="film-outline" size={18} color={Colors.textGrey} />
                        </View>
                      )}
                    </View>
                    <Text style={styles.recentText} numberOfLines={2}>
                      {item.mood_text}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </Animated.View>
        )}

        {/* ── Section 5: Bugunun Filmi (skeleton + conditional) ──────── */}
        {dailyLoading && (
          <View style={styles.section}>
            <SkeletonLoader width={120} height={16} borderRadius={6} style={{ marginLeft: 16 }} />
            <SkeletonLoader width={SCREEN_W - 32} height={140} borderRadius={16} style={{ marginLeft: 16 }} />
          </View>
        )}
        {hasDailyFilm && dailyFilm && dailyPosterUrl && (
          <Animated.View
            entering={FadeInDown.delay(200).duration(400).springify().damping(18)}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>{t('home.todaysFilm')}</Text>
            <TouchableOpacity
              style={styles.dailyCard}
              onPress={() => {
                hapticLight();
                posthogAnalytics.track('home_daily_pick_tapped', { film_id: dailyFilm.id });
                router.push(`/film/${dailyFilm.id}`);
              }}
              activeOpacity={0.85}
            >
              {/* Blurred poster background */}
              <Image
                source={{ uri: dailyPosterUrl }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                cachePolicy="memory-disk"
                blurRadius={15}
              />
              <View style={styles.dailyCardOverlay} />
              {/* Content */}
              <View style={styles.dailyCardContent}>
                <Image
                  source={{ uri: dailyPosterUrl }}
                  style={styles.dailyPoster}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
                <View style={styles.dailyMeta}>
                  <Text style={styles.dailyTitle} numberOfLines={2}>
                    {dailyFilm.title}
                  </Text>
                  <Text style={styles.dailySubtitle} numberOfLines={1}>
                    {dailyFilm.year}{dailyFilm.director ? ` \u00B7 ${dailyFilm.director}` : ''}
                  </Text>
                  {dailyFilm.matchScore > 0 && (
                    <View style={styles.matchBadge}>
                      <Text style={styles.matchBadgeText}>{dailyFilm.matchScore}% match</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textGrey} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Section 6: Watchlist Strip (skeleton + conditional) ────── */}
        {sectionsLoading && (
          <View style={styles.section}>
            <SkeletonLoader width={160} height={16} borderRadius={6} style={{ marginLeft: 16 }} />
            <View style={styles.skeletonRow}>
              <SkeletonLoader width={100} height={150} borderRadius={12} />
              <SkeletonLoader width={100} height={150} borderRadius={12} />
              <SkeletonLoader width={100} height={150} borderRadius={12} />
            </View>
          </View>
        )}
        {!sectionsLoading && hasWatchlist && (
          <Animated.View
            entering={FadeInDown.delay(250).duration(400).springify().damping(18)}
            style={styles.section}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('home.fromWatchlist')}</Text>
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  router.push('/watchlist-detail' as never);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.seeAllText}>{t('home.seeAll')}</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={watchlistItems}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.film.id}
              contentContainerStyle={styles.watchlistContent}
              renderItem={({ item }) => {
                const uri = resolvePoster(item.film.posterUrl, 'w185');
                return (
                  <TouchableOpacity
                    style={styles.watchlistCard}
                    onPress={() => {
                      hapticLight();
                      posthogAnalytics.track('home_watchlist_pick_tapped', { film_id: item.film.id });
                      router.push(`/film/${item.film.id}`);
                    }}
                    activeOpacity={0.85}
                  >
                    {uri ? (
                      <Image
                        source={{ uri }}
                        style={styles.watchlistPoster}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={200}
                      />
                    ) : (
                      <View style={[styles.watchlistPoster, styles.watchlistPosterEmpty]}>
                        <Ionicons name="film-outline" size={24} color={Colors.textGrey} />
                      </View>
                    )}
                    <Text style={styles.watchlistTitle} numberOfLines={1}>
                      {item.film.title}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </Animated.View>
        )}

      </ScrollView>
    </View>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 28,
  },

  // ── Skeleton ─────────────────────────────────────────────────────────────────
  skeletonRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 36,
    height: 36,
    opacity: 0.95,
  },
  logoText: {
    color: Colors.goldLight,
    fontSize: 20,
    fontFamily: 'PlayfairDisplay_400Regular',
    letterSpacing: 0.4,
  },
  archetypeBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white05,
    borderWidth: 1,
    borderColor: Colors.white10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  archetypeBadgeIcon: {
    width: 28,
    height: 28,
  },

  // ── Hero Mood Input ────────────────────────────────────────────────────────
  heroCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.bgElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 20,
    gap: 12,
  },
  heroLabel: {
    fontSize: Theme.typography.h3.fontSize,
    lineHeight: Theme.typography.h3.lineHeight,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  heroInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  heroInput: {
    flex: 1,
    fontSize: Theme.typography.body.fontSize,
    fontWeight: '400',
    color: Colors.textPrimary,
    lineHeight: Theme.typography.body.lineHeight,
    minHeight: 60,
    maxHeight: 100,
    textAlignVertical: 'top',
    padding: 0,
  },
  heroSubmitBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroSubmitBtnDisabled: {
    backgroundColor: Colors.bgSubtle,
  },

  // ── Quick Mood Chips ───────────────────────────────────────────────────────
  quickChipsSection: {
    marginTop: -12, // section gap azalt — hero'ya yakin dursun
  },
  quickChipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  quickChipText: {
    fontSize: Theme.typography.caption.fontSize,
    lineHeight: Theme.typography.caption.lineHeight,
    fontWeight: '500',
    color: Colors.textSecondary,
  },

  // ── Section shared ────────────────────────────────────────────────────────
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: Theme.typography.h3.fontSize,
    lineHeight: Theme.typography.h3.lineHeight,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    paddingHorizontal: 16,
  },
  seeAllText: {
    fontSize: Theme.typography.caption.fontSize,
    fontWeight: '600',
    color: Colors.accentPrimary,
  },

  // ── Recent Searches ───────────────────────────────────────────────────────
  recentSearchContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  recentCard: {
    width: 160,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 12,
    gap: 10,
  },
  posterStack: {
    height: 44,
    position: 'relative',
    width: 60,
  },
  stackPoster: {
    position: 'absolute',
    top: 0,
    width: 32,
    height: 44,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.bgCard,
  },
  stackPosterEmpty: {
    width: 32,
    height: 44,
    borderRadius: 6,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentText: {
    fontSize: Theme.typography.caption.fontSize,
    fontWeight: '500',
    color: Colors.textSecondary,
    lineHeight: Theme.typography.caption.lineHeight,
  },

  // ── Daily Film ────────────────────────────────────────────────────────────
  dailyCard: {
    marginHorizontal: 16,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  dailyCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,15,0.75)',
  },
  dailyCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 14,
  },
  dailyPoster: {
    width: 75,
    height: 112,
    borderRadius: 12,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  dailyMeta: {
    flex: 1,
    gap: 4,
  },
  dailyTitle: {
    fontSize: Theme.typography.h3.fontSize,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.textPrimary,
    lineHeight: Theme.typography.h3.lineHeight,
  },
  dailySubtitle: {
    fontSize: Theme.typography.caption.fontSize,
    color: Colors.textSecondary,
    letterSpacing: 0.1,
  },
  matchBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accentPrimary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  matchBadgeText: {
    color: Colors.textOnAccent,
    fontSize: Theme.typography.micro.fontSize,
    fontWeight: '700',
  },

  // ── Watchlist Strip ───────────────────────────────────────────────────────
  watchlistContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  watchlistCard: {
    width: 100,
    gap: 6,
  },
  watchlistPoster: {
    width: 100,
    height: 150,
    borderRadius: 12,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  watchlistPosterEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.white10,
    borderStyle: 'dashed',
  },
  watchlistTitle: {
    fontSize: Theme.typography.caption.fontSize,
    fontWeight: '500',
    color: Colors.textSecondary,
    paddingHorizontal: 2,
  },
});
