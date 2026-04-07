/**
 * Profil ekranı — kullanıcının sinema kimliği.
 *
 * P3.4 Stable Revision (2026-04-06):
 *   Crash-prone ve P5'te kaldirilacak section'lar temizlendi.
 *   Crash nedeni: GenreDonutChart (react-native-svg native crash) +
 *   var olmayan RPCs (tonight_pick, get_user_stats, get_mood_timeline).
 *
 * Aktif section'lar:
 *  1. Profile Header (avatar + isim + #id + son mood)
 *  2. Taste DNA (son profil ozeti)
 *  3. Daily Streak
 *  4. Discovery Stats
 *  5. Watchlist Preview
 *  6. Settings (dil, watchlist temizle)
 *
 * Tasarim referansi: design-reference/05-profile.png
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/services/supabase';
import { logger } from '@/utils/logger';
import { useLanguage } from '@/contexts/LanguageContext';
import { Colors } from '@/constants/Colors';
import { useStaggeredEntry } from '@/hooks/useStaggeredEntry';
import { hapticLight, hapticSelection } from '@/utils/haptics';
import { Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import TasteDNA from '@/components/Profile/TasteDNA';
import DiscoveryStats from '@/components/Profile/DiscoveryStats';
import WatchlistPreview from '@/components/Profile/WatchlistPreview';
import ErrorState from '@/components/ErrorState';
import StreakCard from '@/components/Profile/StreakCard';
import type { StreakCardProps } from '@/components/Profile/StreakCard';
import {
  getLastParsedProfile,
  getMoodHistory,
  getSwipeInsights,
  getUserStats,
} from '@/services/profileService';
import { computeArchetype } from '@/services/archetypeEngine';
import { getDailyMatch } from '@/services/dailyMatch';
import PersonaBadge from '@/components/Profile/PersonaBadge';
import DailyMatchCard from '@/components/Profile/DailyMatchCard';
import { getWatchlist } from '@/services/watchlist';
import {
  getStreakInfo,
  getAllMilestones,
  getUserMilestones,
} from '@/services/gamification';
import type { StreakInfo } from '@/services/gamification';

import type { MoodHistoryItem, SwipeInsight, UserStats } from '@/types/profile';
import type { TasteProfile } from '@/types/index';
import type { WatchlistItem } from '@/services/watchlist';
import type { Film } from '@/types/film';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

type Locale = 'en' | 'tr';

const LANGUAGES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'tr', label: 'TR' },
];

/** AsyncStorage anahtari */
const AVATAR_STORAGE_KEY = 'chosy_user_avatar';

/** 12 preset emoji avatar */
const AVATAR_OPTIONS = ['🎬', '🎭', '🎪', '🌙', '🎵', '🎨', '🔮', '🌟', '🎯', '🍿', '🎸', '🌌'];

// ─── Section Heading ──────────────────────────────────────────────────────────

/**
 * Sol altin accent cizgili bolum basligi.
 */
function SectionHeading({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeadingRow}>
      <View style={styles.sectionHeadingAccent} />
      <Text style={styles.sectionHeadingText}>{title}</Text>
    </View>
  );
}

// ─── Section Card Wrapper ─────────────────────────────────────────────────────

/**
 * Bolum basligi + icerik kart sarmalayici — Settings icin kullanilir.
 */
function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color={Colors.gold} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ─── Avatar Modal ─────────────────────────────────────────────────────────────

interface AvatarModalProps {
  /** Modal gorunur mu */
  visible: boolean;
  /** Mevcut secili avatar */
  current: string | null;
  /** Kapatma callback */
  onClose: () => void;
  /** Secim callback */
  onSelect: (emoji: string) => void;
}

/**
 * Avatar secim modali — 12 emoji preset, 3x4 grid, altin border secim gostergesi.
 */
function AvatarModal({ visible, current, onClose, onSelect }: AvatarModalProps) {
  const { t } = useLanguage();
  const [temp, setTemp] = useState<string | null>(current);

  useEffect(() => {
    if (visible) {
      setTemp(current);
    }
  }, [visible, current]);

  function handleSelect() {
    if (temp) {
      onSelect(temp);
    }
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t('profile.avatarTitle')}</Text>

          {/* 3x4 avatar grid */}
          <View style={styles.avatarGrid}>
            {AVATAR_OPTIONS.map((emoji) => {
              const isSelected = temp === emoji;
              return (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.avatarOption, isSelected && styles.avatarOptionSelected]}
                  onPress={() => setTemp(emoji)}
                  activeOpacity={0.7}>
                  <Text style={styles.avatarOptionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Butonlar */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={handleSelect}
              activeOpacity={0.8}>
              <LinearGradient
                colors={[Colors.gold, Colors.goldDark]}
                style={styles.selectBtnGradient}>
                <Text style={styles.selectBtnText}>{t('profile.select')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

/**
 * Profil ekrani — P3.4 stable revision.
 * Kaldirilan: TonightPick, SwipeIntelligence, MoodTimeline, WatchHistory,
 *             GenreDonutChart, MoodPatternChart (crash-prone + P5'te kaldirilacak).
 */
export default function ProfileScreen() {
  const { t, language, setLanguage } = useLanguage();

  const headerAnimStyle = useStaggeredEntry(0);
  const sectionsAnimStyle = useStaggeredEntry(1, { baseDelay: 150 });

  const [stats, setStats] = useState<UserStats | null>(null);
  const [moodHistory, setMoodHistory] = useState<MoodHistoryItem[]>([]);
  const [swipeInsights, setSwipeInsights] = useState<SwipeInsight | null>(null);
  const [lastProfile, setLastProfile] = useState<TasteProfile | null>(null);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userIdHash, setUserIdHash] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [archetypeId, setArchetypeId] = useState<number | null>(null);
  const [dailyMatchFilm, setDailyMatchFilm] = useState<Film | null>(null);

  // ── Streak state ──────────────────────────────────────────────────────────
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);
  const [nextMilestone, setNextMilestone] = useState<StreakCardProps['nextMilestone']>(null);

  // ─── Avatar yukleme ───────────────────────────────────────────────────────

  const loadAvatar = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(AVATAR_STORAGE_KEY);
      if (saved) {
        setAvatarEmoji(saved);
      }
    } catch (err) {
      logger.error('[ProfileScreen] avatar yukleme hatasi:', err);
    }
  }, []);

  // ─── Veri yukleme ─────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoadError(false);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      if (!authUser) return;

      const { data: userRow } = await supabase
        .from('users')
        .select('id, display_name')
        .eq('auth_id', authUser.id)
        .single();

      if (!userRow) return;
      const userId: string = userRow.id;

      setDisplayName((userRow as { id: string; display_name: string | null }).display_name);
      setUserIdHash(authUser.id.slice(0, 8).toUpperCase());

      // 8 paralel cagri — sadece mevcut tablolar/view'ler
      const [
        statsData,
        historyData,
        insightsData,
        profileData,
        watchlistData,
        streakData,
        allMilestonesData,
        userMilestonesData,
      ] = await Promise.all([
        getUserStats(userId),
        getMoodHistory(userId),
        getSwipeInsights(userId),
        getLastParsedProfile(userId),
        getWatchlist(),
        getStreakInfo(),
        getAllMilestones(),
        getUserMilestones(),
      ]);

      setStats(statsData);
      setMoodHistory(historyData);
      setSwipeInsights(insightsData);
      setLastProfile(profileData);
      setWatchlistItems(watchlistData);
      setStreakInfo(streakData);

      // P5.2: TasteProfile'dan arketip hesapla
      const computed = computeArchetype(profileData);
      setArchetypeId(computed);

      // P5.3: Günlük öneri — watchlist filmleri hariç tut
      const seenIds = watchlistData.map((w) => w.film.id);
      const dailyFilm = await getDailyMatch(userId, profileData, seenIds);
      setDailyMatchFilm(dailyFilm);

      // Sonraki streak milestone'u hesapla
      if (streakData && allMilestonesData.length > 0) {
        const earnedSlugs = new Set(userMilestonesData.map((m) => m.milestone.slug));
        const streakMilestones = allMilestonesData
          .filter((m) => m.category === 'streak')
          .sort((a, b) => a.threshold - b.threshold);

        const nextStreakMilestone = streakMilestones.find(
          (m) => !earnedSlugs.has(m.slug) && m.threshold > streakData.currentStreak,
        );

        if (nextStreakMilestone) {
          setNextMilestone({
            title: nextStreakMilestone.title,
            threshold: nextStreakMilestone.threshold,
            currentProgress: streakData.currentStreak,
          });
        } else {
          setNextMilestone(null);
        }
      }
    } catch (err) {
      logger.error('[ProfileScreen] veri yukleme hatasi:', err);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      await Promise.all([loadAll(), loadAvatar()]);
      if (!cancelled) setLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, [loadAll, loadAvatar]);

  // ─── Pull-to-refresh ──────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  // ─── Avatar kaydet ────────────────────────────────────────────────────────

  async function handleAvatarSelect(emoji: string) {
    try {
      await AsyncStorage.setItem(AVATAR_STORAGE_KEY, emoji);
      setAvatarEmoji(emoji);
    } catch (err) {
      logger.error('[ProfileScreen] avatar kayit hatasi:', err);
    }
  }

  // ─── Aksiyonlar ───────────────────────────────────────────────────────────

  function handleClearWatchlist() {
    Alert.alert(
      t('profile.clearWatchlistTitle'),
      t('profile.clearWatchlistMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.clearWatchlistConfirm'),
          style: 'destructive',
          onPress: () => {
            logger.log('[Profile] Watchlist cleared');
          },
        },
      ],
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loadError && !loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <ErrorState
          errorType="server"
          title={t('errors.generic')}
          message={t('errors.pullToRefresh')}
          onRetry={async () => {
            setLoading(true);
            setLoadError(false);
            await Promise.all([loadAll(), loadAvatar()]);
            setLoading(false);
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" backgroundColor={Colors.background} />
      <LinearGradient
        colors={[Colors.background, Colors.backgroundGradient]}
        style={styles.gradient}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.gold}
              colors={[Colors.gold]}
            />
          }>

          {/* ── Profile Header ────────────────────────────────────────── */}
          <Animated.View style={headerAnimStyle}>
          <LinearGradient
            colors={[Colors.profileHeaderStart, Colors.profileHeaderEnd]}
            locations={[0, 1]}
            style={styles.headerSection}>
            {/* Avatar daire — altin gradient border simulasyonu */}
            <TouchableOpacity
              style={styles.avatarCircle}
              onPress={() => { hapticLight(); setShowAvatarModal(true); }}
              activeOpacity={0.8}>
              <LinearGradient
                colors={[Colors.gold, Colors.goldDark, Colors.goldMid]}
                style={styles.avatarBorderGradient}
              >
                <View style={styles.avatarInner}>
                  {avatarEmoji ? (
                    <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
                  ) : (
                    <Ionicons name="person-outline" size={32} color={Colors.gold} />
                  )}
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.profileName}>
              {displayName ?? t('profile.anonymousCinephile')}
            </Text>

            {userIdHash.length > 0 && (
              <Text style={styles.userIdHash}>#{userIdHash}</Text>
            )}

            {/* P5.2: Arketip rozeti */}
            <PersonaBadge archetypeId={archetypeId} />

            {moodHistory[0]?.mood_text != null && (
              <Text style={styles.lastMood} numberOfLines={1}>
                {t('profile.lastMoodPrefix')}{moodHistory[0].mood_text}
              </Text>
            )}
          </LinearGradient>
          </Animated.View>

          {/* ── Bolumler ─────────────────────────────────────────────── */}
          <Animated.View style={sectionsAnimStyle}>
          <View style={styles.sections}>

            {/* 0. Daily Match — P5.3 */}
            <SectionHeading title={t('dailyMatch.sectionTitle')} />
            <DailyMatchCard
              film={dailyMatchFilm}
              loading={loading}
              archetypeId={archetypeId}
            />

            {/* 1. Daily Streak */}
            <SectionHeading title={t('profile.dailyStreak') ?? 'Daily Streak'} />
            <StreakCard
              streakInfo={streakInfo}
              loading={loading}
              nextMilestone={nextMilestone}
            />

            {/* 2. Taste DNA */}
            <SectionHeading title={t('profile.tasteDNA')} />
            <TasteDNA
              profile={lastProfile}
              insights={swipeInsights}
              loading={loading}
              archetypeId={archetypeId}
            />

            {/* 3. Discovery Stats */}
            <SectionHeading title={t('profile.discoveryStats')} />
            <DiscoveryStats
              stats={stats}
              insights={swipeInsights}
              loading={loading}
            />

            {/* 4. Watchlist Preview */}
            <SectionHeading title={t('profile.recentlySaved')} />
            <WatchlistPreview items={watchlistItems} loading={loading} />

            {/* 5. Settings */}
            <SectionCard title={t('profile.settingsSection')} icon="settings-outline">
              {/* Dil secimi */}
              <View style={styles.settingsRow}>
                <View style={styles.settingsRowLeft}>
                  <Ionicons name="language-outline" size={16} color={Colors.textGrey} />
                  <Text style={styles.settingsLabel}>{t('profile.language')}</Text>
                </View>
                <View style={styles.langToggle}>
                  {LANGUAGES.map(({ code, label }) => {
                    const isActive = language === code;
                    return (
                      <TouchableOpacity
                        key={code}
                        style={[styles.langOption, isActive && styles.langOptionActive]}
                        onPress={() => { hapticSelection(); setLanguage(code as Parameters<typeof setLanguage>[0]); }}
                        activeOpacity={0.75}>
                        <Text
                          style={[
                            styles.langOptionText,
                            isActive && styles.langOptionTextActive,
                          ]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Watchlist temizle */}
              <TouchableOpacity
                style={styles.dangerRow}
                onPress={handleClearWatchlist}
                activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={16} color={Colors.error} />
                <Text style={styles.dangerLabel}>{t('profile.clearWatchlist')}</Text>
              </TouchableOpacity>
            </SectionCard>

          </View>
          </Animated.View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </LinearGradient>

      {/* ── Avatar Modal ──────────────────────────────────────────────── */}
      <AvatarModal
        visible={showAvatarModal}
        current={avatarEmoji}
        onClose={() => setShowAvatarModal(false)}
        onSelect={handleAvatarSelect}
      />
    </SafeAreaView>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  gradient: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },

  // ── Header ──
  headerSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  avatarCircle: {
    marginBottom: 16,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  avatarBorderGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    padding: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    backgroundColor: Colors.cardSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 40,
  },
  profileName: {
    color: Colors.textWhite,
    fontSize: 22,
    fontFamily: Typography.displayFont,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  userIdHash: {
    color: Colors.textGrey,
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  lastMood: {
    color: Colors.gold,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 8,
    maxWidth: 280,
    textAlign: 'center',
    opacity: 0.85,
  },

  // ── Sections container ──
  sections: {
    paddingHorizontal: Spacing.md,
    gap: 10,
  },

  // ── Section heading ──
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 2,
  },
  sectionHeadingAccent: {
    width: 3,
    height: 20,
    borderRadius: 2,
    backgroundColor: Colors.gold,
  },
  sectionHeadingText: {
    color: Colors.textWhite,
    fontSize: 20,
    fontFamily: Typography.displayFont,
    letterSpacing: 0.3,
  },

  // ── Section card (Settings icin) ──
  sectionCard: {
    backgroundColor: Colors.cardSolid,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    ...Shadows.light,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.textWhite,
    fontSize: 15,
    fontFamily: Typography.displayFont,
    letterSpacing: 0.2,
  },

  // ── Settings ──
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.white10,
    marginBottom: 8,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsLabel: {
    color: Colors.textWhite,
    fontSize: 14,
  },
  langToggle: {
    flexDirection: 'row',
    gap: 6,
  },
  langOption: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.chip,
    borderWidth: 1,
    borderColor: Colors.white10,
    backgroundColor: Colors.white05,
  },
  langOptionActive: {
    backgroundColor: Colors.goldDim,
    borderColor: Colors.gold,
  },
  langOptionText: {
    color: Colors.textGrey,
    fontSize: 13,
    fontWeight: '600',
  },
  langOptionTextActive: {
    color: Colors.gold,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  dangerLabel: {
    color: Colors.error,
    fontSize: 14,
  },

  // ── Avatar Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,14,39,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.cardSolid,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 340,
    ...Shadows.light,
  },
  modalTitle: {
    color: Colors.textWhite,
    fontSize: 18,
    fontFamily: Typography.displayFont,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  avatarOption: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.white05,
    borderWidth: 2,
    borderColor: Colors.white10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOptionSelected: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldDim,
  },
  avatarOptionEmoji: {
    fontSize: 28,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.white10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: Colors.textGrey,
    fontSize: 15,
    fontWeight: '600',
  },
  selectBtn: {
    flex: 1,
    borderRadius: Radius.button,
    overflow: 'hidden',
  },
  selectBtnGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBtnText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '700',
  },

  // ── Genel ──
  bottomSpacer: {
    height: 100,
  },
});
