/**
 * A/B Test Framework — deterministic user bucketing.
 *
 * User ID hash ile deterministic bucket atamasi yapar.
 * Her kullanici her zaman ayni variant'i gorur.
 *
 * Kullanim:
 *   const group = getExperimentGroup('paywall_quota_v1', userId);
 *   // group === 'control' | 'value_framing' | 'social_proof'
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/utils/logger';

// ─── Experiment Definitions ──────────────────────────────────────────────────

interface ExperimentDef {
  /** Variant isimleri */
  variants: string[];
  /** Yuzdelik dagilimlari (toplami 100) */
  allocation: number[];
}

/** Aktif A/B testleri */
const EXPERIMENTS: Record<string, ExperimentDef> = {
  paywall_quota_v1: {
    variants: ['control', 'value_framing', 'social_proof'],
    allocation: [50, 25, 25],
  },
  paywall_streak_v1: {
    variants: ['control', 'lifetime_offer'],
    allocation: [50, 50],
  },
};

// ─── Override Storage ────────────────────────────────────────────────────────

const OVERRIDE_KEY = 'ab_test_overrides';

/**
 * Dev/admin icin override mekanizmasi.
 * Kullanici her zaman belirli bir variant gorsun.
 */
export async function setExperimentOverride(
  experimentId: string,
  variant: string,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OVERRIDE_KEY);
    const overrides: Record<string, string> = raw ? JSON.parse(raw) : {};
    overrides[experimentId] = variant;
    await AsyncStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
  } catch (err) {
    logger.warn('[ab-test] Override kaydetme hatasi:', err);
  }
}

/** Override'i kaldir */
export async function clearExperimentOverride(experimentId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OVERRIDE_KEY);
    const overrides: Record<string, string> = raw ? JSON.parse(raw) : {};
    delete overrides[experimentId];
    await AsyncStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
  } catch (err) {
    logger.warn('[ab-test] Override silme hatasi:', err);
  }
}

// ─── Hash Function ──────────────────────────────────────────────────────────

/**
 * Basit deterministic hash — user ID + experiment ID'den 0-99 arasi sayi uretir.
 * Crypto gerekmiyor — istatistiksel dagılım yeterli.
 */
function deterministicHash(userId: string, experimentId: string): number {
  const str = `${userId}_${experimentId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash) % 100;
}

// ─── Assignment ─────────────────────────────────────────────────────────────

/**
 * Kullanici icin A/B test grubunu dondurur.
 * Deterministik: ayni user ID + experiment ID daima ayni sonuc verir.
 *
 * @param experimentId Deney adi (orn. 'paywall_quota_v1')
 * @param userId Supabase user UUID
 * @returns Variant adi (orn. 'control', 'value_framing') veya null (deney yoksa)
 */
export async function getExperimentGroup(
  experimentId: string,
  userId: string,
): Promise<string | null> {
  const experiment = EXPERIMENTS[experimentId];
  if (!experiment) return null;

  // Override kontrolu (dev/admin)
  try {
    const raw = await AsyncStorage.getItem(OVERRIDE_KEY);
    if (raw) {
      const overrides: Record<string, string> = JSON.parse(raw);
      if (overrides[experimentId]) {
        return overrides[experimentId];
      }
    }
  } catch {
    // Override okunamadiysa normal akisa devam
  }

  // Deterministic bucket
  const bucket = deterministicHash(userId, experimentId);
  let cumulative = 0;

  for (let i = 0; i < experiment.variants.length; i++) {
    cumulative += experiment.allocation[i];
    if (bucket < cumulative) {
      return experiment.variants[i];
    }
  }

  // Fallback: son variant
  return experiment.variants[experiment.variants.length - 1];
}

/**
 * Tum aktif deneylerin listesini dondurur (dashboard icin).
 */
export function getActiveExperiments(): Record<string, ExperimentDef> {
  return { ...EXPERIMENTS };
}
