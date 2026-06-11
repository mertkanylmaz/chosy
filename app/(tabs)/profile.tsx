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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  type ImageSourcePropType,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';

import { supabase } from '@/services/supabase';
import { logger } from '@/utils/logger';
import { posthogAnalytics } from '@/services/posthog';
import { useLanguage } from '@/contexts/LanguageContext';
import { Colors } from '@/constants/Colors';
import { AvatarIcons } from '@/constants/icons';
import { useStaggeredEntry } from '@/hooks/useStaggeredEntry';
import { hapticLight, hapticSelection } from '@/utils/haptics';
import { Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import TasteDNA from '@/components/Profile/TasteDNA';
import DiscoveryStats from '@/components/Profile/DiscoveryStats';
import ErrorState from '@/components/ErrorState';
import StreakCard from '@/components/Profile/StreakCard';
import type { StreakCardProps } from '@/components/Profile/StreakCard';
import {
  getLastParsedProfile,
  getMoodHistory,
  getSwipeInsights,
  getUserStats,
} from '@/services/profileService';
import PersonaBadge from '@/components/Profile/PersonaBadge';
import Purchases from 'react-native-purchases';

import { clearWatchlist } from '@/services/watchlist';
import { signInWithApple, signOut, deleteAccount } from '@/services/authService';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PLANS } from '@/constants/subscriptionPlans';
import { getArchetype } from '@/constants/archetypes';
import {
  getStreakInfo,
  getAllMilestones,
  getUserMilestones,
} from '@/services/gamification';
import type { StreakInfo } from '@/services/gamification';
import ContextualPaywall from '@/components/paywalls/ContextualPaywall';
import { useContextualPaywall } from '@/components/paywalls/useContextualPaywall';
import {
  getNotificationStatus,
  getDailyPickStatus,
  toggleNotifications,
  toggleDailyPick,
} from '@/services/pushNotifications';

import type { MoodHistoryItem, SwipeInsight, UserStats } from '@/types/profile';
import type { TasteProfile } from '@/types/index';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

type Locale = 'en' | 'tr';

const LANGUAGES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'tr', label: 'TR' },
];

/** AsyncStorage anahtari */
const AVATAR_STORAGE_KEY = 'chosy_user_avatar';

/** Sinema ekipmanı avatar seçenekleri — 9 özel ikon */
interface AvatarItem {
  id: string;
  image: ImageSourcePropType;
  labelKey: string;
}

const AVATAR_OPTIONS: AvatarItem[] = [
  { id: 'clapperboard',   image: AvatarIcons.clapperboard,   labelKey: 'profile.avatarClapperboard' },
  { id: 'pro_camera',     image: AvatarIcons.pro_camera,     labelKey: 'profile.avatarProCamera' },
  { id: 'director_chair', image: AvatarIcons.director_chair, labelKey: 'profile.avatarDirectorChair' },
  { id: 'film_reel',      image: AvatarIcons.film_reel,      labelKey: 'profile.avatarFilmReel' },
  { id: 'megaphone',      image: AvatarIcons.megaphone,      labelKey: 'profile.avatarMegaphone' },
  { id: 'boom_mic',       image: AvatarIcons.boom_mic,       labelKey: 'profile.avatarBoomMic' },
  { id: 'studio_light',   image: AvatarIcons.studio_light,   labelKey: 'profile.avatarStudioLight' },
  { id: 'edit_monitor',   image: AvatarIcons.edit_monitor,   labelKey: 'profile.avatarEditMonitor' },
  { id: 'tripod',         image: AvatarIcons.tripod,         labelKey: 'profile.avatarTripod' },
];

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
  /** Mevcut secili avatar ID'si */
  current: string | null;
  /** Kapatma callback */
  onClose: () => void;
  /** Secim callback — avatar ID döner */
  onSelect: (avatarId: string) => void;
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

          {/* Film objeleri subtitle */}
          <Text style={styles.avatarSubtitle}>{t('profile.avatarSubtitle')}</Text>

          {/* 3x3 avatar grid */}
          <View style={styles.avatarGrid}>
            {AVATAR_OPTIONS.map((item) => {
              const isSelected = temp === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.avatarOption, isSelected && styles.avatarOptionSelected]}
                  onPress={() => setTemp(item.id)}
                  activeOpacity={0.7}>
                  <Image
                    source={item.image}
                    style={styles.avatarOptionEmoji}
                    resizeMode="contain"
                  />
                  <Text
                    style={[
                      styles.avatarOptionLabel,
                      isSelected && styles.avatarOptionLabelSelected,
                    ]}
                    numberOfLines={1}>
                    {t(item.labelKey)}
                  </Text>
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

// ─── Nickname Modal ───────────────────────────────────────────────────────────

interface NicknameModalProps {
  /** Modal gorunur mu */
  visible: boolean;
  /** Mevcut isim — input icin baslangic degeri */
  current: string | null;
  /** Kapatma callback */
  onClose: () => void;
  /** Kaydetme callback */
  onSave: (value: string) => void;
}

/**
 * Nickname duzenleme modali — tek satirlik TextInput, altin aksan.
 * Bos birakilirsa kaydetme devre disi.
 */
function NicknameModal({ visible, current, onClose, onSave }: NicknameModalProps) {
  const { t } = useLanguage();
  const [value, setValue] = useState(current ?? '');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setValue(current ?? '');
      // Modal acindan sonra klavye otomatik aclsin
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [visible, current]);

  const trimmed = value.trim();
  const canSave = trimmed.length >= 1 && trimmed.length <= 24;

  function handleSave() {
    if (!canSave) return;
    onSave(trimmed);
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
          <Text style={styles.modalTitle}>{t('profile.nicknameTitle')}</Text>

          {/* TextInput */}
          <TextInput
            ref={inputRef}
            style={nicknameModalStyles.input}
            value={value}
            onChangeText={setValue}
            placeholder={t('profile.nicknamePlaceholder')}
            placeholderTextColor={Colors.textGrey}
            maxLength={24}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          {/* Karakter sayaci */}
          <Text style={nicknameModalStyles.charCount}>{trimmed.length}/24</Text>

          {/* Butonlar */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.selectBtn, !canSave && { opacity: 0.4 }]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.8}>
              <LinearGradient
                colors={[Colors.gold, Colors.goldDark]}
                style={styles.selectBtnGradient}>
                <Text style={styles.selectBtnText}>{t('common.save')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  language: string;
  onLanguageChange: (code: 'en' | 'tr') => void;
  isAnonymous: boolean;
  isPremium: boolean;
  isLifetime: boolean;
  /** Aktif plan etiketi — Apple yonetim sayfasi oncesi gosterilir */
  currentPlanLabel: string;
  linkingAccount: boolean;
  notificationsEnabled: boolean;
  dailyPickEnabled: boolean;
  onToggleNotifications: (enabled: boolean) => void;
  onToggleDailyPick: (enabled: boolean) => void;
  onLinkApple: () => void;
  onClearWatchlist: () => void;
  onManageSubscription: () => void;
  onFoundingMember: () => void;
  onInviteFriends: () => void;
  onSignOut: () => void;
  /** Hesap silme akışını başlatır — iki aşamalı onay */
  onDeleteAccount: () => void;
}

/**
 * Ayarlar bottom-sheet modal — Language, Link Account, Clear Watchlist, Delete Account.
 * Gear icon'a tıklayınca açılır; profil sayfası temiz kalır.
 */
function SettingsModal({
  visible,
  onClose,
  language,
  onLanguageChange,
  isAnonymous,
  isPremium: isPremiumUser,
  isLifetime,
  currentPlanLabel,
  linkingAccount,
  notificationsEnabled,
  dailyPickEnabled,
  onToggleNotifications,
  onToggleDailyPick,
  onLinkApple,
  onClearWatchlist,
  onManageSubscription,
  onFoundingMember,
  onInviteFriends,
  onSignOut,
  onDeleteAccount,
}: SettingsModalProps) {
  const { t } = useLanguage();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <TouchableOpacity
        style={settingsModalStyles.overlay}
        activeOpacity={1}
        onPress={onClose}>
        <TouchableOpacity
          style={settingsModalStyles.sheet}
          activeOpacity={1}
          onPress={() => {}}>

          {/* Handle bar */}
          <View style={settingsModalStyles.handle} />

          {/* Başlık */}
          <View style={settingsModalStyles.header}>
            <Ionicons name="settings-outline" size={18} color={Colors.gold} />
            <Text style={settingsModalStyles.title}>{t('profile.settingsSection')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.textGrey} />
            </TouchableOpacity>
          </View>

          {/* Dil seçimi */}
          <View style={settingsModalStyles.row}>
            <View style={settingsModalStyles.rowLeft}>
              <Ionicons name="language-outline" size={16} color={Colors.textGrey} />
              <Text style={settingsModalStyles.rowLabel}>{t('profile.language')}</Text>
            </View>
            <View style={settingsModalStyles.langToggle}>
              {LANGUAGES.map(({ code, label }) => {
                const isActive = language === code;
                return (
                  <TouchableOpacity
                    key={code}
                    style={[settingsModalStyles.langOption, isActive && settingsModalStyles.langOptionActive]}
                    onPress={() => { hapticSelection(); onLanguageChange(code); }}
                    activeOpacity={0.75}>
                    <Text style={[settingsModalStyles.langText, isActive && settingsModalStyles.langTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Bildirim toggle */}
          <View style={settingsModalStyles.row}>
            <View style={settingsModalStyles.rowLeft}>
              <Ionicons name="notifications-outline" size={16} color={Colors.textGrey} />
              <Text style={settingsModalStyles.rowLabel}>{t('notifications.settingsLabel')}</Text>
            </View>
            <View style={settingsModalStyles.langToggle}>
              <TouchableOpacity
                style={[settingsModalStyles.langOption, notificationsEnabled && settingsModalStyles.langOptionActive]}
                onPress={() => { hapticSelection(); onToggleNotifications(true); }}
                activeOpacity={0.75}>
                <Text style={[settingsModalStyles.langText, notificationsEnabled && settingsModalStyles.langTextActive]}>
                  {t('notifications.enabled')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[settingsModalStyles.langOption, !notificationsEnabled && settingsModalStyles.langOptionActive]}
                onPress={() => { hapticSelection(); onToggleNotifications(false); }}
                activeOpacity={0.75}>
                <Text style={[settingsModalStyles.langText, !notificationsEnabled && settingsModalStyles.langTextActive]}>
                  {t('notifications.disabled')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Daily Pick toggle — sadece notifications acikken goster */}
          {notificationsEnabled && (
            <View style={settingsModalStyles.row}>
              <View style={settingsModalStyles.rowLeft}>
                <Ionicons name="film-outline" size={16} color={Colors.textGrey} />
                <Text style={settingsModalStyles.rowLabel}>{t('notifications.dailyPickLabel')}</Text>
              </View>
              <View style={settingsModalStyles.langToggle}>
                <TouchableOpacity
                  style={[settingsModalStyles.langOption, dailyPickEnabled && settingsModalStyles.langOptionActive]}
                  onPress={() => { hapticSelection(); onToggleDailyPick(true); }}
                  activeOpacity={0.75}>
                  <Text style={[settingsModalStyles.langText, dailyPickEnabled && settingsModalStyles.langTextActive]}>
                    {t('notifications.enabled')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[settingsModalStyles.langOption, !dailyPickEnabled && settingsModalStyles.langOptionActive]}
                  onPress={() => { hapticSelection(); onToggleDailyPick(false); }}
                  activeOpacity={0.75}>
                  <Text style={[settingsModalStyles.langText, !dailyPickEnabled && settingsModalStyles.langTextActive]}>
                    {t('notifications.disabled')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Hesap bağlama — sadece anonim */}
          {isAnonymous && (
            <View style={settingsModalStyles.linkSection}>
              <View style={settingsModalStyles.linkInfo}>
                <Ionicons name="person-add-outline" size={16} color={Colors.gold} />
                <View style={settingsModalStyles.linkTextBlock}>
                  <Text style={settingsModalStyles.linkTitle}>
                    {t('profile.linkAccountTitle') ?? 'Link Account'}
                  </Text>
                  <Text style={settingsModalStyles.linkSubtitle}>
                    {t('profile.linkAccountSubtitle') ?? 'Save your data permanently'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={settingsModalStyles.appleBtn}
                onPress={onLinkApple}
                disabled={linkingAccount}
                activeOpacity={0.8}>
                <Ionicons name="logo-apple" size={16} color={Colors.textWhite} />
                <Text style={settingsModalStyles.appleBtnText}>
                  {linkingAccount
                    ? (t('common.loading') ?? 'Linking...')
                    : (t('profile.linkWithApple') ?? 'Apple')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Subscription yönetimi */}
          <TouchableOpacity
            style={settingsModalStyles.row}
            onPress={() => { onClose(); onManageSubscription(); }}
            activeOpacity={0.7}>
            <View style={settingsModalStyles.rowLeft}>
              <Ionicons name="diamond-outline" size={16} color={Colors.accentPrimary} />
              <Text style={settingsModalStyles.rowLabel}>
                {isPremiumUser ? t('profile.manageSubscription') : t('profile.upgradePlus')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textGrey} />
          </TouchableOpacity>

          {/* Apple yonetim sayfasi hakkinda bilgi notu */}
          {isPremiumUser && (
            <Text style={settingsModalStyles.manageNote}>
              {t('profile.manageNote', { plan: currentPlanLabel })}
            </Text>
          )}

          {/* Founding Member — sadece lifetime olmayan kullanicilar */}
          {!isLifetime && (
            <TouchableOpacity
              style={settingsModalStyles.row}
              onPress={() => { onClose(); onFoundingMember(); }}
              activeOpacity={0.7}>
              <View style={settingsModalStyles.rowLeft}>
                <Ionicons name="diamond" size={16} color={Colors.gold} />
                <Text style={settingsModalStyles.rowLabel}>{t('lifetime.settingsEntry')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textGrey} />
            </TouchableOpacity>
          )}

          {/* Invite Friends */}
          <TouchableOpacity
            style={settingsModalStyles.row}
            onPress={() => { onClose(); onInviteFriends(); }}
            activeOpacity={0.7}>
            <View style={settingsModalStyles.rowLeft}>
              <Ionicons name="people-outline" size={16} color={Colors.accentPrimary} />
              <Text style={settingsModalStyles.rowLabel}>{t('referral.title')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textGrey} />
          </TouchableOpacity>

          {/* Watchlist temizle */}
          <TouchableOpacity
            style={settingsModalStyles.dangerRow}
            onPress={() => { onClose(); onClearWatchlist(); }}
            activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={16} color={Colors.error} />
            <Text style={settingsModalStyles.dangerLabel}>{t('profile.clearWatchlist')}</Text>
          </TouchableOpacity>

          {/* Çıkış yap — yalnızca oturum açmış kullanıcılar */}
          {!isAnonymous && (
            <TouchableOpacity
              style={settingsModalStyles.signOutRow}
              onPress={onSignOut}
              activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={16} color={Colors.error} />
              <Text style={settingsModalStyles.dangerLabel}>{t('profile.signOut')}</Text>
            </TouchableOpacity>
          )}

          {/* Yasal linkler */}
          <TouchableOpacity
            style={settingsModalStyles.row}
            onPress={() => Linking.openURL('https://abalone-dracopelta-382.notion.site/Chosy-ai-Privacy-Policy-34a00bffbfbe80af9f5fd996fa7ab55b')}
            activeOpacity={0.7}>
            <View style={settingsModalStyles.rowLeft}>
              <Ionicons name="shield-checkmark-outline" size={16} color={Colors.textGrey} />
              <Text style={settingsModalStyles.rowLabel}>{t('paywall.privacy')}</Text>
            </View>
            <Ionicons name="open-outline" size={14} color={Colors.textGrey} />
          </TouchableOpacity>

          <TouchableOpacity
            style={settingsModalStyles.row}
            onPress={() => Linking.openURL('https://www.notion.so/Chosy-ai-Terms-of-Service-34a00bffbfbe80899613c3ce2e5ed01b')}
            activeOpacity={0.7}>
            <View style={settingsModalStyles.rowLeft}>
              <Ionicons name="document-text-outline" size={16} color={Colors.textGrey} />
              <Text style={settingsModalStyles.rowLabel}>{t('paywall.terms')}</Text>
            </View>
            <Ionicons name="open-outline" size={14} color={Colors.textGrey} />
          </TouchableOpacity>

          {/* Hesap Sil — en altta, ince separator ile ayrılmış */}
          <View style={settingsModalStyles.deleteAccountSection}>
            <TouchableOpacity
              style={settingsModalStyles.deleteAccountRow}
              onPress={() => { onClose(); onDeleteAccount(); }}
              activeOpacity={0.7}>
              <Ionicons name="person-remove-outline" size={16} color={Colors.error} />
              <View style={settingsModalStyles.deleteAccountTextBlock}>
                <Text style={settingsModalStyles.deleteAccountLabel}>
                  {t('profile.deleteAccount')}
                </Text>
                <Text style={settingsModalStyles.deleteAccountHint}>
                  {t('profile.deleteAccountConfirmMessage')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

        </TouchableOpacity>
      </TouchableOpacity>
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
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const { isPremium, planId, tier, status: subStatus, isInTrial, expiresAt, quota } = useSubscription();
  const { triggerPaywall, paywallProps } = useContextualPaywall();

  const headerAnimStyle = useStaggeredEntry(0);
  const sectionsAnimStyle = useStaggeredEntry(1, { baseDelay: 150 });

  const [stats, setStats] = useState<UserStats | null>(null);
  const [moodHistory, setMoodHistory] = useState<MoodHistoryItem[]>([]);
  const [swipeInsights, setSwipeInsights] = useState<SwipeInsight | null>(null);
  const [lastProfile, setLastProfile] = useState<TasteProfile | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userIdHash, setUserIdHash] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [archetypeId, setArchetypeId] = useState<number | null>(null);
  const [authProvider, setAuthProvider] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [linkingAccount, setLinkingAccount] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [dailyPickEnabled, setDailyPickEnabled] = useState(true);

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

      // Auth provider bilgisi
      const provider = authUser.app_metadata?.provider ?? null;
      setAuthProvider(provider);
      setAuthEmail(authUser.email ?? null);
      setIsAnonymous(authUser.is_anonymous ?? true);

      const { data: userRow } = await supabase
        .from('users')
        .select('id, display_name, username, archetype_id')
        .eq('auth_id', authUser.id)
        .single();

      if (!userRow) return;
      const userId: string = userRow.id;

      // İsim önceliği: username → display_name → auth metadata adı → null (fallback i18n'den gelir)
      type UserRow = { id: string; display_name: string | null; username: string | null; archetype_id: number | null };
      const row = userRow as UserRow;
      const metaName = (authUser.user_metadata?.full_name as string | undefined)
        ?? (authUser.user_metadata?.name as string | undefined)
        ?? null;
      setDisplayName(row.username ?? row.display_name ?? metaName);
      setUserIdHash(authUser.id.slice(0, 8).toUpperCase());

      // Kalibrasyon sonucu arketip (onboarding'den kaydedilen)
      const calibrationArchetypeId = row.archetype_id;
      setArchetypeId(calibrationArchetypeId ?? null);

      // Faz 1: Kritik veriler (üst kısımda görünen)
      const [profileData, streakData, pushStatus, dailyPickStatus] = await Promise.all([
        getLastParsedProfile(userId),
        getStreakInfo(),
        getNotificationStatus(),
        getDailyPickStatus(),
      ]);
      setNotificationsEnabled(pushStatus);
      setDailyPickEnabled(dailyPickStatus);

      setLastProfile(profileData);
      setStreakInfo(streakData);

      // Faz 2: İkincil veriler (aşağıda, lazy)
      const [statsData, historyData, insightsData, allMilestonesData, userMilestonesData] =
        await Promise.all([
          getUserStats(userId),
          getMoodHistory(userId),
          getSwipeInsights(userId),
          getAllMilestones(),
          getUserMilestones(),
        ]);

      setStats(statsData);
      setMoodHistory(historyData);
      setSwipeInsights(insightsData);

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

  // ── İlk yükleme (loading spinner gösterir) ───────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      await Promise.all([loadAll(), loadAvatar()]);
      if (!cancelled) setLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, [loadAll, loadAvatar]);

  // ── Sekmeye dönüldüğünde sessiz yenileme (sign-in sonrası veri güncellenir) ──
  useFocusEffect(
    useCallback(() => {
      // İlk mount'ta loading zaten çalışıyor; sonraki focus'larda sessiz yenile
      if (!loading) {
        void loadAll();
      }
    }, [loading, loadAll]),
  );

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

  // ─── Nickname kaydet ──────────────────────────────────────────────────────

  /**
   * Nickname'i Supabase users.display_name alanina yazar.
   * Hata durumunda Alert gosterir; state rollback uygulaz.
   */
  async function handleNicknameSave(newName: string): Promise<void> {
    const prev = displayName;
    setDisplayName(newName); // Optimistik guncelleme
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authId = authData?.user?.id;
      if (!authId) throw new Error('no_auth');

      const { error } = await supabase
        .from('users')
        .update({ display_name: newName })
        .eq('auth_id', authId);

      if (error) throw error;
    } catch (err) {
      logger.error('[Profile] nickname kayit hatasi:', err);
      setDisplayName(prev); // Geri al
      Alert.alert(t('errors.generic'), t('errors.pullToRefresh'));
    }
  }

  // ─── Aksiyonlar ───────────────────────────────────────────────────────────

  /**
   * Abonelik yonetimi — premium kullanicilar iOS native ayarlara,
   * free kullanicilar paywall'a yonlendirilir.
   */
  async function handleManageSubscription(): Promise<void> {
    if (isPremium) {
      try {
        await Purchases.showManageSubscriptions();
      } catch {
        // Fallback: native URL ile ac
        const url = Platform.OS === 'ios'
          ? 'itms-apps://apps.apple.com/account/subscriptions'
          : 'https://play.google.com/store/account/subscriptions';
        await Linking.openURL(url);
      }
    } else {
      router.push('/paywall');
    }
  }

  /**
   * Watchlist temizleme — onay sonrasi tum kayitlari siler + UI gunceller.
   */
  function handleClearWatchlist() {
    Alert.alert(
      t('profile.clearWatchlistTitle'),
      t('profile.clearWatchlistMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.clearWatchlistConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await clearWatchlist();
              logger.log('[Profile] Watchlist cleared');
              Alert.alert(t('profile.clearWatchlistSuccess') ?? 'Watchlist cleared');
            } catch (err) {
              logger.error('[Profile] clearWatchlist hatasi:', err);
              Alert.alert(t('errors.generic'));
            }
          },
        },
      ],
    );
  }

  // ─── Hesap bağlama ────────────────────────────────────────────────────────

  async function handleLinkApple() {
    setLinkingAccount(true);
    try {
      const result = await signInWithApple();
      if (result.success) {
        await loadAll();
        Alert.alert(
          t('profile.linkSuccess') ?? 'Account Linked',
          t('profile.linkSuccessMessage') ?? 'Your account has been linked with Apple successfully.',
        );
      } else if (result.error !== 'canceled') {
        Alert.alert(
          t('profile.linkError') ?? 'Link Failed',
          t('profile.linkErrorMessage') ?? 'Could not link account. Please try again.',
        );
      }
    } catch (err) {
      logger.error('[Profile] Apple link hatasi:', err);
    } finally {
      setLinkingAccount(false);
    }
  }

  // TODO: Google Sign-In — native rebuild sonrası geri eklenecek
  // async function handleLinkGoogle() { ... }

  // ─── Çıkış ────────────────────────────────────────────────────────────────

  /**
   * Oturumu kapatır ve kullanıcıyı auth ekranına yönlendirir.
   * Onay Alert'i gösterir — yanlışlıkla çıkışı önler.
   */
  function handleSignOut(): void {
    void hapticLight();
    setShowSettings(false);

    Alert.alert(
      t('profile.signOutConfirmTitle'),
      t('profile.signOutConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.signOutConfirm'),
          style: 'destructive',
          onPress: async () => {
            posthogAnalytics.reset();
            await signOut();
            router.replace('/auth');
          },
        },
      ],
    );
  }

  // ─── Hesap silme ──────────────────────────────────────────────────────────

  /**
   * İki aşamalı onay sonrası hesabı kalıcı siler.
   *
   * Aşama 1: "Bu işlem geri alınamaz" uyarı Alert'i
   * Aşama 2: Kullanıcı "Kalıcı Olarak Sil" seçerse Edge Function çağrılır
   */
  function handleDeleteAccount(): void {
    void hapticLight();

    Alert.alert(
      t('profile.deleteAccountConfirmTitle'),
      t('profile.deleteAccountConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.deleteAccountConfirm'),
          style: 'destructive',
          onPress: () => {
            // İkinci onay — çift güvence
            Alert.alert(
              t('profile.deleteAccountConfirmTitle'),
              t('profile.deleteAccountDeleting') + '\n\n' + t('profile.deleteAccountConfirmMessage'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('profile.deleteAccountConfirm'),
                  style: 'destructive',
                  onPress: async () => {
                    setDeletingAccount(true);
                    try {
                      const result = await deleteAccount();
                      if (result.success) {
                        // Başarılı — auth screen'e yönlendir
                        router.replace('/auth');
                      } else {
                        const msg =
                          result.error === 'network_error'
                            ? t('profile.deleteAccountNetworkError')
                            : t('profile.deleteAccountError');
                        Alert.alert(t('profile.deleteAccountConfirmTitle'), msg);
                      }
                    } catch (err) {
                      logger.error('[ProfileScreen] deleteAccount hatası:', err);
                      Alert.alert(
                        t('profile.deleteAccountConfirmTitle'),
                        t('profile.deleteAccountError'),
                      );
                    } finally {
                      setDeletingAccount(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }

  // ─── Notification toggle ─────────────────────────────────────────────────

  async function handleToggleNotifications(enabled: boolean): Promise<void> {
    const prev = notificationsEnabled;
    setNotificationsEnabled(enabled); // Optimistic
    try {
      const success = await toggleNotifications(enabled);
      if (!success) {
        setNotificationsEnabled(prev); // Rollback
      }
    } catch {
      setNotificationsEnabled(prev);
    }
  }

  // ─── Daily Pick toggle ─────────────────────────────────────────────────

  async function handleToggleDailyPick(enabled: boolean): Promise<void> {
    const prev = dailyPickEnabled;
    setDailyPickEnabled(enabled); // Optimistic
    try {
      const success = await toggleDailyPick(enabled);
      if (!success) {
        setDailyPickEnabled(prev); // Rollback
      }
    } catch {
      setDailyPickEnabled(prev);
    }
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

            {/* Üst satır: Gear sağa hizalanmış, absolute yok */}
            <View style={styles.headerTopRow}>
              <TouchableOpacity
                style={styles.gearBtn}
                onPress={() => { hapticLight(); setShowSettings(true); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}>
                <Ionicons name="settings-outline" size={22} color={Colors.textGrey} />
              </TouchableOpacity>
            </View>

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
                    <Image
                      source={AVATAR_OPTIONS.find((a) => a.id === avatarEmoji)?.image ?? AvatarIcons.clapperboard}
                      style={styles.avatarEmoji}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons name="person-outline" size={32} color={Colors.gold} />
                  )}
                </View>
              </LinearGradient>
              {/* Degistir hintt */}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={12} color={Colors.background} />
              </View>
            </TouchableOpacity>

            {/* Profil adi + duzenle butonu */}
            <TouchableOpacity
              style={styles.profileNameRow}
              onPress={() => { hapticLight(); setShowNicknameModal(true); }}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
              <Text style={styles.profileName}>
                {displayName ?? t('profile.anonymousCinephile')}
              </Text>
              <View style={styles.editNameBadge}>
                <Ionicons name="pencil" size={11} color={Colors.gold} />
              </View>
            </TouchableOpacity>

            {userIdHash.length > 0 && (
              <Text style={styles.userIdHash}>#{userIdHash}</Text>
            )}

            {/* Arketip rozeti + açıklama — null ise dokunarak kalibrasyona git */}
            <PersonaBadge
              archetypeId={archetypeId}
              onPress={archetypeId == null ? () => router.push('/onboarding' as never) : undefined}
            />
            {archetypeId != null && (
              <Text style={styles.archetypeDesc} numberOfLines={2}>
                {t(getArchetype(archetypeId)?.descKey ?? '')}
              </Text>
            )}

            {/* Auth provider rozeti — Apple/Google icin ozel gosterim */}
            {!isAnonymous && authProvider && (
              <View style={styles.authProviderBadge}>
                <Ionicons
                  name={authProvider === 'apple' ? 'logo-apple' : 'logo-google'}
                  size={13}
                  color={Colors.textGrey}
                />
                <Text style={styles.authProviderText}>
                  {t(
                    authProvider === 'apple'
                      ? 'profile.connectedWithApple'
                      : 'profile.connectedWithGoogle',
                  )}
                </Text>
              </View>
            )}

            {/* Subscription badge */}
            {tier === 'lifetime' ? (
              <View style={styles.subBadgeLifetime}>
                <Ionicons name="diamond" size={14} color={Colors.gold} />
                <Text style={styles.subBadgeLifetimeText}>Founding Member</Text>
              </View>
            ) : isPremium ? (
              <View style={styles.subBadgePremium}>
                <Ionicons name="diamond" size={14} color={Colors.accentPrimary} />
                <Text style={styles.subBadgePremiumText}>
                  {isInTrial
                    ? t('profile.subscriptionTrial')
                    : t('profile.subscriptionActive')}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.subBadgeFree}
                onPress={() => router.push('/paywall')}
                activeOpacity={0.8}
              >
                <Ionicons name="sparkles" size={14} color={Colors.gold} />
                <Text style={styles.subBadgeFreeText}>{t('profile.upgradePlus')}</Text>
              </TouchableOpacity>
            )}

            {/* Founding Member upsell banner — non-lifetime premium + free */}
            {tier !== 'lifetime' && (
              <TouchableOpacity
                style={styles.foundingBanner}
                onPress={() => router.push('/lifetime' as never)}
                activeOpacity={0.8}
              >
                <Ionicons name="diamond-outline" size={14} color={Colors.gold} />
                <Text style={styles.foundingBannerText}>{t('lifetime.profileBanner')}</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.gold} />
              </TouchableOpacity>
            )}
          </LinearGradient>
          </Animated.View>

          {/* ── Bolumler ─────────────────────────────────────────────── */}
          <Animated.View style={sectionsAnimStyle}>
          <View style={styles.sections}>

            {/* 1. Daily Streak */}
            <SectionHeading title={t('profile.dailyStreak') ?? 'Daily Streak'} />
            <StreakCard
              streakInfo={streakInfo}
              loading={loading}
              nextMilestone={nextMilestone}
            />

            {/* 2. Taste DNA */}
            <SectionHeading title={t('profile.tasteDNA')} />
            {!isPremium ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => triggerPaywall({ type: 'mood_history_tap' })}
              >
                <TasteDNA
                  profile={lastProfile}
                  insights={swipeInsights}
                  loading={loading}
                  archetypeId={archetypeId}
                />
              </TouchableOpacity>
            ) : (
              <TasteDNA
                profile={lastProfile}
                insights={swipeInsights}
                loading={loading}
                archetypeId={archetypeId}
              />
            )}

            {/* 3. Discovery Stats */}
            <SectionHeading title={t('profile.discoveryStats')} />
            <DiscoveryStats
              stats={stats}
              insights={swipeInsights}
              loading={loading}
            />

          </View>
          </Animated.View>

            {/* ── Dev-only: Sentry Test ──────────────────────────────── */}
            {__DEV__ && (
              <View style={styles.devSection}>
                <TouchableOpacity
                  style={styles.devSentryBtn}
                  onPress={() => {
                    // Lazy import — production bundle'a dahil olmaz
                    const { triggerTestError } = require('@/utils/sentryTest');
                    triggerTestError();
                    Alert.alert('Sentry Test', 'Test error sent. Check Sentry dashboard.');
                  }}
                  activeOpacity={0.7}>
                  <Ionicons name="bug-outline" size={16} color={Colors.gold} />
                  <Text style={styles.devSentryBtnText}>Test Sentry</Text>
                </TouchableOpacity>
              </View>
            )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </LinearGradient>

      {/* ── Hesap silme overlay — tam ekran blok ─────────────────────── */}
      {deletingAccount && (
        <View style={styles.deletingOverlay}>
          <Text style={styles.deletingOverlayText}>{t('profile.deleteAccountDeleting')}</Text>
        </View>
      )}

      {/* ── Avatar Modal ──────────────────────────────────────────────── */}
      <AvatarModal
        visible={showAvatarModal}
        current={avatarEmoji}
        onClose={() => setShowAvatarModal(false)}
        onSelect={handleAvatarSelect}
      />

      {/* ── Nickname Modal ────────────────────────────────────────────── */}
      <NicknameModal
        visible={showNicknameModal}
        current={displayName}
        onClose={() => setShowNicknameModal(false)}
        onSave={(name) => void handleNicknameSave(name)}
      />

      {/* ── Settings Modal ────────────────────────────────────────────── */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        language={language}
        onLanguageChange={(code) => setLanguage(code)}
        isAnonymous={isAnonymous}
        isPremium={isPremium}
        isLifetime={tier === 'lifetime'}
        currentPlanLabel={
          tier === 'lifetime' ? t('paywall.lifetimeTitle')
            : tier === 'annual' ? t('paywall.annualTitle')
            : tier === 'monthly' ? t('paywall.monthlyTitle')
            : t('profile.freePlan')
        }
        linkingAccount={linkingAccount}
        notificationsEnabled={notificationsEnabled}
        dailyPickEnabled={dailyPickEnabled}
        onToggleNotifications={(enabled) => void handleToggleNotifications(enabled)}
        onToggleDailyPick={(enabled) => void handleToggleDailyPick(enabled)}
        onLinkApple={handleLinkApple}
        onClearWatchlist={handleClearWatchlist}
        onManageSubscription={() => void handleManageSubscription()}
        onFoundingMember={() => router.push('/lifetime' as never)}
        onInviteFriends={() => router.push('/referral' as never)}
        onSignOut={handleSignOut}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* ── Contextual Paywall ──────────────────────────────────────── */}
      <ContextualPaywall {...paywallProps} />
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
    paddingTop: 8,
    paddingBottom: 28,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  /** Gear butonunu sağ üste hizalayan tam genişlik satır — absolute positioning yok */
  headerTopRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  gearBtn: {
    padding: 6,
  },
  archetypeDesc: {
    color: Colors.textGrey,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 260,
    fontStyle: 'italic',
    opacity: 0.85,
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
    width: 56,
    height: 56,
  },
  profileName: {
    color: Colors.textWhite,
    fontSize: 22,
    fontFamily: Typography.displayFont,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  userIdHash: {
    color: Colors.textGrey,
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  /** Profil adi + kalem ikonu yan yana */
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  /** Kucuk duzenle rozeti — ismin yaninda */
  editNameBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: Colors.gold + '50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Kamera ikonu — avatar uzerinde */
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  /** Apple/Google baglanti rozeti */
  authProviderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.white05,
    borderWidth: 1,
    borderColor: Colors.white10,
  },
  authProviderText: {
    color: Colors.textGrey,
    fontSize: 11,
    letterSpacing: 0.2,
    opacity: 0.85,
  },

  // ── Subscription Badge ──
  subBadgePremium: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.accentPrimary + '15',
    borderWidth: 1,
    borderColor: Colors.accentPrimary + '30',
  },
  subBadgePremiumText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accentPrimary,
    letterSpacing: 0.2,
  },
  subBadgeFree: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: Colors.gold + '40',
  },
  subBadgeFreeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.gold,
    letterSpacing: 0.2,
  },
  subBadgeLifetime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: Colors.gold + '40',
  },
  subBadgeLifetimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.gold,
    letterSpacing: 0.3,
  },
  foundingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.gold + '12',
    borderWidth: 1,
    borderColor: Colors.gold + '25',
  },
  foundingBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gold,
    letterSpacing: 0.1,
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
    maxWidth: 360,
    ...Shadows.light,
  },
  modalTitle: {
    color: Colors.textWhite,
    fontSize: 18,
    fontFamily: Typography.displayFont,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  avatarSubtitle: {
    color: Colors.textGrey,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: Spacing.md,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  avatarOption: {
    width: 68,
    height: 76,
    borderRadius: 16,
    backgroundColor: Colors.white05,
    borderWidth: 2,
    borderColor: Colors.white10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 2,
  },
  avatarOptionSelected: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldDim,
  },
  avatarOptionEmoji: {
    width: 44,
    height: 44,
  },
  avatarOptionLabel: {
    fontSize: 8,
    color: Colors.textGrey,
    textAlign: 'center',
    letterSpacing: 0.2,
    opacity: 0.8,
  },
  avatarOptionLabelSelected: {
    color: Colors.gold,
    opacity: 1,
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

  // ── Link Account ──
  linkAccountSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.white10,
    paddingTop: 12,
    marginBottom: 8,
    gap: 10,
  },
  linkAccountInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  linkAccountText: {
    flex: 1,
  },
  linkAccountTitle: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: '600',
  },
  linkAccountSubtitle: {
    color: Colors.textGrey,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  linkBtnsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  linkAppleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1C1C1E',
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.white10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  linkGoogleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.white10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  linkAppleBtnText: {
    color: Colors.textWhite,
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Dev-only Sentry test ──
  devSection: {
    paddingHorizontal: Spacing.md,
    paddingTop: 16,
  },
  devSentryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.white05,
    borderWidth: 1,
    borderColor: Colors.gold + '30',
    borderRadius: Radius.button,
    paddingVertical: 10,
    borderStyle: 'dashed',
  },
  devSentryBtnText: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // ── Genel ──
  bottomSpacer: {
    height: 100,
  },

  // ── Hesap silme overlay ──
  deletingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  deletingOverlayText: {
    color: Colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

// ─── Nickname Modal Stilleri ──────────────────────────────────────────────────

const nicknameModalStyles = StyleSheet.create({
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Radius.button,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.textWhite,
    fontSize: 16,
    marginBottom: 6,
  },
  charCount: {
    color: Colors.textGrey,
    fontSize: 11,
    textAlign: 'right',
    marginBottom: Spacing.md,
    opacity: 0.7,
  },
});

// ─── Settings Modal Stilleri ──────────────────────────────────────────────────

const settingsModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.cardSolid,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    paddingTop: 12,
    gap: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.white10,
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.white10,
  },
  title: {
    flex: 1,
    color: Colors.textWhite,
    fontSize: 16,
    fontFamily: Typography.displayFont,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: {
    color: Colors.textWhite,
    fontSize: 14,
  },
  manageNote: {
    color: Colors.textGrey,
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 24,
    marginTop: -8,
  },
  langToggle: {
    flexDirection: 'row',
    gap: 6,
  },
  langOption: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.chip,
    borderWidth: 1,
    borderColor: Colors.white10,
    backgroundColor: Colors.white05,
  },
  langOptionActive: {
    backgroundColor: Colors.goldDim,
    borderColor: Colors.gold,
  },
  langText: {
    color: Colors.textGrey,
    fontSize: 13,
    fontWeight: '600',
  },
  langTextActive: {
    color: Colors.gold,
  },
  linkSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.white10,
    paddingTop: 12,
    gap: 10,
  },
  linkInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  linkTextBlock: {
    flex: 1,
  },
  linkTitle: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: '600',
  },
  linkSubtitle: {
    color: Colors.textGrey,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1C1C1E',
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.white10,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  appleBtnText: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: '600',
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.white10,
  },
  dangerLabel: {
    color: Colors.error,
    fontSize: 14,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.white10,
  },

  // ── Delete Account ──────────────────────────────────────────────────────────
  /** Üstteki içeriklerden net şekilde ayrılan tehlikeli eylem bölümü */
  deleteAccountSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: `${Colors.error}30`,
    borderRadius: 12,
    backgroundColor: `${Colors.error}08`,
    padding: 12,
  },
  deleteAccountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  deleteAccountTextBlock: {
    flex: 1,
    gap: 4,
  },
  deleteAccountLabel: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteAccountHint: {
    color: Colors.textGrey,
    fontSize: 11,
    lineHeight: 15,
    opacity: 0.8,
  },
});
