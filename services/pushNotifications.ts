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
 *   - Call `registerForPushNotifications()` after onboarding (2nd session)
 *   - Call `savePushToken()` on every app launch (token can rotate)
 *   - Call `handleNotificationResponse()` for deep link navigation
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';
import { getAppUserId } from './watchlist';
import { logger } from '@/utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

/** AsyncStorage key: whether we already asked for permission */
const PERMISSION_ASKED_KEY = 'chosy_push_permission_asked';

/** AsyncStorage key: session count (ask on 2nd session) */
const SESSION_COUNT_KEY = 'chosy_session_count';

/** AsyncStorage key: cached push token */
const PUSH_TOKEN_KEY = 'chosy_push_token';

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
  screen?: string;       // e.g. 'mood', 'games', 'watchlist', 'film'
  filmId?: string;       // for film detail navigation
  gameId?: string;       // for specific game navigation
  action?: string;       // custom action identifier
  offerId?: string;      // promotional offer ID
}

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
      logger.error('[push] No EAS project ID found in app config');
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
  } catch {
    return false;
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
 * Toggle push notifications on/off.
 * Used in Settings screen.
 */
export async function toggleNotifications(enabled: boolean): Promise<boolean> {
  try {
    const userId = await getAppUserId();
    if (!userId) return false;

    if (enabled) {
      // Re-request permissions if enabling
      const granted = await requestPermissions();
      if (!granted) return false;

      // Refresh token
      const token = await getExpoPushToken();
      if (token) {
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
        await savePushTokenToServer(token);
      }
    }

    const { error } = await supabase.rpc('toggle_push_notifications', {
      p_user_id: userId,
      p_enabled: enabled,
    });

    if (error) {
      logger.error('[push] Toggle failed:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    logger.error('[push] toggleNotifications error:', err);
    return false;
  }
}

/**
 * Get push notification enabled status from server.
 */
export async function getNotificationStatus(): Promise<boolean> {
  try {
    const userId = await getAppUserId();
    if (!userId) return false;

    const { data, error } = await supabase
      .from('users')
      .select('push_enabled')
      .eq('id', userId)
      .single();

    if (error || !data) return false;
    return (data as { push_enabled: boolean }).push_enabled;
  } catch {
    return false;
  }
}

// ─── Permission Flow (Post-Onboarding) ───────────────────────────────────────

/**
 * Increment session count and check if we should ask for notification permission.
 * Strategy: Ask on 2nd session — not too early, not too late.
 *
 * @returns true if we should show the permission prompt
 */
export async function shouldAskForPermission(): Promise<boolean> {
  try {
    // Already asked?
    const asked = await AsyncStorage.getItem(PERMISSION_ASKED_KEY);
    if (asked === 'true') return false;

    // Already granted?
    const granted = await isPermissionGranted();
    if (granted) {
      await AsyncStorage.setItem(PERMISSION_ASKED_KEY, 'true');
      return false;
    }

    // Check session count
    const countStr = await AsyncStorage.getItem(SESSION_COUNT_KEY);
    const count = countStr ? parseInt(countStr, 10) : 0;
    const newCount = count + 1;
    await AsyncStorage.setItem(SESSION_COUNT_KEY, String(newCount));

    // Ask on 2nd session
    return newCount >= 2;
  } catch {
    return false;
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

  switch (data.screen) {
    case 'mood':
      return '/(tabs)/mood';
    case 'watchlist':
      return '/(tabs)/watchlist';
    case 'profile':
      return '/(tabs)/profile';
    case 'games':
      return data.gameId ? `/games/${data.gameId}` : '/games';
    case 'film':
      return data.filmId ? `/film/${data.filmId}` : null;
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
    logger.error('[push] markNotificationOpened error:', err);
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
    logger.error('[push] touchActivity error:', err);
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
