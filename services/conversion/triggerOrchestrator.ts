/**
 * Conversion Trigger Orchestrator — contextual paywall gosterim kararlari.
 *
 * Rules engine:
 *   - Ayni trigger 24 saat icinde max 1 kez
 *   - 3 dismiss sonrasi 7 gun cooldown
 *   - Yeni user ilk 24 saat NO PAYWALL (habit formation)
 *   - Active trial sirasinda NO PAYWALL
 *
 * Kullanim:
 *   const variant = await orchestrator.shouldShowPaywall(event);
 *   if (variant) { showPaywall(variant); }
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/services/supabase';
import { getAppUserId } from '@/services/auth-utils';
import { getExperimentGroup } from './abTesting';
import type {
  TriggerEvent,
  TriggerType,
  PaywallVariant,
  PaywallVariantName,
  PaywallEventInsert,
} from './types';
import { logger } from '@/utils/logger';

// ─── Storage Keys ────────────────────────────────────────────────────────────

const COOLDOWN_KEY = 'paywall_cooldowns';
const DISMISS_KEY = 'paywall_dismissals';
const FIRST_OPEN_KEY = 'paywall_first_open';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Ayni trigger max 24 saatte 1 kez */
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** 3 dismiss sonrasi 7 gun bekleme */
const MAX_DISMISSALS_BEFORE_EXTENDED = 3;
const EXTENDED_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Yeni kullanici ilk 24 saat paywall gormez */
const NEW_USER_GRACE_MS = 24 * 60 * 60 * 1000;

// ─── Trigger → Variant Mapping ──────────────────────────────────────────────

function triggerToVariant(event: TriggerEvent): PaywallVariantName | null {
  switch (event.type) {
    case 'quota_exhausted':
      return 'quota_exhausted';
    case 'streak_milestone':
      return 'streak_milestone';
    case 'watchlist_full':
      return 'watchlist_full';
    case 'mood_history_tap':
      return 'mood_history';
    case 'streaming_link_tap':
      return 'streaming_link';
    case 'game_perfect_streak':
      return 'streak_milestone';
    case 'custom_list_attempt':
      return 'watchlist_full';
    case 'share_card_generated':
      return null; // V1.1'de eklenecek
    default:
      return null;
  }
}

/** Trigger icin ilgili A/B test ID'si */
function triggerToExperiment(triggerType: TriggerType): string | null {
  switch (triggerType) {
    case 'quota_exhausted':
      return 'paywall_quota_v1';
    case 'streak_milestone':
    case 'game_perfect_streak':
      return 'paywall_streak_v1';
    default:
      return null;
  }
}

// ─── Cooldown & Dismissal Persistence ────────────────────────────────────────

interface CooldownStore {
  [triggerType: string]: number; // timestamp
}

interface DismissalStore {
  [triggerType: string]: number; // count
}

async function getCooldowns(): Promise<CooldownStore> {
  try {
    const raw = await AsyncStorage.getItem(COOLDOWN_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function setCooldown(triggerType: string): Promise<void> {
  const cooldowns = await getCooldowns();
  cooldowns[triggerType] = Date.now();
  await AsyncStorage.setItem(COOLDOWN_KEY, JSON.stringify(cooldowns));
}

async function getDismissals(): Promise<DismissalStore> {
  try {
    const raw = await AsyncStorage.getItem(DISMISS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function incrementDismissal(triggerType: string): Promise<number> {
  const dismissals = await getDismissals();
  dismissals[triggerType] = (dismissals[triggerType] ?? 0) + 1;
  await AsyncStorage.setItem(DISMISS_KEY, JSON.stringify(dismissals));
  return dismissals[triggerType];
}

// ─── First Open Tracking ─────────────────────────────────────────────────────

async function getFirstOpenTime(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(FIRST_OPEN_KEY);
    if (raw) return parseInt(raw, 10);

    // Ilk kez — kaydet
    const now = Date.now();
    await AsyncStorage.setItem(FIRST_OPEN_KEY, String(now));
    return now;
  } catch {
    return 0;
  }
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

/**
 * Contextual paywall gosterim karari verir.
 *
 * @param event Tetikleyen olay
 * @param isInTrial Kullanici trial doneminde mi?
 * @param isPremium Kullanici premium mu?
 * @returns PaywallVariant veya null (gosterme)
 */
export async function shouldShowPaywall(
  event: TriggerEvent,
  isInTrial: boolean,
  isPremium: boolean,
): Promise<PaywallVariant | null> {
  // Premium veya trial kullanicilar paywall gormez
  if (isPremium || isInTrial) {
    return null;
  }

  // Variant mapping
  const variantName = triggerToVariant(event);
  if (!variantName) return null;

  const triggerType = event.type;

  // Yeni kullanici kontrolu — ilk 24 saat paywall yok
  const firstOpen = await getFirstOpenTime();
  if (Date.now() - firstOpen < NEW_USER_GRACE_MS) {
    logger.log('[orchestrator] Yeni kullanici — paywall atlanıyor');
    return null;
  }

  // Cooldown kontrolu
  const cooldowns = await getCooldowns();
  const lastShown = cooldowns[triggerType] ?? 0;
  const dismissals = await getDismissals();
  const dismissCount = dismissals[triggerType] ?? 0;

  // 3+ dismiss → 7 gun cooldown
  const activeCooldown = dismissCount >= MAX_DISMISSALS_BEFORE_EXTENDED
    ? EXTENDED_COOLDOWN_MS
    : COOLDOWN_MS;

  if (Date.now() - lastShown < activeCooldown) {
    logger.log(`[orchestrator] Cooldown aktif — ${triggerType} atlanıyor`);
    return null;
  }

  // A/B test grubu ata
  let abTestGroup: string | null = null;
  const experimentId = triggerToExperiment(triggerType);
  if (experimentId) {
    const userId = await getAppUserId();
    if (userId) {
      abTestGroup = await getExperimentGroup(experimentId, userId);
    }
  }

  return {
    name: variantName,
    trigger: event,
    abTestGroup,
  };
}

// ─── Event Recording ─────────────────────────────────────────────────────────

/**
 * Paywall gosterimini kaydeder + cooldown baslat.
 */
export async function recordPaywallShown(variant: PaywallVariant): Promise<void> {
  await setCooldown(variant.trigger.type);
  await recordEvent(variant, 'shown');
}

/**
 * Paywall dismiss kaydeder + dismiss counter arttir.
 */
export async function recordPaywallDismissed(variant: PaywallVariant): Promise<void> {
  await incrementDismissal(variant.trigger.type);
  await recordEvent(variant, 'dismissed');
}

/**
 * Basarili conversion kaydeder.
 */
export async function recordPaywallConverted(variant: PaywallVariant): Promise<void> {
  await recordEvent(variant, 'converted');
}

/**
 * Trial baslangici kaydeder.
 */
export async function recordTrialStarted(variant: PaywallVariant): Promise<void> {
  await recordEvent(variant, 'trial_started');
}

// ─── Internal ────────────────────────────────────────────────────────────────

async function recordEvent(
  variant: PaywallVariant,
  action: PaywallEventInsert['action'],
): Promise<void> {
  try {
    const userId = await getAppUserId();
    if (!userId) return;

    const triggerContext: Record<string, unknown> = {};
    if ('quota' in variant.trigger) triggerContext.quota = variant.trigger.quota;
    if ('days' in variant.trigger) triggerContext.days = variant.trigger.days;
    if ('count' in variant.trigger) triggerContext.count = variant.trigger.count;
    if ('filmId' in variant.trigger) triggerContext.filmId = variant.trigger.filmId;

    const row: PaywallEventInsert = {
      user_id: userId,
      variant: variant.name,
      trigger_type: variant.trigger.type,
      trigger_context: triggerContext,
      action,
      ab_test_group: variant.abTestGroup,
    };

    const { error } = await supabase.from('paywall_events').insert(row);
    if (error) {
      logger.warn('[orchestrator] Event kayit hatasi:', error.message);
    }
  } catch (err) {
    logger.warn('[orchestrator] Event kayit exception:', err);
  }
}
