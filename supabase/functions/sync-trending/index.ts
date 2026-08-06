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
 *   npx tsx scripts/ai-profile-films.ts --only-missing
 *
 * Deploy: supabase functions deploy sync-trending --no-verify-jwt
 * Cron: Her Pazartesi 06:00 UTC (pg_cron ile)
 *
 * Secrets: TMDB_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  release_date: string
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

let _admin: ReturnType<typeof createClient> | null = null
function getAdmin(): ReturnType<typeof createClient> {
  if (!_admin) {
    _admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  }
  return _admin
}

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
  const year = detail.release_date
    ? parseInt(detail.release_date.slice(0, 4), 10) || null
    : null

  return {
    tmdb_id: detail.id,
    title: detail.title,
    original_title: detail.original_title,
    original_language: detail.original_language,
    overview: detail.overview,
    release_date: detail.release_date ?? '',
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

serve(async (_req: Request) => {
  const startTime = Date.now()
  const errors: SyncError[] = []
  const syncedTmdbIds: number[] = []
  let newFilmsInserted = 0
  let existingFilmsUpdated = 0
  let placeholdersCreated = 0

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
    const existingFilms = new Map<number, { id: string; curation_tier: string }>()

    const { data: existRows, error: lookupErr } = await admin
      .from('films')
      .select('id, tmdb_id, curation_tier')
      .in('tmdb_id', allTmdbIds)

    if (lookupErr) throw new Error(`DB lookup: ${lookupErr.message}`)

    for (const row of existRows ?? []) {
      existingFilms.set(row.tmdb_id as number, {
        id: row.id as string,
        curation_tier: row.curation_tier as string,
      })
    }

    console.log(`Existing in DB: ${existingFilms.size} / ${filmMap.size}`)

    // ─── 3. Update existing films (batch update) ────────────────────────

    const now = new Date().toISOString()
    const existingEntries = [...filmMap.entries()].filter(([id]) => existingFilms.has(id))

    for (const [tmdbId, { trendingType }] of existingEntries) {
      try {
        const existing = existingFilms.get(tmdbId)!
        const { error: updateError } = await admin
          .from('films')
          .update({
            curation_tier: 'trending',
            trending_type: trendingType,
            trending_added_at: now,
          })
          .eq('id', existing.id)

        if (updateError) throw new Error(updateError.message)
        existingFilmsUpdated++
        syncedTmdbIds.push(tmdbId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push({ tmdb_id: tmdbId, title: filmMap.get(tmdbId)!.result.title, step: 'update', error: msg })
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
        }
      }

      console.log(`Detail batch ${Math.floor(i / PARALLEL_DETAIL_BATCH) + 1}/${Math.ceil(newEntries.length / PARALLEL_DETAIL_BATCH)} done`)
    }

    // ─── 5. Archive old trending films ──────────────────────────────────

    let archivedCount = 0

    if (syncedTmdbIds.length > 0) {
      const { data: toArchive, error: findError } = await admin
        .from('films')
        .select('id, tmdb_id, title')
        .eq('curation_tier', 'trending')
        .not('tmdb_id', 'in', `(${syncedTmdbIds.join(',')})`)

      if (findError) {
        console.error('Archive query error:', findError.message)
        errors.push({ tmdb_id: 0, title: 'archive-query', step: 'archive', error: findError.message })
      } else if (toArchive && toArchive.length > 0) {
        const archiveIds = toArchive.map(r => r.id as string)

        const { error: archiveError } = await admin
          .from('films')
          .update({ curation_tier: 'archive', trending_type: null })
          .in('id', archiveIds)

        if (archiveError) {
          console.error('Archive update error:', archiveError.message)
          errors.push({ tmdb_id: 0, title: 'archive-update', step: 'archive', error: archiveError.message })
        } else {
          archivedCount = toArchive.length
          console.log(`Archived ${archivedCount} old trending films`)
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
      archived: archivedCount,
      errors_count: errors.length,
      errors: errors.slice(0, 20),
      needs_profiling: newFilmsInserted > 0,
      profiling_hint: newFilmsInserted > 0
        ? 'Run: npx tsx scripts/ai-profile-films.ts --only-missing'
        : null,
      timestamp: new Date().toISOString(),
    }

    if (errors.length > 0) {
      console.error(`Sync completed with ${errors.length} errors`)
    }

    console.log(
      `Sync complete: ${result.synced_total} synced, ` +
      `${result.new_inserted} new, ${result.archived} archived, ` +
      `${result.errors_count} errors, ${durationMs}ms`,
    )

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('sync-trending fatal error:', msg)

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
