// ⚠️ CRON'U ACMADAN ONCE 079 GEREKLI
// Bu dosyadaki tier mandali onarimi (Bug 2) YALNIZCA bundan SONRA
// trending'e cikan filmleri korur. Su anda trending'deki 56 filmin
// pre_trending_tier degeri NULL — onlar duserken COALESCE(null,'archive')
// ile archive'e gider, yani hata tekrarlanir.
// Migration 079 o 56 filmin pre_trending_tier'ini backfill edecek.
// weekly-trending-sync cron'u 079 + GATE 3 tamamlanmadan active=true
// YAPILMAYACAK.

/**
 * Edge Function: sync-trending
 *
 * Phase 1 of trending sync — TMDB fetch + films upsert (no AI profiling).
 *
 * Pipeline:
 *   1. TMDB trending/week (2 pages) + upcoming (1 page) → ~60 unique films
 *   2. Existing films: curation_tier='trending' olarak güncelle
 *   3. New films: TMDB detail çek → INSERT + placeholder film_profiles
 *   4. Önceki haftanın trending'leri → curation_tier='archive' (DELETE YOK)
 *
 * AI profiling (Phase 2) ayrı çalışır:
 *   npx tsx scripts/ai-profile-films.ts --from-db
 *
 * `--only-missing` DEGIL: o bayrak girdisini films-raw.json'dan alir ve o dosya
 * yalnizca ilk seed'i icerir. Bu fonksiyonun ekledigi filmler orada YOKTUR
 * (scripts/ai-profile-films.ts:17-20). `--from-db` girdiyi dogrudan films
 * tablosundan okur.
 *
 * Deploy: supabase functions deploy sync-trending --no-verify-jwt
 * Cron: Her Pazartesi 06:00 UTC (pg_cron ile)
 *
 * Secrets: TMDB_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole, unauthorizedResponse } from '../_shared/auth.ts'
import { sentryCapture } from '../_shared/sentry.ts'

// ─── Config ──────────────────────────────────────────────────────────────────

const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original'
const TMDB_DELAY_MS = 260 // ~4 req/sec — safe under 40/10s limit
const PARALLEL_DETAIL_BATCH = 5 // Fetch 5 TMDB details in parallel

// ─── Types ───────────────────────────────────────────────────────────────────

interface TmdbListResult {
  id: number
  title: string
  original_title: string
  original_language: string
  overview: string
  release_date: string
  poster_path: string | null
  backdrop_path: string | null
  genre_ids: number[]
  vote_average: number
  vote_count: number
  adult: boolean
}

interface TmdbListResponse {
  page: number
  results: TmdbListResult[]
  total_pages: number
  total_results: number
}

interface TmdbGenre { id: number; name: string }
interface TmdbProductionCountry { iso_3166_1: string; name: string }
interface TmdbCastMember { name: string; order: number }
interface TmdbCrewMember { name: string; job: string }
interface TmdbKeyword { id: number; name: string }

interface TmdbMovieDetail {
  id: number
  title: string
  original_title: string
  original_language: string
  overview: string
  release_date: string
  runtime: number | null
  vote_average: number
  vote_count: number
  adult: boolean
  poster_path: string | null
  backdrop_path: string | null
  genres: TmdbGenre[]
  production_countries: TmdbProductionCountry[]
  credits: { cast: TmdbCastMember[]; crew: TmdbCrewMember[] }
  keywords: { keywords: TmdbKeyword[] }
  external_ids: { imdb_id: string | null }
}

interface FilmInsertRow {
  tmdb_id: number
  title: string
  original_title: string
  original_language: string
  overview: string
  /**
   * 078 sonrasi kolon `date`. Bos string YAZILAMAZ — PostgREST 400 / PG 22007
   * "invalid input syntax for type date" dondurur ve TUM satir insert'i patlar.
   * Tarih yoksa dogru deger NULL'dur.
   */
  release_date: string | null
  year: number | null
  runtime: number | null
  vote_average: number
  genres: string[]
  poster_url: string | null
  backdrop_url: string | null
  director: string | null
  country: string[] | null
  cast: string[]
  tmdb_keywords: string[]
  imdb_id: string | null
  imdb_rating: null
  /** Daima null — bkz. detailToRow. Tip regresyonu derleme aninda yakalar. */
  imdb_votes: null
  metascore: null
  oscar_wins: number
  oscar_nominations: number
  content_rating: null
  curation_tier: string
  trending_type: string
  trending_added_at: string
  metadata_json: Record<string, unknown>
}

interface SyncError {
  tmdb_id: number
  title: string
  step: string
  error: string
}

// ─── Supabase Admin ──────────────────────────────────────────────────────────

/**
 * Service-role client factory.
 *
 * `ReturnType<typeof createClient>` KULLANILMAZ: generic'leri varsayilanlariyla
 * ornekler ve `never`-sekilli varyanti uretir — `createClient(url, key)`in
 * gercekte dondurdugu tip o degildir. Bu dosyanin uretttigi 10 typecheck
 * hatasinin tamami o desenden geliyordu. Desen: winback-sequencer/index.ts:100.
 */
function makeServiceClient(url: string, key: string) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type ServiceClient = ReturnType<typeof makeServiceClient>

let _admin: ServiceClient | null = null
function getAdmin(): ServiceClient {
  if (!_admin) {
    _admin = makeServiceClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
  }
  return _admin
}

/**
 * `pre_trending_tier`e yazilabilecek degerler — 078'in
 * films_pre_trending_tier_check kisitiyla birebir ayni kume.
 * `'trending'` bilerek YOK: cift promosyonda film kendi trending durumunu
 * "onceki tier" sanip kalici olarak kilitlenirdi.
 */
const RESTORABLE_TIERS = ['core', 'extended', 'archive']

// ─── TMDB Client ─────────────────────────────────────────────────────────────

let lastTmdbRequest = 0

/** Rate-limited TMDB GET with single retry on 429 */
async function tmdbGet<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = Deno.env.get('TMDB_API_KEY')
  if (!apiKey) throw new Error('TMDB_API_KEY not set')

  // Rate limit
  const now = Date.now()
  const elapsed = now - lastTmdbRequest
  if (elapsed < TMDB_DELAY_MS) {
    await new Promise(r => setTimeout(r, TMDB_DELAY_MS - elapsed))
  }

  const url = new URL(`${TMDB_BASE}${endpoint}`)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('language', 'en-US')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  lastTmdbRequest = Date.now()
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  })

  if (res.status === 429) {
    console.warn('TMDB rate limit hit, waiting 10s...')
    await new Promise(r => setTimeout(r, 10_000))
    lastTmdbRequest = Date.now()
    const retry = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    })
    if (!retry.ok) throw new Error(`TMDB ${retry.status} ${retry.statusText} — ${endpoint}`)
    return (await retry.json()) as T
  }

  if (!res.ok) throw new Error(`TMDB ${res.status} ${res.statusText} — ${endpoint}`)
  return (await res.json()) as T
}

// ─── detailToRow — ported from scripts/add-missing-films.ts ──────────────────

function detailToRow(
  detail: TmdbMovieDetail,
  trendingType: 'weekly_trending' | 'upcoming',
): FilmInsertRow {
  const directors = detail.credits.crew
    .filter((cr) => cr.job === 'Director')
    .map((cr) => cr.name)

  const cast = detail.credits.cast
    .sort((a, b) => a.order - b.order)
    .slice(0, 8)
    .map((a) => a.name)

  const keywords = detail.keywords.keywords.map((k) => k.name)
  const countries = detail.production_countries.map((pc) => pc.iso_3166_1)

  // TMDb tarihsiz filmde `undefined` DEGIL bos string dondurur — bu yuzden
  // eski `detail.release_date ?? ''` ifadesi olu koddu, `??` `''`i yakalamaz.
  // Tek dogru normalizasyon: trim edilince bos kalan her sey NULL.
  const releaseDate = detail.release_date?.trim() ? detail.release_date : null
  const year = releaseDate ? parseInt(releaseDate.slice(0, 4), 10) || null : null

  return {
    tmdb_id: detail.id,
    title: detail.title,
    original_title: detail.original_title,
    original_language: detail.original_language,
    overview: detail.overview,
    release_date: releaseDate,
    year,
    runtime: detail.runtime,
    vote_average: detail.vote_average,
    genres: detail.genres.map((g) => g.name),
    poster_url: detail.poster_path ? `${TMDB_IMAGE_BASE}${detail.poster_path}` : null,
    backdrop_url: detail.backdrop_path ? `${TMDB_IMAGE_BASE}${detail.backdrop_path}` : null,
    director: directors[0] ?? null,
    country: countries.length > 0 ? countries : null,
    cast,
    tmdb_keywords: keywords,
    imdb_id: detail.external_ids?.imdb_id ?? null,
    imdb_rating: null,
    // 0 gercek deger gibi gorunur ve taninirlik yuzdeligini bozar; bilinmeyen
    // deger NULL'dur. Ayrica buraya daha once TMDb'nin vote_count'u yaziliyordu
    // — o farkli bir metriktir, imdb_votes'un tek kaynagi OMDb'dir
    // (scripts/lib/omdb-client.ts). Ham TMDb sayisi metadata_json.vote_count'ta
    // korunuyor; IMDb oyu OMDb enrichment ile doldurulur.
    imdb_votes: null,
    metascore: null,
    oscar_wins: 0,
    oscar_nominations: 0,
    content_rating: null,
    curation_tier: 'trending',
    trending_type: trendingType,
    // Bu satir YALNIZCA yeni filmler icin uretilir; film gercekten bugun
    // trending'e giriyor, dolayisiyla `now` dogru deger.
    //
    // `pre_trending_tier` bilerek YOK: yeni filmin oncesi de yoktur, kolon
    // default NULL kalir ve film duserken COALESCE(NULL,'archive') = archive
    // olur. Ayrica upsert'un onConflict yolunda payload'da olmayan kolona
    // dokunulmaz — mevcut bir satirin saklanmis tier'i ezilmez.
    trending_added_at: new Date().toISOString(),
    metadata_json: {
      genre_ids: detail.genres.map((g) => g.id),
      production_countries: countries,
      vote_count: detail.vote_count,
      source: 'sync-trending',
      added_at: new Date().toISOString(),
    },
  }
}

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  /**
   * Service-role kapısı (C.0b). Çağıran `weekly-trending-sync` cron'udur —
   * bir kullanıcı değil, sistemin kendisi. Bu yüzden `requireUser` DEĞİL.
   *
   * `verify_jwt = false` olduğu için gateway hiçbir doğrulama yapmıyor;
   * doğrulama tamamen burada. Gerekçenin tamamı: `_shared/auth.ts`.
   *
   * CORS map'i boş: bu fonksiyon tarayıcıdan çağrılmaz, dosyada hiç OPTIONS
   * işleyicisi yok. Header eklemek olmayan bir çağrı sınıfına izin verir gibi
   * görünürdü — `generate-puzzles` ile aynı gerekçe, bilinçli olarak boş.
   *
   * Parametre daha önce `_req` idi (istek hiç okunmuyordu); kapı onu okuduğu
   * için `req` oldu. İş mantığı değişmedi.
   */
  const svc = await requireServiceRole(req)
  if (!svc.ok) return unauthorizedResponse(svc, {})

  const startTime = Date.now()
  const errors: SyncError[] = []
  const syncedTmdbIds: number[] = []
  let newFilmsInserted = 0
  let existingFilmsUpdated = 0
  let placeholdersCreated = 0
  /** Guncellemesi patlayip yine de arsivden korunan film sayisi (Bug 3). */
  let protectedFromArchive = 0
  /** Yeni film insert'i basarisiz olan vaka sayisi (1.8). */
  let insertFailures = 0
  /** RESTORABLE_TIERS disinda tier ile karsilasilan film sayisi. */
  let unexpectedTierCount = 0
  /** Duserken 'archive' yerine onceki tier'ina geri donen film sayisi. */
  let restoredToPrevTier = 0

  try {
    const admin = getAdmin()

    // ─── 1. Fetch trending + upcoming from TMDB (3 list calls) ──────────

    console.log('Fetching TMDB lists...')
    const [trending1, trending2, upcoming1] = await Promise.all([
      tmdbGet<TmdbListResponse>('/trending/movie/week', { page: '1' }),
      tmdbGet<TmdbListResponse>('/trending/movie/week', { page: '2' }),
      tmdbGet<TmdbListResponse>('/movie/upcoming', { region: 'US', page: '1' }),
    ])

    // Combine + deduplicate by tmdb_id
    const filmMap = new Map<number, { result: TmdbListResult; trendingType: 'weekly_trending' | 'upcoming' }>()

    for (const r of trending1.results) {
      if (!r.adult) filmMap.set(r.id, { result: r, trendingType: 'weekly_trending' })
    }
    for (const r of trending2.results) {
      if (!r.adult && !filmMap.has(r.id)) filmMap.set(r.id, { result: r, trendingType: 'weekly_trending' })
    }
    for (const r of upcoming1.results) {
      if (!r.adult && !filmMap.has(r.id)) filmMap.set(r.id, { result: r, trendingType: 'upcoming' })
    }

    console.log(`Total unique films: ${filmMap.size}`)

    // ─── 2. Batch check which tmdb_ids already exist ────────────────────

    const allTmdbIds = [...filmMap.keys()]
    const existingFilms = new Map<
      number,
      { id: string; curation_tier: string | null; pre_trending_tier: string | null }
    >()

    // `pre_trending_tier` de okunuyor: cift promosyonda mevcut degerin
    // KORUNMASI gerekiyor, ustune yazilmasi degil (bkz. adim 3).
    const { data: existRows, error: lookupErr } = await admin
      .from('films')
      .select('id, tmdb_id, curation_tier, pre_trending_tier')
      .in('tmdb_id', allTmdbIds)

    if (lookupErr) throw new Error(`DB lookup: ${lookupErr.message}`)

    for (const row of existRows ?? []) {
      existingFilms.set(row.tmdb_id as number, {
        id: row.id as string,
        curation_tier: row.curation_tier as string | null,
        pre_trending_tier: row.pre_trending_tier as string | null,
      })
    }

    console.log(`Existing in DB: ${existingFilms.size} / ${filmMap.size}`)

    // ─── 3. Update existing films (batch update) ────────────────────────

    const now = new Date().toISOString()
    const existingEntries = [...filmMap.entries()].filter(([id]) => existingFilms.has(id))

    for (const [tmdbId, { trendingType }] of existingEntries) {
      const title = filmMap.get(tmdbId)!.result.title
      try {
        const existing = existingFilms.get(tmdbId)!
        const cur = existing.curation_tier

        // ── Tier mandali ────────────────────────────────────────────────
        let nextPre: string | null
        if (cur === 'trending') {
          // CIFT PROMOSYON KORUMASI. Film zaten trending — saklanmis degeri
          // KORU. Buraya 'trending' yazmak 078'in CHECK'ini patlatir; kisit
          // olmasaydi bile film kendi trending durumunu "onceki tier" sanip
          // dustugunde trending'de kalirdi.
          nextPre = existing.pre_trending_tier
        } else if (cur !== null && RESTORABLE_TIERS.includes(cur)) {
          nextPre = cur
        } else {
          // Beklenmedik tier = yalnizca NULL olabilir. films_curation_tier_check
          // diger tum degerleri reddediyor; CHECK NULL'da gecer ve kolon nullable.
          // Olcum (13 Agu 2026): NULL tier film sayisi = 0. Bu dal savunma amaclidir.
          // 079'da curation_tier NOT NULL yapilirsa dal tamamen erisilemez hale gelir.
          nextPre = null
          unexpectedTierCount++
          await sentryCapture({
            level: 'warning',
            message: 'sync-trending: beklenmeyen curation_tier, pre_trending_tier NULL yazildi',
            tags: { function: 'sync-trending', step: 'promote' },
            extra: { tmdb_id: tmdbId, title, curation_tier: cur },
          })
        }

        const patch: {
          curation_tier: string
          trending_type: string
          pre_trending_tier: string | null
          trending_added_at?: string
        } = {
          curation_tier: 'trending',
          trending_type: trendingType,
          pre_trending_tier: nextPre,
        }

        // `trending_added_at` YALNIZCA yeni giriste yazilir. Her kosumda
        // yenilemek "ne zamandir trending" bilgisini siler; kolonun tuketicisi
        // app/(tabs)/mood.tsx:62 buna gore siraliyor ve 079 yas analizinde
        // gerekiyor.
        if (cur !== 'trending') patch.trending_added_at = now

        const { error: updateError } = await admin
          .from('films')
          .update(patch)
          .eq('id', existing.id)

        if (updateError) throw new Error(updateError.message)
        existingFilmsUpdated++
        syncedTmdbIds.push(tmdbId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push({ tmdb_id: tmdbId, title, step: 'update', error: msg })

        // BUG 3 KORUMASI. Film DB'de hala `trending` ama guncellemesi patladi.
        // `syncedTmdbIds`e girmezse adim 5 onu "artik trending degil" sayip
        // arsivler — yani gecici bir yazma hatasi filmi gauntlet havuzundan
        // kalici olarak dusururdu (gauntletCore.ts:227, archive havuz disi).
        // Bu SESSIZ bir gecis DEGIL: hata Sentry'ye ve kosum raporuna gidiyor.
        syncedTmdbIds.push(tmdbId)
        protectedFromArchive++

        await sentryCapture({
          level: 'error',
          message: `sync-trending: film guncellemesi basarisiz — ${msg}`,
          tags: { function: 'sync-trending', step: 'update' },
          extra: { tmdb_id: tmdbId, title, protected_from_archive: true },
        })
      }
    }

    console.log(`Updated ${existingFilmsUpdated} existing films`)

    // ─── 4. Fetch details + insert new films (parallel batches of 5) ────

    const newEntries = [...filmMap.entries()].filter(([id]) => !existingFilms.has(id))
    console.log(`New films to fetch: ${newEntries.length}`)

    for (let i = 0; i < newEntries.length; i += PARALLEL_DETAIL_BATCH) {
      const batch = newEntries.slice(i, i + PARALLEL_DETAIL_BATCH)

      const results = await Promise.allSettled(
        batch.map(async ([tmdbId, { result, trendingType }]) => {
          // Fetch full detail
          const detail = await tmdbGet<TmdbMovieDetail>(
            `/movie/${tmdbId}`,
            { append_to_response: 'credits,keywords,external_ids' },
          )

          // Quality filters
          if (!detail.poster_path) {
            console.warn(`Skip ${tmdbId} "${detail.title}" — no poster`)
            return { tmdbId, skipped: true as const }
          }
          if (detail.runtime !== null && detail.runtime < 60) {
            console.warn(`Skip ${tmdbId} "${detail.title}" — runtime ${detail.runtime}m`)
            return { tmdbId, skipped: true as const }
          }

          // Insert film row
          const row = detailToRow(detail, trendingType)
          const { data: inserted, error: insertError } = await admin
            .from('films')
            .upsert(row, { onConflict: 'tmdb_id' })
            .select('id')
            .single()

          if (insertError) throw new Error(`Insert ${tmdbId}: ${insertError.message}`)

          // Create placeholder film_profile (vector profiling runs separately)
          if (inserted) {
            await admin
              .from('film_profiles')
              .upsert(
                { film_id: inserted.id, profile_vector: null, dimensions_json: null },
                { onConflict: 'film_id' },
              )
          }

          return { tmdbId, skipped: false as const, title: detail.title, uuid: inserted?.id }
        }),
      )

      for (let j = 0; j < results.length; j++) {
        const r = results[j]
        const [tmdbId, { result }] = batch[j]

        if (r.status === 'fulfilled') {
          if (!r.value.skipped) {
            newFilmsInserted++
            placeholdersCreated++
          }
          syncedTmdbIds.push(tmdbId)
        } else {
          const msg = r.reason instanceof Error ? r.reason.message : String(r.reason)
          console.error(`Failed ${tmdbId} "${result.title}": ${msg}`)
          errors.push({ tmdb_id: tmdbId, title: result.title, step: 'insert', error: msg })
          insertFailures++

          // Bu yolda arsiv riski YOK (basarisiz yeni film DB'de hic olusmadi,
          // adim 5 onu goremez), bu yuzden `syncedTmdbIds`e eklenmiyor. Ama
          // sessiz de kalmiyor: tarihsiz filmlerin 22007 ile dusup kimsenin
          // bakmamasi tam olarak boyle olmustu.
          await sentryCapture({
            level: 'error',
            message: `sync-trending: yeni film eklenemedi — ${msg}`,
            tags: { function: 'sync-trending', step: 'insert' },
            extra: { tmdb_id: tmdbId, title: result.title },
          })
        }
      }

      console.log(`Detail batch ${Math.floor(i / PARALLEL_DETAIL_BATCH) + 1}/${Math.ceil(newEntries.length / PARALLEL_DETAIL_BATCH)} done`)
    }

    // ─── 5. Archive old trending films ──────────────────────────────────

    let archivedCount = 0

    if (syncedTmdbIds.length > 0) {
      const { data: toArchive, error: findError } = await admin
        .from('films')
        .select('id, tmdb_id, title, pre_trending_tier')
        .eq('curation_tier', 'trending')
        .not('tmdb_id', 'in', `(${syncedTmdbIds.join(',')})`)

      if (findError) {
        console.error('Archive query error:', findError.message)
        errors.push({ tmdb_id: 0, title: 'archive-query', step: 'archive', error: findError.message })
        await sentryCapture({
          level: 'error',
          message: `sync-trending: arsiv sorgusu basarisiz — ${findError.message}`,
          tags: { function: 'sync-trending', step: 'archive' },
        })
      } else if (toArchive && toArchive.length > 0) {
        // COALESCE(pre_trending_tier, 'archive'). Tek `UPDATE ... IN (ids)`
        // satir basina farkli deger yazamaz, bu yuzden filmler hedef tier'a
        // gore kovalanip kova basina tek UPDATE atiliyor — en fazla 3 sorgu.
        const buckets = new Map<string, string[]>()
        for (const row of toArchive) {
          const prev = row.pre_trending_tier as string | null
          const target = prev !== null && RESTORABLE_TIERS.includes(prev) ? prev : 'archive'
          const list = buckets.get(target) ?? []
          list.push(row.id as string)
          buckets.set(target, list)
        }

        for (const [target, ids] of buckets) {
          const { error: archiveError } = await admin
            .from('films')
            .update({
              curation_tier: target,
              trending_type: null,
              // Bayat deger kalmasin: film artik trending degil, saklanmis
              // "onceki tier"i de anlamini yitirdi.
              pre_trending_tier: null,
            })
            .in('id', ids)

          if (archiveError) {
            console.error(`Demote update error (${target}):`, archiveError.message)
            errors.push({ tmdb_id: 0, title: `demote-${target}`, step: 'archive', error: archiveError.message })
            await sentryCapture({
              level: 'error',
              message: `sync-trending: trending'den dusurme basarisiz (${target}) — ${archiveError.message}`,
              tags: { function: 'sync-trending', step: 'archive' },
              extra: { target_tier: target, film_count: ids.length },
            })
          } else {
            archivedCount += ids.length
            if (target !== 'archive') restoredToPrevTier += ids.length
            console.log(`Demoted ${ids.length} films → ${target}`)
          }
        }
      }
    }

    // ─── 6. Result ──────────────────────────────────────────────────────

    const durationMs = Date.now() - startTime
    const result = {
      success: true,
      duration_ms: durationMs,
      synced_total: syncedTmdbIds.length,
      existing_updated: existingFilmsUpdated,
      new_inserted: newFilmsInserted,
      placeholders_created: placeholdersCreated,
      /** Trending'den dusurulen toplam film (archive + onceki tier'ina donenler). */
      demoted: archivedCount,
      /** Onceki tier'ina geri yuklenenler — pre_trending_tier mandali calisti. */
      restored_to_prev_tier: restoredToPrevTier,
      /** Guncellemesi patlayip yine de arsivden korunanlar (Bug 3). */
      protected_from_archive: protectedFromArchive,
      insert_failures: insertFailures,
      unexpected_tier: unexpectedTierCount,
      errors_count: errors.length,
      errors: errors.slice(0, 20),
      needs_profiling: newFilmsInserted > 0,
      // `--only-missing` DEGIL: girdisini films-raw.json'dan alir ve bu
      // fonksiyonun ekledigi filmler o dosyada yoktur.
      profiling_hint: newFilmsInserted > 0
        ? 'Run: npx tsx scripts/ai-profile-films.ts --from-db'
        : null,
      timestamp: new Date().toISOString(),
    }

    if (errors.length > 0) {
      console.error(`Sync completed with ${errors.length} errors`)
      // Tekil vakalar zaten yakalandi; bu kosum duzeyinde bir ozet sinyal.
      // Gerekcesi: tarihsiz filmlerin 22007 ile sessizce dusup haftalarca
      // kimsenin bakmamasi tam olarak boyle olmustu.
      await sentryCapture({
        level: 'warning',
        message: `sync-trending: kosum ${errors.length} hatayla tamamlandi`,
        tags: { function: 'sync-trending', step: 'summary' },
        extra: {
          errors_count: errors.length,
          insert_failures: insertFailures,
          protected_from_archive: protectedFromArchive,
          unexpected_tier: unexpectedTierCount,
          first_errors: errors.slice(0, 10),
        },
      })
    }

    console.log(
      `Sync complete: ${result.synced_total} synced, ` +
      `${result.new_inserted} new, ${result.demoted} demoted ` +
      `(${result.restored_to_prev_tier} restored), ` +
      `${result.errors_count} errors, ${durationMs}ms`,
    )

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('sync-trending fatal error:', msg)

    // 500 doner ama cron `net.http_post` yaniti OKUMUYOR — yani bu hata
    // sessiz degil, sadece gorunmez. Sentry tek gorunur kanal.
    //
    // `.catch(() => {})` sarmalayicisi BILEREK YOK: sentryCapture kendi
    // govdesini try/catch icine aliyor (_shared/sentry.ts:25-63) ve
    // `Promise<void>` donuyor — cagirana hicbir kosulda throw etmez.
    // Ekstra koruma bos catch olurdu (CLAUDE.md kural 2).
    await sentryCapture({
      level: 'fatal',
      message: `sync-trending: kosum fatal hata ile sonlandi — ${msg}`,
      tags: { function: 'sync-trending', step: 'fatal' },
      extra: { partial_errors: errors.length },
    })

    return new Response(
      JSON.stringify({
        success: false,
        error: msg,
        errors,
        synced_total: syncedTmdbIds.length,
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
