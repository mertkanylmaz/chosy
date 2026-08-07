/**
 * Edge Function: recompute-taste-vector — ZEVK ekseni cache'ini kurar (B.5)
 *
 * ── Neden ayri fonksiyon ────────────────────────────────────────────────────
 * PRODUCT_OS §5.1 iki ekseni ayirir: ZEVK (gauntlet secimleri + izleme geri
 * bildirimi) ve BILGI (yalnizca trivia olcebilir). `recompute-cinema-dna`
 * BILGI eksenidir ve `game_scores`'tan beslenir. Bu fonksiyon ZEVK eksenidir
 * ve `choice_events` + `watch_feedback`'ten beslenir. Ikisini tek fonksiyona
 * koymak urunun ayirdigi iki kavrami kodda tekrar karistirirdi.
 *
 * ── KOLON SOZLESMESI (ihlali regresyondur) ──────────────────────────────────
 * Bu fonksiyon `cinema_dna` tablosunda YALNIZCA su kolonlara yazar:
 *   taste_vector · user_confidence · taste_signal_count ·
 *   taste_computed_at · taste_algorithm_version
 * knowledge / deduction / auteur_sense / instinct / consistency /
 * cinema_score / rank_id / identity_title / total_dailies_completed
 * kolonlarina ASLA DOKUNMAZ — onlarin sahibi recompute-cinema-dna. Iki
 * fonksiyon ayni satiri farkli kolon setleriyle gunceller; payload'a fazladan
 * kolon eklemek digerinin degerlerini sifirlar.
 *
 * ── Kaynak / cache ayrimi ───────────────────────────────────────────────────
 * choice_events ve watch_feedback KAYNAK'tir: bu fonksiyon onlari yalnizca
 * OKUR. Hicbir kosulda INSERT/UPDATE/DELETE yapmaz. cinema_dna CACHE'tir ve
 * her zaman ham gecmisten yeniden turetilebilir.
 *
 * ── Modlar ──────────────────────────────────────────────────────────────────
 *   { user_id }                        → tek kullanici (incremental kullanim)
 *   { full: true, confirm_reset: true} → TUM cinema_dna taste_* kolonlarini
 *                                        sifirlar ve tum gecmisten yeniden kurar
 *
 * Tek kullanici modu `choice_events(user_id, created_at DESC)` index'ini
 * kullanir (069'daki choice_events_user_recent); full-table-scan YALNIZCA
 * full modda olur.
 *
 * Auth: yalnizca service_role. Istemci cagrisi → 403.
 * Config: app_config'ten LAZY okunur, modul seviyesinde cache YOK.
 *
 * Deploy: supabase functions deploy recompute-taste-vector
 */

import {
  errorResponse,
  getAppConfig,
  getServiceClient,
  handleCors,
  jsonResponse,
  logError,
  logInfo,
} from '../_shared/gameUtils.ts'
import { sentryCapture } from '../_shared/sentry.ts'
import {
  archetypeCentroids,
  type ChoiceEventRow,
  computeTasteVector,
  formatPgVector,
  parsePgVector,
  type TasteVectorConfig,
  type TasteVectorResult,
  validateTasteVectorConfig,
  type WatchFeedbackRow,
} from '../_shared/tasteVector.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ─── Sabitler ────────────────────────────────────────────────────────────────

/**
 * Algoritma surumu. Hesap mantigi degistiginde ARTIRILIR ve gecmis `--full`
 * ile yeniden kurulur. Kodun kimligidir — app_config'e TASINMAZ, cunku
 * konfigurasyondan degil kaynak kodundan turer.
 */
const TASTE_ALGORITHM_VERSION = 'taste-v1'

/** Sayfa boyutu — PostgREST varsayilan 1000 satir limitini asmamak icin. */
const PAGE_SIZE = 1000

/**
 * `.update()` tum satirlara uygulansin diye gereken filtre. PostgREST filtresiz
 * UPDATE'i reddeder; bu sentinel UUID hicbir satirda bulunmaz, dolayisiyla
 * kosul her satirda dogrudur. Migration 021'deki -1 sentinel'i ile ayni fikir.
 */
const IMPOSSIBLE_UUID = '00000000-0000-0000-0000-000000000000'

// ─── Tipler ──────────────────────────────────────────────────────────────────

interface RequestBody {
  user_id?: string
  full?: boolean
  confirm_reset?: boolean
}

interface UserOutcome {
  user_id: string
  signal_count: number
  user_confidence: number
  nearest_archetype_id: number | null
  prior_source: string
  observation_degenerate: boolean
  skipped: TasteVectorResult['skipped']
  /** taste_computed_at NULL idi → ilk hesaplama (tam gecmis). */
  first_computation: boolean
}

// ─── Sayfali okuma ───────────────────────────────────────────────────────────

/**
 * PostgREST'in satir limitini asan tablolari sayfali okur.
 *
 * ── Neden "eksik sayfa = son sayfa" DEGIL ──────────────────────────────────
 * `rows.length < PAGE_SIZE` ile kirmak PAGE_SIZE'in sunucunun `db-max-rows`
 * ayarina esit oldugu VARSAYIMINA dayanir. Sunucu tarafinda bu deger 1000'in
 * altina cekilirse (or. 500) ilk sayfa 500 satir doner, dongu HATA VERMEDEN
 * kirilir ve zevk vektoru eksik gecmisten hesaplanir: ne exception, ne Sentry,
 * ne rapor alani — tam olarak yasakli sessiz fallback sekli.
 *
 * Bunun yerine dongu yalnizca BOS sayfada kirilir ve ilerleme gercekte donen
 * satir sayisi kadar yapilir. Sunucu limiti ne olursa olsun dogru calisir.
 */
async function fetchAllPages<T>(
  buildQuery: () => {
    range: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>
  },
  label: string,
): Promise<T[]> {
  const out: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`${label} okunamadi: ${error.message}`)
    const rows = (data ?? []) as T[]
    if (rows.length === 0) break
    out.push(...rows)
    // Sunucunun gercekte dondugu kadar ilerle — istenen kadar degil.
    from += rows.length
  }
  return out
}

// ─── Film vektorleri ─────────────────────────────────────────────────────────

/**
 * Verilen film id'leri icin `film_profiles.profile_vector` degerlerini ceker.
 * Bozuk/eksik vektorler haritaya KONULMAZ; cagiran taraf onlari
 * `skipped.missing_film_vector` altinda sayar (sessiz atlama yok).
 */
async function fetchFilmVectors(
  service: SupabaseClient,
  filmIds: string[],
): Promise<{ vectors: Map<string, number[]>; unusable: string[] }> {
  const vectors = new Map<string, number[]>()
  const unusable: string[] = []
  if (filmIds.length === 0) return { vectors, unusable }

  // Tekillestir ve sirala: ayni girdi → ayni sorgu (determinizm + cache dostu).
  const unique = [...new Set(filmIds)].sort()

  for (let i = 0; i < unique.length; i += PAGE_SIZE) {
    const chunk = unique.slice(i, i + PAGE_SIZE)
    const { data, error } = await service
      .from('film_profiles')
      .select('film_id, profile_vector')
      .in('film_id', chunk)

    if (error) throw new Error(`film_profiles okunamadi: ${error.message}`)

    for (const row of (data ?? []) as { film_id: string; profile_vector: unknown }[]) {
      const parsed = parsePgVector(row.profile_vector)
      if (parsed) vectors.set(row.film_id, parsed)
      else unusable.push(row.film_id)
    }
  }

  // Hic satiri olmayan filmler de kullanilamaz sayilir.
  for (const id of unique) {
    if (!vectors.has(id) && !unusable.includes(id)) unusable.push(id)
  }

  return { vectors, unusable }
}

// ─── Tek kullanici hesabi ────────────────────────────────────────────────────

interface UserBundle {
  events: ChoiceEventRow[]
  feedback: WatchFeedbackRow[]
  archetypeId: number | null
  computedAt: string | null
}

async function computeAndPersist(
  service: SupabaseClient,
  userId: string,
  bundle: UserBundle,
  filmVectors: Map<string, number[]>,
  config: TasteVectorConfig,
  centroids: Map<number, number[]>,
): Promise<UserOutcome> {
  const result = computeTasteVector({
    events: bundle.events,
    feedback: bundle.feedback,
    filmVectors,
    userArchetypeId: bundle.archetypeId,
    config,
    centroids,
  })

  // KOLON SOZLESMESI: yalnizca taste_* + user_confidence. Baska kolon eklenmez.
  const { error } = await service.from('cinema_dna').upsert(
    {
      user_id: userId,
      taste_vector: formatPgVector(result.taste_vector),
      user_confidence: result.user_confidence,
      taste_signal_count: result.signal_count,
      taste_computed_at: new Date().toISOString(),
      taste_algorithm_version: TASTE_ALGORITHM_VERSION,
    },
    { onConflict: 'user_id' },
  )

  if (error) throw new Error(`cinema_dna yazilamadi (${userId}): ${error.message}`)

  if (result.observation_degenerate) {
    // Sinyal var ama yon yok (tam dengelenmis fark). Prior devraldi —
    // ama bu SESSIZ gecilemez, cunku beklenmedik bir veri sekli.
    await sentryCapture({
      message: `recompute-taste-vector: gozlem vektoru dejenere (user ${userId}, ${result.signal_count} sinyal)`,
      level: 'warning',
      tags: { fn: 'recompute-taste-vector', user_id: userId },
    })
  }

  return {
    user_id: userId,
    signal_count: result.signal_count,
    user_confidence: result.user_confidence,
    nearest_archetype_id: result.nearest_archetype_id,
    prior_source: result.prior_source,
    observation_degenerate: result.observation_degenerate,
    skipped: result.skipped,
    first_computation: bundle.computedAt === null,
  }
}

// ─── Mod: tek kullanici ──────────────────────────────────────────────────────

/**
 * Tek kullanicinin zevk vektorunu yeniden kurar.
 *
 * ── Neden delta degil, kullanicinin TUM gecmisi ─────────────────────────────
 * Gercek artimli harmanlama, normalize edilmis `taste_vector`'den degil HAM
 * birikimden devam etmeyi gerektirir; onu saklamak yeni bir kolon demekti ve
 * yuvarlanmis vektorden devam etmek hem kayipli hem sira-bagimli olurdu —
 * "--full iki kez ayni sonuc" garantisi kirilirdi. Kullanici basina olay
 * sayisi gunde en fazla 3 oldugundan tam gecmis okumak zaten ucuzdur.
 *
 * Bu yuzden `taste_computed_at IS NULL` durumu ayri bir yol GEREKTIRMEZ: her
 * cagri zaten tam gecmis hesabidir. Yine de durum `first_computation` olarak
 * raporlanir.
 *
 * Sorgu `.eq('user_id', ...)` ile baslar → 069'daki choice_events_user_recent
 * index'i kullanilir, full-table-scan OLMAZ.
 */
async function runSingleUser(
  service: SupabaseClient,
  userId: string,
  config: TasteVectorConfig,
  centroids: Map<number, number[]>,
): Promise<{ outcome: UserOutcome; unusableFilms: string[] }> {
  const events = await fetchAllPages<ChoiceEventRow>(
    () =>
      service
        .from('choice_events')
        .select('id, user_id, session_id, round, film_a, film_b, winner, outcome, low_confidence, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }) as never,
    'choice_events',
  )

  const feedback = await fetchAllPages<WatchFeedbackRow>(
    () =>
      service
        .from('watch_feedback')
        .select('id, user_id, film_id, response, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }) as never,
    'watch_feedback',
  )

  const { data: userRow, error: userError } = await service
    .from('users')
    .select('id, archetype_id')
    .eq('id', userId)
    .maybeSingle()

  if (userError) throw new Error(`users okunamadi: ${userError.message}`)
  if (!userRow) throw new Error(`app user bulunamadi: ${userId}`)

  const { data: dnaRow, error: dnaError } = await service
    .from('cinema_dna')
    .select('taste_computed_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (dnaError) throw new Error(`cinema_dna okunamadi: ${dnaError.message}`)

  const filmIds = collectFilmIds(events, feedback)
  const { vectors, unusable } = await fetchFilmVectors(service, filmIds)

  const outcome = await computeAndPersist(
    service,
    userId,
    {
      events,
      feedback,
      archetypeId: (userRow as { archetype_id: number | null }).archetype_id ?? null,
      computedAt: (dnaRow as { taste_computed_at: string | null } | null)?.taste_computed_at ?? null,
    },
    vectors,
    config,
    centroids,
  )

  return { outcome, unusableFilms: unusable }
}

function collectFilmIds(
  events: ChoiceEventRow[],
  feedback: WatchFeedbackRow[],
): string[] {
  const ids: string[] = []
  for (const ev of events) {
    ids.push(ev.film_a, ev.film_b)
  }
  for (const fb of feedback) ids.push(fb.film_id)
  return ids
}

// ─── Mod: full ───────────────────────────────────────────────────────────────

/**
 * TUM kullanicilarin zevk vektorunu sifirdan kurar.
 *
 * Once `cinema_dna`nin taste_* kolonlari sifirlanir (BILGI ekseni kolonlarina
 * dokunulmaz), sonra tum gecmis tek seferde okunup bellekte kullaniciya gore
 * gruplanir. Full-table-scan YALNIZCA burada olur ve amaci budur.
 *
 * Sinyali olmayan kullanicilar da islenir: 0 sinyalde bos vektor degil ARKETIP
 * PRIOR'u yazilmalidir (sozlesme).
 *
 * ── ATOMIK DEGIL — kurtarma yolu ────────────────────────────────────────────
 * Sifirlama tek islemde, hesaplar tek tek yapilir. N. kullanicida hata olursa
 * o noktadan sonrakiler sifirlanmis (taste_vector NULL) kalir ve yanit 500
 * doner. Bu VERI KAYBI DEGILDIR: cinema_dna bir cache'tir, kaynagi
 * choice_events + watch_feedback'te durur. Kurtarma = hatanin sebebini gider
 * ve `full` cagrisini TEKRARLA; sonuc deterministiktir, iki kez calismak
 * zarar vermez.
 *
 * ── Anonim (device-only) gecmis ─────────────────────────────────────────────
 * `user_id IS NULL` satirlar (anonim cihaz oyunu) DISLANIR: cinema_dna
 * user_id anahtarlidir, yazilacak satir yoktur. Bu satirlar C.7'de
 * `claim_device_data` ile kullaniciya devredilince hesaba katilirlar.
 * Sessizce yutulmasin diye sayilari yanitta `skipped_anonymous_rows` altinda
 * raporlanir.
 */
async function runFull(
  service: SupabaseClient,
  config: TasteVectorConfig,
  centroids: Map<number, number[]>,
): Promise<{
  outcomes: UserOutcome[]
  unusableFilms: string[]
  resetRows: number
  skippedAnonymousRows: { choice_events: number; watch_feedback: number }
}> {
  // ── 1. Sifirlama (geri donusu yok) ─────────────────────────────────────
  const { count: resetRows, error: resetError } = await service
    .from('cinema_dna')
    .update(
      {
        taste_vector: null,
        user_confidence: 0,
        taste_signal_count: 0,
        taste_computed_at: null,
        taste_algorithm_version: null,
      },
      { count: 'exact' },
    )
    .neq('user_id', IMPOSSIBLE_UUID)

  if (resetError) throw new Error(`taste kolonlari sifirlanamadi: ${resetError.message}`)

  // ── 2. Tum gecmis ──────────────────────────────────────────────────────
  const allEvents = await fetchAllPages<ChoiceEventRow>(
    () =>
      service
        .from('choice_events')
        .select('id, user_id, session_id, round, film_a, film_b, winner, outcome, low_confidence, created_at')
        .not('user_id', 'is', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }) as never,
    'choice_events (full)',
  )

  const allFeedback = await fetchAllPages<WatchFeedbackRow>(
    () =>
      service
        .from('watch_feedback')
        .select('id, user_id, film_id, response, created_at')
        .not('user_id', 'is', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }) as never,
    'watch_feedback (full)',
  )

  const allUsers = await fetchAllPages<{ id: string; archetype_id: number | null }>(
    () =>
      service
        .from('users')
        .select('id, archetype_id')
        .order('id', { ascending: true }) as never,
    'users (full)',
  )

  const { vectors, unusable } = await fetchFilmVectors(
    service,
    collectFilmIds(allEvents, allFeedback),
  )

  // ── 3. Bellekte grupla ─────────────────────────────────────────────────
  const eventsByUser = new Map<string, ChoiceEventRow[]>()
  for (const ev of allEvents) {
    if (!ev.user_id) continue
    const list = eventsByUser.get(ev.user_id)
    if (list) list.push(ev)
    else eventsByUser.set(ev.user_id, [ev])
  }

  const feedbackByUser = new Map<string, WatchFeedbackRow[]>()
  for (const fb of allFeedback) {
    if (!fb.user_id) continue
    const list = feedbackByUser.get(fb.user_id)
    if (list) list.push(fb)
    else feedbackByUser.set(fb.user_id, [fb])
  }

  // ── 4. Her kullaniciyi hesapla ─────────────────────────────────────────
  // Sirali (id ASC) — determinizm icin. 135 kullanicida paralellik gereksiz.
  const outcomes: UserOutcome[] = []
  for (const u of allUsers) {
    outcomes.push(
      await computeAndPersist(
        service,
        u.id,
        {
          events: eventsByUser.get(u.id) ?? [],
          feedback: feedbackByUser.get(u.id) ?? [],
          archetypeId: u.archetype_id ?? null,
          // Sifirlama az once yapildi → hepsi ilk hesaplama sayilir.
          computedAt: null,
        },
        vectors,
        config,
        centroids,
      ),
    )
  }

  // Anonim satirlar: hesaba katilmadilar, ama sayilari raporlanir.
  const { count: anonChoice, error: anonChoiceErr } = await service
    .from('choice_events')
    .select('id', { count: 'exact', head: true })
    .is('user_id', null)
  if (anonChoiceErr) throw new Error(`anonim choice_events sayilamadi: ${anonChoiceErr.message}`)

  const { count: anonFeedback, error: anonFeedbackErr } = await service
    .from('watch_feedback')
    .select('id', { count: 'exact', head: true })
    .is('user_id', null)
  if (anonFeedbackErr) throw new Error(`anonim watch_feedback sayilamadi: ${anonFeedbackErr.message}`)

  return {
    outcomes,
    unusableFilms: unusable,
    resetRows: resetRows ?? 0,
    skippedAnonymousRows: {
      choice_events: anonChoice ?? 0,
      watch_feedback: anonFeedback ?? 0,
    },
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Use POST', 405)
  }

  // ── Auth: yalnizca service_role ────────────────────────────────────────
  // Supabase gateway Authorization basligini yeniden yaziyor; ham anahtar
  // karsilastirmak yerine JWT'nin role claim'ine bakilir (recompute-cinema-dna
  // ile ayni desen).
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  let isServiceRole = false
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      isServiceRole = payload.role === 'service_role'
    } catch {
      // Gecersiz JWT → service_role degil. Asagida 403 doner, sessiz gecis yok.
      isServiceRole = false
    }
  }
  if (!isServiceRole) {
    return errorResponse('FORBIDDEN', 'Internal only endpoint', 403)
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return errorResponse('INVALID_INPUT', 'Invalid request body', 400)
  }

  const isFull = body.full === true

  if (!isFull && !body.user_id) {
    return errorResponse('MISSING_PARAMS', 'user_id gerekli (ya da full: true)', 400)
  }

  // Full mod cinema_dna.taste_* kolonlarini geri donusu olmadan sifirlar.
  // Kazara tetiklenmesin diye acik onay alani ZORUNLU.
  if (isFull && body.confirm_reset !== true) {
    return errorResponse(
      'CONFIRM_REQUIRED',
      'full: true tum kullanicilarin taste_* kolonlarini sifirlar. confirm_reset: true gerekli.',
      400,
    )
  }

  const service = getServiceClient()
  const startedAt = Date.now()

  try {
    // app_config LAZY — her istekte okunur, modul seviyesinde cache YOK.
    // getAppConfig yalnizca cast yapar; eksik/bozuk anahtar sessizce yanlis
    // sonuc uretmesin diye ACIKCA dogrulanir (validate throw eder).
    const config = validateTasteVectorConfig(
      await getAppConfig<TasteVectorConfig>(service, 'taste_vector_config'),
    )
    const centroids = archetypeCentroids()

    if (isFull) {
      const { outcomes, unusableFilms, resetRows, skippedAnonymousRows } = await runFull(
        service,
        config,
        centroids,
      )

      logInfo('recompute-taste-vector.full_success', {
        users_processed: outcomes.length,
        reset_rows: resetRows,
        unusable_films: unusableFilms.length,
        skipped_anonymous_rows: skippedAnonymousRows,
        duration_ms: Date.now() - startedAt,
      })

      if (unusableFilms.length > 0) {
        await sentryCapture({
          message: `recompute-taste-vector: ${unusableFilms.length} filmin profile_vector'u kullanilamaz`,
          level: 'warning',
          tags: { fn: 'recompute-taste-vector', mode: 'full' },
        })
      }

      return jsonResponse({
        success: true,
        mode: 'full',
        algorithm_version: TASTE_ALGORITHM_VERSION,
        reset_rows: resetRows,
        users_processed: outcomes.length,
        unusable_films: unusableFilms,
        skipped_anonymous_rows: skippedAnonymousRows,
        results: outcomes,
      })
    }

    const { outcome, unusableFilms } = await runSingleUser(
      service,
      body.user_id!,
      config,
      centroids,
    )

    logInfo('recompute-taste-vector.success', {
      user_id: outcome.user_id,
      signal_count: outcome.signal_count,
      user_confidence: outcome.user_confidence,
      prior_source: outcome.prior_source,
      duration_ms: Date.now() - startedAt,
    })

    if (unusableFilms.length > 0) {
      await sentryCapture({
        message: `recompute-taste-vector: ${unusableFilms.length} filmin profile_vector'u kullanilamaz (user ${outcome.user_id})`,
        level: 'warning',
        tags: { fn: 'recompute-taste-vector', mode: 'single', user_id: outcome.user_id },
      })
    }

    return jsonResponse({
      success: true,
      mode: 'single',
      algorithm_version: TASTE_ALGORITHM_VERSION,
      unusable_films: unusableFilms,
      result: outcome,
    })
  } catch (err) {
    logError('recompute-taste-vector.unhandled', err, {
      user_id: body.user_id ?? null,
      full: isFull,
    })
    await sentryCapture({
      message: `recompute-taste-vector unhandled error: ${err}`,
      level: 'error',
      tags: {
        fn: 'recompute-taste-vector',
        mode: isFull ? 'full' : 'single',
        user_id: body.user_id ?? 'n/a',
      },
    })
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500)
  }
})
