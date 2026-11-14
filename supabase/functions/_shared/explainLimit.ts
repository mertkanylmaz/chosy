/**
 * explain-match kullanım sınırları (145, güvenlik P0).
 *
 * Fonksiyon her çağrıda ücretli LLM çağırır ve anonim oturumlara da açıktır (film detayı
 * herkese açık; kullanıcıların çoğu anonim). 145 öncesinde yalnız dakikalık kullanıcı
 * sınırı (30/dk) vardı — günlük tavan yoktu.
 *
 * Dört kapı, hepsi LLM'den ÖNCE:
 *   1. kullanıcı başı dakikalık   — `explain-match`           (rateLimit.ts, çağıran yapar)
 *   2. IP başı dakikalık          — `explain-match-ip`        (rateLimit.ts)
 *   3. kullanıcı başı günlük      — `explain-match-daily`     (dailyLimit.ts)
 *   4. IP başı günlük             — `explain-match-ip-daily`  (dailyLimit.ts)
 *
 * IP kapıları neden var: kullanıcı başı tavan tek başına dolanılabilir — her yeni anonim
 * oturum yeni bir kullanıcı kimliğidir. IP kovası `ip:<adres>` anahtarıyla aynı
 * `api_rate_limits` tablosunda tutulur (`p_user_id` text).
 *
 * Günlük tavan aşımı BEKLENEN bir durumdur (iş kuralı): istemci şablon açıklamaya düşer.
 * Sentry'ye yazılmaz; `console.warn` ile yapılandırılmış log düşer (aşan istek sayısı dahil).
 * Sayaç okunamazsa FAIL-CLOSED (503) — rateLimit.ts / dailyLimit.ts ile aynı.
 */
import { checkDailyLimit, DailyLimitError } from './dailyLimit.ts'
import { checkRateLimit } from './rateLimit.ts'

/** Kullanıcı başı günlük explain-match çağrı tavanı. */
export const EXPLAIN_DAILY_USER = 50
/** IP başı günlük tavan — paylaşılan IP (NAT, mobil operatör) için kullanıcı tavanının 4 katı. */
export const EXPLAIN_DAILY_IP = 200

export const EXPLAIN_USER_DAILY_KEY = 'explain-match-daily'
export const EXPLAIN_IP_DAILY_KEY = 'explain-match-ip-daily'
export const EXPLAIN_IP_MINUTE_KEY = 'explain-match-ip'

export type ClientIpSource = 'cf-connecting-ip' | 'x-real-ip' | 'x-forwarded-for'

/**
 * İstemci IP'si. Öncelik: platformun yazdığı başlıklar (`cf-connecting-ip`, `x-real-ip`),
 * sonra `x-forwarded-for`'un İLK öğesi. XFF en sonda: istemci kendi XFF değerini
 * gönderebilir ve vekiller buna ekleme yapar; ilk öğe istemci beyanı olabilir.
 * Hiçbiri yoksa `null` — çağıran bunu sessizce geçmez (bkz. `enforceExplainLimits`).
 */
export function clientIp(headers: Headers): { ip: string; source: ClientIpSource } | null {
  const cf = headers.get('cf-connecting-ip')?.trim()
  if (cf) return { ip: cf, source: 'cf-connecting-ip' }
  const real = headers.get('x-real-ip')?.trim()
  if (real) return { ip: real, source: 'x-real-ip' }
  const first = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (first) return { ip: first, source: 'x-forwarded-for' }
  return null
}

/** IP kovasının sayaç anahtarı. Kullanıcı UUID'leriyle çakışamaz (`ip:` öneki). */
export function ipBucket(ip: string): string {
  return `ip:${ip.toLowerCase()}`
}

/** Günlük tavan aşıldı → 429 EXPLAIN_DAILY_LIMIT. `scope`: hangi kova doldu. */
export class ExplainDailyLimitError extends Error {
  constructor(
    public scope: 'user' | 'ip',
    public limit: number,
    public resetsAt: string,
    public count: number | null,
  ) {
    super('Explain daily limit exceeded')
    this.name = 'ExplainDailyLimitError'
  }
}

export interface ExplainLimitDeps {
  checkMinute: (bucket: string, fnName: string) => Promise<void>
  checkDaily: (bucket: string, fnName: string, max: number) => Promise<void>
  /** IP belirlenemediğinde çağrılır (yalnız kullanıcı kovaları uygulanır). */
  onIpMissing: () => Promise<void>
}

const defaultDeps: Pick<ExplainLimitDeps, 'checkMinute' | 'checkDaily'> = {
  checkMinute: (bucket, fnName) => checkRateLimit(bucket, fnName),
  checkDaily: (bucket, fnName, max) => checkDailyLimit(bucket, fnName, max),
}

/**
 * IP dakikalık + kullanıcı günlük + IP günlük kapıları. Kullanıcı dakikalık kapısı
 * (`explain-match`) çağıranda kalır — sırası değişmedi.
 *
 * @throws {RateLimitError}            IP dakikalık sınır → 429
 * @throws {ExplainDailyLimitError}    günlük tavan → 429 EXPLAIN_DAILY_LIMIT
 * @throws {RateLimitUnavailableError} sayaç okunamadı → 503 (fail-closed)
 */
export async function enforceExplainLimits(
  authUserId: string,
  ip: string | null,
  deps: Pick<ExplainLimitDeps, 'onIpMissing'> & Partial<ExplainLimitDeps>,
): Promise<void> {
  const checkMinute = deps.checkMinute ?? defaultDeps.checkMinute
  const checkDaily = deps.checkDaily ?? defaultDeps.checkDaily
  const bucket = ip ? ipBucket(ip) : null

  if (bucket) {
    await checkMinute(bucket, EXPLAIN_IP_MINUTE_KEY)
  } else {
    // IP yok: platform başlıkları gelmedi. Sessiz geçiş değil — çağıran Sentry'ye yazar.
    await deps.onIpMissing()
  }

  try {
    await checkDaily(authUserId, EXPLAIN_USER_DAILY_KEY, EXPLAIN_DAILY_USER)
  } catch (err) {
    if (err instanceof DailyLimitError) {
      throw new ExplainDailyLimitError('user', err.limit, err.resetsAt, err.count ?? null)
    }
    throw err
  }

  if (bucket) {
    try {
      await checkDaily(bucket, EXPLAIN_IP_DAILY_KEY, EXPLAIN_DAILY_IP)
    } catch (err) {
      if (err instanceof DailyLimitError) {
        throw new ExplainDailyLimitError('ip', err.limit, err.resetsAt, err.count ?? null)
      }
      throw err
    }
  }
}

/** Log satırı: tavanı aşan istek sayısı = `over` (sayaç − limit). Kimlik/IP yazılmaz. */
export function explainLimitLog(err: ExplainDailyLimitError): Record<string, unknown> {
  return {
    event: 'explain_daily_limit_exceeded',
    scope: err.scope,
    limit: err.limit,
    count: err.count,
    over: err.count === null ? null : err.count - err.limit,
    resets_at: err.resetsAt,
  }
}

/** ExplainDailyLimitError → 429 EXPLAIN_DAILY_LIMIT. */
export function explainDailyLimitResponse(
  err: ExplainDailyLimitError,
  corsHeaders: Record<string, string>,
  now: Date = new Date(),
): Response {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((new Date(err.resetsAt).getTime() - now.getTime()) / 1000),
  )
  return new Response(
    JSON.stringify({
      error: 'Daily explanation limit reached.',
      code: 'EXPLAIN_DAILY_LIMIT',
      scope: err.scope,
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
