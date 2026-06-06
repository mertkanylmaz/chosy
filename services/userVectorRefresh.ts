import { supabase } from './supabase';
import { logger } from '../utils/logger';

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 dakika

// In-memory throttle: hangi user için ne zaman invoke ettik
const recentInvokes = new Map<string, number>();
const INVOKE_THROTTLE_MS = 30 * 60 * 1000;

interface UserVectorResult {
  vector: number[] | null;
  signalCount: number;
}

/**
 * Supabase'den gelen vector'ü number[] dizisine çevirir.
 * Format: '[0.1,0.2,...]' (pgvector text) veya number[].
 */
function parseVector(raw: unknown): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Edge Function'i fire-and-forget invoke et.
 * Throttle: ayni user icin 30 dk icinde tekrar cagri atlanir.
 */
function triggerRecompute(userId: string): void {
  const lastInvoke = recentInvokes.get(userId);
  if (lastInvoke !== undefined && Date.now() - lastInvoke < INVOKE_THROTTLE_MS) {
    return; // throttled
  }
  recentInvokes.set(userId, Date.now());

  // Memory leak prevention: 100'den fazla entry varsa eskileri temizle
  if (recentInvokes.size > 100) {
    const cutoff = Date.now() - INVOKE_THROTTLE_MS;
    for (const [id, ts] of recentInvokes.entries()) {
      if (ts < cutoff) recentInvokes.delete(id);
    }
  }

  // Fire-and-forget: bekleme yok
  supabase.functions
    .invoke('recompute-user-vector', { body: { user_id: userId } })
    .then((res) => {
      if (res.error) {
        logger.warn('[userVectorRefresh] Edge function error:', res.error.message);
      } else if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[userVectorRefresh] Recompute triggered:', res.data);
      }
    })
    .catch((err) => {
      logger.warn('[userVectorRefresh] Edge function invoke failed:', err);
    });
}

/**
 * User'in vector'unu ve toplam signal sayisini dondurur.
 * Eger vector stale ise (dirty=true + last_update > 30 dk once),
 * arka planda Edge Function tetikler ama YANITI BEKLEMEZ.
 *
 * Cold-start (vector=null) veya stale durumda mevcut vector'u doner.
 * Recommendations.ts dynamic blend weight icin signalCount'u kullanir.
 */
export async function getFreshUserVector(userId: string): Promise<UserVectorResult> {
  try {
    // 1. User'in vector + dirty flag durumu
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('preferences_vector, preferences_vector_dirty, preferences_vector_updated_at')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      logger.warn('[userVectorRefresh] User fetch failed:', userError?.message);
      return { vector: null, signalCount: 0 };
    }

    const vector = parseVector(user.preferences_vector);

    // 2. Stale check
    const isDirty = user.preferences_vector_dirty === true;
    const updatedAt = user.preferences_vector_updated_at
      ? new Date(user.preferences_vector_updated_at).getTime()
      : 0;
    const isStale = isDirty && (Date.now() - updatedAt > STALE_THRESHOLD_MS);

    // 3. Stale ise arka planda recompute tetikle (bekleme yok)
    if (isStale) {
      triggerRecompute(userId);
    }

    // 4. Signal count (blend weight icin)
    const { count: signalCount } = await supabase
      .from('user_taste_signals')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    return { vector, signalCount: signalCount ?? 0 };
  } catch (err) {
    logger.error('[userVectorRefresh] Unhandled error:', err);
    return { vector: null, signalCount: 0 };
  }
}

/**
 * Signal count -> dynamic blend weights.
 * Step function (CTO karari):
 *   < 10:      mood 1.0, user 0.0 (cold start)
 *   10-49:     mood 0.85, user 0.15 (light personalization)
 *   50-199:    mood 0.70, user 0.30 (default)
 *   >= 200:    mood 0.55, user 0.45 (heavy user)
 */
export function calculateBlendWeights(signalCount: number): {
  moodWeight: number;
  userWeight: number;
} {
  if (signalCount < 10) return { moodWeight: 1.0, userWeight: 0.0 };
  if (signalCount < 50) return { moodWeight: 0.85, userWeight: 0.15 };
  if (signalCount < 200) return { moodWeight: 0.7, userWeight: 0.3 };
  return { moodWeight: 0.55, userWeight: 0.45 };
}
