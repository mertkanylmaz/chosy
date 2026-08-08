/**
 * Edge Function Rate Limiter — `api_rate_limits` tablosu ile server-side limit.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 8 Ağu 2026 ONARIMI — bu dosyanın önceki hâli HİÇBİR ŞEYİ SINIRLAMIYORDU.
 * Üç bağımsız kusur vardı, üçü de burada kapatıldı:
 *
 *  1. SAYAÇ ARTMIYORDU. PostgREST `upsert` gövdeye sabit `request_count: 1`
 *     yazıyordu; çakışmada `ON CONFLICT DO UPDATE` mevcut sayacın ÜZERİNE 1
 *     yazıyordu. Dönen değer hep 1 olduğu için `if (count === 1) return`
 *     her istekte erken dönüyor, `throw new RateLimitError` ULAŞILAMAZ kod
 *     oluyordu. → Artırma migration 076'daki `increment_rate_limit` RPC'sine
 *     taşındı; artırma artık tek ifadede, atomik.
 *
 *  2. KİMLİK DOĞRULANMIYORDU. JWT `atob` ile imza doğrulanmadan açılıp `sub`
 *     alanına güveniliyordu. Saldırgan her istekte uydurma bir `sub`
 *     göndererek sınırsız temiz kova açabilirdi — yani limit, limit koymak
 *     isteyen herkes için geçerliydi, aşmak isteyen için değil.
 *     → Bu dosyada ARTIK JWT KODU YOK. Kimlik dışarıdan, `_shared/auth.ts`
 *     `requireUser()` tarafından İMZA DOĞRULANARAK verilir. `userId`
 *     parametresi zorunlu: kimliksiz çağrı yapısal olarak imkânsız.
 *
 *  3. DB HATASINDA SESSİZCE GEÇİYORDU. `console.error` + `return`, Sentry yok.
 *     → FAIL-CLOSED. Sayaç okunamıyorsa istek reddedilir (503) ve Sentry'ye
 *     `level: 'error'` ile yazılır. Sessiz fallback proje kuralı 1'in ihlali.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Pencere semantiği: SABİT (tumbling) bucket — `floor(now / windowMs) * windowMs`.
 * Kayan pencere DEĞİL. Dakika sınırında 2× burst mümkündür; 033'ten beri
 * böyle ve bu onarımın kapsamı değil. Eski satırları `cleanup_rate_limits()`
 * saat başı siler.
 *
 * Kullanım:
 *   const auth = await requireUser(req)
 *   if (!auth.ok) return unauthorizedResponse(auth, CORS_HEADERS)
 *   try {
 *     await checkRateLimit(auth.authUserId, 'explain-match')
 *   } catch (err) {
 *     return rateLimitResponse(err, CORS_HEADERS)
 *   }
 */
import { getServiceClient } from './gameUtils.ts'
import { sentryCapture } from './sentry.ts'

/** Her fonksiyon için limit konfigürasyonu */
const LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  'parse-mood':    { maxRequests: 10, windowMs: 60_000 },  // 10/dakika
  'explain-match': { maxRequests: 30, windowMs: 60_000 },  // 30/dakika
  'rerank-films':  { maxRequests: 10, windowMs: 60_000 },  // 10/dakika
  'recommend':     { maxRequests: 10, windowMs: 60_000 },  // 10/dakika
}

/** Limit aşıldı — istemci beklemeli (429) */
export class RateLimitError extends Error {
  constructor(public retryAfterMs: number) {
    super('Rate limit exceeded')
    this.name = 'RateLimitError'
  }
}

/**
 * Sayaç OKUNAMADI — limit uygulanamıyor (503).
 *
 * Fail-open ile fail-closed arasındaki tercih burada yapılıyor: sayaç
 * çalışmıyorken isteği geçirmek, tam olarak onarmaya çalıştığımız duruma
 * (sınırsız ücretli LLM çağrısı) geri dönmek olurdu.
 */
export class RateLimitUnavailableError extends Error {
  constructor(public reason: string) {
    super('Rate limit backend unavailable')
    this.name = 'RateLimitUnavailableError'
  }
}

/**
 * Rate limit kontrolü — sayacı atomik artırır ve limiti karşılaştırır.
 *
 * @param userId - **Doğrulanmış** kullanıcı kimliği (`requireUser().authUserId`).
 *                 Ham JWT'den okunmuş bir değer BURAYA GEÇİRİLMEZ.
 * @param fnName - Edge Function adı (LIMITS anahtarı)
 * @throws {RateLimitError}            Limit aşıldıysa → 429
 * @throws {RateLimitUnavailableError} Sayaç okunamadıysa → 503 (fail-closed)
 */
export async function checkRateLimit(userId: string, fnName: string): Promise<void> {
  const limit = LIMITS[fnName]
  if (!limit) return  // Tanımsız fonksiyon için limit yok

  if (!userId) {
    // Çağıran auth adımını atlamış demektir — geçirmek eski kusuru geri getirir.
    throw new RateLimitUnavailableError('userId boş — auth adımı atlanmış')
  }

  const { windowMs, maxRequests } = limit
  const now = Date.now()
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs).toISOString()

  let count: number

  try {
    const { data, error } = await getServiceClient().rpc('increment_rate_limit', {
      p_user_id:       userId,
      p_function_name: fnName,
      p_window_start:  windowStart,
    })

    if (error) throw new Error(`RPC hatası: ${error.message}`)

    // NULL dönüşü sessizce 0/1'e çevirmek sayacı yeniden kör ederdi (kural 1).
    if (typeof data !== 'number') {
      throw new Error(`RPC beklenmeyen dönüş: ${JSON.stringify(data)}`)
    }

    count = data
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    console.error('[rateLimit] FAIL-CLOSED —', fnName, ':', reason)

    await sentryCapture({
      message: `rateLimit sayacı okunamadı — istek reddedildi: ${reason}`,
      level: 'error',
      tags: { function: fnName, error_code: 'RATE_LIMIT_UNAVAILABLE' },
      extra: { user_id: userId, window_start: windowStart },
    })

    throw new RateLimitUnavailableError(reason)
  }

  if (count > maxRequests) {
    throw new RateLimitError(windowMs - (now % windowMs))
  }
}

/**
 * Rate limit yolundan gelen HERHANGİ bir hatayı HTTP yanıtına çevirir.
 *
 * `unknown` alması bilinçli: eski kod `if (err instanceof RateLimitError)`
 * yazıp `else` dalını boş bırakıyordu, yani limiter'ın fırlattığı diğer her
 * hata SESSİZCE YUTULUYOR ve istek LLM'e ulaşıyordu. Bu imza o hatayı
 * yapısal olarak imkânsız kılar — beklenmeyen her hata 503 olur.
 */
export function rateLimitResponse(
  err: unknown,
  corsHeaders: Record<string, string>,
): Response {
  if (err instanceof RateLimitError) {
    const retryAfterSeconds = Math.ceil(err.retryAfterMs / 1000)
    return new Response(
      JSON.stringify({
        error: 'Too many requests. Please wait before trying again.',
        code:  'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After':  String(retryAfterSeconds),
        },
      },
    )
  }

  // RateLimitUnavailableError zaten checkRateLimit içinde Sentry'ye yazıldı.
  // Buraya düşen BAŞKA bir hata varsa görünmesi gerekir — sessizce 503'e
  // dönüşmesi eski "boş else" kusurunun tekrarı olurdu.
  if (!(err instanceof RateLimitUnavailableError)) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error('[rateLimit] Beklenmeyen hata:', reason)
    sentryCapture({
      message: `rateLimit yolunda beklenmeyen hata: ${reason}`,
      level: 'error',
      tags: { error_code: 'RATE_LIMIT_UNEXPECTED' },
    }).catch(() => {})
  }

  return new Response(
    JSON.stringify({
      error: 'Service temporarily unavailable. Please try again shortly.',
      code:  'RATE_LIMIT_UNAVAILABLE',
      retry_after: 60,
    }),
    {
      status: 503,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After':  '60',
      },
    },
  )
}
