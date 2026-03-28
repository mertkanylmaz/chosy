/**
 * Edge Function Rate Limiter — Supabase tablosu ile server-side rate limiting.
 *
 * In-memory Map yerine `api_rate_limits` tablosunu kullanır:
 * - Uygulama yeniden başlasa bile limit korunur
 * - Tüm cihazlar/instancelar aynı limiti paylaşır
 *
 * Kullanım:
 *   import { checkRateLimit } from '../_shared/rateLimit.ts'
 *   await checkRateLimit(req, 'parse-mood')  // limit aşılırsa hata döner
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Her fonksiyon için limit konfigürasyonu */
const LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  'parse-mood':    { maxRequests: 10, windowMs: 60_000 },  // 10/dakika
  'explain-match': { maxRequests: 30, windowMs: 60_000 },  // 30/dakika
}

/** Rate limit aşımında dönen HTTP yanıtı için hata sınıfı */
export class RateLimitError extends Error {
  constructor(public retryAfterMs: number) {
    super('Rate limit exceeded')
    this.name = 'RateLimitError'
  }
}

/**
 * İstek sahibini tanımlar: Authorization header'dan JWT decode eder.
 * JWT yoksa (veya geçersizse) 'anon' döner.
 */
function extractUserId(req: Request): string {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return 'anon'

  try {
    // JWT payload base64 decode (imza doğrulaması gerekmiyor, sadece kimlik için)
    const payload = JSON.parse(atob(token.split('.')[1]))
    return (payload.sub as string) ?? 'anon'
  } catch {
    return 'anon'
  }
}

/**
 * Supabase tablosu üzerinden rate limit kontrolü yapar.
 *
 * @param req     - Gelen HTTP isteği (Authorization header okunur)
 * @param fnName  - Edge Function adı ('parse-mood' | 'explain-match')
 * @throws {RateLimitError} - Limit aşılırsa
 */
export async function checkRateLimit(req: Request, fnName: string): Promise<void> {
  const limit = LIMITS[fnName]
  if (!limit) return  // Tanımsız fonksiyon için limit yok

  const userId = extractUserId(req)

  // Mevcut dakika penceresinin başlangıcını hesapla
  const windowMs = limit.windowMs
  const now = Date.now()
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs).toISOString()

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const client = createClient(supabaseUrl, serviceKey)

  // UPSERT: kayıt yoksa oluştur, varsa count'u artır
  const { data, error } = await client
    .from('api_rate_limits')
    .upsert(
      {
        user_id:       userId,
        function_name: fnName,
        window_start:  windowStart,
        request_count: 1,
        updated_at:    new Date().toISOString(),
      },
      {
        onConflict:    'user_id,function_name,window_start',
        ignoreDuplicates: false,
      },
    )
    .select('request_count')
    .single()

  if (error) {
    // DB hatası durumunda yanlış pozitif vermemek için geçiriyoruz
    console.error('[rateLimit] DB error:', error.message)
    return
  }

  // Eğer UPSERT yeni kayıt oluşturmadıysa (conflict), count'u artır
  if (data && data.request_count === 1) {
    // Yeni kayıt — sayaç zaten 1, limit geçilmedi
    return
  }

  // Mevcut sayacı oku ve artır
  const { data: updated, error: updateErr } = await client
    .from('api_rate_limits')
    .update({
      request_count: (data?.request_count ?? 0) + 1,
      updated_at:    new Date().toISOString(),
    })
    .eq('user_id',       userId)
    .eq('function_name', fnName)
    .eq('window_start',  windowStart)
    .select('request_count')
    .single()

  if (updateErr) {
    console.error('[rateLimit] Update error:', updateErr.message)
    return
  }

  const currentCount = updated?.request_count ?? 1
  if (currentCount > limit.maxRequests) {
    const retryAfterMs = windowMs - (now % windowMs)
    throw new RateLimitError(retryAfterMs)
  }
}

/**
 * RateLimitError için HTTP 429 yanıtı üretir.
 */
export function rateLimitResponse(
  err: RateLimitError,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please wait before trying again.',
      code:  'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: Math.ceil(err.retryAfterMs / 1000),
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type':  'application/json',
        'Retry-After':   String(Math.ceil(err.retryAfterMs / 1000)),
      },
    },
  )
}
