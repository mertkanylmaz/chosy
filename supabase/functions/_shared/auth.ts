/**
 * Edge Function kimlik doğrulaması — TEK KAYNAK.
 *
 * Bu dosya 7 Ağu 2026'da keşfedilen kalemin cevabı: `explain-match` ve
 * `generate-puzzles` hiçbir kimlik kontrolü yapmadan ücretli LLM çağırıyordu,
 * `rerank-films` ve `recommend` ise yalnızca uygulama binary'sinde GÖMÜLÜ olan
 * anon key ile korunuyordu — yani pratikte korunmuyordu.
 *
 * ── Neden manuel JWT decode YASAK ──────────────────────────────────────────
 * `rateLimit.ts` eski hâli JWT'yi `atob` ile İMZA DOĞRULAMADAN açıp `sub`
 * alanına güveniyordu. Bu kimlik doğrulaması değil, kimlik BEYANI: saldırgan
 * her istekte uydurma bir `sub` göndererek sınırsız sayıda temiz kova açardı.
 * Aynı ders `parse-mood` içinde bir kez öğrenilmişti (index.ts:163 —
 * "Manual atob JWT decode KALDIRILDI"); bu dosya onu kalıcılaştırıyor.
 *
 * Kimlik YALNIZCA `supabase.auth.getUser()` ile, yani imza doğrulanarak alınır.
 *
 * ── Anonim oturum reddedilmez ──────────────────────────────────────────────
 * `app/_layout.tsx:196` her istemci için `signInAnonymously()` çağırıyor. Bu
 * oturumun token'ı da imzalıdır ve gerçek, tekil bir `sub` taşır. Reddedilen
 * şey "anonim kullanıcı" değil, KİMLİKSİZ istek: token yok, ya da token
 * doğrulanamıyor (anon key'in kendisi dahil — o bir kullanıcı değil, bir
 * API anahtarıdır ve `getUser()` ondan kullanıcı üretemez).
 *
 * Kullanım:
 *   const auth = await requireUser(req)
 *   if (!auth.ok) return unauthorizedResponse(auth, CORS_HEADERS)
 *   // auth.authUserId  → auth.users.id (rate limit kovası)
 *   // auth.appUserId   → public.users.id (quota/iş mantığı), yoksa null
 */
import { AuthError, getServiceClient, getUserClient } from './gameUtils.ts'

/** Doğrulanmış kimlik */
export interface AuthOk {
  ok: true
  /** `auth.users.id` — imza doğrulanmış JWT'den gelir, her zaman dolu */
  authUserId: string
  /** `public.users.id` — uygulama satırı henüz yoksa null */
  appUserId: string | null
  /** Supabase anonim oturumu mu (`is_anonymous`) */
  isAnonymous: boolean
}

/** Reddedilmiş istek */
export interface AuthFail {
  ok: false
  /** İstemciye dönecek HTTP durumu */
  status: 401
  code: 'AUTH_REQUIRED' | 'AUTH_INVALID'
  message: string
}

export type AuthResult = AuthOk | AuthFail

/**
 * İsteği doğrulanmış bir kullanıcıya bağlar.
 *
 * Fail-CLOSED: token yoksa, doğrulanamıyorsa veya doğrulama sırasında hata
 * oluşursa istek REDDEDİLİR. Sessiz geçiş yoktur (proje kuralı 1).
 *
 * `public.users` lookup'ı başarısız olursa istek reddedilmez — kimlik zaten
 * doğrulanmıştır ve `auth.users.id` rate limit için yeterlidir. Uygulama
 * satırının yokluğu bir yetki sorunu değil, bir veri durumudur; çağıran
 * fonksiyon `appUserId === null` durumunu kendi iş mantığına göre yorumlar.
 */
export async function requireUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !/^Bearer\s+\S+/i.test(authHeader)) {
    return {
      ok: false,
      status: 401,
      code: 'AUTH_REQUIRED',
      message: 'Authentication required.',
    }
  }

  let authUserId: string
  let isAnonymous: boolean

  try {
    // `getUserClient` çağıranın JWT'sini taşır — doğrulama Supabase tarafında,
    // imza kontrolüyle yapılır. Bu dosyada JWT'nin içine BAKILMAZ.
    const userClient = getUserClient(req)

    const { data: { user }, error } = await userClient.auth.getUser()

    if (error || !user) {
      // Beklenen yol: süresi dolmuş token ya da anon key ile çağrı.
      // Sentry'ye YAZILMAZ — bu gürültü olur, saldırı değil normal istemci hâli.
      console.warn('[auth] getUser başarısız:', error?.message ?? 'kullanıcı yok')
      return {
        ok: false,
        status: 401,
        code: 'AUTH_INVALID',
        message: 'Invalid or expired session.',
      }
    }

    authUserId = user.id
    isAnonymous = user.is_anonymous === true
  } catch (e) {
    // `getUserClient` header yoksa AuthError fırlatır; ağ/yapılandırma hataları
    // da buraya düşer. Hepsinde kimlik DOĞRULANAMAMIŞTIR — geçirmek fail-open.
    const msg = e instanceof AuthError ? e.message : (e as Error).message
    console.error('[auth] kimlik doğrulanamadı:', msg)
    return {
      ok: false,
      status: 401,
      code: 'AUTH_INVALID',
      message: 'Invalid or expired session.',
    }
  }

  // ── public.users satırı (opsiyonel) ────────────────────────────────────────
  let appUserId: string | null = null

  try {
    const { data, error } = await getServiceClient()
      .from('users')
      .select('id')
      .eq('auth_id', authUserId)
      .maybeSingle()

    if (error) {
      console.warn('[auth] users lookup hatası:', error.message, '| auth_id:', authUserId)
    } else if (data) {
      appUserId = (data as { id: string }).id
    }
  } catch (e) {
    console.warn('[auth] users lookup istisnası:', (e as Error).message)
  }

  return { ok: true, authUserId, appUserId, isAnonymous }
}

/** `requireUser` reddi için HTTP 401 yanıtı üretir. */
export function unauthorizedResponse(
  fail: AuthFail,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({ error: fail.message, code: fail.code }),
    {
      status: fail.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
}
