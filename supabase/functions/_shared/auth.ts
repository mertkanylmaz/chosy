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
import { sentryCapture } from './sentry.ts'

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
  code: 'AUTH_REQUIRED' | 'AUTH_INVALID' | 'SERVICE_ROLE_REQUIRED'
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

/**
 * İsteğin service-role anahtarıyla geldiğini DOĞRULAR.
 *
 * Kullanıcı fonksiyonları için değildir — batch/cron üretim işleri içindir
 * (`generate-puzzles` gibi). `requireUser` burada yanlış araçtır: çağıran bir
 * kullanıcı değil, sistemin kendisidir.
 *
 * ── Neden `atob` ile role claim'i okunmuyor ────────────────────────────────
 * `recompute-cinema-dna` / `recompute-taste-vector` JWT payload'ını imza
 * doğrulamadan açıp `role === 'service_role'` bakıyor. O iki fonksiyonda bu
 * güvenli, çünkü ikisi de `config.toml`'da beyan edilmemiş → gateway JWT'yi
 * imzasıyla doğruladıktan SONRA fonksiyona veriyor. `generate-puzzles`'ta ise
 * `verify_jwt = false` — imzayı kimse doğrulamıyor. Orada aynı deseni
 * kullanmak, saldırganın `{"role":"service_role"}` payload'lı İMZASIZ bir
 * token uydurmasına izin verirdi. Yani desen kopyalanabilir değil.
 *
 * Bunun yerine token'ın kendisi sırla karşılaştırılır: service-role anahtarı
 * zaten sabit bir sırdır, imza matematiği gerekmez. Bu kontrol gateway'e
 * bağımlı değildir — `verify_jwt` yarın açılsa da kapansa da aynı korumayı
 * verir. JWT olmayan (`sb_secret_*`) anahtar biçimleriyle de çalışır.
 *
 * Ham `Authorization` başlığının fonksiyona bozulmadan ulaştığının üretim
 * kanıtı: `revenuecat-webhook` (verify_jwt = false) tam olarak bunu yapıyor ve
 * ödemeler aylardır çalışıyor. `recompute-*` dosyalarındaki "gateway başlığı
 * yeniden yazıyor" yorumu bu yüzden dayanaksız.
 *
 * ── Hangi anahtar eşleşir ─────────────────────────────────────────────────
 * Edge runtime'ın enjekte ettiği `SUPABASE_SERVICE_ROLE_KEY` bu projede YENİ
 * biçimdedir (`sb_secret_…`, 41 karakter). Legacy `service_role` JWT'si
 * (`eyJ…`, 219 karakter) BAŞKA bir anahtardır ve burada 401 alır — geçersiz
 * olduğu için değil, farklı olduğu için. Bu bilinçli: kapı tek anahtara bakar
 * (CTO kararı, 8 Ağu 2026). Legacy JWT'yi `SUPABASE_JWKS` ile imza doğrulayıp
 * kabul etme seçeneği değerlendirildi ve reddedildi; gerekmezse ikinci bir
 * kabul yolu açılmıyor.
 *
 * ⚠️ Bu bir EŞİTLİK kontrolüdür, bir BİÇİM kontrolü değil. `sb_secret_` ile
 * başlayan her değer geçmez; yalnızca runtime'daki değerin ta kendisi geçer.
 * 9 Ağu 2026 rotasyonundan sonra `.env` içinde iki ayrı `sb_secret_` değeri
 * bulundu ve yalnızca biri kapıyı açtı (ölçüm:
 * `generate-puzzles/README.md`). Çağıran taraf (cron, script, elle test)
 * anahtarı ADINA bakarak seçerse sessizce 401 alır.
 *
 * Karşılaştırma sabit zamanlıdır: iki taraf da SHA-256'ya indirgenir (her zaman
 * 32 bayt, uzunluk sızmaz) ve baytlar erken çıkışsız XOR ile taranır.
 *
 * Fail-CLOSED: header yoksa, eşleşmiyorsa veya ortamda anahtar yoksa 401.
 */
export async function requireServiceRole(req: Request): Promise<{ ok: true } | AuthFail> {
  const fail: AuthFail = {
    ok: false,
    status: 401,
    code: 'SERVICE_ROLE_REQUIRED',
    message: 'Service role credentials required.',
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!serviceKey) {
    // Yapılandırma hatası: fonksiyon artık HİÇBİR çağrıyı kabul edemez, yani
    // üretim hattı tamamen durur. Sadece console.error yazmak bunu görünmez
    // kılardı — 401'ler dışarıdan "yanlış anahtar"dan ayırt edilemez.
    console.error('[auth] SUPABASE_SERVICE_ROLE_KEY tanımsız — service-role kontrolü yapılamıyor')
    await sentryCapture({
      message: 'SUPABASE_SERVICE_ROLE_KEY tanımsız — service-role korumalı fonksiyon her çağrıyı reddediyor',
      level: 'fatal',
      tags: { area: 'auth', check: 'service_role' },
    })
    return fail
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader)
  if (!match) return fail

  const [presented, expected] = await Promise.all([
    sha256(match[1]),
    sha256(serviceKey),
  ])

  if (!constantTimeEqual(presented, expected)) {
    console.warn('[auth] service-role eşleşmedi — istek reddedildi')
    return fail
  }

  return { ok: true }
}

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return new Uint8Array(digest)
}

/** Erken çıkışsız bayt karşılaştırması — eşleşmeyen ilk bayt zamanı sızdırmaz. */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i % b.length]
  }
  return diff === 0
}

/** `requireUser` / `requireServiceRole` reddi için HTTP 401 yanıtı üretir. */
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
