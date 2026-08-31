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
  PaywallDismissMethod,
  TriggerEvent,
  TriggerType,
  PaywallVariant,
  PaywallVariantName,
  PaywallEventInsert,
} from './types';
import { logger } from '@/utils/logger';
import { remoteConfig } from '@/services/remoteConfig';
import { posthogAnalytics } from '@/services/posthog';

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
    case 'profile_upgrade':
      return 'profile_upgrade';
    case 'roulette_limit':
      return 'roulette_limit';
    case 'lifetime_soldout':
      return 'lifetime_soldout';
    case 'missed_day_archive':
      return 'missed_day_archive';
    default:
      return null;
  }
}

/**
 * Kullanici eylemiyle tetiklenen trigger'lar — cooldown / 24h grace atlanir.
 * Kullanici bilinçli olarak paywall'i goruyor, engellemek UX bozar.
 */
const IMMEDIATE_TRIGGERS: ReadonlySet<TriggerType> = new Set([
  'profile_upgrade',
  'roulette_limit',
  'lifetime_soldout',
]);

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

// ─── Variant Activation Check (Remote Config) ──────────────────────────────

/**
 * Variant → remote config key mapping.
 * Listede olmayan variant'lar daima aktiftir.
 * Geri acma: DB'de ilgili key'i true yap → hydrate sonrasi aktif olur.
 *
 * ⚠️ `profile_upgrade` bu listede DEGILDIR (C.9d fix). 047 onu deaktif etmisti;
 * C.9c ise Profile'daki "Chosy Pro" CTA'sini tek paywall girisi yapti ve flag
 * geri acilmadi — CTA sessizce olu kaldi. Bu trigger `IMMEDIATE_TRIGGERS`
 * uyesidir: kullanicinin bilerek bastigi giris, A/B kill-switch'e tabi otomatik
 * bir varyant degil. `app_config.paywall_profile_upgrade` satiri DB'de durur
 * ama artik okunmaz. Gate'i geri koymak = CTA'yi yeniden oldurmek.
 */
const VARIANT_CONFIG_KEYS: Partial<Record<PaywallVariantName, string>> = {
  streak_milestone: 'paywall_streak_milestone',
  streaming_link: 'paywall_streaming_link',
  roulette_limit: 'paywall_roulette_limit',
  lifetime_soldout: 'paywall_lifetime_soldout',
};

/**
 * Variant'in remote config ile aktif olup olmadigini kontrol eder.
 * Config key yoksa (mapping'de tanimli degilse) variant daima aktiftir.
 * SAFE_DEFAULTS'ta false → deaktif. DB'de true yapilirsa → aktif.
 */
function isVariantEnabled(variantName: PaywallVariantName): boolean {
  const configKey = VARIANT_CONFIG_KEYS[variantName];
  if (!configKey) return true;
  // remoteConfig.get strict typed — cast ile dynamic key okuma
  const val = (remoteConfig as { get(k: string): unknown }).get(configKey);
  return val === true;
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

  // Deaktif variant kontrolu — remote config flag'i false ise paywall gosterme
  if (!isVariantEnabled(variantName)) {
    logger.log(`[orchestrator] Variant deaktif — ${variantName} atlanıyor`);
    posthogAnalytics.track('paywall_variant_skipped', { variant: variantName, trigger: event.type });
    return null;
  }

  const triggerType = event.type;
  const isImmediate = IMMEDIATE_TRIGGERS.has(triggerType);

  // Kullanici eylemiyle tetiklenen trigger'lar cooldown/grace atlar
  if (!isImmediate) {
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

  // ── E-09: paywall_triggered ────────────────────────────────────────────────
  // Tetiklenme ile GÖRÜNTÜLENME ayrı olaylardır: buradan sonra modal açılır ama
  // kullanıcı onu görmeden ekranı terk edebilir. `paywall_viewed` (Contextual-
  // Paywall) tek başına dönüşmeyen bir paywall'ın nedenini söyleyemez; funnel'ın
  // ilk basamağı burasıdır.
  //
  // Supabase `paywall_events` tarafına AYRICA yazılmaz: o tablonun `action`
  // CHECK'i yalnız shown/dismissed/converted/trial_started kabul eder (023:14),
  // 'triggered' eklemek migration ister. Aynı satır `recordPaywallShown` ile
  // action='shown' olarak zaten düşüyor ve `trigger_context.missedDayCount`
  // taşıyor — yani Supabase tarafında bilgi kaybı yok.
  posthogAnalytics.track('paywall_triggered', {
    trigger_type: triggerType,
    variant: variantName,
    missed_day_count:
      'missedDayCount' in event ? event.missedDayCount : null,
  });

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
  trackFunnel('paywall_shown', variant);
  await recordEvent(variant, 'shown');
}

/**
 * Paywall dismiss kaydeder + dismiss counter arttir.
 *
 * `method` E-09'un `dismiss_method` alanıdır (PaywallBase gecirir). Supabase
 * `paywall_events` semasinda boyle bir kolon YOK ve eklenmiyor — ayrim
 * PostHog tarafinda yasiyor, tablo yazimi degismeden kaliyor.
 */
export async function recordPaywallDismissed(
  variant: PaywallVariant,
  method?: PaywallDismissMethod,
): Promise<void> {
  await incrementDismissal(variant.trigger.type);
  trackFunnel('paywall_dismissed', variant, { dismiss_method: method ?? null });
  await recordEvent(variant, 'dismissed');
}

/**
 * Basarili conversion kaydeder.
 */
export async function recordPaywallConverted(variant: PaywallVariant): Promise<void> {
  trackFunnel('paywall_converted', variant);
  await recordEvent(variant, 'converted');
}

/**
 * PostHog aynasi (E-09).
 *
 * `paywall_events` tablosuna yazma DEGISMEDI — bu fonksiyon onun yerine gecmez,
 * yanina gecer. Tablo operasyonel amaca hizmet ediyor (cooldown/dismiss sayaci
 * ayri AsyncStorage'da olsa da satirlar A/B analizinin kaynagi); PostHog ise
 * G-6'nin "canli dogrulanmis event" kapisini karsiliyor. Ikisini tek yola
 * indirmek, calisan bir yazimi riske atmak olurdu.
 */
function trackFunnel(
  event: string,
  variant: PaywallVariant,
  extra: Record<string, string | number | boolean | null> = {},
): void {
  posthogAnalytics.track(event, {
    variant: variant.name,
    trigger_type: variant.trigger.type,
    ab_test_group: variant.abTestGroup,
    missed_day_count:
      'missedDayCount' in variant.trigger ? variant.trigger.missedDayCount : null,
    ...extra,
  });
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
    if ('missedDayCount' in variant.trigger) {
      triggerContext.missedDayCount = variant.trigger.missedDayCount;
    }

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
