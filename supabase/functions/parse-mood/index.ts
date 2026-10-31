/**
 * Edge Function: parse-mood
 * Kullanıcının serbest metin girdisini 12 boyutlu TasteProfile'a dönüştürür.
 *
 * Deploy: supabase functions deploy parse-mood --no-verify-jwt
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts'
import { requireUser, unauthorizedResponse } from '../_shared/auth.ts'
import { sentryCapture } from '../_shared/sentry.ts'
import { shouldRefundOnError } from '../_shared/refundPolicy.ts'
import { validateRawInput } from '../_shared/moodInput.ts'
import { isSchemaV2, normalizeV2Fields } from '../_shared/moodV2.ts'
import { parseV2PromptFingerprint, runParseV2 } from '../_shared/moodParseTools.ts'
import { classifyQuotaResult, quotaFields } from '../_shared/quotaFields.ts'
import {
  PARSE_CACHE_TTL_SECONDS,
  parseCacheKey,
  parseQuickMoodId,
  promptVersionOf,
  readCachedProfile,
} from '../_shared/moodParseCache.ts'
import { collectRecentShown, RECENT_SEARCHES } from '../_shared/moodRecentShown.ts'
import {
  ANTHROPIC_TIMEOUT_MS,
  STALE_SECONDS,
  interpretClaim,
  parseClientSearchId,
  type ClaimOutcome,
} from '../_shared/moodClaim.ts'

// ─── Shared Admin Client ──────────────────────────────────────────────────────

/**
 * Lazy-init admin client (service role).
 * persistSession: false ZORUNLU — Deno Deploy'da storage yok,
 * default true client auth module'unu bozuyor (BUG: mood_searches INSERT sessiz fail).
 */
// `ReturnType<typeof createClient>` jenerikleri varsayilanla orneklediginden
// tablo/RPC tipleri `never`'a coker. Tip gercek bir cagri yerinden cikarilir
// (winback-sequencer deseni, bkz. docs/TEKNIK_BORC.md).
function makeAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
type AdminClient = ReturnType<typeof makeAdminClient>

let _admin: AdminClient | null = null
function getAdmin(): AdminClient {
  if (!_admin) {
    _admin = makeAdminClient()
  }
  return _admin
}

// ─── Sprint 1 v4.0 — Async Logging Helper ────────────────────────────────────

/**
 * Fire-and-forget mood search logging.
 * Inserts enriched row into mood_searches for production debugging.
 * Errors are silently caught — never affects user-facing response.
 */
async function logMoodSearch(params: {
  userId: string;
  moodText?: string;
  parsedProfile: Record<string, unknown> | null;
  latencyMs: number;
  tierUsed?: number;
  cacheHit?: boolean;
  errorCode?: string;
  llmTokensIn?: number;
  llmTokensOut?: number;
}): Promise<string | null> {
  try {
    const admin = getAdmin()

    const { data, error } = await admin
      .from('mood_searches')
      .insert({
        user_id: params.userId,
        mood_text: params.moodText?.slice(0, 500) || null,
        parsed_profile: params.parsedProfile,
        latency_ms: params.latencyMs,
        tier_used: params.tierUsed || null,
        cache_hit: params.cacheHit || false,
        error_code: params.errorCode || null,
        llm_tokens_in: params.llmTokensIn || null,
        llm_tokens_out: params.llmTokensOut || null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[parse-mood] log INSERT error:', error.message, '| code:', error.code, '| user_id:', params.userId)
      return null
    }

    return data?.id || null
  } catch (e) {
    console.error('[parse-mood] log failed:', e)
    return null
  }
}

// ─── MOOD-VEC-2d: parse onbellegi + kisisel tekrar dislama (yalniz schema_version:2) ──

/** Onbellek/kisisel-dislama hatasi arama akisini DUSURMEZ ama sessiz de kalmaz: Sentry warning. */
async function reportV2Aux(code: string, detail: string, userId?: string): Promise<void> {
  console.error(`[parse-mood] ${code}:`, detail)
  await sentryCapture({
    message: `parse-mood ${code}: ${detail}`,
    level: 'warning',
    tags: { function: 'parse-mood', error_code: code },
    extra: userId ? { user_id: userId } : undefined,
  })
}

/** Isabet → parse ciktisi; iskalama (yok / TTL dolmus) → null. Hata/bozuk satir → Sentry + null (Haiku'ya duser). */
async function readParseCache(key: string): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await getAdmin().rpc('mood_parse_cache_get', {
      p_key: key,
      p_max_age_seconds: PARSE_CACHE_TTL_SECONDS,
    })
    if (error) throw new Error(`RPC hatasi: ${error.message}`)
    if (data === null || data === undefined) return null
    const profile = readCachedProfile(data)
    if (!profile) throw new Error('onbellek satiri bozuk (beklenen sekil yok)')
    return profile
  } catch (err) {
    await reportV2Aux('PARSE_CACHE_READ_FAILED', err instanceof Error ? err.message : String(err))
    return null
  }
}

/** Yalniz parse CIKTISI yazilir (kullanici kimligi/ham metin yok). Hicbir zaman firlatmaz. */
async function writeParseCache(
  key: string,
  schemaVersion: number,
  promptVersion: string,
  result: Record<string, unknown>,
): Promise<void> {
  try {
    // Yazma + suresi dolanlarin sinirli (100 satir) temizligi tek RPC'de (migration 144).
    const { error } = await getAdmin().rpc('mood_parse_cache_put', {
      p_key: key,
      p_schema_version: schemaVersion,
      p_prompt_version: promptVersion,
      p_result: result,
    })
    if (error) throw new Error(error.message)
  } catch (err) {
    await reportV2Aux('PARSE_CACHE_WRITE_FAILED', err instanceof Error ? err.message : String(err))
  }
}

/** `finish_mood_search` cache_hit=false yazar; onbellek isabetinde satir sonradan duzeltilir. */
async function markCacheHit(searchId: string, userId: string): Promise<void> {
  try {
    const { error } = await getAdmin().from('mood_searches').update({ cache_hit: true }).eq('id', searchId)
    if (error) throw new Error(error.message)
  } catch (err) {
    await reportV2Aux('CACHE_HIT_MARK_FAILED', err instanceof Error ? err.message : String(err), userId)
  }
}

/**
 * Kullanicinin son `RECENT_SEARCHES` mood aramasinda gosterilen ilk 4 filmin id'leri.
 * Istemci bunu match_films_v4 `exclude_ids`ine ekler. Hata → Sentry + [] (dislama olmadan devam).
 */
async function fetchRecentShown(appUserId: string): Promise<string[]> {
  try {
    const { data, error } = await getAdmin()
      .from('mood_searches')
      .select('recommended_film_ids')
      .eq('user_id', appUserId)
      .not('recommended_film_ids', 'is', null)
      .order('searched_at', { ascending: false })
      .limit(RECENT_SEARCHES)
    if (error) throw new Error(error.message)
    return collectRecentShown(data ?? [])
  } catch (err) {
    await reportV2Aux('RECENT_SHOWN_READ_FAILED', err instanceof Error ? err.message : String(err), appUserId)
    return []
  }
}

// ─── Idempotent Claim (MONEY-1C, migration 139) ──────────────────────────────

/**
 * `client_search_id` ile gelen istek icin atomik sahiplenme. Kotayi (gerekirse) BU RPC
 * tuketir; ayni (user, id) icin en fazla bir kez. RPC hatasi / anlasilmaz cevap
 * `unavailable` doner — cagiran fail-closed 503 verir, hicbir sey tuketilmis sayilmaz.
 */
async function claimSearch(
  appUserId: string,
  clientSearchId: string,
  rawInput: string,
): Promise<ClaimOutcome> {
  try {
    const { data, error } = await getAdmin().rpc('claim_mood_search', {
      p_user_id: appUserId,
      p_client_search_id: clientSearchId,
      p_mood_text: rawInput,
      p_stale_seconds: STALE_SECONDS,
    })
    if (error) return { kind: 'unavailable', detail: `RPC hatasi: ${error.message}` }
    return interpretClaim(data)
  } catch (err) {
    return { kind: 'unavailable', detail: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Sahiplenilmis satiri sonuclandirir. Hicbir zaman firlatmaz: finish basarisizligi LLM
 * hatasi DEGILDIR (kullanici yanitini alir, iade tetiklenmez). Sahiplik kaybi (zombi
 * istek) ve RPC hatasi Sentry'ye yazilir; satir `pending` kalirsa bayat yoluyla kurtarilir.
 */
async function finishSearch(params: {
  userId: string
  searchId: string
  claimedAt: string
  status: 'completed' | 'failed'
  profile: Record<string, unknown> | null
  errorCode: string | null
  /** Yalniz `failed`: iade iste. Iade, sahiplik dogrulandiktan sonra RPC icinde yapilir. */
  refund: boolean
  latencyMs: number
  tokensIn: number | null
  tokensOut: number | null
}): Promise<{ finished: boolean; refunded: boolean }> {
  try {
    const { data, error } = await getAdmin().rpc('finish_mood_search', {
      p_search_id: params.searchId,
      p_claimed_at: params.claimedAt,
      p_status: params.status,
      p_profile: params.profile,
      p_error_code: params.errorCode,
      p_refund: params.refund,
      p_latency_ms: params.latencyMs,
      p_tokens_in: params.tokensIn,
      p_tokens_out: params.tokensOut,
    })
    if (error) throw new Error(`RPC hatasi: ${error.message}`)
    const res = (data ?? {}) as { finished?: boolean; refunded?: boolean; refund?: unknown }
    if (res.finished !== true) {
      throw new Error('sahiplik kaybedildi: satir baska bir istek tarafindan yeniden sahiplenildi')
    }
    if (params.refund && res.refunded !== true) {
      // Hak yandi ve iade edilemedi (ornegin gece yarisi siniri): kullanici hakkini kaybetti.
      await sentryCapture({
        message: `parse-mood kota iadesi basarisiz — kullanici hakkini kaybetti: ${JSON.stringify(res.refund)}`,
        level: 'error',
        tags: { function: 'parse-mood', error_code: 'QUOTA_REFUND_FAILED' },
        extra: { user_id: params.userId, search_id: params.searchId },
      })
    }
    return { finished: true, refunded: res.refunded === true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[parse-mood] finish_mood_search failed:', msg)
    await sentryCapture({
      message: `parse-mood finish_mood_search basarisiz: ${msg}`,
      level: 'error',
      tags: { function: 'parse-mood', error_code: 'MOOD_FINISH_FAILED' },
      extra: { user_id: params.userId, search_id: params.searchId, status: params.status },
    })
    return { finished: false, refunded: false }
  }
}

// ─── CORS ─────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are MoodFlix Taste Parser. Given a user's mood description, extract a 12-dimensional taste profile.

Return ONLY valid JSON, no explanation:
{
  "emotional_state": {
    "joy": 0.0-1.0,
    "sadness": 0.0-1.0,
    "fear": 0.0-1.0,
    "anger": 0.0-1.0,
    "surprise": 0.0-1.0,
    "disgust": 0.0-1.0,
    "trust": 0.0-1.0,
    "anticipation": 0.0-1.0
  },
  "energy_level": 0.0-1.0,
  "pace_preference": "slow" | "medium" | "fast",
  "visual_style": "minimalist" | "cinematic" | "experimental" | "lush" | "raw",
  "thematic_depth": 0.0-1.0,
  "ending_preference": "hopeful" | "bittersweet" | "open" | "tragic" | "triumphant",
  "era_preference": { "from": year_number, "to": year_number },
  "cultural_context": ["country or region strings"],
  "avoid_signals": ["theme strings to avoid"],
  "narrative_style": "linear" | "nonlinear" | "anthology" | "dialogue-driven",
  "social_context": "alone" | "couple" | "friends" | "family",
  "rewatch_tolerance": true | false,
  "profile_name": "2-3 word mood summary in English",
  "profile_description": "One sentence explaining the mood and what kind of film experience this person needs",
  "search_keywords": ["5-8 lowercase thematic keywords for content matching"]
}

Rules:
- Interpret emotions from context, not just keywords
- "I had a bad day" → high sadness + anticipation (wants comfort)
- "feeling adventurous" → high anticipation + surprise + high energy
- "need to cry" → high sadness, thematic_depth high, slow pace
- Multiple emotions can coexist (AND logic, not OR)
- If social context is unclear, default to "alone"
- Keep avoid_signals conservative — only add when clearly stated in input
- era_preference default when not mentioned: { "from": 1970, "to": 2025 }
- cultural_context default when not mentioned: []
- rewatch_tolerance: true if user implies comfort/familiar content, false for new discoveries
- profile_name and profile_description must always be in English
- Accept both English and Turkish input equally well

Genre-critical differentiation rules (IMPORTANT — these prevent cross-genre contamination):
- COMEDY/FUNNY/LAUGH signals → joy VERY HIGH (0.8-0.95), energy MEDIUM-LOW (0.3-0.5), anticipation LOW (0.1-0.25), fear LOW (0.05-0.15), anger LOW (0.05-0.15), thematic_depth LOW (0.1-0.2), ending "hopeful". Comedy is NOT high energy — high energy maps to Action.
- ACTION/THRILLER/ADVENTURE signals → energy VERY HIGH (0.8-0.95), anticipation HIGH (0.8-0.9), fear MODERATE (0.5-0.7), joy MODERATE (0.4-0.6), pace "fast"
- HORROR/SCARY signals → fear HIGH (0.8-0.9), anticipation HIGH, energy MODERATE, joy LOW (0.1-0.2)
- ROMANTIC signals → trust HIGH (0.8-0.9), joy MODERATE-HIGH (0.6-0.8), energy LOW-MODERATE (0.3-0.5)
- DRAMA/SAD signals → sadness HIGH (0.7-0.9), thematic_depth HIGH, energy LOW (0.1-0.3), pace "slow"
- When a mood clearly maps to one genre (e.g. "need a laugh" = comedy), actively SUPPRESS dimensions of other genres. A comedy profile should NOT have high anticipation/fear/anger values.

search_keywords rules (IMPORTANT — these enable thematic film matching):
- Extract 5-8 lowercase thematic keywords describing the SUBJECT, SETTING, THEME, or CONTEXT implied by the mood — NOT emotions.
- These match against film content tags (TMDB keywords). Think: what is this film ABOUT?
- Use natural language phrases like TMDB keywords (lowercase, can be multi-word).
- Examples:
  "thailand trip" → ["travel", "vacation", "adventure", "southeast asia", "journey", "exotic location"]
  "sınav sonucum iyi geldi" → ["coming of age", "school", "youth", "achievement", "friendship", "success"]
  "ayrılık acısı" → ["heartbreak", "breakup", "romance", "loss", "relationships", "melancholy"]
  "bir soygun filmi izlemek istiyorum" → ["heist", "crime", "robbery", "thriller", "gang", "planning"]
  "need a laugh" → ["comedy", "humor", "funny", "satire"]
- If the mood is purely emotional with no clear theme/subject (e.g. "feeling down"), return an empty array [].`

// ─── Quota Check Helper ───────────────────────────────────────────────────────

/**
 * Gunluk arama kotasini kontrol eder ve tuketir.
 * allowed=false ise Claude API call engellenir (maliyet tasarrufu).
 *
 * ── 8 Ağu 2026 degisikligi ───────────────────────────────────────────────
 * Kimlik dogrulamasi buradan CIKARILDI: artik handler basinda `requireUser()`
 * yapiliyor ve bu fonksiyon zaten dogrulanmis `appUserId` aliyor. Onceki hali
 * hem kendi `getUser()` cagrisini yapiyor hem de basarisiz olunca
 * `{ allowed: true }` donuyordu — yani header'siz istek kotayi ATLAYIP ucretli
 * Claude'a ulasabiliyordu. O bosluk artik handler seviyesinde kapali.
 *
 * ── 10 Agu 2026 degisikligi (C.0c) ───────────────────────────────────────
 * `appUserId` null dali FAIL-CLOSED yapildi. Onceki hal `{ allowed: true }`
 * donuyordu: kota sayaci hic okunmuyor, `logMoodSearch` da atlaniyordu (o da
 * `quotaCheck.userId` istiyor) ve akis dogrudan ucretli Haiku cagrisina
 * ulasiyordu. Yani sayacsiz, izsiz, ucretli bir LLM yolu.
 *
 * Olcum (9 Agu 2026, SQL): auth.users 226 · anonim 162 · `public.users`
 * satiri olmayan 88 (87 anonim + 1 kayitli). Yani her 4 kimlikten 1'i bu
 * daldan geciyordu.
 *
 * Artik istek REDDEDILIR (403). Kimlik gecerli oldugu icin 401 DEGIL:
 * dogrulama basarili, eksik olan uygulama satiri — yani yetki/veri durumu.
 * `public.users` satiri BURADA acilmaz; lazy insert mimari karardir ve C.7
 * kapsamindadir (bkz. docs/TEKNIK_BORC.md).
 */
async function checkSearchQuota(
  appUserId: string | null,
): Promise<{
  allowed: boolean
  userId?: string
  quotaResult?: Record<string, unknown>
  reason?: string
  error?: string
}> {
  if (!appUserId) {
    // level: 'warning' → 'error'. Bu artik "gecti ama tuhaf" degil, kullanici
    // arama yapamiyor demek. Ayri alert kurali `error_code:APP_USER_MISSING`
    // tag'i uzerinden kurulur — `sentryCapture` fingerprint tasimiyor.
    await sentryCapture({
      message: 'parse-mood: dogrulanmis kullanicinin public.users satiri yok — istek reddedildi',
      level: 'error',
      tags: { function: 'parse-mood', error_code: 'APP_USER_MISSING' },
    })
    return { allowed: false, reason: 'APP_USER_MISSING' }
  }

  try {
    const admin = getAdmin()

    // Atomic quota check + consume
    const { data, error } = await admin.rpc('check_and_consume_quota', {
      p_user_id: appUserId,
      p_quota_type: 'search',
    })

    if (error) {
      return await failClosedQuota(appUserId, 'QUOTA_CHECK_FAILED', error.message)
    }

    return await quotaResultToCheck(appUserId, data as Record<string, unknown>)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return await failClosedQuota(appUserId, 'QUOTA_CHECK_EXCEPTION', msg)
  }
}

/**
 * Kota RPC sonucunu (`check_and_consume_quota` dondurusu — dogrudan ya da
 * `claim_mood_search` icinden) izin/red kararina cevirir. Iki yol ayni kurallari paylasir.
 */
async function quotaResultToCheck(
  appUserId: string,
  result: Record<string, unknown>,
): Promise<{
  allowed: boolean
  userId?: string
  quotaResult?: Record<string, unknown>
  reason?: string
  error?: string
}> {
  const outcome = classifyQuotaResult(result)

  if (outcome === 'tier_not_configured') {
    // Yapilandirma hatasi: `subscription_limits`te bu tier'in satiri yok.
    // 429 DEGIL — kullanici kotayi asmadi. Sentry'de gorunur olmali.
    await sentryCapture({
      message: `parse-mood: tier icin subscription_limits satiri yok — istek reddedildi (tier: ${String(result.tier)})`,
      level: 'error',
      tags: { function: 'parse-mood', error_code: 'TIER_NOT_CONFIGURED' },
      extra: { user_id: appUserId, tier: result.tier },
    })
    return { allowed: false, userId: appUserId, quotaResult: result, reason: 'TIER_NOT_CONFIGURED' }
  }

  if (outcome === 'unavailable') {
    // allowed alani yok / bilinmeyen hata (USER_NOT_FOUND, INVALID_QUOTA_TYPE...)
    return await failClosedQuota(appUserId, 'QUOTA_CHECK_UNEXPECTED', JSON.stringify(result))
  }

  return {
    allowed: outcome === 'allowed',
    userId: appUserId,
    quotaResult: result,
    reason: outcome === 'exceeded' ? 'QUOTA_EXCEEDED' : undefined,
  }
}

/**
 * Kota RPC'si cevap vermedi ya da anlasilmaz cevap verdi → istek REDDEDILIR
 * (MONEY-1C; onceki hal fail-open'di). Gerekce: rate limiter ayni DB'de zaten
 * fail-closed, yani fail-open yalniz "kota fonksiyonu bozuk, DB saglam"
 * durumunda devreye giriyordu — 115 gibi bir migration hatasinda tum kullanim
 * kotasiz ve ucretli akardi. Hicbir sey tuketilmedi, iade de gerekmez.
 * Sessiz degil: Sentry `level: error`.
 */
async function failClosedQuota(
  appUserId: string,
  errorCode: string,
  detail: string,
): Promise<{ allowed: false; userId: string; reason: 'QUOTA_UNAVAILABLE' }> {
  console.error(`[parse-mood] Quota ${errorCode}:`, detail)
  await sentryCapture({
    message: `parse-mood kota kontrolu basarisiz — istek reddedildi: ${detail}`,
    level: 'error',
    tags: { function: 'parse-mood', error_code: errorCode },
    extra: { user_id: appUserId },
  })
  return { allowed: false, userId: appUserId, reason: 'QUOTA_UNAVAILABLE' }
}

// ─── Quota Refund + Response Fields (MONEY-1C) ────────────────────────────────

/**
 * Tuketilen aramayi geri verir (migration 136). parse-mood tukettikten sonra
 * KENDI hatasiyla dustugunde cagrilir. Hicbir zaman firlatmaz: iade
 * basarisizsa kullanici yine hata yanitini alir, ama hak kaybi Sentry'ye yazilir
 * (sessiz fallback yasak). Tuketim basina en cok bir kez cagrilmalidir — RPC
 * idempotent degil.
 */
async function refundSearchQuota(appUserId: string, cause: string): Promise<boolean> {
  try {
    const { data, error } = await getAdmin().rpc('refund_quota', {
      p_user_id: appUserId,
      p_quota_type: 'search',
    })
    if (error) throw new Error(`RPC hatasi: ${error.message}`)

    const result = data as Record<string, unknown> | null
    if (result?.refunded === true) return true

    throw new Error(`iade edilmedi: ${JSON.stringify(result)}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[parse-mood] Quota refund failed:', msg)
    await sentryCapture({
      message: `parse-mood kota iadesi basarisiz — kullanici hakkini kaybetti: ${msg}`,
      level: 'error',
      tags: { function: 'parse-mood', error_code: 'QUOTA_REFUND_FAILED' },
      extra: { user_id: appUserId, cause },
    })
    return false
  }
}

// ─── Input Validation ─────────────────────────────────────────────────────────

/**
 * Govdeyi okur ve `raw_input`u dogrular (kural: `_shared/moodInput.ts`). Kota
 * TUKETMEZ — handler bunu kotadan once cagirir. Bozuk JSON da gecersiz girdidir.
 */
async function readRawInput(
  req: Request,
): Promise<
  | { ok: true; rawInput: string; clientSearchId: string | null; schemaV2: boolean; quickMoodId: string | null }
  | { ok: false }
> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return { ok: false }
  }

  const rawInput = validateRawInput((body as { raw_input?: unknown } | null)?.raw_input)
  if (rawInput === null) return { ok: false }

  // `client_search_id` (MONEY-1C idempotency): yoksa eski istemci → bugunku akis;
  // varsa UUID olmak zorunda, degilse kotadan ONCE reddedilir.
  const clientSearchId = parseClientSearchId(
    (body as { client_search_id?: unknown } | null)?.client_search_id,
  )
  return clientSearchId.ok
    ? {
        ok: true,
        rawInput,
        clientSearchId: clientSearchId.value,
        schemaV2: isSchemaV2(body),
        quickMoodId: parseQuickMoodId(body),
      }
    : { ok: false }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // ── Kimlik ────────────────────────────────────────────────────────────────
  // Onceki hal: header yoksa kota da rate limit de fiilen atlaniyor, istek
  // dogrudan ucretli Claude'a gidiyordu. Reddedilen sey ANONIM KULLANICI DEGIL,
  // kimliksiz istektir — `signInAnonymously()` oturumu imzali ve gecerlidir.
  const auth = await requireUser(req)
  if (!auth.ok) {
    return unauthorizedResponse(auth, CORS_HEADERS)
  }

  try {
    await checkRateLimit(auth.authUserId, 'parse-mood')
  } catch (err) {
    return rateLimitResponse(err, CORS_HEADERS)
  }

  const startTime = Date.now()

  // ── Girdi dogrulamasi KOTADAN ONCE (MONEY-1C) ─────────────────────────────
  // Onceki sira: kota tuketilir, sonra govde dogrulanirdi — bos/gecersiz bir
  // istek hakki yakardi. Ucretsiz hak gunde 1 oldugunda bu, tek bir hatali
  // istekle hakkin kaybi demek. Gecersiz girdi LLM'e de kotaya da ulasmaz.
  // Rate limit yukarida kalir: gecersiz istek spam'i yine sinirlanir.
  const input = await readRawInput(req)
  if (!input.ok) {
    if (auth.appUserId) {
      logMoodSearch({
        userId: auth.appUserId,
        parsedProfile: null,
        latencyMs: Date.now() - startTime,
        errorCode: 'INVALID_INPUT',
      }).catch(() => {})
    }

    return new Response(
      JSON.stringify({ error: 'raw_input string is required', code: 'INVALID_INPUT' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
  const rawInput = input.rawInput
  const clientSearchId = input.clientSearchId
  const schemaV2 = input.schemaV2
  // Onbellek YALNIZ hizli mood karti istegi (v2 + gecerli quick_mood_id) icin; yoksa ne okuma ne yazma.
  const quickMoodId = schemaV2 ? input.quickMoodId : null

  // Sunucu yapilandirma hatasi kotadan ONCE: eksik anahtar yuzunden hak yanmasin.
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    console.error('[parse-mood] ANTHROPIC_API_KEY is not set')
    return new Response(
      JSON.stringify({ error: 'Server configuration error', code: 'CONFIG_ERROR' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // Quota check — free user 4. aramada Claude API maliyeti olusturmaz.
  //
  // `client_search_id` varsa (MONEY-1C, migration 139) kota atomik sahiplenmeyle tuketilir:
  // ayni (user, id) icin hak <= 1, LLM <= 1. Yoksa (eski istemci) bugunku akis DEGISMEDEN.
  let claimed: { searchId: string; claimedAt: string } | null = null
  let quotaCheck: Awaited<ReturnType<typeof checkSearchQuota>>
  if (clientSearchId !== null && auth.appUserId) {
    const claim = await claimSearch(auth.appUserId, clientSearchId, rawInput)

    if (claim.kind === 'replay') {
      // Tamamlanmis arama: kayitli profil, kota ve LLM yok.
      return new Response(
        JSON.stringify({
          ...claim.profile,
          search_id: claim.searchId,
          ...quotaFields(claim.quota ?? undefined),
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    if (claim.kind === 'in_progress') {
      // Ayni kimlik baska istekte calisiyor. Istemci `retry_after` sonra AYNI id ile dener.
      return new Response(
        JSON.stringify({
          error: 'This search is already in progress.',
          code: 'IN_PROGRESS',
          retry_after: claim.retryAfter,
          search_id: claim.searchId,
        }),
        {
          status: 409,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Retry-After': String(claim.retryAfter) },
        },
      )
    }

    if (claim.kind === 'claimed') {
      quotaCheck = { allowed: true, userId: auth.appUserId, quotaResult: claim.quota }
      claimed = { searchId: claim.searchId, claimedAt: claim.claimedAt }
    } else if (claim.kind === 'quota_denied') {
      quotaCheck = await quotaResultToCheck(auth.appUserId, claim.quota)
    } else {
      quotaCheck = await failClosedQuota(auth.appUserId, 'QUOTA_CLAIM_FAILED', claim.detail)
    }
  } else {
    quotaCheck = await checkSearchQuota(auth.appUserId)
  }
  // Sahiplenme satiri zaten yazildi (claim/finish); legacy log satiri YAZILMAZ.
  const idempotent = clientSearchId !== null && !!auth.appUserId

  // `public.users` satiri yok → kota sayilamaz, istek burada BITER.
  // `logMoodSearch` cagrilmaz: `mood_searches.user_id` bir `public.users`
  // satiri bekler, o satir zaten yok. Bu yolun tek izi yukaridaki Sentry
  // kaydidir — sessiz degil, ama analitikte gorunmez (C.7 kalemi).
  if (!quotaCheck.allowed && quotaCheck.reason === 'APP_USER_MISSING') {
    return new Response(
      JSON.stringify({
        error: 'Account setup is incomplete.',
        code: 'APP_USER_MISSING',
      }),
      { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // Kota okunamadi / tier yapilandirilmamis → 503 (429 degil: kullanici kotayi
  // asmadi). Hicbir sey tuketilmedi. Log satiri yazilmaz: bu bir kullanici
  // davranisi degil, altyapi durumu — Sentry kaydi zaten var.
  if (!quotaCheck.allowed && quotaCheck.reason === 'TIER_NOT_CONFIGURED') {
    return new Response(
      JSON.stringify({
        error: 'Plan configuration error. Please try again later.',
        code: 'TIER_NOT_CONFIGURED',
        retry_after: 60,
      }),
      { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Retry-After': '60' } },
    )
  }

  if (!quotaCheck.allowed && quotaCheck.reason === 'QUOTA_UNAVAILABLE') {
    return new Response(
      JSON.stringify({
        error: 'Search quota service is temporarily unavailable. Please try again shortly.',
        code: 'QUOTA_UNAVAILABLE',
        retry_after: 30,
      }),
      { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Retry-After': '30' } },
    )
  }

  if (!quotaCheck.allowed) {
    // Log quota exceeded (no mood_text available yet — body not parsed)
    if (quotaCheck.userId && !idempotent) {
      logMoodSearch({
        userId: quotaCheck.userId,
        parsedProfile: null,
        latencyMs: Date.now() - startTime,
        errorCode: 'QUOTA_EXCEEDED',
      }).catch(() => {})
    }

    return new Response(
      JSON.stringify({
        error: 'Daily search quota exceeded',
        code: 'QUOTA_EXCEEDED',
        ...quotaCheck.quotaResult,
        ...quotaFields(quotaCheck.quotaResult),
        upgrade_url: 'chosy://paywall',
      }),
      { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // Bu noktadan sonra kota TUKETILDI: kota RPC'si cevap verdi ve izin verdi.
  // (Eskiden fail-open yolu `quotaResult` olmadan geciyordu; artik o yol yok.)
  const quotaConsumed = quotaCheck.quotaResult !== undefined

  try {
    // MOOD-VEC-2d (yalniz v2): kisisel dislama sorgusu onbellek/Haiku ile PARALEL baslar.
    const recentShownTask = schemaV2 && auth.appUserId ? fetchRecentShown(auth.appUserId) : null

    // MOOD-VEC-2d (yalniz v2): ayni metin + schema + prompt surumu icin Haiku bir kez cagrilir.
    let cacheKey: string | null = null
    let promptVersion = ''
    let cachedParsed: Record<string, unknown> | null = null
    if (schemaV2 && quickMoodId) {
      promptVersion = await promptVersionOf(parseV2PromptFingerprint(SYSTEM_PROMPT))
      cacheKey = await parseCacheKey(quickMoodId, rawInput, 2, promptVersion)
      cachedParsed = await readParseCache(cacheKey)
    }
    const cacheHit = cachedParsed !== null

    let parsed: Record<string, unknown>
    let llmTokensIn = 0
    let llmTokensOut = 0
    let cacheWriteTask: Promise<void> | null = null
    let v2Degraded = false // B basarisiz → bos v2 alanlari onbellege YAZILMAZ

    if (cachedParsed !== null) {
      parsed = cachedParsed
    } else {
      const client = new Anthropic({ apiKey, timeout: ANTHROPIC_TIMEOUT_MS, maxRetries: 0 })

      let fresh: Record<string, unknown>
      let v2Fields: Record<string, unknown> = {}
      if (schemaV2) {
        // MOOD-VEC-2e: iki paralel zorunlu tool_use cagrisi. A = v1 profil (hata = mevcut hata yolu),
        // B = v2 ek alanlari (iki denemede de basarisizsa alanlar bos, akis v1 kalitesinde surer).
        const r = await runParseV2(
          (params, timeoutMs) =>
            client.messages.create(params as unknown as Anthropic.MessageCreateParamsNonStreaming, { timeout: timeoutMs }),
          SYSTEM_PROMPT,
          rawInput,
          ANTHROPIC_TIMEOUT_MS,
        )
        llmTokensIn = r.a.tokensIn + r.b.tokensIn
        llmTokensOut = r.a.tokensOut + r.b.tokensOut
        if (r.a.value === null) {
          // Mesaj 'JSON' icerir → mevcut catch yolu PARSE_FAILED siniflar (iade yok, v1 ile ayni).
          throw new Error('Profile JSON schema validation failed after retry (tool_use)')
        }
        fresh = { ...r.a.value }
        if (r.b.value !== null) {
          v2Fields = r.b.value
        } else {
          v2Degraded = true
          await reportV2Aux(
            'V2_FIELDS_FAILED',
            r.b.error ?? `v2 alanlari ${r.b.attempts} denemede sema dogrulamasini gecemedi`,
            auth.appUserId ?? undefined,
          )
        }
      } else {
        const message = await client.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: rawInput }],
        })

        // Token usage tracking
        llmTokensIn = message.usage?.input_tokens || 0
        llmTokensOut = message.usage?.output_tokens || 0

        const rawText = message.content.find((b) => b.type === 'text')?.text ?? ''

        // Markdown code block varsa temizle
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        const jsonString = jsonMatch ? jsonMatch[1] : rawText.trim()

        fresh = JSON.parse(jsonString)
      }

      // Normalize search_keywords: array of lowercase strings, max 8
      if (!Array.isArray(fresh.search_keywords)) {
        fresh.search_keywords = []
      } else {
        fresh.search_keywords = fresh.search_keywords
          .filter((k: unknown) => typeof k === 'string' && k.trim().length > 0)
          .map((k: string) => k.toLowerCase().trim())
          .slice(0, 8)
      }

      if (schemaV2) Object.assign(fresh, normalizeV2Fields(v2Fields))
      parsed = fresh

      // Yalniz normalize edilmis parse ciktisi onbellege girer (kullanici kimligi yok).
      if (cacheKey && !v2Degraded) cacheWriteTask = writeParseCache(cacheKey, 2, promptVersion, parsed)
    }

    const latencyMs = Date.now() - startTime

    // Async log — response'u beklemez
    let searchId: string | null = null
    if (claimed && quotaCheck.userId) {
      // Idempotent yol: sahiplenilmis satir sonuclandirilir (sahiplik dogrulamali).
      // Basarisiz olsa da kullanici profilini alir; satir `pending` kalirsa bayat yoluyla kurtarilir.
      await finishSearch({
        userId: quotaCheck.userId,
        searchId: claimed.searchId,
        claimedAt: claimed.claimedAt,
        status: 'completed',
        profile: parsed,
        errorCode: null,
        refund: false,
        latencyMs,
        tokensIn: llmTokensIn,
        tokensOut: llmTokensOut,
      })
      searchId = claimed.searchId
      if (cacheHit) await markCacheHit(claimed.searchId, quotaCheck.userId)
    } else if (quotaCheck.userId) {
      searchId = await logMoodSearch({
        userId: quotaCheck.userId,
        moodText: rawInput,
        parsedProfile: parsed,
        latencyMs,
        llmTokensIn,
        llmTokensOut,
        tierUsed: 3, // Sprint 1.A: hepsi tier 3, 1.C'de degisecek
        cacheHit, // v1: hep false; v2: parse onbellegi isabeti (MOOD-VEC-2d)
      }).catch(() => null)
    }

    // v2: onbellek yazimi ve kisisel dislama okumasi yanittan ONCE tamamlanir (isolate donmasin).
    if (cacheWriteTask) await cacheWriteTask
    const recentShownIds = recentShownTask ? await recentShownTask : []

    // `remaining`/`limit` EN SONDA: LLM ciktisindaki ayni adli bir alan ezilir.
    return new Response(
      JSON.stringify({
        ...parsed,
        search_id: searchId,
        // Yalniz v2: istemci/eval onbellek isabetini ve dislanacak film id'lerini buradan okur.
        ...(schemaV2 ? { cache_hit: cacheHit, exclude_recent_ids: recentShownIds } : {}),
        ...quotaFields(quotaCheck.quotaResult),
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const latencyMs = Date.now() - startTime

    // Iade YALNIZ LLM'den sonuc alinamayan hatalarda (5xx/529/429, ag, timeout,
    // kredi) — bkz. `_shared/refundPolicy.ts`. PARSE_FAILED'de iade YOK: LLM
    // cagrisi yapildi (ucret dogdu) ve girdi modeli JSON uretmemeye yonlendirebilir.
    // Iade, hata kaydindan ONCE beklenir ki yanitla guncel `remaining` donebilsin.
    const wantRefund = quotaConsumed && !!quotaCheck.userId && shouldRefundOnError(err)

    // ── Sonuc kaydi + iade ───────────────────────────────────────────────
    // Idempotent yol: iade `finish_mood_search` icinde, sahiplik dogrulandiktan sonra
    // yapilir (zombi istek iade edemez). Legacy yol: eski sira (iade, sonra log).
    const isAnthropicCreditError =
      msg.includes('credit balance is too low') ||
      msg.includes('billing') ||
      msg.includes('insufficient_quota') ||
      msg.includes('rate_limit') ||
      (err instanceof Error && 'status' in err && (err as { status: number }).status === 529)
    const failureCode = isAnthropicCreditError
      ? 'ANTHROPIC_CREDIT_LOW'
      : msg.includes('JSON') || msg.includes('Unexpected token')
        ? 'PARSE_FAILED'
        : 'UNKNOWN_ERROR'

    let refunded = false
    if (claimed && quotaCheck.userId) {
      const fin = await finishSearch({
        userId: quotaCheck.userId,
        searchId: claimed.searchId,
        claimedAt: claimed.claimedAt,
        status: 'failed',
        profile: null,
        errorCode: failureCode,
        refund: wantRefund,
        latencyMs,
        tokensIn: null,
        tokensOut: null,
      })
      refunded = fin.refunded
    } else if (wantRefund && quotaCheck.userId) {
      refunded = await refundSearchQuota(quotaCheck.userId, msg)
    }
    const refundFields = quotaFields(quotaCheck.quotaResult, refunded)

    // Legacy yolda hata satiri (idempotent yolda finish yukarida yazdi).
    const recordFailure = (code: string): void => {
      if (!claimed && quotaCheck.userId) {
        logMoodSearch({
          userId: quotaCheck.userId,
          moodText: rawInput,
          parsedProfile: null,
          latencyMs,
          errorCode: code,
        }).catch(() => {})
      }
    }

    // ── Sprint 1 v5.0: Anthropic credit/billing detection ─────────────
    // 14 gun boyunca fark edilmeden kaldi — artik FATAL level log
    if (isAnthropicCreditError) {
      console.error('[parse-mood] FATAL: ANTHROPIC_CREDIT_LOW —', msg)

      // Sentry fatal — immediate alert for credit outage
      await sentryCapture({
        message: 'ANTHROPIC CREDIT BALANCE LOW — parse-mood failing',
        level: 'fatal',
        tags: { function: 'parse-mood', critical: 'true', error_code: 'ANTHROPIC_CREDIT_LOW' },
        extra: { user_id: quotaCheck.userId, error_message: msg },
      })

      recordFailure('ANTHROPIC_CREDIT_LOW')

      return new Response(
        JSON.stringify({
          error: 'AI service is temporarily unavailable. Please try again later.',
          code: 'SERVICE_UNAVAILABLE',
          retry_after: 3600,
          ...refundFields,
        }),
        { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // ── JSON parse error (LLM returned invalid JSON) ──────────────────
    const errorCode = failureCode

    console.error(`[parse-mood] Error [${errorCode}]:`, msg)

    // Sentry error — parse/unknown failures
    await sentryCapture({
      message: `parse-mood failed: ${msg}`,
      level: 'error',
      tags: { function: 'parse-mood', error_code: errorCode },
      extra: { mood_length: rawInput?.length, user_id: quotaCheck.userId },
    })

    // Log parse failure
    recordFailure(errorCode)

    return new Response(
      JSON.stringify({
        error: 'Failed to parse mood. Please try again.',
        code: errorCode,
        ...refundFields,
      }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
