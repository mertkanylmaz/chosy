/**
 * Push Notifications Service — Expo Notifications setup, token registration,
 * permission handling, and deep link routing.
 *
 * Setup:
 *   1. `npx expo install expo-notifications expo-device expo-constants`
 *   2. Add "expo-notifications" to app.json plugins
 *   3. Rebuild dev client: `npx expo prebuild && npx expo run:ios`
 *
 * Usage:
 *   - Call `registerForPushNotifications()` after the user accepts the K-15
 *     in-context prompt (first champion), NOT at launch
 *   - Call `savePushToken()` on every app launch (token can rotate)
 *   - Call `handleNotificationResponse()` for deep link navigation
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

import { supabase } from './supabase';
import { getAppUserId } from './auth-utils';
import { logger } from '@/utils/logger';
import { checkShouldAskForNotification } from '@/utils/notificationAskCheck';
import { i18n } from '@/constants/i18n';
import { UNLOCK_HOUR } from '@/components/gauntlet/GauntletShell/unlockClock';

// ─── Constants ────────────────────────────────────────────────────────────────

/** AsyncStorage key: whether we already asked for permission */
const PERMISSION_ASKED_KEY = 'chosy_push_permission_asked';

/** AsyncStorage key: cached push token */
const PUSH_TOKEN_KEY = 'chosy_push_token';

/**
 * K-15 yerel akşam hatırlatıcısının sabit kimliği. Sabit kimlik sayesinde
 * yeniden planlama mevcut kaydın ÜSTÜNE yazar — cihazda asla iki hatırlatıcı
 * birikmez (kilitli karar: günde tek bildirim).
 */
const DAILY_REMINDER_ID = 'chosy_daily_reminder';

/**
 * Hatırlatıcı metninin sürümü. Metin planlama anında dondurulduğu için
 * `dailyReminderTitle`/`dailyReminderBody` değiştiğinde bu sayı ARTIRILIR —
 * `ensureDailyReminderScheduled()` sürümü farklı kaydı bir sonraki açılışta
 * yeniden planlar. Sürüm alanı olmayan eski kayıt = 1.
 *   1 — "Üç tur, tek film. Bu akşamın şampiyonunu seç." (K-15, V-2 Tur E1)
 *   2 — "Üç tur, tek film. Sonra bugünün karesi." (P-5, K-62)
 */
const DAILY_REMINDER_COPY_VERSION = 2;

// ─── Notification Handler Config ──────────────────────────────────────────────

/**
 * Configure how notifications are displayed when the app is in foreground.
 * Show alert + badge + sound for all notifications.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Types ────────────────────────────────────────────────────────────────────

/** Deep link data attached to push notifications */
export interface NotificationData {
  screen?: string;       // e.g. 'mood', 'games', 'profile', 'film'
  filmId?: string;       // for film detail navigation
  gameId?: string;       // for specific game navigation
  action?: string;       // custom action identifier
  offerId?: string;      // promotional offer ID
  source?: string;       // notification source (e.g. 'daily_pick')
  locale?: string;       // yerel hatırlatıcının planlandığı dil (K-15)
  copyVersion?: number;  // yerel hatırlatıcı metninin sürümü (P-5)
}

/** OS bildirim izninin üç hâli — `undetermined`: henüz hiç sorulmadı. */
export type NotificationPermissionState = 'granted' | 'denied' | 'undetermined';

/** Settings switch'inin sonucu — başarısızlığın nedeni kullanıcıya yansır. */
export type ToggleNotificationsResult = 'ok' | 'permission_denied' | 'error';

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Get the Expo push token for this device.
 * Returns null if not a physical device or token retrieval fails.
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    // Push notifications only work on physical devices
    if (!Device.isDevice) {
      logger.warn('[push] Not a physical device — skipping token');
      return null;
    }

    // Get project ID from app config
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      logger.warn('[push] No EAS project ID found in app config');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return tokenData.data;
  } catch (err) {
    logger.error('[push] Failed to get push token:', err);
    return null;
  }
}

/**
 * Request notification permissions from the user.
 * Returns true if granted, false otherwise.
 */
export async function requestPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    if (existingStatus === 'granted') {
      return true;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    logger.error('[push] Permission request failed:', err);
    return false;
  }
}

/**
 * Check if notifications are currently permitted.
 */
export async function isPermissionGranted(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    // İzin okunamıyorsa "verilmedi" sayılır (fail-closed) — ama iz bırakır.
    Sentry.captureException(err, {
      level: 'warning',
      tags: { flow: 'push_permission_read', fn: 'isPermissionGranted' },
    });
    return false;
  }
}

/**
 * OS izninin üç hâlli durumu. Okunamazsa `null` + Sentry — çağıran "bilinmiyor"u
 * açıkça ele alır (ör. bekleme CTA'sı gizlenir), `denied`'a sessizce düşülmez.
 */
export async function getPermissionState(): Promise<NotificationPermissionState | null> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch (err) {
    Sentry.captureException(err, {
      level: 'warning',
      tags: { flow: 'push_permission_read', fn: 'getPermissionState' },
    });
    return null;
  }
}

/**
 * Register device for push notifications and save token to Supabase.
 * Call this after user grants permission.
 *
 * @param timezone - User's timezone (e.g., 'Europe/Istanbul')
 */
export async function registerForPushNotifications(
  timezone?: string,
): Promise<boolean> {
  try {
    const granted = await requestPermissions();
    if (!granted) {
      logger.log('[push] Permission not granted');
      return false;
    }

    // K-15: yerel 18:00 hatırlatıcısı token'a bağlı DEĞİL — token alınamasa
    // da (simülatör, EAS id yok) izin verildiği anda planlanır. Hata
    // fonksiyonun içinde Sentry'ye yazılır.
    await ensureDailyReminderScheduled();

    const token = await getExpoPushToken();
    if (!token) return false;

    // Save locally
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

    // Save to Supabase
    await savePushTokenToServer(token, timezone);

    // Mark as asked
    await AsyncStorage.setItem(PERMISSION_ASKED_KEY, 'true');

    // Configure Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D4A843',
      });
    }

    logger.log('[push] Registered successfully:', token.slice(0, 20) + '...');
    return true;
  } catch (err) {
    logger.error('[push] Registration failed:', err);
    return false;
  }
}

/**
 * Save push token to Supabase users table via RPC.
 * Called on every app launch to keep token fresh.
 */
export async function savePushTokenToServer(
  token?: string,
  timezone?: string,
): Promise<void> {
  try {
    const userId = await getAppUserId();
    if (!userId) return;

    // Use provided token or get from cache
    const pushToken = token ?? (await AsyncStorage.getItem(PUSH_TOKEN_KEY));
    if (!pushToken) return;

    // Get device timezone if not provided
    const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

    const { error } = await supabase.rpc('save_push_token', {
      p_user_id: userId,
      p_push_token: pushToken,
      p_timezone: tz,
    });

    if (error) {
      logger.error('[push] Failed to save token:', error.message);
    }
  } catch (err) {
    logger.error('[push] savePushTokenToServer error:', err);
  }
}

/**
 * Settings'teki TEK bildirim switch'i (K-15, "günde tek bildirim").
 *
 * Yazdığı yer değişmedi: `toggle_push_notifications` RPC → `users.push_enabled`.
 * Ek olarak cihazdaki yerel 18:00 hatırlatıcısını planlar / iptal eder.
 *
 * `users.daily_pick_enabled` ve `users.watchlist_notifications_enabled` artık
 * okunmuyor/yazılmıyor (V-2 Tur E1) — kolonlar silinmedi, sunucu okuyucuları
 * (`send-daily-pick`, `watchlist-activation`) cron'ları Ağu 2026'dan beri
 * `active=false`. Bkz. docs/TEKNIK_BORC.md "Bildirim kolonları".
 */
export async function toggleNotifications(enabled: boolean): Promise<ToggleNotificationsResult> {
  try {
    const userId = await getAppUserId();
    if (!userId) {
      Sentry.captureMessage('[push] toggleNotifications: app user id çözülemedi', {
        level: 'warning',
        tags: { flow: 'push_toggle' },
      });
      return 'error';
    }

    if (enabled) {
      // Re-request permissions if enabling
      const granted = await requestPermissions();
      if (!granted) return 'permission_denied';

      // Refresh token
      const token = await getExpoPushToken();
      if (token) {
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
        await savePushTokenToServer(token);
      }
    } else {
      // Kapatırken önce yerel hatırlatıcı: iptal edilemezse sunucu da
      // değişmez, switch geri döner — "kapalı görünüp çalan" durum oluşmaz.
      await cancelDailyReminder();
    }

    const { error } = await supabase.rpc('toggle_push_notifications', {
      p_user_id: userId,
      p_enabled: enabled,
    });

    if (error) {
      Sentry.captureException(error, { tags: { flow: 'push_toggle', fn: 'toggle_push_notifications' } });
      logger.error('[push] Toggle failed:', error.message);
      return 'error';
    }

    if (enabled) {
      const scheduled = await ensureDailyReminderScheduled();
      if (!scheduled) return 'error';
    }

    return 'ok';
  } catch (err) {
    Sentry.captureException(err, { tags: { flow: 'push_toggle' } });
    logger.error('[push] toggleNotifications error:', err);
    return 'error';
  }
}

/**
 * Sunucudaki `users.push_enabled`. Okunamazsa `null` + Sentry — çağıran
 * "bilinmiyor"u açıkça ele alır; `false`'a sessizce düşülmez (kural 1).
 */
export async function getNotificationStatus(): Promise<boolean | null> {
  try {
    const userId = await getAppUserId();
    if (!userId) {
      Sentry.addBreadcrumb({
        category: 'push',
        level: 'warning',
        message: 'getNotificationStatus: app user id henüz yok',
      });
      return null;
    }

    const { data, error } = await supabase
      .from('users')
      .select('push_enabled')
      .eq('id', userId)
      .single();

    if (error || !data) {
      Sentry.captureException(error ?? new Error('users.push_enabled satırı yok'), {
        level: 'warning',
        tags: { flow: 'push_status_read', fn: 'getNotificationStatus' },
      });
      return null;
    }
    return (data as { push_enabled: boolean }).push_enabled;
  } catch (err) {
    Sentry.captureException(err, {
      level: 'warning',
      tags: { flow: 'push_status_read', fn: 'getNotificationStatus' },
    });
    return null;
  }
}

// ─── K-15: Yerel akşam hatırlatıcısı ─────────────────────────────────────────
//
// Akşam bildirimi SUNUCU push'u değil, cihazda yerel planlanan günlük bir
// bildirimdir (bible v1.31, K-15 eki). Saat `UNLOCK_HOUR` — istemcideki tek
// tanım (V1-D9); tetikleyici cihaz yerel saatini kullanır, yani saat dilimi
// değişince de 18:00'de çalar.
//
// Bildirim metni planlama anındaki dilde dondurulur. Bu yüzden kayıt kendi
// dilini `data.locale`'de, metin sürümünü `data.copyVersion`'da taşır;
// `ensureDailyReminderScheduled()` dil ya da metin sürümü değişmişse yeniden
// planlar, ikisi de aynıysa dokunmaz (idempotent).

/**
 * Yerel 18:00 hatırlatıcısının planlı olduğunu garanti eder.
 *
 * İzin İSTEMEZ — yalnızca izin zaten verilmişse planlar. İzin yoksa `false`
 * döner (hata değil, Sentry'ye yazılmaz). Planlama hatası Sentry'ye yazılır
 * ve `false` döner.
 *
 * @returns Hatırlatıcı şu an planlıysa true
 */
export async function ensureDailyReminderScheduled(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return false;

    const locale = i18n.locale;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const existing = scheduled.find((n) => n.identifier === DAILY_REMINDER_ID);
    const existingData = existing?.content.data as NotificationData | undefined;
    const existingCopyVersion = existingData?.copyVersion ?? 1;
    if (
      existing &&
      existingData?.locale === locale &&
      existingCopyVersion === DAILY_REMINDER_COPY_VERSION
    ) {
      return true;
    }

    // Aynı kimlikle planlamak üstüne yazar; yine de dil/metin değişiminde
    // eskiyi açıkça iptal ediyoruz — platform davranışına yaslanmıyoruz.
    if (existing) {
      await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
    }

    const data: NotificationData = {
      screen: 'mood',
      source: 'daily_reminder',
      locale,
      copyVersion: DAILY_REMINDER_COPY_VERSION,
    };
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_REMINDER_ID,
      content: {
        title: i18n.t('notifications.dailyReminderTitle'),
        body: i18n.t('notifications.dailyReminderBody'),
        data: { ...data },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: UNLOCK_HOUR,
        minute: 0,
      },
    });
    return true;
  } catch (err) {
    Sentry.captureException(err, { tags: { flow: 'daily_reminder', fn: 'ensureDailyReminderScheduled' } });
    logger.error('[push] ensureDailyReminderScheduled error:', err);
    return false;
  }
}

/** Yerel 18:00 hatırlatıcısını iptal eder (Settings switch'i kapatıldı). */
export async function cancelDailyReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
  } catch (err) {
    Sentry.captureException(err, { tags: { flow: 'daily_reminder', fn: 'cancelDailyReminder' } });
    throw err;
  }
}

// ─── Permission Flow (K-15: bağlam içinde, şampiyon sonrası) ─────────────────
//
// R-A-2 öncesi tetikleyici "2. oturum, uygulama açılışı"ydı (`_layout.tsx`) ve
// izin, kullanıcı henüz hiçbir değer görmeden isteniyordu. K-15 bunu tersine
// çevirir: izin ilk şampiyondan SONRA, "Want your four ready every evening?"
// bağlamıyla istenir. Oturum sayacı (`chosy_session_count`) bu yüzden kaldırıldı
// — onu okuyan tek yer burasıydı.
//
// Auth prompt ile aynı oturumda ART ARDA sorulmaz (CTO kararı, 22 Ağu 2026):
// iOS izin diyaloğu tek atışlıktır, üst üste iki sheet'in ikincisi refleks
// olarak kapatılır ve ret kalıcıdır. Sıralamayı GauntletShell yönetir.

/**
 * Bildirim izni sheet'i gösterilmeli mi.
 *
 * OS izni cihaz-yereldir; bu yüzden bayrak da cihaz-yereldir (AsyncStorage).
 * Migration 103'ün DB bayrakları burada KULLANILMAZ — bir cihazda verilen izin
 * diğerinde geçerli değildir.
 *
 * Okunamıyorsa sorulmaz (fail-closed) ve hata Sentry'ye `fatal` yazılır —
 * prod'da `logger.warn` sessizdir, tek başına yetmez. Saf mantık:
 * `utils/notificationAskCheck.ts`.
 *
 * @returns Daha önce sorulmadıysa ve izin zaten verilmemişse true
 */
export async function shouldAskForNotificationPermission(): Promise<boolean> {
  return checkShouldAskForNotification({
    readAsked: () => AsyncStorage.getItem(PERMISSION_ASKED_KEY),
    isGranted: isPermissionGranted,
    markAsked: () => AsyncStorage.setItem(PERMISSION_ASKED_KEY, 'true'),
    reportError: (err) => {
      Sentry.captureException(err, {
        level: 'fatal',
        tags: {
          flow: 'push_permission_ask_check',
          fn: 'shouldAskForNotificationPermission',
        },
      });
    },
  });
}

/**
 * "Sorduk" işaretini kalıcılaştırır — kabul, ret ve kapatma dâhil.
 *
 * `registerForPushNotifications()` bunu yalnızca izin VERİLDİĞİNDE yazar;
 * reddedilen ya da kapatılan sheet de bir daha gösterilmemeli, o yüzden
 * çağıran yüzey her yolda bunu çağırır.
 */
export async function markNotificationPermissionAsked(): Promise<void> {
  try {
    await AsyncStorage.setItem(PERMISSION_ASKED_KEY, 'true');
  } catch (err) {
    logger.warn('[push] markNotificationPermissionAsked yazılamadı:', err);
  }
}

// ─── Deep Link Handling ──────────────────────────────────────────────────────

/**
 * Extract navigation route from notification data.
 * Used by notification response listener to navigate user.
 *
 * @returns Expo Router path string or null
 */
export function getDeepLinkFromNotification(
  data: NotificationData | undefined,
): string | null {
  if (!data?.screen) return null;

  // C.9d: `case 'watchlist'` kaldırıldı — `(tabs)/watchlist.tsx` silindi ve
  // bu dalı üreten hiçbir bildirim yoktu. Kırık bir hedefi canlı sözleşmede
  // bırakmıyoruz; watchlist bildirimi gerekirse hedefi o zamanki ihtiyaca
  // göre tanımlanır. Bilinmeyen `screen` zaten default'ta null döner.
  switch (data.screen) {
    case 'mood':
      return '/(tabs)';
    case 'profile':
      return '/(tabs)/profile';
    case 'games':
      return data.gameId ? `/games/${data.gameId}` : '/games';
    case 'film': {
      if (!data.filmId) return null;
      const filmSource = data.source ? `?source=${data.source}` : '';
      return `/film/${data.filmId}${filmSource}`;
    }
    case 'paywall':
      return '/paywall';
    default:
      return null;
  }
}

/**
 * Mark a notification as opened in the database.
 * Fire-and-forget — errors are silently logged.
 */
export async function markNotificationOpened(notificationId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('notification_log')
      .update({ status: 'opened', opened_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) {
      logger.warn('[push] Failed to mark notification opened:', error.message);
    }
  } catch (err) {
    logger.error(
      '[push] markNotificationOpened error:', err,
      {
        code: 'PUSH_MARK_OPENED_FAILED',
        sampleRate: 0.5,
      },
    );
  }
}

// ─── Activity Tracking ───────────────────────────────────────────────────────

/**
 * Update last_activity_at on the server.
 * Call on meaningful user actions (mood search, swipe, game play).
 * Also clears winback_stage if user was in a win-back sequence.
 */
export async function touchActivity(): Promise<void> {
  try {
    const userId = await getAppUserId();
    if (!userId) return;

    const { error } = await supabase.rpc('touch_user_activity', {
      p_user_id: userId,
    });

    if (error) {
      logger.warn('[push] touchActivity error:', error.message);
    }
  } catch (err) {
    logger.error(
      '[push] touchActivity error:', err,
      {
        code: 'PUSH_TOUCH_ACTIVITY_FAILED',
        sampleRate: 0.5,
      },
    );
  }
}

// ─── Badge Management ────────────────────────────────────────────────────────

/**
 * Clear the app badge count (call on app foreground).
 */
export async function clearBadge(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    // Non-critical
  }
}

/**
 * Açılışta yerel hatırlatıcı eşitlemesi (V-2 Tur E1, CTO onayı: backfill).
 *
 * Bu build'den önce izin vermiş kullanıcılar için hatırlatıcı hiç planlanmamış
 * olabilir. Koşul: OS izni `granted` VE `users.push_enabled` açıkça `false`
 * değil. `push_enabled` okunamazsa (`null`) hiçbir şey yapılmaz — okuma hatası
 * `getNotificationStatus` içinde zaten Sentry'ye yazıldı. Kullanıcının
 * kapattığı hatırlatıcı bu yolla geri AÇILMAZ.
 */
export async function syncDailyReminderOnLaunch(): Promise<void> {
  const permission = await getPermissionState();
  if (permission !== 'granted') return;

  const pushEnabled = await getNotificationStatus();
  if (pushEnabled === null) return;

  if (pushEnabled) {
    await ensureDailyReminderScheduled();
  } else {
    await cancelDailyReminder();
  }
}
