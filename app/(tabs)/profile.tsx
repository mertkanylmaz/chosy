/**
 * Profil ekranı — kullanıcının sinema kimliği.
 *
 * P3.4 Stable Revision (2026-04-06):
 *   Crash-prone ve P5'te kaldirilacak section'lar temizlendi.
 *   Crash nedeni: GenreDonutChart (react-native-svg native crash) +
 *   var olmayan RPCs (tonight_pick, get_user_stats, get_mood_timeline).
 *
 * Aktif section'lar:
 *  1. Profile Header (avatar + isim + auth rozeti)
 *  2. Cinema DNA (son profil ozeti) — v1'de gizli, `isCinemaDnaEnabled`
 *  3. Watched (watchlist.watched_at sayisi — Fix 6)
 *  4. Saved (watchlist ozeti)
 *  5. Membership
 *  Settings modal (dil, bildirim, watchlist temizle, hesap)
 *
 * Tasarim referansi: design-reference/05-profile.png
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  type AlertButton,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
// V-4 Tur C: ikon aileleri — marka anlari Phosphor, fonksiyonel simgeler
// (ayar, geri, chevron, kapat, kilit) Ionicons.
import {
  AppleLogo,
  Camera,
  Diamond,
  Eye,
  FilmStrip,
  GoogleLogo,
  MagicWand,
  Sparkle,
  User,
} from 'phosphor-react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import * as Clipboard from 'expo-clipboard'; // Referral card UI'dan kaldirildi
import { useFocusEffect, useRouter } from 'expo-router';

import { supabase } from '@/services/supabase';
import * as Sentry from '@sentry/react-native';

import { logger } from '@/utils/logger';
import { posthogAnalytics } from '@/services/posthog';
import { useLanguage } from '@/contexts/LanguageContext';
// V-4 Tur C: yalniz `Colors.error` — Design OS'ta tehlike token'i yok; yikici
// eylemlerin (listeyi temizle, hesabi sil) bilinen istisnasi (kurucu karari).
import { Colors } from '@/constants/Colors';
import { AvatarIcons } from '@/constants/icons';
import { AVATAR_GLYPHS, AVATAR_IDS, isAvatarId, type AvatarId } from '@/constants/avatarGlyphs';
import { color, radius, size, space, type } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';
import { readStoredAvatar, writeStoredAvatar } from '@/utils/avatarStorage';
import { useStaggeredEntry } from '@/hooks/useStaggeredEntry';
import { useProModeAccess } from '@/hooks/useProModeAccess';
import { useReduceTransparency } from '@/hooks/useReduceTransparency';
import { TabBarInsetProvider, useTabBarInset } from '@/hooks/useTabBarInset';
import { hapticLight, hapticSelection } from '@/utils/haptics';
import { isCinemaDnaEnabled } from '@/constants/config';
import TasteDNA from '@/components/Profile/TasteDNA';
// WatchlistSection kaldirildi — watchlist-detail.tsx'e tasindi
// import GameScoreSummary from '@/components/Profile/GameScoreSummary';
import ErrorState from '@/components/ErrorState';
// C.9c: CollectionsCard + CinemaIdentity kaldirildi (K-07 · bible §7.3 "Rank · Radar
// donmus"). Bilesen dosyalari SILINMEDI, yalnizca profilden mount edilmiyor.
// C.9c: StreakCard hala baglanmadi — K-08 "Streak" bolumu backlog (R-A).
import {
  getLastParsedProfile,
  getSwipeInsights,
} from '@/services/profileService';
import Purchases from 'react-native-purchases';

import { clearWatchlist, getWatchlist } from '@/services/watchlist';
import {
  signInWithApple,
  deleteAccount,
  reauthenticateAppleForDeletion,
} from '@/services/authService';
import { clearIdentityCache } from '@/services/auth-utils';
import { resetToFreshSession } from '@/services/sessionReset';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { getArchetype } from '@/constants/archetypes';
import ContextualPaywall from '@/components/paywalls/ContextualPaywall';
import { useContextualPaywall } from '@/components/paywalls/useContextualPaywall';
import {
  getNotificationStatus,
  toggleNotifications,
} from '@/services/pushNotifications';
import { AiConsentHost } from '@/components/AiConsentSheet';
import { ensureAiConsent, hasAiConsent, revokeAiConsent } from '@/services/aiConsent';
import { formatUnlockTime } from '@/components/gauntlet/GauntletShell/unlockClock';
import { getChampionDatesSince, getLastChampion, type LastChampion } from '@/services/gauntletService';
import { RitualRing } from '@/components/Profile/RitualRing';
import { buildRitualWeek, ritualWeekStart } from '@/components/Profile/RitualRing/ritualWeek';
import type { PremiumStatus } from '@/utils/premiumStatus';

import type { SwipeInsight } from '@/types/profile';
import type { TasteProfile } from '@/types/index';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

type Locale = 'en' | 'tr';

/** Dil adları kendi dilinde (endonim) — `profile.english` / `profile.turkish`. */
const LANGUAGES: { code: Locale; labelKey: string }[] = [
  { code: 'en', labelKey: 'profile.english' },
  { code: 'tr', labelKey: 'profile.turkish' },
];

/** Saved poster seridindeki yuva sayisi — yukleme dilimi ile ayni kaynak. */
const SAVED_STRIP_SLOTS = 4;

/**
 * Header perdesi — son sampiyon posteri. Design OS §6 bilincli istisnasi
 * (kurucu talebi, 29 Eyl 2026). 30 Eyl 2026 kurucu referansi: bulaniklik
 * hafif, afis TANINIR; perde durum cubugunun arkasina uzanir. `ink` ortusu
 * metin kontrastini korur, alt gecis header'i zemine eritir.
 */
const HEADER_CURTAIN_BLUR = 4;
const HEADER_CURTAIN_DIM = withAlpha(color.surface.base, 0.45);
const HEADER_CURTAIN_FADE_TOP = withAlpha(color.surface.base, 0);

/** Avatar mercegi dis capi (pt) — Faz 2 ritual halkasi da bu olcuyu kullanir. */
const AVATAR_LENS_SIZE = 96;
/** Ritual halkasi cizgi kalinligi (pt). */
const RITUAL_RING_STROKE = 3;
/** Dis kenardan ic mercege uzaklik: halka + 4pt bosluk. */
const AVATAR_LENS_INSET = RITUAL_RING_STROKE + space.xs;

// Avatar secenekleri ve saklanan deger → glif eslemesi: constants/avatarGlyphs.ts
// Anahtar + tek seferlik tasima: utils/avatarStorage.ts

// ─── Section Heading ──────────────────────────────────────────────────────────

/**
 * Bolum basligi — Design OS `title` stili. V-4 Tur C: eski altin accent
 * cubugu + kalin display basligi kalkti.
 */
function SectionHeading({ title }: { title: string }) {
  return (
    <Text style={styles.sectionHeadingText} accessibilityRole="header">
      {title}
    </Text>
  );
}

// ─── Avatar Modal ─────────────────────────────────────────────────────────────

interface AvatarModalProps {
  /** Modal gorunur mu */
  visible: boolean;
  /** Mevcut secili avatar ID'si */
  current: AvatarId | null;
  /** Kapatma callback */
  onClose: () => void;
  /** Secim callback — avatar ID döner */
  onSelect: (avatarId: AvatarId) => void;
}

/**
 * Avatar secim modali — 9 sinema ekipmani glifi (Phosphor duotone), 3x3 grid,
 * `beam` kenar secim gostergesi. "Select" secim mevcut avatardan farkli
 * olana kadar devre disi.
 */
function AvatarModal({ visible, current, onClose, onSelect }: AvatarModalProps) {
  const { t } = useLanguage();
  const [temp, setTemp] = useState<AvatarId | null>(current);

  useEffect(() => {
    if (visible) {
      setTemp(current);
    }
  }, [visible, current]);

  const canSelect = temp !== null && temp !== current;

  function handleSelect() {
    if (!canSelect) return;
    onSelect(temp);
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
            {AVATAR_IDS.map((id) => {
              const { Icon, labelKey } = AVATAR_GLYPHS[id];
              const isSelected = temp === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.avatarOption, isSelected && styles.avatarOptionSelected]}
                  onPress={() => setTemp(id)}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityLabel={t(labelKey)}
                  accessibilityState={{ selected: isSelected }}>
                  <Icon size={36} weight="duotone" color={color.reward.primary} />
                  {/* Kesilme yok: numberOfLines verilmez, 2 satira kadar sarar. */}
                  <Text
                    style={[
                      styles.avatarOptionLabel,
                      isSelected && styles.avatarOptionLabelSelected,
                    ]}>
                    {t(labelKey)}
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
              style={[styles.selectBtn, !canSelect && styles.selectBtnDisabled]}
              onPress={handleSelect}
              disabled={!canSelect}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSelect }}>
              <Text style={styles.selectBtnText}>{t('profile.select')}</Text>
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
            placeholderTextColor={color.text.secondary}
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
              style={[styles.selectBtn, !canSave && styles.selectBtnDisabled]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.8}>
              <Text style={styles.selectBtnText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Sürüm satırı ────────────────────────────────────────────────────────────

/**
 * V-4 Tur B: Settings'in en altındaki "Chosy 2.1.0 (906)". Build numarası
 * gömülü Info.plist'ten (`Constants.platform.ios.buildNumber`) — app.json'daki
 * `ios.buildNumber` DEĞİL: `appVersionSource: remote` olduğu için o değer
 * bayat kalır. `expo-application` doğrudan bağımlılık değil, eklenmedi.
 * Güncelleme kimliği (update_id) burada GÖSTERİLMEZ — yalnız Sentry/PostHog.
 * Build numarası okunamazsa (Expo Go / dev) yalnız sürüm gösterilir.
 */
function appVersionLine(t: (key: string, options?: Record<string, unknown>) => string): string {
  const version = Constants.expoConfig?.version ?? '';
  const build =
    Platform.OS === 'ios'
      ? Constants.platform?.ios?.buildNumber
      : Constants.platform?.android?.versionCode?.toString();
  return build
    ? t('profile.versionLine', { version, build })
    : t('profile.versionLineNoBuild', { version });
}

// ─── Settings Modal ───────────────────────────────────────────────────────────

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  language: string;
  onLanguageChange: (code: 'en' | 'tr') => void;
  isAnonymous: boolean;
  /** V1-D3 üç hâlli durum — `loading`'de abonelik satırı çizilmez. */
  premiumStatus: PremiumStatus;
  /**
   * Aktif plan etiketi — Apple yonetim sayfasi oncesi gosterilir.
   * `null`: premium ama plan bilinmiyor → not cizilmez (Fix 7).
   */
  currentPlanLabel: string | null;
  linkingAccount: boolean;
  /** `users.push_enabled` — `null`: okunamadı (switch devre dışı). */
  notificationsEnabled: boolean | null;
  onToggleNotifications: (enabled: boolean) => void;
  /** AI rızası (R-1) — `null`: henüz okunmadı (switch devre dışı). */
  aiSuggestionsEnabled: boolean | null;
  onToggleAiSuggestions: (enabled: boolean) => void;
  onLinkApple: () => void;
  onClearWatchlist: () => void;
  onManageSubscription: () => void;
  /** `users.archetype_id` dolu mu — değilse "Share My Archetype" satırı çizilmez. */
  canShareArchetype: boolean;
  onShareArchetype: () => void;
  onSignOut: () => void;
  /** Hesap silme akışını başlatır — iki aşamalı onay */
  onDeleteAccount: () => void;
}

/**
 * Ayarlar bottom-sheet modal (V-1 Tur 5 / V-2 Tur E1).
 *
 * Sıra: Dil · Akşam bildirimi · Hesap bağlama · Abonelik · Paylaş · Çıkış ·
 * Yasal · en altta destructive grup (izleme listesini temizle + hesabı sil).
 * Gear icon'a tıklayınca açılır; profil sayfası temiz kalır.
 */
function SettingsModal({
  visible,
  onClose,
  language,
  onLanguageChange,
  isAnonymous,
  premiumStatus,
  currentPlanLabel,
  linkingAccount,
  notificationsEnabled,
  onToggleNotifications,
  aiSuggestionsEnabled,
  onToggleAiSuggestions,
  onLinkApple,
  onClearWatchlist,
  onManageSubscription,
  canShareArchetype,
  onShareArchetype,
  onSignOut,
  onDeleteAccount,
}: SettingsModalProps) {
  const { t } = useLanguage();
  const currentLanguageKey = LANGUAGES.find((l) => l.code === language)?.labelKey;
  const currentLanguageLabel = currentLanguageKey ? t(currentLanguageKey) : language;

  /**
   * Dil seçimi — iOS'ta native action sheet, diğer platformlarda Alert
   * düğmeleri. Seçim mevcut `onLanguageChange` yolundan geçer.
   */
  function openLanguagePicker(): void {
    hapticSelection();
    const labels = LANGUAGES.map(({ labelKey }) => t(labelKey));
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: t('profile.language'),
          options: [...labels, t('common.cancel')],
          cancelButtonIndex: labels.length,
        },
        (index) => {
          const picked = LANGUAGES[index];
          if (picked) onLanguageChange(picked.code);
        },
      );
      return;
    }
    Alert.alert(t('profile.language'), undefined, [
      ...LANGUAGES.map(({ code, labelKey }) => ({
        text: t(labelKey),
        onPress: () => onLanguageChange(code),
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  }

  const reminderLabel = t('notifications.dailyReminderLabel', { time: formatUnlockTime(language) });

  /**
   * V-4 Tur C (Kural 2): yasal linkin acilamamasi eskiden islenmemis bir
   * Promise reddiydi — kullanici hicbir sey gormuyordu.
   */
  function openLegalLink(url: string): void {
    WebBrowser.openBrowserAsync(url).catch((err: unknown) => {
      Sentry.captureException(err, {
        level: 'warning',
        tags: { screen: 'profile', flow: 'legal_link' },
        extra: { url },
      });
      Alert.alert(t('errors.openLink'));
    });
  }

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
            <Ionicons name="settings-outline" size={18} color={color.text.secondary} />
            <Text style={settingsModalStyles.title}>{t('profile.settingsSection')}</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('profile.closeSettings')}>
              <Ionicons name="close" size={22} color={color.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Dil — tek satır, action sheet */}
          <TouchableOpacity
            style={settingsModalStyles.row}
            onPress={openLanguagePicker}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${t('profile.language')}: ${currentLanguageLabel}`}>
            <View style={settingsModalStyles.rowLeft}>
              <Ionicons name="language-outline" size={16} color={color.text.secondary} />
              <Text style={settingsModalStyles.rowLabel}>{t('profile.language')}</Text>
            </View>
            <View style={settingsModalStyles.rowRight}>
              <Text style={settingsModalStyles.rowValue}>{currentLanguageLabel}</Text>
              <Ionicons name="chevron-forward" size={16} color={color.text.secondary} />
            </View>
          </TouchableOpacity>

          {/* Akşam bildirimi — TEK native switch (K-15, günde tek bildirim) */}
          <View style={settingsModalStyles.row}>
            <View style={settingsModalStyles.rowLeft}>
              <Ionicons name="notifications-outline" size={16} color={color.text.secondary} />
              <Text style={settingsModalStyles.rowLabel}>{reminderLabel}</Text>
            </View>
            <Switch
              value={notificationsEnabled === true}
              onValueChange={(next) => { hapticSelection(); onToggleNotifications(next); }}
              disabled={notificationsEnabled === null}
              trackColor={{ false: color.surface.border, true: color.accent.active }}
              ios_backgroundColor={color.surface.border}
              accessibilityRole="switch"
              accessibilityLabel={reminderLabel}
              accessibilityState={{
                checked: notificationsEnabled === true,
                disabled: notificationsEnabled === null,
              }}
            />
          </View>

          {/* AI önerileri (R-1) — kapatınca rıza geri çekilir, açınca sheet açılır */}
          <View style={settingsModalStyles.row}>
            <View style={settingsModalStyles.rowLeft}>
              <Ionicons name="sparkles-outline" size={16} color={color.text.secondary} />
              <Text style={settingsModalStyles.rowLabel}>{t('profile.aiSuggestions')}</Text>
            </View>
            <Switch
              value={aiSuggestionsEnabled === true}
              onValueChange={(next) => { hapticSelection(); onToggleAiSuggestions(next); }}
              disabled={aiSuggestionsEnabled === null}
              trackColor={{ false: color.surface.border, true: color.accent.active }}
              ios_backgroundColor={color.surface.border}
              accessibilityRole="switch"
              accessibilityLabel={t('profile.aiSuggestions')}
              accessibilityState={{
                checked: aiSuggestionsEnabled === true,
                disabled: aiSuggestionsEnabled === null,
              }}
            />
          </View>

          {/* Hesap bağlama — sadece anonim, native Apple butonu (HIG) */}
          {isAnonymous && Platform.OS === 'ios' && (
            <View style={settingsModalStyles.linkSection}>
              <View style={settingsModalStyles.linkInfo}>
                <Ionicons name="person-add-outline" size={16} color={color.text.secondary} />
                <View style={settingsModalStyles.linkTextBlock}>
                  <Text style={settingsModalStyles.linkTitle}>
                    {t('profile.linkAccountTitle')}
                  </Text>
                  <Text style={settingsModalStyles.linkSubtitle}>
                    {t('profile.linkAccountSubtitle')}
                  </Text>
                </View>
              </View>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
                cornerRadius={space.md}
                style={[settingsModalStyles.appleBtn, linkingAccount && settingsModalStyles.appleBtnBusy]}
                onPress={() => { if (!linkingAccount) onLinkApple(); }}
              />
            </View>
          )}

          {/* Abonelik — `loading`'de çizilmez (V1-D3: upsell yanlış kişiye görünmez) */}
          {premiumStatus !== 'loading' && (
            <TouchableOpacity
              style={settingsModalStyles.row}
              onPress={() => { onClose(); onManageSubscription(); }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={premiumStatus === 'premium' ? t('profile.manageSubscription') : t('profile.upgradePlus')}>
              <View style={settingsModalStyles.rowLeft}>
                <Ionicons name="diamond-outline" size={16} color={color.text.secondary} />
                <Text style={settingsModalStyles.rowLabel}>
                  {premiumStatus === 'premium' ? t('profile.manageSubscription') : t('profile.upgradePlus')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={color.text.secondary} />
            </TouchableOpacity>
          )}

          {/* Apple yonetim sayfasi hakkinda bilgi notu */}
          {/* Fix 7: plan bilinmiyorsa (null) not cizilmez — "Free" yazilmaz. */}
          {premiumStatus === 'premium' && currentPlanLabel !== null && (
            <Text style={settingsModalStyles.manageNote}>
              {t('profile.manageNote', { plan: currentPlanLabel })}
            </Text>
          )}

          {/* C.9c: "Founding Member" (lifetime) ve "Invite Friends" (referral)
              satirlari kaldirildi — ikisi de bible §7.3'te donmus. Paywall'a
              tek giris kaldi: yukaridaki abonelik satiri + Profile'daki
              "Chosy Pro" CTA'si (ikisi de `offerings.current`). */}

          {/* Share My Archetype — kaynak `users.archetype_id` (emekli quiz,
              R-12), Cinema DNA degil. Arketipi olmayan kullanicida satir
              cizilmez: aksi halde varsayilan "Mystery Cinephile" paylasilirdi
              (30 Eyl 2026, arketip hero kartiyla ayni kural). */}
          {canShareArchetype && (
            <TouchableOpacity
              style={settingsModalStyles.row}
              onPress={() => { onClose(); onShareArchetype(); }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('profile.shareArchetype')}>
              <View style={settingsModalStyles.rowLeft}>
                <Ionicons name="share-social-outline" size={16} color={color.text.secondary} />
                <Text style={settingsModalStyles.rowLabel}>{t('profile.shareArchetype')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={color.text.secondary} />
            </TouchableOpacity>
          )}

          {/* Çıkış yap — yalnızca oturum açmış kullanıcılar */}
          {!isAnonymous && (
            <TouchableOpacity
              style={settingsModalStyles.row}
              onPress={onSignOut}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('profile.signOut')}
              accessibilityHint={t('profile.signOutConfirmMessage')}>
              <View style={settingsModalStyles.rowLeft}>
                <Ionicons name="log-out-outline" size={16} color={color.text.secondary} />
                <Text style={settingsModalStyles.rowLabel}>{t('profile.signOut')}</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Yasal linkler */}
          <TouchableOpacity
            style={settingsModalStyles.row}
            onPress={() => openLegalLink('https://abalone-dracopelta-382.notion.site/Chosy-ai-Privacy-Policy-34a00bffbfbe80af9f5fd996fa7ab55b')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('paywall.privacy')}>
            <View style={settingsModalStyles.rowLeft}>
              <Ionicons name="shield-checkmark-outline" size={16} color={color.text.secondary} />
              <Text style={settingsModalStyles.rowLabel}>{t('paywall.privacy')}</Text>
            </View>
            <Ionicons name="open-outline" size={14} color={color.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={settingsModalStyles.row}
            onPress={() => openLegalLink('https://www.notion.so/Chosy-ai-Terms-of-Service-34a00bffbfbe80899613c3ce2e5ed01b')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('paywall.terms')}>
            <View style={settingsModalStyles.rowLeft}>
              <Ionicons name="document-text-outline" size={16} color={color.text.secondary} />
              <Text style={settingsModalStyles.rowLabel}>{t('paywall.terms')}</Text>
            </View>
            <Ionicons name="open-outline" size={14} color={color.text.secondary} />
          </TouchableOpacity>

          {/* Destructive grup — en altta, tek stil (kırmızı metin, kutu yok).
              İkisi de onay diyaloğu açar (handleClearWatchlist /
              handleDeleteAccount). */}
          <View style={settingsModalStyles.dangerGroup}>
            <TouchableOpacity
              style={settingsModalStyles.dangerRow}
              onPress={() => { onClose(); onClearWatchlist(); }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('profile.clearWatchlist')}
              accessibilityHint={t('profile.clearWatchlistMessage')}>
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
              <Text style={settingsModalStyles.dangerLabel}>{t('profile.clearWatchlist')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={settingsModalStyles.dangerRow}
              onPress={() => { onClose(); onDeleteAccount(); }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('profile.deleteAccount')}
              accessibilityHint={t('profile.deleteAccountConfirmMessage')}>
              <Ionicons name="person-remove-outline" size={16} color={Colors.error} />
              <Text style={settingsModalStyles.dangerLabel}>{t('profile.deleteAccount')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={settingsModalStyles.versionLine}>{appVersionLine(t)}</Text>

        </TouchableOpacity>
      </TouchableOpacity>
      {/* R-1: iOS Modal üstüne Modal'ı kök VC'den sunamaz — rıza sheet'i bu modalın içinden açılır. */}
      <AiConsentHost />
    </Modal>
  );
}

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

/**
 * Profil ekrani — P3.4 stable revision.
 * Kaldirilan: TonightPick, SwipeIntelligence, MoodTimeline, WatchHistory,
 *             GenreDonutChart, MoodPatternChart (crash-prone + P5'te kaldirilacak).
 *
 * V-4 Tur A: alt pay olcumu ekranin DISINDA kurulur — `useTabBarInset()`
 * yalniz provider altinda okunabilir ve olcum view'i tam ekrani kaplamali
 * (GauntletShell ile ayni desen).
 */
export default function ProfileScreen() {
  return (
    <TabBarInsetProvider>
      <ProfileScreenContent />
    </TabBarInsetProvider>
  );
}

function ProfileScreenContent() {
  const router = useRouter();
  /** V-4 Tur A: tab bar + home indicator — kaydirma iceriginin alt payi. */
  const tabBarInset = useTabBarInset();
  /** Header perdesi durum cubugunun arkasina uzanir — ust pay header'da. */
  const insets = useSafeAreaInsets();
  const { t, language, setLanguage } = useLanguage();
  const { isPremium, premiumStatus, planId, tier, status: subStatus, isInTrial, expiresAt, quota, resetSubscriptionState } = useSubscription();
  const { triggerPaywall, paywallProps } = useContextualPaywall();
  /** Pro Mode satirindaki kilit ikonu — yetki kontrolu ekranin kendisinde */
  const proAccess = useProModeAccess();

  // ── Plan bilgisi (B-1 / Fix 7) ──
  // Rozet entitlement'tan (`premiumStatus`), plan adi `tier`'dan gelir.
  // Eslenemeyen urun ID'si `tier`'i 'free' birakir: premium + 'free' =
  // bilinmeyen plan → plan satiri CIZILMEZ (ne "Free") + Sentry.
  // `weekly_legacy` bilinen eski plan: satir yok, Sentry yok.
  // Lifetime: istemci eslemesi (`planIdToTier`) 'lifetime'i tier'a CEVIRMIYOR
  // ve `tier` 'free' kaliyor; bu yuzden DB plan kimligi (`planId`) okunur
  // (REACT-NATIVE-J). Tier esleme bosluğu ayrica raporlandi.
  const knownPlanTitle: string | null =
    tier === 'annual' ? t('paywall.annualTitle')
      : tier === 'monthly' ? t('paywall.monthlyTitle')
      : planId === 'lifetime' ? t('paywall.lifetimeTitle')
      : null;
  const isUnknownPremiumPlan =
    premiumStatus === 'premium' && tier !== 'weekly_legacy' && knownPlanTitle === null;

  /**
   * Rozet alt satiri. "renews" DEGIL: `willRenew` context'e tasinmiyor,
   * iptal edilmis abonelikte yaniltici olurdu (TEKNIK_BORC). Bitis tarihi
   * yoksa yalnizca plan adi.
   */
  const planLine: string | null = (() => {
    if (premiumStatus !== 'premium' || knownPlanTitle === null) return null;
    if (!expiresAt) return knownPlanTitle;
    const date = expiresAt.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return t(isInTrial ? 'profile.planTrialEnds' : 'profile.planActiveUntil', {
      plan: knownPlanTitle,
      date,
    });
  })();

  useEffect(() => {
    if (!isUnknownPremiumPlan) return;
    Sentry.captureException(new Error('profile: premium entitlement, plan eslenemedi'), {
      tags: { screen: 'profile', fn: 'planInfo', error_code: 'PROFILE_UNKNOWN_PLAN' },
      extra: { tier, planId, subStatus },
    });
  }, [isUnknownPremiumPlan, tier, planId, subStatus]);

  const headerAnimStyle = useStaggeredEntry(0);
  const sectionsAnimStyle = useStaggeredEntry(1, { baseDelay: 150 });

  const [swipeInsights, setSwipeInsights] = useState<SwipeInsight | null>(null);
  const [lastProfile, setLastProfile] = useState<TasteProfile | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  /** `users.created_at` — "Cinephile since" satiri; okunamazsa satir cizilmez. */
  const [joinedAt, setJoinedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarId, setAvatarId] = useState<AvatarId | null>(null);
  /**
   * `public.users.id` — avatar anahtari buna baglidir. `loadAll` cozer;
   * cozulene kadar `null` (bootstrap bitmemis / cevrimdisi).
   */
  const publicUserIdRef = useRef<string | null>(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [archetypeId, setArchetypeId] = useState<number | null>(null);
  const [authProvider, setAuthProvider] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [linkingAccount, setLinkingAccount] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  /** `users.ai_consent_at` (R-1) — `null`: henüz okunmadı. */
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState<boolean | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  /** `users.push_enabled` — `null`: henüz okunmadı ya da okunamadı. */
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [watchlistPosters, setWatchlistPosters] = useState<string[]>([]);
  const reduceTransparency = useReduceTransparency();
  /**
   * Son sampiyon — header "perde"si ve Watched'in "son secimin" karti
   * (V-4 Tur C, V4-D5). `pending`: henuz okunmadi; `error`: okunamadi (servis
   * Sentry'ye yazdi) — kart da bos kopya da cizilmez, sessiz "yok" gosterilmez.
   */
  const [lastChampion, setLastChampion] = useState<
    | { status: 'pending' }
    | { status: 'ok'; champion: LastChampion | null }
    | { status: 'error' }
  >({ status: 'pending' });
  const championPosterUrl =
    lastChampion.status === 'ok' ? lastChampion.champion?.posterUrl ?? null : null;
  /**
   * Ritual halkasi — son 7 gunun sampiyon dolulugu. null → yuklenmedi veya
   * hata: halka cizilmez, mercek duz `graphite` hairline'a doner (sahte
   * "0/7" gosterilmez).
   */
  const [ritualWeek, setRitualWeek] = useState<boolean[] | null>(null);
  /** Izlenen film sayisi — `null`: yuklenmedi ya da hata (satir cizilmez). */
  const [watchedCount, setWatchedCount] = useState<number | null>(null);

  // C.9c: moodHistory · streakInfo · nextMilestone · referralStats state'leri
  // kaldirildi. Dordu de fetch ediliyordu ama HICBIRI render edilmiyordu —
  // her profil acilisinda 5 gereksiz sorgu. Streak/Watched bolumleri K-08'de
  // hedefleniyor ama bu turda insa EDILMIYOR (backlog R-A/R-B); geri
  // geldiklerinde fetch de birlikte gelir.

  // ─── Avatar yukleme ───────────────────────────────────────────────────────

  /**
   * Anahtar `chosy_user_avatar_{publicUserId}`; ilk okumada eski cihaz bazli
   * anahtar tasinir (utils/avatarStorage.ts). `loadAll` icinden, public id
   * cozulduktan SONRA cagrilir — oncesinde anahtar kurulamaz.
   *
   * Taninmayan deger sessizce varsayilana dusmez: Sentry'ye yazilir, baslik
   * avatarsiz (User glifi) cizilir.
   */
  const loadAvatar = useCallback(async (publicUserId: string) => {
    try {
      const saved = await readStoredAvatar(AsyncStorage, publicUserId);
      if (saved === null) {
        setAvatarId(null);
        return;
      }
      if (!isAvatarId(saved)) {
        setAvatarId(null);
        Sentry.captureMessage('[Profile] taninmayan avatar degeri', {
          level: 'warning',
          tags: { screen: 'profile', fn: 'loadAvatar' },
          extra: { saved },
        });
        return;
      }
      setAvatarId(saved);
    } catch (err) {
      Sentry.captureException(err, { tags: { screen: 'profile', fn: 'loadAvatar' } });
      // V-4 Tur C: capture elle yapildi — logger koprusu ikinci event uretmesin.
      logger.error('[ProfileScreen] avatar yukleme hatasi:', err, { skipBridge: true });
    }
  }, []);

  // ─── Veri yukleme ─────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoadError(false);
    try {
      // Yerel oturum (ağ yok). is_anonymous / app_metadata bayat olabilir:
      // linkIdentity sonrası oturum yenilenene kadar eski değeri taşır.
      const { data: sessionData } = await supabase.auth.getSession();
      const authUser = sessionData.session?.user;
      if (!authUser) return;

      // Auth provider bilgisi
      const provider = authUser.app_metadata?.provider ?? null;
      setAuthProvider(provider);
      setAuthEmail(authUser.email ?? null);
      setIsAnonymous(authUser.is_anonymous ?? true);

      const { data: userRow } = await supabase
        .from('users')
        .select('id, display_name, username, archetype_id, created_at')
        .eq('auth_id', authUser.id)
        .single();

      if (!userRow) {
        // Bootstrap penceresi: ensureAppUser (app/_layout.tsx) henuz satir
        // acmamis. Avatar anahtari kurulamaz; sonraki focus yeniden dener.
        Sentry.addBreadcrumb({
          category: 'profile',
          level: 'warning',
          message: 'loadAll: public.users satiri yok — avatar okunmadi',
        });
        return;
      }
      const userId: string = userRow.id;
      publicUserIdRef.current = userId;
      void loadAvatar(userId);

      // Son sampiyon — header perdesi + "son secimin" karti (non-blocking).
      // Hata servis katmaninda Sentry'ye yazildi; perde ve kart cizilmez.
      getLastChampion(userId)
        .then((champion) => setLastChampion({ status: 'ok', champion }))
        .catch((err: unknown) => {
          setLastChampion({ status: 'error' });
          logger.warn('[ProfileScreen] son sampiyon yuklenemedi:', err);
        });

      // Ritual halkasi — son 7 UTC gunu (non-blocking). Hata servis
      // katmaninda Sentry'ye yazildi; halka cizilmez.
      const ritualNow = new Date();
      getChampionDatesSince(userId, ritualWeekStart(ritualNow))
        .then((dates) => setRitualWeek(buildRitualWeek(dates, ritualNow)))
        .catch((err: unknown) => {
          setRitualWeek(null);
          logger.warn('[ProfileScreen] ritual haftasi yuklenemedi:', err);
        });

      // İsim önceliği: username → display_name → auth metadata adı → null (fallback i18n'den gelir)
      type UserRow = {
        id: string;
        display_name: string | null;
        username: string | null;
        archetype_id: number | null;
        created_at: string;
      };
      const row = userRow as UserRow;
      const metaName = (authUser.user_metadata?.full_name as string | undefined)
        ?? (authUser.user_metadata?.name as string | undefined)
        ?? null;
      setDisplayName(row.username ?? row.display_name ?? metaName);

      // "Cinephile since" — created_at NOT NULL; ayrıştırılamazsa satır
      // çizilmez ve Sentry'ye yazılır (sessiz yanlış tarih yok).
      const joined = new Date(row.created_at);
      if (Number.isNaN(joined.getTime())) {
        Sentry.captureMessage('profile: users.created_at ayrıştırılamadı', {
          level: 'warning',
          tags: { component: 'ProfileScreen' },
          extra: { created_at: row.created_at },
        });
        setJoinedAt(null);
      } else {
        setJoinedAt(joined);
      }

      // Kalibrasyon sonucu arketip (onboarding'den kaydedilen)
      const calibrationArchetypeId = row.archetype_id;
      setArchetypeId(calibrationArchetypeId ?? null);

      // Faz 1: Kritik veriler (üst kısımda görünen)
      // V-2 Tur E1: `daily_pick_enabled` / `watchlist_notifications_enabled`
      // artik okunmuyor (K-15 tek switch). Kolonlar silinmedi — TEKNIK_BORC.
      // Cinema DNA v1'de kapali (`isCinemaDnaEnabled`, CTO 30 Eyl 2026):
      // kapaliyken `sessions` ve `watchlist` okumalari hic atilmaz.
      const dnaEnabled = isCinemaDnaEnabled();
      const [profileData, pushStatus] = await Promise.all([
        dnaEnabled ? getLastParsedProfile(userId) : Promise.resolve(null),
        getNotificationStatus(),
      ]);
      setNotificationsEnabled(pushStatus);

      setLastProfile(profileData);

      // Faz 2: İkincil veriler (aşağıda, lazy)
      if (dnaEnabled) {
        const insightsData = await getSwipeInsights(userId);
        setSwipeInsights(insightsData);
      }

      // Watched sayisi (non-blocking). B-1 / Fix 6: tek kaynak
      // `watchlist.watched_at` — kaynagi ne olursa olsun izlenen her film
      // (gauntlet "seen", "dun izledin mi?" loved/ok/abandoned, listeden
      // elle isaret). `watch_feedback` satisfaction metrigi olarak kalir
      // (K-27), sayacin kaynagi degildir.
      // Kimlik `public.users.id` — `auth.uid()` DEGIL; watchlist RLS'i
      // ayni eslemeyi yapar (083).
      // Hata: satir gizlenir + Sentry. Sessiz 0 gosterilmez (kural 1).
      void (async () => {
        const { count, error } = await supabase
          .from('watchlist')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .not('watched_at', 'is', null);
        if (error || count === null) {
          setWatchedCount(null);
          Sentry.captureException(error ?? new Error('watchlist watched count null'), {
            tags: { screen: 'profile', fn: 'watchedCount' },
          });
          return;
        }
        setWatchedCount(count);
      })();

      // Saved count + poster previews (non-blocking). Saved = kaydedilmis
      // ve henuz izlenmemis (`watched_at IS NULL`); izlenenler Watched'ta.
      getWatchlist().then((wl) => {
        const saved = wl.filter((item) => item.watchedAt === null);
        setWatchlistCount(saved.length);
        const posters = saved
          .slice(0, SAVED_STRIP_SLOTS)
          .map((item) => item.film.posterUrl)
          .filter((url): url is string => !!url);
        setWatchlistPosters(posters);
      }).catch((err) => {
        // Sayac 0 / poster yok kalir — ikincil istatistik, ekrani bloklamaz.
        // Servis katmani hatayi Sentry'ye yazdi.
        logger.warn('[ProfileScreen] watchlist sayaci yuklenemedi:', err);
      });
    } catch (err) {
      logger.error('[ProfileScreen] veri yukleme hatasi:', err);
      setLoadError(true);
    }
  }, [loadAvatar]);

  // ── İlk yükleme (loading spinner gösterir) ───────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      await loadAll();
      if (!cancelled) setLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, [loadAll]);

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

  async function handleAvatarSelect(id: AvatarId) {
    const publicUserId = publicUserIdRef.current;
    try {
      if (!publicUserId) throw new Error('avatar kaydi: publicUserId cozulmedi');
      await writeStoredAvatar(AsyncStorage, publicUserId, id);
      setAvatarId(id);
    } catch (err) {
      Sentry.captureException(err, { tags: { screen: 'profile', fn: 'handleAvatarSelect' } });
      logger.error('[ProfileScreen] avatar kayit hatasi:', err, { skipBridge: true });
      Alert.alert(t('profile.avatarSaveError'));
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
      const { data: sessionData } = await supabase.auth.getSession();
      const authId = sessionData.session?.user?.id;
      if (!authId) throw new Error('no_auth');

      const { error } = await supabase
        .from('users')
        .update({ display_name: newName })
        .eq('auth_id', authId);

      if (error) throw error;
    } catch (err) {
      logger.error('[Profile] nickname kayit hatasi:', err);
      setDisplayName(prev); // Geri al
      Alert.alert(t('errors.profileLoad'));
    }
  }

  // ─── Aksiyonlar ───────────────────────────────────────────────────────────

  /**
   * Upgrade niyetinin tek girisi — "Chosy Pro" CTA'si ve Settings'teki
   * abonelik satiri buradan gecer.
   *
   * ⚠️ `triggerPaywall` bir Promise<boolean> dondurur ve orchestrator paywall'i
   * gostermemeye karar verebilir. Onceden bu deger hic okunmuyordu: karar `null`
   * oldugunda dokunus sessizce yutuluyordu (C.9d bug'i — kok neden
   * `paywall_profile_upgrade` flag'iydi, `triggerOrchestrator`'da kaldirildi).
   * Flag gittikten sonra `false` yalnizca beklenmedik durumda (or. trial)
   * gelebilir; CTA zaten `premiumStatus === 'free'` ile korundugu icin bu bir anomalidir ve
   * sessizce yutulmaz — Sentry'ye yansir (kural 1).
   *
   * `/paywall` route'una DUSULMEZ: o dosya deprecated bir stub'dir, acilir
   * acilmaz `router.back()` yapar — olu bir fallback olurdu.
   */
  async function handleUpgradePress(): Promise<void> {
    const shown = await triggerPaywall({ type: 'profile_upgrade' });
    if (!shown) {
      Sentry.captureMessage('[Profile] profile_upgrade paywall acilmadi', {
        level: 'warning',
        tags: { screen: 'profile', flow: 'upgrade_cta' },
        extra: { isPremium, tier },
      });
      logger.warn('[Profile] profile_upgrade paywall acilmadi');
    }
  }

  /**
   * Abonelik yonetimi — premium kullanicilar iOS native ayarlara,
   * free kullanicilar paywall'a yonlendirilir.
   */
  async function handleManageSubscription(): Promise<void> {
    // V1-D3: satir `loading`'de cizilmez; yine de ulasilirsa hicbir sey yapma.
    if (premiumStatus === 'loading') return;
    if (premiumStatus === 'premium') {
      try {
        await Purchases.showManageSubscriptions();
      } catch (err) {
        // Native URL ile acilir — kullanici yine yonetim sayfasina ulasir,
        // ama RC sheet'inin acilmamasi iz birakir (kural 1/2).
        Sentry.captureException(err, {
          level: 'warning',
          tags: { screen: 'profile', flow: 'manage_subscription' },
        });
        const url = Platform.OS === 'ios'
          ? 'itms-apps://apps.apple.com/account/subscriptions'
          : 'https://play.google.com/store/account/subscriptions';
        await Linking.openURL(url);
      }
    } else {
      await handleUpgradePress();
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
              Alert.alert(t('profile.clearWatchlistSuccess'));
            } catch {
              // V-4 Tur C: servis katmani (`logger.error`) hatayi Sentry'ye
              // yazdi — ekranda ikinci event uretilmez; kullaniciya soylenir.
              Alert.alert(t('errors.watchlistClear'));
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
      switch (result.outcome) {
        case 'signed_in':
          await loadAll();
          Alert.alert(
            t('profile.linkSuccess'),
            t('profile.linkSuccessMessage'),
          );
          break;
        case 'identity_already_exists':
          // Apple kimliği başka hesapta — o hesaba girildi. Taşıma sonucu
          // (`result.merge`) kullanıcıya yansımaz: `failed` authService'te
          // Sentry'ye yazıldı, hesap girişi yine geçerli (1b kararı).
          await loadAll();
          Alert.alert(t('auth.existingAccountSignedIn'));
          break;
        case 'canceled':
          break;
        case 'not_available':
        case 'network':
        case 'failed':
          Alert.alert(
            t('profile.linkError'),
            t('profile.linkErrorMessage'),
          );
          break;
        default: {
          const unreachable: never = result;
          throw new Error(`[Profile] Beklenmeyen AuthResult: ${JSON.stringify(unreachable)}`);
        }
      }
    } catch (err) {
      logger.error('[Profile] Apple link hatasi:', err);
      // V-4 Tur C (Kural 1): beklenmedik hata artik kullaniciya da soylenir.
      Alert.alert(t('profile.linkError'), t('profile.linkErrorMessage'));
    } finally {
      setLinkingAccount(false);
    }
  }

  // TODO: Google Sign-In — native rebuild sonrası geri eklenecek
  // async function handleLinkGoogle() { ... }

  // ─── Çıkış ────────────────────────────────────────────────────────────────

  /**
   * Oturumu kapatır ve cihazı yeni anonim kimlikle onboarding'e taşır.
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
            // Hesap silmeyle aynı rutin (4b): analitik/RC sıfırlama (RC logOut
            // hatası Sentry'ye) → yerel veri temizliği → signOut → yeni anonim
            // oturum → onboarding. Kullanıcı Profil'deki "Sign in" ile geri
            // girer. Sunucudaki hesap ve veri yerinde kalır.
            await resetToFreshSession({
              resetSubscriptionState,
              navigateToOnboarding: () => {
                if (router.canDismiss()) router.dismissAll();
                router.replace('/onboarding');
              },
            });
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
   *
   * 29 Eyl 2026: premium kullanıcıya iki aşamada da Apple aboneliğinin
   * hesap silinince DURMADIĞI söylenir — mağaza aboneliğini uygulama iptal
   * edemez, yenilemeler sürer (Sentry: silinen hesapların RENEWAL'ları).
   * Onay akışı ve silme mantığı aynı; yalnız metin.
   */
  function handleDeleteAccount(): void {
    void hapticLight();

    const confirmMessage =
      premiumStatus === 'premium'
        ? t('profile.deleteAccountConfirmMessage') +
          '\n\n' +
          t('profile.deleteAccountAppleSubscriptionNote')
        : t('profile.deleteAccountConfirmMessage');

    // Aktif abonelik varsa (anonim Pro dahil) iptal etmek için mağaza
    // yönetimine giden buton. Mantık handleManageSubscription'da.
    const manageButtons: AlertButton[] =
      premiumStatus === 'premium'
        ? [
            {
              text: t('profile.manageSubscription'),
              onPress: () => void handleManageSubscription(),
            },
          ]
        : [];

    Alert.alert(
      t('profile.deleteAccountConfirmTitle'),
      confirmMessage,
      [
        { text: t('common.cancel'), style: 'cancel' },
        ...manageButtons,
        {
          text: t('profile.deleteAccountConfirm'),
          style: 'destructive',
          onPress: () => {
            // İkinci onay — çift güvence
            Alert.alert(
              t('profile.deleteAccountConfirmTitle'),
              t('profile.deleteAccountDeleting') + '\n\n' + confirmMessage,
              [
                { text: t('common.cancel'), style: 'cancel' },
                ...manageButtons,
                {
                  text: t('profile.deleteAccountConfirm'),
                  style: 'destructive',
                  onPress: async () => {
                    setDeletingAccount(true);
                    try {
                      // Apple identity varsa önce yeniden doğrulama (5.1.1(v)).
                      // Code tek kullanımlık ve ~5 dk geçerli: hemen gönderilir.
                      // İptal / okuma hatasında hiçbir veri silinmez.
                      const reauth = await reauthenticateAppleForDeletion();
                      if (reauth.outcome === 'cancelled') {
                        Alert.alert(
                          t('profile.deleteAccountConfirmTitle'),
                          t('profile.deleteAccountAppleCancelled'),
                        );
                        return;
                      }
                      if (reauth.outcome === 'identities_failed') {
                        Alert.alert(
                          t('profile.deleteAccountConfirmTitle'),
                          t('profile.deleteAccountIdentitiesError'),
                        );
                        return;
                      }

                      const result = await deleteAccount(
                        reauth.outcome === 'code' ? reauth.code : undefined,
                      );
                      if (result.success) {
                        // Sunucu sildi — cihazı yeni anonim kimlikle temiz
                        // başlat; yığın sıfırlanır, geri hareketi yok.
                        await resetToFreshSession({
                          resetSubscriptionState,
                          navigateToOnboarding: () => {
                            if (router.canDismiss()) router.dismissAll();
                            router.replace('/onboarding');
                          },
                        });
                      } else {
                        // partial_failure: veri silindi, auth kaydi kaldi.
                        // Oturum acik birakilir — tekrar dokunmak islemi bitirir.
                        const msg =
                          result.error === 'network_error'
                            ? t('profile.deleteAccountNetworkError')
                            : result.error === 'partial_failure'
                              ? t('profile.deleteAccountPartialError')
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
                      // Sonuç ne olursa olsun: partial_failure'da oturum açık
                      // kalır ama public.users satırı silinmiştir — eski id
                      // bellekten dönmemeli.
                      clearIdentityCache();
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

  // ─── Notification toggle (K-15 tek switch) ─────────────────────────────

  /**
   * Optimistic switch + geri alma. Basarisizlik sessiz kalmaz: izin reddi
   * kullaniciya Ayarlar yolunu gosterir, diger hatalar genel mesaj verir
   * (servis tarafi Sentry'ye yazdi).
   */
  async function handleToggleNotifications(enabled: boolean): Promise<void> {
    const prev = notificationsEnabled;
    setNotificationsEnabled(enabled); // Optimistic
    const result = await toggleNotifications(enabled);
    if (result === 'ok') return;

    setNotificationsEnabled(prev); // Rollback
    if (result === 'permission_denied') {
      Alert.alert(
        t('notifications.permissionDeniedTitle'),
        t('notifications.permissionDeniedMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('notifications.openSettings'), onPress: () => void Linking.openSettings() },
        ],
      );
      return;
    }
    Alert.alert(t('notifications.toggleError'));
  }

  // ─── AI önerileri anahtarı (R-1) ────────────────────────────────────

  /** Ayarlar her açıldığında güncel rıza okunur (başka yüzeyden verilmiş olabilir). */
  useEffect(() => {
    if (!showSettings) return;
    let active = true;
    hasAiConsent()
      .then((granted) => {
        if (active) setAiSuggestionsEnabled(granted);
      })
      .catch((err: unknown) => {
        Sentry.captureException(err, {
          tags: { screen: 'profile', flow: 'ai_consent_read' },
        });
      });
    return () => {
      active = false;
    };
  }, [showSettings]);

  /**
   * Açmak rıza sheet'ini açar (sonuç reddederse anahtar geri döner); kapatmak
   * rızayı geri çeker. Geri çekme yazılamadıysa anahtar geri alınır ve hata
   * gösterilir — rıza sunucuda duruyorsa arayüz "kapalı" demez.
   */
  async function handleToggleAiSuggestions(enabled: boolean): Promise<void> {
    const prev = aiSuggestionsEnabled;
    setAiSuggestionsEnabled(enabled); // Optimistic
    if (enabled) {
      const granted = await ensureAiConsent('settings', { explicit: true });
      if (!granted) setAiSuggestionsEnabled(prev); // Rollback
      return;
    }
    const revoked = await revokeAiConsent();
    if (revoked) return;
    setAiSuggestionsEnabled(prev); // Rollback
    Alert.alert(t('aiConsent.saveError'));
  }

  // ─── Share Archetype ─────────────────────────────────────────────────

  async function handleShareArchetype(): Promise<void> {
    const archetype = archetypeId !== null ? getArchetype(archetypeId) : null;
    const name = archetype ? t(archetype.nameKey) : t('onboarding.mysteryType');

    posthogAnalytics.track('archetype_share_initiated', {
      archetype_id: archetypeId,
      archetype_name: name,
      source: 'settings',
    });

    try {
      const message = `I'm a ${name} 🎬 Which cinephile archetype are you?\nchosy.vercel.app`;
      const result = await Share.share(
        Platform.OS === 'ios'
          ? { message, url: 'https://chosy.vercel.app' }
          : { message },
      );

      if (result.action === Share.sharedAction) {
        posthogAnalytics.track('archetype_share_completed', {
          archetype_id: archetypeId,
          archetype_name: name,
          source: 'settings',
        });
      }
    } catch (err) {
      logger.error('[Profile] shareArchetype error:', err);
    }
  }

  /** Secili avatarin glifi; secim yoksa notr `User` glifi. */
  const HeaderAvatarIcon = avatarId ? AVATAR_GLYPHS[avatarId].Icon : User;

  // C.9c: handleShareReferral kaldirildi — referral v1 kapsaminda donmus
  // (bible §7.3) ve fonksiyon zaten hicbir yerden cagrilmiyordu.

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loadError && !loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="light" backgroundColor={color.surface.base} />
        <ErrorState
          errorType="server"
          message={t('errors.profileLoad')}
          onRetry={async () => {
            setLoading(true);
            setLoadError(false);
            await loadAll();
            setLoading(false);
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    // 30 Eyl 2026: ust kenar dolgusu yok — header perdesi durum cubugunun
    // arkasina uzanir; ust pay `headerSection`'da (`insets.top`).
    <SafeAreaView style={styles.safe} edges={[]}>
      <StatusBar style="light" backgroundColor={color.surface.base} />
      {/* V-4 Tur A (V4-D3): eski iki durakli gradyan ayni rengin iki kopyasiydi
          (#0A0A0F → #0A0A0F); zemin artik `safe`'in duz `ink`'i. */}
      <View style={styles.gradient}>
        <ScrollView
          style={styles.scroll}
          // V-4 Tur A: alt pay native olcumden (tab bar + home indicator) —
          // en alttaki oge bar'in USTUNDE tam gorunur. Sabit deger yazilmaz.
          contentContainerStyle={{ paddingBottom: tabBarInset + space.lg }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={color.text.secondary}
              colors={[color.text.secondary]}
            />
          }>

          {/* ── Profile Header ────────────────────────────────────────── */}
          <Animated.View style={headerAnimStyle}>
          {/* V-4 Tur C: eski iki durakli header gradyani kalkti — zemin `ink`,
              perde varsa perde. */}
          <View style={[styles.headerSection, { paddingTop: insets.top + space.sm }]}>

            {/* Perde — son sampiyonun bulanik, karartilmis posteri. Sampiyon
                yoksa cizilmez; header eski gradyanla kalir. Dekoratif:
                erisilebilirlik agacina girmez, dokunusu yutmaz.
                Reduce Transparency (§6): bulaniklik yerine duz `charcoal`. */}
            {championPosterUrl && (
              <View
                style={styles.headerCurtain}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants">
                {reduceTransparency ? (
                  <View style={styles.headerCurtainFlat} />
                ) : (
                  <Image
                    source={{ uri: championPosterUrl }}
                    style={styles.headerCurtainImage}
                    blurRadius={HEADER_CURTAIN_BLUR}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.headerCurtainDim} />
                <LinearGradient
                  colors={[HEADER_CURTAIN_FADE_TOP, color.surface.base]}
                  locations={[0.35, 1]}
                  style={styles.headerCurtainFade}
                />
              </View>
            )}

            {/* Üst satır: Gear sağa hizalanmış, absolute yok */}
            <View style={styles.headerTopRow}>
              <TouchableOpacity
                style={styles.gearBtn}
                onPress={() => { hapticLight(); setShowSettings(true); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('profile.settingsSection')}>
                <Ionicons name="settings-outline" size={22} color={color.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Avatar — projektor mercegi: dis halka + ic `beam`@24% halka,
                aralarinda bosluk. Golge yok (§4). Dis halka = ritual halkasi:
                son 7 gunun sampiyonlu gunleri `marquee` ile dolar — altin
                yalniz kazanilinca (E-23). Veri yoksa duz `graphite` hairline. */}
            <View style={styles.avatarLensWrap}>
            {ritualWeek && (
              <RitualRing
                filled={ritualWeek}
                diameter={AVATAR_LENS_SIZE}
                strokeWidth={RITUAL_RING_STROKE}
                accessibilityLabel={t('profile.ritualRingA11y', {
                  count: ritualWeek.filter(Boolean).length,
                  total: ritualWeek.length,
                })}
              />
            )}
            <TouchableOpacity
              style={[styles.avatarLensOuter, ritualWeek && styles.avatarLensOuterRing]}
              onPress={() => { hapticLight(); setShowAvatarModal(true); }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('profile.avatarTitle')}>
              <View style={styles.avatarInner}>
                <HeaderAvatarIcon
                  size={avatarId ? 48 : 32}
                  weight="duotone"
                  color={color.text.primary}
                />
              </View>
              {/* Degistir ipucu */}
              <View style={styles.avatarEditBadge}>
                <Camera size={12} weight="fill" color={color.text.primary} />
              </View>
            </TouchableOpacity>
            </View>

            {/* Profil adi — 30 Eyl 2026 kurucu referansi: kalem rozeti yerine
                altta "Cinephile since" satiri + "Edit profile" pill'i. */}
            <Text style={styles.profileName}>
              {displayName ?? t('profile.anonymousCinephile')}
            </Text>
            {joinedAt && (
              <Text style={styles.cinephileSince}>
                {/* Buyuk harf JS'te, dile gore — `textTransform` TR'de i → I yapar (İ degil). */}
                {t('profile.cinephileSince', {
                  date: joinedAt.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
                    month: 'short',
                    year: 'numeric',
                  }),
                }).toLocaleUpperCase(language === 'tr' ? 'tr-TR' : 'en-US')}
              </Text>
            )}
            <TouchableOpacity
              style={styles.editProfilePill}
              onPress={() => { hapticLight(); setShowNicknameModal(true); }}
              activeOpacity={0.8}
              accessibilityRole="button">
              <Text style={styles.editProfilePillText}>{t('profile.editProfile')}</Text>
            </TouchableOpacity>

            {/* Auth provider rozeti — Apple/Google icin ozel gosterim */}
            {!isAnonymous && authProvider && (
              <View style={styles.authProviderBadge}>
                {authProvider === 'apple' ? (
                  <AppleLogo size={13} weight="fill" color={color.text.secondary} />
                ) : (
                  <GoogleLogo size={13} weight="bold" color={color.text.secondary} />
                )}
                <Text style={styles.authProviderText}>
                  {t(
                    authProvider === 'apple'
                      ? 'profile.connectedWithApple'
                      : 'profile.connectedWithGoogle',
                  )}
                </Text>
              </View>
            )}
          </View>
          </Animated.View>

          {/* ── Bolumler ─────────────────────────────────────────────── */}
          <Animated.View style={sectionsAnimStyle}>
          <View style={styles.sections}>

            {/* a) Archetype Hero Card — yalnizca VERI gosterimi.
                R-12: quiz giris noktalari kaldirildi. "Retake Quiz" linki ve
                arketipsiz kullaniciya gosterilen PersonaBadge ("Discover your
                type") ikisi de /onboarding'e goturuyordu. archetype_id verisi
                SILINMEDI — cold-start seed olarak duruyor, yalnizca artik
                quiz'den yeniden yazilamiyor. Arketipi olmayan kullanicida kart
                hic render edilmez (bos kart / olu CTA birakmaz). */}
            {archetypeId != null && (
              <View style={styles.archetypeHeroCard}>
                <Image
                  source={getArchetype(archetypeId)?.image ?? AvatarIcons.clapperboard}
                  style={styles.archetypeHeroIcon}
                  resizeMode="contain"
                />
                <Text style={styles.archetypeHeroName}>
                  {t(getArchetype(archetypeId)?.nameKey ?? '')}
                </Text>
                <Text style={styles.archetypeHeroTagline} numberOfLines={2}>
                  {t(getArchetype(archetypeId)?.descKey ?? '')}
                </Text>
              </View>
            )}

            {/* Subscription badge — B-1 / Fix 7: aktif `chosy_plus`
                entitlement'i (`premiumStatus`) varsa HER ZAMAN "Chosy Pro";
                `tier` rozeti belirlemez ("Founding Member" kaldirildi).
                Plan bilgisi alt satirda (`planLine`). `loading`'de cizilmez. */}
            {premiumStatus === 'premium' && (
              <>
                <View style={styles.subBadge}>
                  <Diamond size={14} weight="fill" color={color.reward.primary} />
                  <Text style={styles.subBadgeText}>{t('profile.proBadge')}</Text>
                </View>
                {planLine !== null && (
                  <Text style={styles.subPlanLine}>{planLine}</Text>
                )}
              </>
            )}

            {/* b) Cinema DNA — K-08 bolumu (bilesen adi `TasteDNA` kaldi).
                CinemaIdentity (rank + 6-eksen radar) buradan kaldirildi:
                bible §7.3 Rank ve Radar'i donduruyor, profilde tek DNA bolumu
                kalir. Bilesen dosyasi silinmedi.
                Paywall sarmalayicisi yalnizca `free`'de: `loading`'de dokunus
                paywall acmaz (V-1 Tur 2).
                v1'de GIZLI (`isCinemaDnaEnabled`, CTO 30 Eyl 2026): kart
                `cinema_dna` okumuyor ve DNA boru hatti tetiklenmiyor. Gizliyken
                K-46 ekindeki `mood_history` girisi de fiilen kapali. */}
            {isCinemaDnaEnabled() && (
              <>
                <SectionHeading title={t('profile.tasteDNA')} />
                {premiumStatus === 'free' ? (
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
              </>
            )}

            {/* K-07: Badge / Collections UI kaldirildi. `CollectionsCard`
                bilesen dosyasi, `milestone_collections` seed'i ve
                `user_collection_progress` tablosu SILINMEDI — yalnizca render
                edilmiyor. Karta yazan hicbir servis yoktu; 5 koleksiyon da
                kalici olarak 0/threshold gosteriyordu. */}

            {/* c) Watched — izlenen film sayisi (CTO D6). Sayim yuklenemezse
                (`null`) bolum hic cizilmez.
                V-4 Tur C (V4-D5): sayi 0 ise son sampiyon varsa "son secimin"
                karti; sampiyon yoksa davet kopyasi (§15.2). Sampiyon okumasi
                bekliyorsa ya da hata verdiyse ikisi de cizilmez — okunamayan
                veri "yok" gibi gosterilmez (kural 1). */}
            {watchedCount !== null && (watchedCount > 0 || lastChampion.status === 'ok') && (
              <>
                <SectionHeading title={t('profile.watchedSection')} />
                <Text style={styles.watchedSubtitle}>{t('profile.watchedSubtitle')}</Text>
                {watchedCount > 0 ? (
                  <View style={styles.watchlistSummaryRow}>
                    <View style={styles.watchlistSummaryLeft}>
                      <View style={styles.watchlistEmptyPoster}>
                        <Eye size={18} color={color.text.secondary} />
                      </View>
                      <Text style={styles.watchlistSummaryText}>
                        {t('profile.watchedCount', { count: watchedCount })}
                      </Text>
                    </View>
                  </View>
                ) : lastChampion.status === 'ok' && lastChampion.champion ? (
                  <View style={styles.lastPickCard}>
                    {lastChampion.champion.posterUrl ? (
                      <Image
                        source={{ uri: lastChampion.champion.posterUrl }}
                        style={styles.lastPickPoster}
                        accessibilityIgnoresInvertColors
                      />
                    ) : (
                      <View style={[styles.lastPickPoster, styles.watchlistEmptyPoster]}>
                        <FilmStrip size={18} color={color.text.secondary} />
                      </View>
                    )}
                    <View style={styles.lastPickText}>
                      <Text style={styles.lastPickLabel}>{t('profile.lastPickLabel')}</Text>
                      <Text style={styles.lastPickTitle} numberOfLines={2}>
                        {lastChampion.champion.title}
                      </Text>
                      <Text style={styles.lastPickHint}>{t('profile.lastPickHint')}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.watchlistSummaryRow}>
                    <View style={styles.watchlistSummaryLeft}>
                      <View style={styles.watchlistEmptyPoster}>
                        <Eye size={18} color={color.text.secondary} />
                      </View>
                      <Text style={styles.watchedEmptyText}>{t('profile.watchedEmpty')}</Text>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* d) Saved — watchlist ozeti (K-06: Watchlist ayri tab degil,
                Profile alt sayfasi) */}
            <SectionHeading title={t('profile.savedSection')} />
            {watchlistPosters.length > 0 ? (
              /* Poster seridi — 4 esit yuva, 2:3. Eksik yuvalar bos
                 spacer: poster boyutu kayit sayisina gore degismez.
                 Kartin tamami watchlist-detail'e gider; pill gorsel ipucu. */
              <TouchableOpacity
                style={styles.savedStripCard}
                onPress={() => { hapticLight(); router.push('/watchlist-detail' as never); }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t('profile.watchlistSummaryCount', { count: watchlistCount })}
                accessibilityHint={t('profile.seeAll')}
              >
                <View style={styles.savedStripRow}>
                  {Array.from({ length: SAVED_STRIP_SLOTS }, (_, idx) => {
                    const url = watchlistPosters[idx];
                    return url ? (
                      <Image
                        key={`wl-poster-${idx}`}
                        source={{ uri: url }}
                        style={styles.savedStripPoster}
                      />
                    ) : (
                      <View key={`wl-slot-${idx}`} style={styles.savedStripSlot} />
                    );
                  })}
                </View>
                <View style={styles.savedStripFooter}>
                  <Text style={styles.savedStripCount}>
                    {t('profile.watchlistSummaryCount', { count: watchlistCount })}
                  </Text>
                  <View style={styles.savedStripSeeAll}>
                    <Text style={styles.savedStripSeeAllText}>{t('profile.seeAll')}</Text>
                    <Ionicons name="chevron-forward" size={size.iconInline} color={color.text.primary} />
                  </View>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.watchlistSummaryRow}
                onPress={() => router.push('/watchlist-detail' as never)}
                activeOpacity={0.7}
              >
                <View style={styles.watchlistSummaryLeft}>
                  <View style={styles.watchlistEmptyPoster}>
                    <FilmStrip size={18} color={color.text.secondary} />
                  </View>
                  <Text style={styles.watchlistSummaryText}>
                    {watchlistCount > 0
                      ? t('profile.watchlistSummaryCount', { count: watchlistCount })
                      : t('profile.watchlistSummaryEmpty')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={color.text.secondary} />
              </TouchableOpacity>
            )}

            {/* e) Pro — K-08 sirasindaki "Pro" bolumu.
                Tek CTA (K-48: tek entitlement `chosy_plus`). Onceki iki CTA'dan
                "Founding Member" kaldirildi: bible §7.3 lifetime satisini
                donduruyor. `lifetime_founding` offering'i RevenueCat'te durur,
                `/lifetime` route'u ve istemci claim akisi silindi (Sprint 4b). */}
            <SectionHeading title={t('profile.proSection')} />

            {/* `loading`'de CTA cizilmez — abonelik cozulmeden upsell yok. */}
            {premiumStatus === 'free' && (
              <TouchableOpacity
                style={styles.proCta}
                onPress={() => { hapticLight(); void handleUpgradePress(); }}
                activeOpacity={0.85}
              >
                <Sparkle size={18} weight="fill" color={color.accent.active} />
                <View style={styles.proCtaTextBlock}>
                  <Text style={styles.proCtaTitle}>{t('profile.chosyPro')}</Text>
                  <Text style={styles.proCtaSubtitle}>{t('profile.chosyProSubtitle')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={color.text.secondary} />
              </TouchableOpacity>
            )}

            {/* Pro Mode — mood search girisi. Gate ekranin KENDISINDE
                (`app/pro-mode.tsx`): `isPremium || legacy_mood_access`.
                Buradaki kilit ikonu yalnizca gorsel isarettir, yetki kontrolu
                degildir — tek dogruluk kaynagi `useProModeAccess`. */}
            <TouchableOpacity
              style={styles.proModeRow}
              onPress={() => { hapticLight(); router.push('/pro-mode' as never); }}
              activeOpacity={0.7}
            >
              <MagicWand size={18} color={color.text.secondary} />
              <View style={styles.proModeTextBlock}>
                <Text style={styles.proModeTitle}>{t('profile.proMode')}</Text>
                <Text style={styles.proModeSubtitle}>{t('profile.proModeSubtitle')}</Text>
              </View>
              <Ionicons
                name={proAccess.allowed ? 'chevron-forward' : 'lock-closed'}
                size={16}
                color={color.text.secondary}
              />
            </TouchableOpacity>

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
                  <Ionicons name="bug-outline" size={16} color={color.text.secondary} />
                  <Text style={styles.devSentryBtnText}>Test Sentry</Text>
                </TouchableOpacity>
              </View>
            )}

        </ScrollView>
      </View>

      {/* ── Hesap silme overlay — tam ekran blok ─────────────────────── */}
      {deletingAccount && (
        <View style={styles.deletingOverlay}>
          <Text style={styles.deletingOverlayText}>{t('profile.deleteAccountDeleting')}</Text>
        </View>
      )}

      {/* ── Avatar Modal ──────────────────────────────────────────────── */}
      <AvatarModal
        visible={showAvatarModal}
        current={avatarId}
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
        premiumStatus={premiumStatus}
        currentPlanLabel={
          premiumStatus === 'premium' ? knownPlanTitle : t('profile.freePlan')
        }
        linkingAccount={linkingAccount}
        notificationsEnabled={notificationsEnabled}
        onToggleNotifications={(enabled) => void handleToggleNotifications(enabled)}
        aiSuggestionsEnabled={aiSuggestionsEnabled}
        onToggleAiSuggestions={(enabled) => void handleToggleAiSuggestions(enabled)}
        onLinkApple={handleLinkApple}
        onClearWatchlist={handleClearWatchlist}
        onManageSubscription={() => void handleManageSubscription()}
        canShareArchetype={archetypeId != null}
        onShareArchetype={() => void handleShareArchetype()}
        onSignOut={handleSignOut}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* ── Contextual Paywall ──────────────────────────────────────── */}
      <ContextualPaywall {...paywallProps} />
    </SafeAreaView>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────
//
// V-4 Tur C: tum renk/tipografi/bosluk Design OS semantic token'larindan
// (`constants/design/semantic.ts`). Eski `Colors` / `Theme` / deprecated
// `Typography·Shadows·Radius·Spacing` kalktı; golge yok (§4). Tek istisna
// `Colors.error` (yikici eylemler). Kullanilmayan 30 stil (referral, eski
// link-account, founding banner…) silindi — JSX'te karsiligi yoktu.

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: color.surface.base,
  },
  gradient: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },

  // ── Header ──
  headerSection: {
    alignItems: 'center',
    paddingTop: space.sm,
    paddingBottom: space.lg,
    paddingHorizontal: space.lg,
    borderBottomLeftRadius: radius.chrome,
    borderBottomRightRadius: radius.chrome,
    overflow: 'hidden',
  },
  /** Perde katmani — header'in tamamini kaplar, icerigin altinda kalir */
  headerCurtain: {
    ...StyleSheet.absoluteFillObject,
  },
  /** Blur kenarlarda seffaf halka birakir — hafif buyutme onu tasar */
  headerCurtainImage: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: 1.15 }],
  },
  /** Reduce Transparency — bulanik poster yerine duz `charcoal` (§6) */
  headerCurtainFlat: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: color.surface.raised,
  },
  headerCurtainDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: HEADER_CURTAIN_DIM,
  },
  headerCurtainFade: {
    ...StyleSheet.absoluteFillObject,
  },
  /** Gear butonunu sağ üste hizalayan tam genişlik satır — absolute positioning yok */
  headerTopRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: space.md,
  },
  gearBtn: {
    padding: space.xs,
  },
  /** Mercek + ritual halkasi ortak kutusu — halka absoluteFill ile bunu doldurur */
  avatarLensWrap: {
    width: AVATAR_LENS_SIZE,
    height: AVATAR_LENS_SIZE,
    marginBottom: space.base,
  },
  /**
   * Mercek dis halkasi — veri yokken `graphite` hairline. Ic halkaya uzaklik
   * her iki durumda AVATAR_LENS_INSET: hairline + padding = halka + bosluk.
   */
  avatarLensOuter: {
    width: AVATAR_LENS_SIZE,
    height: AVATAR_LENS_SIZE,
    borderRadius: AVATAR_LENS_SIZE / 2,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    padding: AVATAR_LENS_INSET - size.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Ritual halkasi cizilirken — kenari halka tasir */
  avatarLensOuterRing: {
    borderWidth: 0,
    padding: AVATAR_LENS_INSET,
  },
  /** Mercek ic halkasi — `beam`@24% kenar, `charcoal` zemin */
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR_LENS_SIZE / 2,
    borderWidth: size.hairline,
    borderColor: color.accent.edge,
    backgroundColor: color.surface.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    ...type['display-m'],
    color: color.text.primary,
    textAlign: 'center',
  },
  /** "CINEPHILE SINCE AUG 2026" — sayilar/meta Martian Mono (§3.3) */
  cinephileSince: {
    ...type.meta,
    color: color.text.secondary,
    marginTop: space.xs,
  },
  /** "Edit profile" — perde uzerinde yari saydam `ink` pill, hairline kenar */
  editProfilePill: {
    marginTop: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    backgroundColor: withAlpha(color.surface.base, 0.4),
  },
  editProfilePillText: {
    ...type.callout,
    color: color.text.primary,
  },
  /** Kamera ikonu — avatar uzerinde */
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: color.surface.raised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: size.hairline,
    borderColor: color.surface.border,
  },
  /** Apple/Google baglanti rozeti */
  authProviderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.surface.raised,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
  },
  authProviderText: {
    ...type.caption,
    color: color.text.secondary,
  },

  // ── Subscription Badge ──
  /**
   * Premium ve lifetime ayni rozet — `marquee` yalniz ikonda (odul ani,
   * E-23). Eski iki ayri altin (`gold` / `accentPrimary`) birlesti.
   */
  subBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: space.sm,
    paddingHorizontal: space.base,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.surface.raised,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
  },
  subBadgeText: {
    ...type.caption,
    color: color.text.primary,
  },
  /** Rozet alti plan satiri — "Annual · active until …" (Fix 7) */
  subPlanLine: {
    ...type.caption,
    alignSelf: 'center',
    color: color.text.secondary,
  },

  // ── Sections container ──
  sections: {
    paddingHorizontal: space.base,
    gap: space.md,
  },

  // ── Archetype Hero Card ──
  archetypeHeroCard: {
    backgroundColor: color.surface.raised,
    borderRadius: radius.surface,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    padding: space.lg,
    alignItems: 'center',
    gap: space.sm,
  },
  archetypeHeroIcon: {
    width: 72,
    height: 72,
    marginBottom: space.xs,
  },
  /**
   * DNA arketip adı — §3.4'ün üç marka anından biri: Archivo Expanded
   * `display-l` (V-1 Tur 7 CTO kararı). Ağırlık aile adında; `fontWeight`
   * verilmez (statik kesitte iOS sistem fontuna düşürür).
   */
  archetypeHeroName: {
    ...type['display-l'],
    color: color.text.primary,
    textAlign: 'center',
  },
  archetypeHeroTagline: {
    ...type.callout,
    color: color.text.secondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  // C.9c: retakeQuizBtn/retakeQuizText (R-12) ve upgradeCtaRow/upgradeCta
  // (cift CTA) stilleri kaldirildi — kullanan JSX kalmadi.

  // ── Pro bolumu ──
  /**
   * Tek "Chosy Pro" CTA'si — `offerings.current` (default) offering'ine gider.
   * Birincil eylem dili (C.9b-UI L-2): `beam`@12% dolgu + `@40%` kenar.
   */
  proCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.base,
    paddingHorizontal: space.base,
    borderRadius: radius.surface,
    backgroundColor: color.accent.fill,
    borderWidth: size.hairline,
    borderColor: color.accent.edgeStrong,
  },
  proCtaTextBlock: {
    flex: 1,
    gap: 2,
  },
  proCtaTitle: {
    ...type['body-strong'],
    color: color.text.primary,
  },
  proCtaSubtitle: {
    ...type.caption,
    color: color.text.secondary,
  },
  /** Pro Mode (mood search) giris satiri */
  proModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.surface.raised,
    borderRadius: radius.surface,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    paddingVertical: space.base,
    paddingHorizontal: space.base,
  },
  proModeTextBlock: {
    flex: 1,
    gap: 2,
  },
  proModeTitle: {
    ...type['body-strong'],
    color: color.text.primary,
  },
  proModeSubtitle: {
    ...type.caption,
    color: color.text.secondary,
  },

  // ── Watchlist Summary Row ──
  watchlistSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: color.surface.raised,
    borderRadius: radius.surface,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    paddingVertical: space.md,
    paddingHorizontal: space.base,
    minHeight: 80,
  },
  watchlistSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    flex: 1,
  },
  // ── Saved poster seridi — Design OS semantic token'lari ──
  savedStripCard: {
    backgroundColor: color.surface.raised,
    borderRadius: radius.surface,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    padding: space.md,
    gap: space.md,
  },
  savedStripRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  savedStripPoster: {
    flex: 1,
    aspectRatio: 2 / 3,
    borderRadius: space.sm,
    backgroundColor: color.surface.border,
  },
  /** Eksik yuva — yer tutar, cizilmez */
  savedStripSlot: {
    flex: 1,
    aspectRatio: 2 / 3,
  },
  savedStripFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  savedStripCount: {
    ...type.callout,
    flexShrink: 1,
    color: color.text.secondary,
  },
  savedStripSeeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
  },
  savedStripSeeAllText: {
    ...type.caption,
    color: color.text.primary,
  },
  /** Poster yokken yer tutucu — ikonlu kucuk 2:3 kutu */
  watchlistEmptyPoster: {
    width: 36,
    height: 54,
    borderRadius: space.xs,
    backgroundColor: color.surface.base,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchlistSummaryText: {
    ...type['body-strong'],
    flexShrink: 1,
    color: color.text.primary,
  },
  /** Watched alt basligi — sayacin kapsami (Fix 6) */
  watchedSubtitle: {
    ...type.caption,
    color: color.text.secondary,
  },
  /** Watched sifir durumu — davet kopyasi, iki satira sarabilir */
  watchedEmptyText: {
    ...type.callout,
    flexShrink: 1,
    color: color.text.secondary,
  },

  // ── Son secimin karti (V-4 Tur C, V4-D5) ──
  lastPickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.base,
    backgroundColor: color.surface.raised,
    borderRadius: radius.surface,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    padding: space.md,
  },
  /** Afis — Saved seridiyle ayni kose dili (kucuk afis, `radius.poster` degil) */
  lastPickPoster: {
    width: 56,
    height: 84,
    borderRadius: space.sm,
    backgroundColor: color.surface.border,
  },
  lastPickText: {
    flex: 1,
    gap: space.xs,
  },
  lastPickLabel: {
    ...type['label-caps'],
    color: color.text.secondary,
    textTransform: 'uppercase',
  },
  /** Serif yalniz film adinda (V3-D1) */
  lastPickTitle: {
    ...type.filmTitle,
    color: color.text.primary,
  },
  lastPickHint: {
    ...type.caption,
    color: color.text.secondary,
  },

  // ── Section heading — Design OS `title` ──
  sectionHeadingText: {
    ...type.title,
    color: color.text.primary,
    marginTop: space.md,
  },

  // ── Avatar Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: withAlpha(color.surface.base, 0.92),
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  modalCard: {
    backgroundColor: color.surface.raised,
    borderRadius: radius.surface,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    padding: space.lg,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    ...type.title,
    color: color.text.primary,
    textAlign: 'center',
    marginBottom: space.md,
  },
  avatarSubtitle: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
    marginBottom: space.md,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  /** 3 sutun: 3x88 + 2x8 = 280 ≤ kart ic genisligi (360 - 2xlg); 4. kart sigmaz. */
  avatarOption: {
    width: 88,
    minHeight: 88,
    borderRadius: 16,
    backgroundColor: color.surface.raised,
    borderWidth: 2,
    borderColor: color.surface.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
    gap: space.xs,
  },
  avatarOptionSelected: {
    borderColor: color.accent.active,
  },
  /** Iki satira kadar sarar; `minHeight` iki satirlik yer ayirir ki grid hizasi bozulmasin. */
  avatarOptionLabel: {
    fontSize: 10,
    lineHeight: 13,
    minHeight: 26,
    color: color.text.secondary,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  avatarOptionLabelSelected: {
    color: color.accent.active,
  },
  modalActions: {
    flexDirection: 'row',
    gap: space.md,
  },
  cancelBtn: {
    flex: 1,
    minHeight: size.touchTarget,
    borderRadius: space.md,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    ...type['body-strong'],
    color: color.text.secondary,
  },
  /**
   * Birincil modal eylemi — eski altin gradyan yerine Champion'in birincil
   * eylem dili: `beam`@12% dolgu + `@40%` kenar, `bone` metin.
   */
  selectBtn: {
    flex: 1,
    minHeight: size.touchTarget,
    borderRadius: space.md,
    backgroundColor: color.accent.fill,
    borderWidth: size.hairline,
    borderColor: color.accent.edgeStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBtnDisabled: {
    opacity: 0.4,
  },
  selectBtnText: {
    ...type['body-strong'],
    color: color.text.primary,
  },

  // ── Dev-only Sentry test ──
  devSection: {
    paddingHorizontal: space.base,
    paddingTop: space.base,
  },
  devSentryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: color.surface.raised,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    borderRadius: space.md,
    paddingVertical: space.md,
    borderStyle: 'dashed',
  },
  devSentryBtnText: {
    ...type.caption,
    color: color.text.secondary,
  },

  // ── Genel ──
  // V-4 Tur A: sabit 100pt `bottomSpacer` kalkti — alt pay `useTabBarInset()`.

  // ── Hesap silme overlay ──
  deletingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(color.surface.base, 0.88),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  deletingOverlayText: {
    ...type['body-strong'],
    color: color.text.primary,
  },
});

// ─── Nickname Modal Stilleri ──────────────────────────────────────────────────

const nicknameModalStyles = StyleSheet.create({
  input: {
    ...type.body,
    backgroundColor: color.surface.base,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    borderRadius: space.md,
    paddingHorizontal: space.base,
    paddingVertical: space.md,
    color: color.text.primary,
    marginBottom: space.xs,
  },
  charCount: {
    ...type.meta,
    color: color.text.secondary,
    textAlign: 'right',
    marginBottom: space.md,
  },
});

// ─── Settings Modal Stilleri ──────────────────────────────────────────────────

const settingsModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: withAlpha(color.surface.base, 0.6),
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: color.surface.raised,
    borderTopLeftRadius: radius.surface,
    borderTopRightRadius: radius.surface,
    borderWidth: size.hairline,
    borderBottomWidth: 0,
    borderColor: color.surface.border,
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
    paddingTop: space.md,
    gap: space.base,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.surface.border,
    alignSelf: 'center',
    marginBottom: space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: size.hairline,
    borderBottomColor: color.surface.border,
  },
  title: {
    ...type.title,
    flex: 1,
    color: color.text.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.xs,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  rowLabel: {
    ...type.callout,
    color: color.text.primary,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  rowValue: {
    ...type.callout,
    color: color.text.secondary,
  },
  manageNote: {
    ...type.caption,
    color: color.text.secondary,
    paddingHorizontal: space.lg,
    marginTop: -space.sm,
  },
  linkSection: {
    borderTopWidth: size.hairline,
    borderTopColor: color.surface.border,
    paddingTop: space.md,
    gap: space.md,
  },
  linkInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  linkTextBlock: {
    flex: 1,
  },
  linkTitle: {
    ...type.callout,
    fontWeight: '600',
    color: color.text.primary,
  },
  linkSubtitle: {
    ...type.caption,
    color: color.text.secondary,
    marginTop: 2,
  },
  /** Native Apple butonu — tam genişlik, HIG minimum 44pt yükseklik. */
  appleBtn: {
    width: '100%',
    height: size.touchTarget,
  },
  appleBtnBusy: {
    opacity: 0.5,
  },
  /** En alttaki destructive grup — ince ayraçla ayrılır, kutu yok. */
  dangerGroup: {
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: size.hairline,
    borderTopColor: color.surface.border,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  /** `Colors.error` — bilinen istisna (V-4 Tur C, bkz. import notu). */
  dangerLabel: {
    ...type.body,
    color: Colors.error,
  },
  /** Sürüm satırı — sönük, ortalı, dokunulmaz. */
  versionLine: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
  },
});
