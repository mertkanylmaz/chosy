/**
 * Edge Function: revenuecat-webhook
 * Genel RevenueCat webhook handler — tum subscription event'lerini isler.
 *
 * POST /functions/v1/revenuecat-webhook
 * Auth: Bearer token (REVENUECAT_WEBHOOK_SECRET)
 *
 * Handled events:
 *   - INITIAL_PURCHASE / RENEWAL / PRODUCT_CHANGE → tier update
 *   - NON_RENEWING_PURCHASE → lifetime claim
 *   - CANCELLATION / EXPIRATION → will_renew flag + winback queue
 *   - BILLING_ISSUE → notification log
 *   - SUBSCRIBER_ALIAS → user merge (log only)
 *
 * Deploy: supabase functions deploy revenuecat-webhook
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sentryCapture } from '../_shared/sentry.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Product ID → Tier Mapping ─────────────────────────────────────────────────

function mapProductToTier(productId: string): string {
  // Lifetime
  if (productId === 'com.chosy.lifetime') return 'lifetime'

  // Annual (yeni + eski)
  if (productId === 'com.chosy.annual') return 'annual'
  if (productId === 'chosyai_yearly') return 'annual'

  // Monthly (yeni + eski)
  if (productId === 'com.chosy.monthly') return 'monthly'
  if (productId === 'chosyai_monthly') return 'monthly'

  // Weekly (eski — sadece legacy)
  if (productId === 'chosyai_weekly') return 'weekly_legacy'

  return 'free'
}

// ─── Tier → subscriptions.plan Mapping ─────────────────────────────────────────

/**
 * `mapProductToTier` çıktısını `subscriptions.plan` kelime dağarcığına çevirir.
 *
 * Kaynak sözleşme İSTEMCİDE: `constants/subscriptionPlans.ts`
 *   PlanId       = 'monthly' | 'annual' | 'lifetime'
 *   LegacyPlanId = PlanId | 'weekly' | 'yearly'
 * Migration 104 `subscriptions_plan_check` kısıtını tam olarak LegacyPlanId'e
 * eşitler. Buradaki değerler o listenin DIŞINA ÇIKAMAZ.
 *
 * `free` bilerek YOK: `mapProductToTier` tanımadığı bir `product_id` için
 * 'free' döner. Bu bir abonelik planı değil, eşleme boşluğudur — satıra
 * yazılırsa "ödeme yapan kullanıcı ücretsiz plana düştü" verisi üretir.
 * Çağıran taraf bunu Sentry'ye rapor eder ve satıra DOKUNMAZ.
 *
 * `weekly_legacy` → 'weekly': tier adı 021'de yenilendi, plan kolonundaki
 * tarihsel değer 'weekly' olarak kaldı (021:20 veri göçü bu değeri okuyor).
 */
const TIER_TO_PLAN: Record<string, string | undefined> = {
  weekly_legacy: 'weekly',
  monthly: 'monthly',
  annual: 'annual',
  lifetime: 'lifetime',
}

// ─── Types ──────────────────────────────────────────────────────────────────────

interface RevenueCatEvent {
  /**
   * RevenueCat olay kimliği. Dokümanda Common alan grubunda, "Included:
   * Always" — her olay tipinde var. Retry'lar AYNI `id` ile gelir, bu yüzden
   * idempotency anahtarı olarak kullanılır (migration 107).
   *
   * Yine de `?` opsiyonel: bu bir doküman garantisi, versiyonlanmış bir şema
   * garantisi değil. Sağlayıcı taraflı sessiz şema kaymaları bu projede iki
   * kez yaşandı — alan gelmezse kod çökmez, korumasız pencere Sentry'ye
   * warning olarak düşer.
   */
  id?: string
  type: string
  app_user_id: string
  product_id: string
  transaction_id?: string
  price_in_purchased_currency?: number
  currency?: string
  expiration_at_ms?: number
  /**
   * YALNIZ `CANCELLATION` olaylarında gelir (R-C2). RevenueCat'in belgelediği
   * değer kümesi — bu altısı dışında bir değer gelirse gönüllü iptal sayılır
   * (aşağıdaki `IMMEDIATE_REVOKE_CANCEL_REASONS`'ın güvenli yönü):
   *
   *   UNSUBSCRIBE         kullanıcı yenilemeyi kapattı
   *   BILLING_ERROR       ödeme alınamadı (grace period akışı — EXPIRATION'a bırakılır)
   *   DEVELOPER_INITIATED bizim tarafımızdan iptal
   *   PRICE_INCREASE      kullanıcı zammı onaylamadı
   *   CUSTOMER_SUPPORT    mağaza/destek para iadesi verdi  ← refund, TEK anında iptal
   *   UNKNOWN             mağaza sebebi bildirmedi
   *
   * `?` opsiyonel ve `string` (union DEĞİL) olması bilinçli: `id` alanındaki
   * gerekçenin aynısı — sağlayıcı bu listeye yeni bir değer eklerse kod
   * çökmemeli, bilinmeyen değer gönüllü iptal gibi ele alınmalıdır.
   */
  cancel_reason?: string
  [key: string]: unknown
}

/**
 * Erişimin DÖNEM SONUNU BEKLEMEDEN kapatıldığı iptal sebepleri (R-C2).
 *
 * Ayrım şu: `UNSUBSCRIBE` / `PRICE_INCREASE` / `DEVELOPER_INITIATED` gönüllü
 * ya da planlı iptaldir — kullanıcı parasını ödediği dönemi hak eder ve
 * erişim `expiration_at_ms`'e kadar sürer; oraya geldiğinde RevenueCat ayrıca
 * `EXPIRATION` gönderir ve tier'ı orası düşürür.
 *
 * `CUSTOMER_SUPPORT` ise para iadesidir: kullanıcının parası geri verilmiştir,
 * karşılığında erişimin sürmesi bedava Plus demektir.
 *
 * ── `BILLING_ERROR` neden bu listede DEĞİL (CTO kararı, 24 Eyl 2026) ────────
 * İlk taslakta buradaydı ve çıkarıldı. `BILLING_ERROR` bir para iadesi değil,
 * "ödeme alınamadı" halidir ve RevenueCat onu zaten kendi akışıyla yönetir:
 *   BILLING_ISSUE (uyarı, grace period başladı, abonelik AYAKTA)
 *     → kullanıcı kartını düzeltirse RENEWAL
 *     → düzeltmezse EXPIRATION (tier'ı o dal düşürür)
 * Bu sebebi anında iptale bağlamak grace period'u fiilen kısaltır: kartını
 * düzeltmek üzere olan kullanıcı, kendisine tanınan süreyi kullanamadan
 * erişimini kaybeder. Ödenmemiş dönem riski EXPIRATION ile zaten kapanıyor.
 *
 * ⚠️ `BILLING_ERROR` (cancel_reason) ile `BILLING_ISSUE` (event type) AYRI
 * şeylerdir; ikisini karıştırmak yukarıdaki akışı yanlış okutur.
 *
 * Bu küme `readonly` ve modül seviyesinde: feature flag değil, sözleşme
 * sabitidir (CLAUDE.md #5 lazy-getter kuralı `app_config` okumaları içindir).
 */
const IMMEDIATE_REVOKE_CANCEL_REASONS: readonly string[] = [
  'CUSTOMER_SUPPORT',
]

interface RevenueCatWebhook {
  api_version: string
  event: RevenueCatEvent
}

// ─── Handler ────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // ── 1. Verify webhook secret ──────────────────────────────────────────────
    // FAIL-CLOSED: secret yoksa istek islenmez. Onceki `if (webhookSecret && ...)`
    // kalibi secret tanimsizken dogrulamayi tamamen atliyordu — 12 Agu 2026'da
    // secret'in `RC_WEBHOOK_SECRET` adiyla set edildigi, kodun ise
    // `REVENUECAT_WEBHOOK_SECRET` okudugu tespit edildi; yani bu webhook
    // aylarca kimlik dogrulamasiz calisti ve herkes entitlement yazabilirdi.
    const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET')
    if (!webhookSecret) {
      console.error('[rc-webhook] REVENUECAT_WEBHOOK_SECRET tanimsiz — istek reddedildi')
      await sentryCapture({
        message: 'revenuecat-webhook: REVENUECAT_WEBHOOK_SECRET tanimsiz, webhook fail-closed reddetti',
        level: 'fatal',
        tags: { error_code: 'WEBHOOK_SECRET_MISSING', function: 'revenuecat-webhook' },
      })
      return new Response(
        JSON.stringify({ error: 'WEBHOOK_SECRET_MISSING' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const authHeader = req.headers.get('authorization') || ''

    if (authHeader !== `Bearer ${webhookSecret}`) {
      console.warn('[rc-webhook] Invalid auth header')
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // ── 2. Parse payload ──────────────────────────────────────────────────────
    const payload: RevenueCatWebhook = await req.json()
    const event = payload.event

    console.log(`[rc-webhook] ${event.type} | product: ${event.product_id} | user: ${event.app_user_id}`)

    // ── 3. Supabase client ────────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const tier = mapProductToTier(event.product_id)

    /**
     * `event.app_user_id` — RevenueCat'e `app/_layout.tsx:271`'de
     * `session.user.id` olarak verilen değer, yani **auth.users.id**.
     * Değişken adı bunu açıkça söyler; `userId` gibi belirsiz bir ad
     * D1 hatasının kaynağıydı.
     */
    const authUserId = event.app_user_id

    // ── 3b. Kimlik çözümleme (D1) ─────────────────────────────────────────────
    //
    // Bu kod tabanında İKİ AYRIK kullanıcı kimliği uzayı var (22 Ağu 2026
    // canlı ölçüm: public.users 248 · auth.users 252 · id kesişimi **0**):
    //
    //   Uzay A — public.users.id   → subscriptions.user_id, notification_log.user_id
    //   Uzay B — auth.users.id     → lifetime_sales.user_id, winback_queue.user_id
    //
    // Tek köprü `public.users.auth_id` (TEXT). Bu webhook eskiden auth UID'yi
    // doğrudan A uzayına yazıyordu; sonuç sessiz felaketti: `.eq('id', …)`
    // HER ZAMAN 0 satır eşliyordu ve **0 satırlık UPDATE hata değildir**,
    // dolayısıyla R-B-0'da eklenen `const { error }` kontrolleri bile bunu
    // görmüyordu. Bugüne kadar hiçbir abonelik satırı güncellenmedi.
    //
    // Desen `services/auth-utils.ts`'ten uyarlandı — ama KOPYALANMADI:
    // orası `upsert` ile satır YARATIR (istemci, oturum sahibi adına).
    // Webhook satır yaratmaz: kimlik oluşturmak uygulamanın işidir, ödeme
    // sağlayıcısının değil. Burada yalnızca ÇÖZÜMLEME yapılır.
    const { data: appUserRow, error: resolveError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUserId)
      .maybeSingle()

    if (resolveError) {
      console.error('[rc-webhook] kimlik çözümleme sorgusu düştü:', resolveError.message)
      await sentryCapture({
        message: `revenuecat-webhook: public.users çözümlemesi düştü — ${resolveError.message}`,
        level: 'error',
        tags: {
          error_code: 'APP_USER_RESOLVE_FAILED',
          function: 'revenuecat-webhook',
          event_type: event.type,
        },
        extra: {
          auth_user_id: authUserId,
          product_id: event.product_id,
          pg_code: resolveError.code ?? null,
          pg_details: resolveError.details ?? null,
        },
      })
      return new Response(
        JSON.stringify({ error: 'APP_USER_RESOLVE_FAILED', retryable: true }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    /** Uzay A kimliği. `null` = `public.users` satırı henüz yok. */
    const appUserId: string | null = (appUserRow?.id as string | undefined) ?? null

    /**
     * Uzay A'ya yazacak dalların ortak kapısı: `if (!appUserId) return await
     * appUserMissing()`. Bu biçim TypeScript'in `appUserId`'yi dalın geri
     * kalanında `string`e daraltmasını sağlar — cast gerekmez.
     *
     * Satır yoksa bu bir YARIŞ KOŞULU olabilir: kullanıcı satın almayı
     * tamamladı ama istemcinin `ensureAppUser()` upsert'i henüz sunucuya
     * ulaşmadı. Satır birazdan oluşabileceği için RevenueCat'in retry
     * etmesi DOĞRU davranış — bu yüzden 500 dönüyoruz.
     *
     * Kalıcı orphan (auth satırı var, public satırı hiç oluşmayacak) da aynı
     * kanaldan görünür: retry'lar tükendiğinde Sentry'de `APP_USER_NOT_FOUND`
     * yığılması kalır. Sessiz kayıp yok.
     */
    const appUserMissing = async (): Promise<Response> => {
      console.error(`[rc-webhook] public.users satırı yok — auth_id=${authUserId}`)
      await sentryCapture({
        message: 'revenuecat-webhook: auth_id için public.users satırı bulunamadı — ödeme işlenemedi',
        level: 'error',
        tags: {
          error_code: 'APP_USER_NOT_FOUND',
          function: 'revenuecat-webhook',
          event_type: event.type,
        },
        extra: {
          auth_user_id: authUserId,
          product_id: event.product_id,
          transaction_id: event.transaction_id ?? null,
        },
      })
      return new Response(
        JSON.stringify({ error: 'APP_USER_NOT_FOUND', retryable: true }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    /**
     * `event.id` yoksa, o olay için yazılan satır partial indeksin DIŞINDA
     * kalır (`WHERE rc_event_id IS NOT NULL`) — yani idempotency garantisi
     * yoktur ve bir retry mükerrer satır üretir.
     *
     * Seviye bilerek `warning`: sistem durmuyor, satır yazılıyor, kullanıcı
     * etkilenmiyor. İşaretlenen şey korumasız pencerenin KENDİSİ. `error`
     * yapmak gerçek arızalarla aynı kanalı kirletirdi; hiç loglamamak ise RC
     * şeması sessizce kayarsa bunu görünmez kılardı — entitlement_id / plan
     * CHECK derslerinin tekrarı olurdu.
     *
     * R-C1'de EXPIRATION dalındaki gövdeden buraya ÇIKARILDI (davranış ve
     * Sentry yükü birebir korunarak): BILLING_ISSUE de aynı `event.id`
     * anahtarına bağlanınca iki dalın aynı uyarıyı vermesi gerekti ve iki
     * kopya, ileride yalnız birinin güncellenmesi demekti.
     */
    const warnMissingRcEventId = async (): Promise<void> => {
      if (event.id) return
      console.warn(
        `[rc-webhook] RC event.id eksik — idempotency korumasız (${event.type})`,
      )
      await sentryCapture({
        message: 'revenuecat-webhook: RC event.id eksik — idempotency korumasız',
        level: 'warning',
        tags: {
          error_code: 'RC_EVENT_ID_MISSING',
          function: 'revenuecat-webhook',
          event_type: event.type,
        },
        extra: {
          event_type: event.type,
          app_user_id: event.app_user_id,
          auth_user_id: authUserId,
        },
      })
    }

    // ── 4. Handle by event type ───────────────────────────────────────────────
    switch (event.type) {
      // ━━ Purchase / Renewal / Plan Change ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE':
      case 'UNCANCELLATION': {
        // D1: bu dal Uzay A'ya yazar — kimlik çözümlenmeden devam edilmez.
        if (!appUserId) return await appUserMissing()

        const expiresAt = event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null // null = lifetime

        // Update users table
        //
        // K-36: dönüş değeri artık kontrol ediliyor. Bu yazma sessizce
        // düşerse kullanıcı ödeme yaptığı halde eski tier'ında kalır —
        // 200 dönmek RevenueCat'in retry'ını da iptal ederdi.
        //
        // `count: 'exact'`: D1'den sonra 0 satır ARTIK ANLAMLI. Bu tabloda
        // 0 satır imkânsıza yakındır — satırı az önce okuduk — yani gerçek
        // bir anomali sinyalidir (satır arada silinmiş olabilir).
        const { error: usersError, count: usersCount } = await supabase
          .from('users')
          .update({
            subscription_tier: tier,
            subscription_active_until: expiresAt,
            subscription_will_renew: true,
            updated_at: new Date().toISOString(),
          }, { count: 'exact' })
          .eq('id', appUserId)

        if (!usersError && usersCount === 0) {
          console.error(`[rc-webhook] users update 0 satır — app_user_id=${appUserId}`)
          await sentryCapture({
            message: 'revenuecat-webhook: users update 0 satır etkiledi — satır çözümlemeden sonra kayboldu',
            level: 'error',
            tags: {
              error_code: 'USERS_ROW_VANISHED',
              function: 'revenuecat-webhook',
              event_type: event.type,
              tier,
            },
            extra: { auth_user_id: authUserId, app_user_id: appUserId },
          })
          return new Response(
            JSON.stringify({ error: 'USERS_ROW_VANISHED', retryable: true }),
            { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
          )
        }

        if (usersError) {
          console.error('[rc-webhook] users update failed:', usersError.message)
          await sentryCapture({
            message: `revenuecat-webhook: users tier yazılamadı — ${usersError.message}`,
            level: 'error',
            tags: {
              error_code: 'USERS_TIER_UPDATE_FAILED',
              function: 'revenuecat-webhook',
              event_type: event.type,
              tier,
            },
            extra: {
              auth_user_id: authUserId,
              app_user_id: appUserId,
              product_id: event.product_id,
              transaction_id: event.transaction_id ?? null,
              pg_code: usersError.code ?? null,
              pg_details: usersError.details ?? null,
            },
          })
          return new Response(
            JSON.stringify({ error: 'USERS_TIER_UPDATE_FAILED', retryable: true }),
            { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
          )
        }

        // tier → plan çevirisi. Eşlenemeyen tier (yalnız 'free', yani tanınmayan
        // product_id) satıra YAZILMAZ: retry bunu düzeltmez, kod düzeltmesi
        // gerekir. Sessiz değil — Sentry'ye error seviyesinde düşer.
        const plan = TIER_TO_PLAN[tier]

        if (!plan) {
          console.error(`[rc-webhook] Eşlenemeyen product_id: ${event.product_id} (tier=${tier})`)
          await sentryCapture({
            message: `revenuecat-webhook: product_id eşlenemedi (${event.product_id}) — subscriptions.plan yazılmadı`,
            level: 'error',
            tags: {
              error_code: 'PRODUCT_ID_UNMAPPED',
              function: 'revenuecat-webhook',
              event_type: event.type,
              tier,
            },
            extra: {
              auth_user_id: authUserId,
              app_user_id: appUserId,
              product_id: event.product_id,
              transaction_id: event.transaction_id ?? null,
            },
          })
          // 200: RevenueCat retry'ı aynı sonucu verir, sonsuz kuyruk üretir.
          // users.subscription_tier zaten yazıldı, olay kayıp değil.
          break
        }

        // Update subscriptions table
        //
        // `count: 'exact'`: burada 0 satır MEŞRU bir durumdur — kimlik
        // doğru ama kullanıcının hiç `subscriptions` satırı olmayabilir
        // (satırı istemci `upsertSubscription` ile yaratır). Bunu genel
        // hatayla KARIŞTIRMIYORUZ: ayrı kod, warning seviyesi, 200.
        const { error: subsError, count: subsCount } = await supabase
          .from('subscriptions')
          .update({
            plan,
            status: 'active',
            expires_at: expiresAt,
          }, { count: 'exact' })
          .eq('user_id', appUserId)
          .in('status', ['active', 'trial', 'expired', 'cancelled'])

        if (!subsError && subsCount === 0) {
          console.warn(`[rc-webhook] subscriptions satırı yok — app_user_id=${appUserId}`)
          await sentryCapture({
            message: 'revenuecat-webhook: eşleşen subscriptions satırı yok — plan yazılamadı (users.subscription_tier yazıldı)',
            level: 'warning',
            tags: {
              error_code: 'SUBSCRIPTION_ROW_NOT_FOUND',
              function: 'revenuecat-webhook',
              event_type: event.type,
              tier,
            },
            extra: {
              auth_user_id: authUserId,
              app_user_id: appUserId,
              plan,
              product_id: event.product_id,
            },
          })
          // 200: hata değil, eksik satır. Retry satır yaratmaz —
          // yetkilendirmenin taşıyıcısı zaten users.subscription_tier.
          break
        }

        if (subsError) {
          console.error('[rc-webhook] subscriptions update failed:', subsError.message)
          await sentryCapture({
            message: `revenuecat-webhook: subscriptions.plan yazılamadı — ${subsError.message}`,
            level: 'error',
            tags: {
              error_code: 'SUBSCRIPTION_PLAN_UPDATE_FAILED',
              function: 'revenuecat-webhook',
              event_type: event.type,
              tier,
            },
            extra: {
              auth_user_id: authUserId,
              app_user_id: appUserId,
              plan,
              product_id: event.product_id,
              transaction_id: event.transaction_id ?? null,
              pg_code: subsError.code ?? null,
              pg_details: subsError.details ?? null,
            },
          })
          // Non-2xx → RevenueCat retry eder. İki UPDATE de idempotent
          // (aynı değerleri yazar), tekrar çalışması güvenlidir.
          return new Response(
            JSON.stringify({ error: 'SUBSCRIPTION_PLAN_UPDATE_FAILED', retryable: true }),
            { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
          )
        }

        console.log(`[rc-webhook] Tier updated: ${tier} for ${appUserId}`)
        break
      }

      // ━━ Non-Renewing Purchase (Lifetime) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'NON_RENEWING_PURCHASE': {
        if (tier === 'lifetime') {
          // D1: bu dal da Uzay A'ya yazar — kimlik çözümlenmeden devam edilmez.
          // `claim_lifetime_spot` gövdesi baştan beri public uzayı bekliyordu
          // (`UPDATE users WHERE id = p_user_id`, `UPDATE subscriptions WHERE
          // user_id = p_user_id`); auth id geçildiği için o iki UPDATE sessizce
          // 0 satır ediyordu. Migration 111 `lifetime_sales.user_id` FK'sini de
          // `public.users(id)`'ye çevirdi — artık auth id geçmek 23503 üretir.
          if (!appUserId) return await appUserMissing()

          // Claim lifetime spot via atomic RPC
          const { data, error } = await supabase.rpc('claim_lifetime_spot', {
            p_user_id: appUserId,
            p_price: event.price_in_purchased_currency || 89.99,
            p_rc_transaction_id: event.transaction_id || null,
          })

          // ── Kanal 1: taşıma/DB hatası ───────────────────────────────────
          // RPC tek transaction: burada hata varsa lifetime_sales insert'i de
          // users update'i de geri alındı. Kullanıcı ödedi, HİÇBİR iz kalmadı.
          // Retry edilebilir — RPC kendi içinde ALREADY_LIFETIME koruması
          // taşıdığı için ikinci çalıştırma güvenlidir.
          if (error) {
            console.error('[rc-webhook] Lifetime claim RPC error:', error.message)
            await sentryCapture({
              message: `revenuecat-webhook: claim_lifetime_spot RPC düştü — ${error.message}`,
              level: 'fatal',
              tags: {
                error_code: 'LIFETIME_CLAIM_RPC_FAILED',
                function: 'revenuecat-webhook',
                event_type: event.type,
              },
              extra: {
                auth_user_id: authUserId,
                app_user_id: appUserId,
                product_id: event.product_id,
                transaction_id: event.transaction_id ?? null,
                price: event.price_in_purchased_currency ?? null,
                pg_code: error.code ?? null,
                pg_details: error.details ?? null,
              },
            })
            return new Response(
              JSON.stringify({ error: 'LIFETIME_CLAIM_RPC_FAILED', retryable: true }),
              { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
            )
          }

          // ── Kanal 2: iş kuralı sonucu ───────────────────────────────────
          // RPC `{ success: false, error: '…' }` döndüğünde `error` NULL'dır —
          // yukarıdaki dal bunu görmez. Eskiden yalnız console.log'a gidiyordu.
          const claim = (data ?? {}) as { success?: boolean; error?: string }

          if (claim.success !== true) {
            const reason = claim.error ?? 'UNKNOWN'

            if (reason === 'ALREADY_LIFETIME') {
              // Beklenen idempotent yol: aynı olayın tekrarı (RevenueCat retry
              // veya mükerrer teslim). Hata DEĞİL — Sentry'yi kirletme.
              //
              // ⚠️ `break` ETMİYORUZ. İlk denemede claim başarılı olup users
              // yazması düşmüşse, retry buraya gelir; burada çıkarsak
              // `subscription_active_until` sonsuza dek yazılmadan kalırdı.
              // Yer zaten bu kullanıcının — aşağıdaki idempotent update'e
              // devam etmek yakınsamayı sağlar.
              console.log(`[rc-webhook] Lifetime zaten talep edilmiş, users yazması tazeleniyor: ${authUserId}`)
            } else {
              // SOLD_OUT veya bilinmeyen: kullanıcı ÖDEDİ ama yer alamadı.
              // Retry bunu çözmez (kontenjan dolu / kod arızası) — 200 dönüp
              // sonsuz kuyruk üretmiyoruz, ama insan müdahalesi gerekiyor.
              console.error(`[rc-webhook] Lifetime claim reddedildi: ${reason} — ${authUserId}`)
              await sentryCapture({
                message: `revenuecat-webhook: lifetime claim reddedildi (${reason}) — ödeme alındı, yer verilmedi`,
                level: 'fatal',
                tags: {
                  error_code: 'LIFETIME_CLAIM_REJECTED',
                  function: 'revenuecat-webhook',
                  event_type: event.type,
                  reason,
                },
                extra: {
                  auth_user_id: authUserId,
                  app_user_id: appUserId,
                  product_id: event.product_id,
                  transaction_id: event.transaction_id ?? null,
                  price: event.price_in_purchased_currency ?? null,
                  rpc_result: data,
                },
              })
              // Yalnız BU dalda çıkılır: yer verilmedi, tier de verilmez.
              break
            }
          } else {
            console.log('[rc-webhook] Lifetime claim result:', JSON.stringify(data))
          }

          // Also update users table expiry.
          // D1: bu yazma Uzay A'dadır — claim (Uzay B) başarılı olsa bile
          // kimlik çözümlenmemişse devam edilmez.
          if (!appUserId) return await appUserMissing()

          const { error: lifetimeUsersError } = await supabase
            .from('users')
            .update({
              subscription_active_until: null, // lifetime = never expires
              subscription_will_renew: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', appUserId)

          if (lifetimeUsersError) {
            console.error('[rc-webhook] lifetime users update failed:', lifetimeUsersError.message)
            await sentryCapture({
              message: `revenuecat-webhook: lifetime sonrası users yazılamadı — ${lifetimeUsersError.message}`,
              level: 'error',
              tags: {
                error_code: 'LIFETIME_USERS_UPDATE_FAILED',
                function: 'revenuecat-webhook',
                event_type: event.type,
              },
              extra: {
                auth_user_id: authUserId,
                app_user_id: appUserId,
                transaction_id: event.transaction_id ?? null,
                pg_code: lifetimeUsersError.code ?? null,
                pg_details: lifetimeUsersError.details ?? null,
              },
            })
            // Retry güvenli: claim ALREADY_LIFETIME'a düşer, update tekrarlanır.
            return new Response(
              JSON.stringify({ error: 'LIFETIME_USERS_UPDATE_FAILED', retryable: true }),
              { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
            )
          }
        }
        break
      }

      // ━━ Cancellation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'CANCELLATION': {
        // D1: Uzay A yazması — kimlik çözümlenmeden devam edilmez.
        if (!appUserId) return await appUserMissing()

        // ── R-C2: iki ayrı iptal anlamı ──────────────────────────────────
        // refund/chargeback → ANINDA iptal, gönüllü iptal → DÖNEM SONU.
        //
        // Eskiden bu dal `cancel_reason`'a hiç bakmıyordu ve HER iptali
        // gönüllü sayıyordu: para iadesi alan kullanıcı `expiration_at_ms`'e
        // kadar — yıllık planda 12 aya kadar — Plus erişimini bedava
        // sürdürüyordu. Ölçülmemişti çünkü hiçbir yerde hata üretmiyordu.
        //
        // Gönüllü tarafta DAVRANIŞ DEĞİŞMEDİ: yalnız `will_renew=false`
        // yazılır, tier'ı dönem sonunda RevenueCat'in ayrıca gönderdiği
        // `EXPIRATION` olayı düşürür (aşağıdaki case).
        const cancelReason = event.cancel_reason ?? null
        const revokeNow = cancelReason !== null &&
          IMMEDIATE_REVOKE_CANCEL_REASONS.includes(cancelReason)

        // Anında iptalde tier de düşer. `subscription_active_until`'a
        // DOKUNULMAZ: o alan "ödenen dönem ne zaman bitiyordu" bilgisidir ve
        // destek/muhasebe tarafında iade penceresini okumak için gerekir;
        // yetkilendirmenin taşıyıcısı `subscription_tier`'dır.
        const cancelUsersPatch = revokeNow
          ? {
            subscription_tier: 'free',
            subscription_will_renew: false,
            updated_at: new Date().toISOString(),
          }
          : {
            subscription_will_renew: false,
            updated_at: new Date().toISOString(),
          }

        // Yazma idempotent (aynı değeri yazar), retry güvenli.
        const { error: cancelError } = await supabase
          .from('users')
          .update(cancelUsersPatch)
          .eq('id', appUserId)

        if (cancelError) {
          console.error('[rc-webhook] cancellation users update failed:', cancelError.message)
          await sentryCapture({
            message: `revenuecat-webhook: cancellation flag yazılamadı — ${cancelError.message}`,
            level: 'error',
            tags: {
              error_code: 'CANCELLATION_USERS_UPDATE_FAILED',
              function: 'revenuecat-webhook',
              event_type: event.type,
            },
            extra: {
              auth_user_id: authUserId,
              app_user_id: appUserId,
              cancel_reason: cancelReason,
              revoke_now: revokeNow,
              pg_code: cancelError.code ?? null,
              pg_details: cancelError.details ?? null,
            },
          })
          return new Response(
            JSON.stringify({ error: 'CANCELLATION_USERS_UPDATE_FAILED', retryable: true }),
            { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
          )
        }

        // Anında iptalde `subscriptions` da kapatılır. Gönüllü iptalde bu
        // tabloya HİÇ DOKUNULMAZ — mevcut davranış korunur.
        //
        // `.in('status', [...])`: EXPIRATION dalının `.eq('status','active')`
        // kalıbından bilerek AYRILIYOR. Para iadesi deneme (trial) sırasında
        // da verilebilir ve o satır 'trial' durumundadır; `eq('active')` onu
        // sessizce atlar ve `subscriptions` ile `users` ıraksardı.
        // Zaten 'cancelled' olan satırı yeniden yazmak da zararsızdır ama
        // listeye alınmadı: 0 satır burada meşru (aşağıda warning).
        if (revokeNow) {
          const { error: cancelSubsError, count: cancelSubsCount } = await supabase
            .from('subscriptions')
            .update({ status: 'cancelled' }, { count: 'exact' })
            .eq('user_id', appUserId)
            .in('status', ['active', 'trial'])

          if (cancelSubsError) {
            console.error(
              '[rc-webhook] cancellation subscriptions update failed:',
              cancelSubsError.message,
            )
            await sentryCapture({
              message:
                `revenuecat-webhook: refund iptalinde subscriptions kapatılamadı — ${cancelSubsError.message}`,
              level: 'error',
              tags: {
                error_code: 'CANCELLATION_SUBSCRIPTION_UPDATE_FAILED',
                function: 'revenuecat-webhook',
                event_type: event.type,
              },
              extra: {
                auth_user_id: authUserId,
                app_user_id: appUserId,
                cancel_reason: cancelReason,
                pg_code: cancelSubsError.code ?? null,
                pg_details: cancelSubsError.details ?? null,
              },
            })
            // 500: retry güvenli, iki UPDATE de aynı değerleri yazar.
            // users.subscription_tier zaten 'free' — erişim KAPALI, yani
            // retry beklerken kullanıcı bedava Plus kullanmıyor.
            return new Response(
              JSON.stringify({
                error: 'CANCELLATION_SUBSCRIPTION_UPDATE_FAILED',
                retryable: true,
              }),
              { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
            )
          }

          if (cancelSubsCount === 0) {
            // Meşru durum: kullanıcının hiç `subscriptions` satırı olmayabilir
            // (satırı istemci `upsertSubscription` yaratır) ya da satır zaten
            // kapalı olabilir. Genel hatayla karıştırılmıyor — PURCHASE
            // dalındaki `SUBSCRIPTION_ROW_NOT_FOUND` ile aynı kalıp.
            console.warn(
              `[rc-webhook] refund iptali: eşleşen subscriptions satırı yok — app_user_id=${appUserId}`,
            )
            await sentryCapture({
              message:
                'revenuecat-webhook: refund iptalinde eşleşen subscriptions satırı yok (users.subscription_tier free yazıldı)',
              level: 'warning',
              tags: {
                error_code: 'CANCELLATION_SUBSCRIPTION_ROW_NOT_FOUND',
                function: 'revenuecat-webhook',
                event_type: event.type,
              },
              extra: {
                auth_user_id: authUserId,
                app_user_id: appUserId,
                cancel_reason: cancelReason,
              },
            })
          }
        }

        console.log(
          `[rc-webhook] Cancellation flagged for ${appUserId} ` +
            `(reason=${cancelReason ?? 'yok'}, revoke_now=${revokeNow})`,
        )
        break
      }

      // ━━ Expiration ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'EXPIRATION': {
        // Artık free tier'a düş
        // D1: EXPIRATION hem Uzay A (users, subscriptions) hem Uzay B
        // (winback_queue) yazar. A tarafı kimlik ister.
        if (!appUserId) return await appUserMissing()

        const { error: expUsersError } = await supabase
          .from('users')
          .update({
            subscription_tier: 'free',
            subscription_will_renew: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', appUserId)

        if (expUsersError) {
          console.error('[rc-webhook] expiration users update failed:', expUsersError.message)
          await sentryCapture({
            message: `revenuecat-webhook: expiration users yazılamadı — ${expUsersError.message}`,
            level: 'error',
            tags: {
              error_code: 'EXPIRATION_USERS_UPDATE_FAILED',
              function: 'revenuecat-webhook',
              event_type: event.type,
            },
            extra: {
              auth_user_id: authUserId,
              app_user_id: appUserId,
              pg_code: expUsersError.code ?? null,
              pg_details: expUsersError.details ?? null,
            },
          })
          return new Response(
            JSON.stringify({ error: 'EXPIRATION_USERS_UPDATE_FAILED', retryable: true }),
            { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
          )
        }

        // Subscriptions tablosunu da güncelle
        const { error: expSubsError } = await supabase
          .from('subscriptions')
          .update({ status: 'expired' })
          .eq('user_id', appUserId)
          .eq('status', 'active')

        if (expSubsError) {
          console.error('[rc-webhook] expiration subscriptions update failed:', expSubsError.message)
          await sentryCapture({
            message: `revenuecat-webhook: expiration subscriptions yazılamadı — ${expSubsError.message}`,
            level: 'error',
            tags: {
              error_code: 'EXPIRATION_SUBSCRIPTION_UPDATE_FAILED',
              function: 'revenuecat-webhook',
              event_type: event.type,
            },
            extra: {
              auth_user_id: authUserId,
              app_user_id: appUserId,
              pg_code: expSubsError.code ?? null,
              pg_details: expSubsError.details ?? null,
            },
          })
          return new Response(
            JSON.stringify({ error: 'EXPIRATION_SUBSCRIPTION_UPDATE_FAILED', retryable: true }),
            { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
          )
        }

        // Win-back queue'ya ekle.
        //
        // Migration 107 ile artık İDEMPOTENT: `winback_queue_rc_event_id_idx`
        // (partial unique, WHERE rc_event_id IS NOT NULL) mükerrer event'i
        // reddeder. RevenueCat "at least once" teslim ediyor ve retry AYNI
        // `event.id` ile geliyor — anahtar bu.
        //
        // Neden `upsert` DEĞİL, düz `insert`: PostgREST'in `on_conflict`
        // parametresi indeks predicate'ini ifade edemiyor, partial indeks ise
        // arbiter çıkarımı için predicate'in ifadede tekrarlanmasını şart
        // koşuyor. Canlıda doğrulandı:
        //   ON CONFLICT (rc_event_id) DO NOTHING            → 42P10
        //   ON CONFLICT (rc_event_id) WHERE … DO NOTHING    → çalışır
        // Yani `.upsert({ onConflict: 'rc_event_id' })` HER çağrıda 42P10
        // verirdi — yazma hiç gerçekleşmezdi. Bunun yerine çakışma dönüş
        // kodundan (23505) ayırt ediliyor.
        //
        // Bu yazma en SONA alındı ve hatası 200 ile geçiliyor: churn zaten
        // users + subscriptions'a işlendi, eksik olan yalnız pazarlama
        // kuyruğu. Sessiz değil — Sentry'ye düşer.

        // Korumasız pencere uyarısı — gövdesi `warnMissingRcEventId`'de
        // (R-C1'de çıkarıldı, davranış birebir aynı).
        await warnMissingRcEventId()

        const { error: winbackError } = await supabase.from('winback_queue').insert({
          user_id: authUserId,
          churned_at: new Date().toISOString(),
          rc_event_id: event.id ?? null,
        })

        if (winbackError && winbackError.code === '23505') {
          // Beklenen yol: idempotency ÇALIŞTI. Aynı `rc_event_id` zaten
          // kayıtlı, yani bu mükerrer bir teslim (RevenueCat retry'ı veya
          // çift gönderim). Hata değil, korumanın kanıtı — Sentry'ye
          // düşürmüyoruz, yoksa çalışan mekanizma gürültü üretirdi.
          console.log(
            `[rc-webhook] winback zaten kayıtlı (rc_event_id çakışması) — ${event.id ?? 'id yok'}`,
          )
        } else if (winbackError) {
          console.error('[rc-webhook] winback queue insert failed:', winbackError.message)
          await sentryCapture({
            message: `revenuecat-webhook: winback_queue'ya yazılamadı — ${winbackError.message}`,
            level: 'error',
            tags: {
              error_code: 'WINBACK_QUEUE_INSERT_FAILED',
              function: 'revenuecat-webhook',
              event_type: event.type,
            },
            extra: {
              auth_user_id: authUserId,
              pg_code: winbackError.code ?? null,
              pg_details: winbackError.details ?? null,
            },
          })
          // Bilerek 200: churn zaten users + subscriptions'a işlendi,
          // eksik olan yalnız pazarlama kuyruğu. Retry'ın mükerrer satır
          // riski bu kaybın maliyetinden yüksek.
        }

        console.log(`[rc-webhook] Expired + winback queued for ${appUserId}`)
        break
      }

      // ━━ Billing Issue ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'BILLING_ISSUE': {
        // D1: `notification_log.user_id` FK'si `public.users(id)` hedefler
        // (024'ün tanımı; 027'nin `auth.users` istemi no-op'a düşmüştü).
        // Eskiden buraya auth UID yazılıyordu → her insert 23503 FK ihlali,
        // dönüş kontrol edilmediği için sessizce kayboluyordu.
        if (!appUserId) return await appUserMissing()

        // ── R-C1: mükerrer bildirim koruması ─────────────────────────────
        // Migration 114 (`notification_log_rc_event_id_idx`, partial unique
        // WHERE rc_event_id IS NOT NULL) mükerrer event'i reddeder — desen
        // 107'nin (winback_queue) birebir aynısı.
        //
        // Bu dal insert hatasında 500 dönüyor, yani RC 5 kez retry ediyor.
        // Koruma olmadan, ilk insert BAŞARILI olup yanıt yolu düşerse
        // kullanıcı aynı "Payment issue" push'unu 5 kez alırdı — zaten ödeme
        // sorunu yaşayan kullanıcı için en kötü an.
        //
        // Neden `upsert` DEĞİL, düz `insert`: PostgREST'in `on_conflict`
        // parametresi indeks predicate'ini ifade edemiyor, partial indeks ise
        // arbiter çıkarımı için predicate'in ifadede tekrarlanmasını şart
        // koşuyor — `.upsert({ onConflict: 'rc_event_id' })` HER çağrıda
        // 42P10 verirdi (107'de canlıda doğrulandı). Çakışma dönüş kodundan
        // (23505) ayırt ediliyor.
        await warnMissingRcEventId()

        const { error: notifError } = await supabase.from('notification_log').insert({
          user_id: appUserId,
          type: 'billing_issue',
          title: 'Payment issue',
          body: 'Your subscription renewal failed. Please update your payment method in Apple ID settings.',
          data: { screen: 'profile' },
          status: 'queued',
          rc_event_id: event.id ?? null,
        })

        if (notifError && notifError.code === '23505') {
          // Beklenen yol: idempotency ÇALIŞTI. Aynı `rc_event_id` zaten
          // kayıtlı, yani bu mükerrer bir teslim (RevenueCat retry'ı veya
          // çift gönderim). Hata değil, korumanın kanıtı — Sentry'ye
          // düşürmüyoruz, yoksa çalışan mekanizma gürültü üretirdi.
          //
          // 200 dönülür (aşağıdaki ortak çıkış): bildirim ZATEN kuyrukta,
          // yapılacak iş yok. 500 dönmek RC'yi sonsuz retry'a sokardı.
          console.log(
            `[rc-webhook] billing_issue bildirimi zaten kayıtlı (rc_event_id çakışması) — ${event.id ?? 'id yok'}`,
          )
        } else if (notifError) {
          console.error('[rc-webhook] billing issue notification insert failed:', notifError.message)
          await sentryCapture({
            message: `revenuecat-webhook: billing_issue bildirimi kuyruğa yazılamadı — ${notifError.message}`,
            level: 'error',
            tags: {
              error_code: 'BILLING_NOTIFICATION_INSERT_FAILED',
              function: 'revenuecat-webhook',
              event_type: event.type,
            },
            extra: {
              auth_user_id: authUserId,
              app_user_id: appUserId,
              pg_code: notifError.code ?? null,
              pg_details: notifError.details ?? null,
            },
          })
          return new Response(
            JSON.stringify({ error: 'BILLING_NOTIFICATION_INSERT_FAILED', retryable: true }),
            { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
          )
        }

        console.log(`[rc-webhook] Billing issue notification queued for ${appUserId}`)
        break
      }

      // ━━ Transfer / Alias ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'TRANSFER':
      case 'SUBSCRIBER_ALIAS': {
        console.log(`[rc-webhook] ${event.type} for ${authUserId} — logged, no action`)
        break
      }

      default: {
        // ── R-C3: bilinmeyen event tipi artık görünür ────────────────────
        // Eskiden yalnız `console.log`'a gidiyordu. Edge Function logları
        // retention'a tabi ve kimse onları taramıyor; sonuç, RevenueCat yeni
        // bir event tipi eklediğinde (ya da mevcut birini yeniden
        // adlandırdığında) bunun hiç fark edilmemesiydi — `entitlement_id` ve
        // `plan` CHECK derslerinin tam olarak nasıl doğduğu.
        //
        // Seviye bilerek `info`, `error`/`fatal` DEĞİL: bu bir arıza değil.
        // Bu dala düşen olayların çoğu bizi ilgilendirmiyor (`TEST`,
        // `INVOICE_ISSUANCE`) ve `error` yapmak gerçek ödeme arızalarıyla
        // aynı kanalı kirletirdi. İşaretlenen şey KAPSAM BOŞLUĞU: "bu tip
        // geldi ve hiçbir şey yapmadık" cümlesinin aranabilir bir iz
        // bırakması.
        //
        // Yanıt 200 kalır (aşağıdaki ortak çıkış): işlemediğimiz bir olay
        // için RevenueCat'i retry kuyruğuna sokmak, kapsam boşluğunu bir
        // teslim arızasına çevirirdi.
        console.log(`[rc-webhook] Unhandled event type: ${event.type}`)
        await sentryCapture({
          message: `revenuecat-webhook: işlenmeyen event tipi (${event.type}) — kapsam dışı, işlem yapılmadı`,
          level: 'info',
          tags: {
            error_code: 'RC_EVENT_TYPE_UNHANDLED',
            function: 'revenuecat-webhook',
            event_type: event.type,
          },
          extra: {
            event_type: event.type,
            rc_event_id: event.id ?? null,
            auth_user_id: authUserId,
            app_user_id: appUserId,
            product_id: event.product_id,
            transaction_id: event.transaction_id ?? null,
          },
        })
      }
    }

    return new Response(
      JSON.stringify({ status: 'OK', event_type: event.type, tier }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[rc-webhook] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
