/**
 * Günlük kullanıcı başı çağrı sınırı (MONEY-1C) — şimdilik yalnız rerank-films.
 *
 * Sayaç `api_rate_limits` + `increment_rate_limit` RPC'si ile tutulur (dakikalık
 * rateLimit.ts ile aynı mekanizma), pencere = UTC gün başı. Migration 138,
 * fonksiyon adı '-daily' ile bitenleri 48 saat saklar; aksi halde cleanup
 * sayacı saatte bir silerdi. Bu yüzden `checkDailyLimit` '-daily' dışı adı REDDEDER.
 *
 * Sayaç okunamazsa FAIL-CLOSED (rateLimit.ts gibi): Sentry `error` + 503.
 * Limit aşımı Sentry'ye `warning` düşer (beklenen iş kuralı, hata değil);
 * sabit fingerprint ile tek issue altında toplanır.
 *
 * Kullanım:
 *   const max = await lookupDailyLimit(auth.appUserId, 'rerank-films')
 *   await checkDailyLimit(auth.authUserId, 'rerank-films-daily', max)
 */
import { getServiceClient } from './gameUtils.ts'
import { RateLimitUnavailableError } from './rateLimit.ts'
import { nextUtcMidnight } from './quotaFields.ts'
import { sentryCapture } from './sentry.ts'

/** Ücretsiz kullanıcı: rerank-films günlük çağrı sınırı. Ölçüm: yapısal üst sınır 3/gün (free arama kotası). */
export const RERANK_DAILY_FREE = 15
/** Premium + legacy_mood_access: rerank-films günlük çağrı sınırı. */
export const RERANK_DAILY_PREMIUM = 60

/** Premium = `free` dışındaki herhangi bir tier ya da legacy_mood_access. Bilinmeyen/boş tier → free. */
export function rerankDailyLimit(tier: string | null | undefined, legacyMoodAccess: boolean | null | undefined): number {
  const premium = legacyMoodAccess === true || (typeof tier === 'string' && tier !== '' && tier !== 'free')
  return premium ? RERANK_DAILY_PREMIUM : RERANK_DAILY_FREE
}

/** Günlük sınır aşıldı → 429 RERANK_DAILY_LIMIT */
export class DailyLimitError extends Error {
  constructor(public limit: number, public resetsAt: string) {
    super('Daily limit exceeded')
    this.name = 'DailyLimitError'
  }
}

/** UTC gün başı (ISO) — sayaç penceresi. */
export function utcDayStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

type Increment = (userId: string, fnName: string, windowStart: string) => Promise<unknown>

async function incrementViaRpc(userId: string, fnName: string, windowStart: string): Promise<unknown> {
  const { data, error } = await getServiceClient().rpc('increment_rate_limit', {
    p_user_id: userId,
    p_function_name: fnName,
    p_window_start: windowStart,
  })
  if (error) throw new Error(`RPC hatası: ${error.message}`)
  return data
}

/**
 * Sayacı artırır, `maxPerDay` aşıldıysa fırlatır.
 * @throws {DailyLimitError}           limit aşıldı → 429
 * @throws {RateLimitUnavailableError} sayaç okunamadı → 503 (fail-closed)
 * `increment` / `now` testler için enjekte edilebilir.
 */
export async function checkDailyLimit(
  userId: string,
  fnName: string,
  maxPerDay: number,
  deps: { increment?: Increment; now?: Date } = {},
): Promise<void> {
  if (!fnName.endsWith('-daily')) {
    // Programlama hatası: cleanup (138) 1 saat sonra siler, limit sessizce sıfırlanır.
    throw new Error(`checkDailyLimit: fonksiyon adı '-daily' ile bitmeli: ${fnName}`)
  }
  if (!userId) {
    throw new RateLimitUnavailableError('userId boş — auth adımı atlanmış')
  }

  const now = deps.now ?? new Date()
  const windowStart = utcDayStart(now)
  const increment = deps.increment ?? incrementViaRpc

  let count: number
  try {
    const data = await increment(userId, fnName, windowStart)
    // NULL/tuhaf dönüşü sessizce 0/1'e çevirmek sayacı kör ederdi (kural 1).
    if (typeof data !== 'number') {
      throw new Error(`RPC beklenmeyen dönüş: ${JSON.stringify(data)}`)
    }
    count = data
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    console.error('[dailyLimit] FAIL-CLOSED —', fnName, ':', reason)
    await sentryCapture({
      message: `günlük limit sayacı okunamadı — istek reddedildi: ${reason}`,
      level: 'error',
      tags: { function: fnName, error_code: 'DAILY_LIMIT_UNAVAILABLE' },
      extra: { user_id: userId, window_start: windowStart },
    })
    throw new RateLimitUnavailableError(reason)
  }

  if (count > maxPerDay) {
    throw new DailyLimitError(maxPerDay, nextUtcMidnight(now))
  }
}

/**
 * Kullanıcının tier'ına göre rerank günlük sınırını bulur. `appUserId` null ise
 * (public.users satırı yok) free sınırı. Okuma hatası FAIL-CLOSED: Sentry + 503.
 */
export async function lookupDailyLimit(appUserId: string | null): Promise<number> {
  if (!appUserId) return RERANK_DAILY_FREE

  try {
    const { data, error } = await getServiceClient()
      .from('users')
      .select('subscription_tier, legacy_mood_access')
      .eq('id', appUserId)
      .maybeSingle()
    if (error) throw new Error(`users okuma hatası: ${error.message}`)

    const row = data as { subscription_tier?: string | null; legacy_mood_access?: boolean | null } | null
    // Satır yok (silinmiş/yarış) → free sınır; hata değil.
    return rerankDailyLimit(row?.subscription_tier, row?.legacy_mood_access)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    console.error('[dailyLimit] tier okunamadı — FAIL-CLOSED:', reason)
    await sentryCapture({
      message: `günlük limit için tier okunamadı — istek reddedildi: ${reason}`,
      level: 'error',
      tags: { function: 'rerank-films', error_code: 'DAILY_LIMIT_UNAVAILABLE' },
      extra: { user_id: appUserId },
    })
    throw new RateLimitUnavailableError(reason)
  }
}

/** DailyLimitError → 429 RERANK_DAILY_LIMIT (+ Sentry warning). */
export async function rerankDailyLimitResponse(
  err: DailyLimitError,
  userId: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  await sentryCapture({
    message: `rerank-films günlük limit aşıldı (${err.limit}/gün)`,
    level: 'warning',
    tags: { function: 'rerank-films', error_code: 'RERANK_DAILY_LIMIT' },
    extra: { user_id: userId, limit: err.limit, resets_at: err.resetsAt },
    fingerprint: ['rerank-films', 'RERANK_DAILY_LIMIT'],
  })

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((new Date(err.resetsAt).getTime() - Date.now()) / 1000),
  )
  return new Response(
    JSON.stringify({
      error: 'Daily rerank limit reached.',
      code: 'RERANK_DAILY_LIMIT',
      limit: err.limit,
      resets_at: err.resetsAt,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
    },
  )
}
