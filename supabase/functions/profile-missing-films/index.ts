/**
 * Edge Function: profile-missing-films  (GATE 3)
 *
 * Vektorsuz kalan filmleri Claude Haiku 4.5 ile profiller ve
 * `film_profiles.profile_vector` alanini doldurur.
 *
 * ── Neden var ───────────────────────────────────────────────────────────────
 * `sync-trending` her kosumda yeni filmler icin PLACEHOLDER `film_profiles`
 * satiri aciyor (profile_vector NULL) ve dolduran bir otomasyon yoktu.
 * Vektorsuz film `match_films_v*` icin GORUNMEZ, yani gauntlet havuzuna
 * hic girmiyor. 13 Agu 2026 olcumu: core+extended+trending 1867 filmin
 * 10'u vektorsuz ve 10'unun da tamami `sync-trending`in acdigi satirlar.
 *
 * ── Tek kaynak ──────────────────────────────────────────────────────────────
 * Prompt, dogrulama, model ve surum etiketi `services/filmProfilePrompt.ts`
 * modulunden gelir — `scripts/ai-profile-films.ts` ile ORTAK. Kopya YOK.
 * 384 boyutlu kodlama `services/vectorEncoder.ts` (tekil kaynak).
 *
 * ── Guvenlik ────────────────────────────────────────────────────────────────
 * `requireServiceRole()` ile korunur; yalnizca cron (Vault'tan okunan
 * service key ile) cagirabilir.
 *
 * ── Sessiz fallback YASAK ───────────────────────────────────────────────────
 * Her kosum Sentry'ye bir sinyal birakir — 0 film islense bile. "Cron kostu
 * ama isleyecek film yoktu" ile "cron hic kosmadi" ayrimi ancak boyle
 * yapilabilir; ikincisi sessiz bir olu cron demektir ve tam da bu
 * fonksiyonun var olma sebebidir.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

import { tasteProfileToVector } from '../../../services/vectorEncoder.ts'
import {
  CLAUDE_MODEL,
  PROFILING_METHOD,
  PROFILING_SYSTEM_PROMPT,
  buildPrompt,
  validateAndConvert,
  type RawFilmJSON,
  type LLMProfileResponse,
} from '../../../services/filmProfilePrompt.ts'
import { requireServiceRole, unauthorizedResponse } from '../_shared/auth.ts'
import { sentryCapture } from '../_shared/sentry.ts'

// ─── Config ──────────────────────────────────────────────────────────────────

/**
 * Kosum basina ust sinir. Olculmemis bir hacimde sinirsiz AI cagrisi
 * yapilmaz: bir gun tier degisimi 500 filmi vektorsuz birakirsa bu tavan
 * maliyeti tek kosumda ~$0.10 seviyesinde tutar, kalani haftaya kalir.
 *
 * NOT: bilerek sabit. `app_config` lazy getter'a tasima ayri bir istir
 * (borc) — bu turda kapsamda degil.
 */
const MAX_FILMS_PER_RUN = 50

/** CLI ile ayni: 5 paralel istek, partiler arasi 400ms. */
const BATCH_CONCURRENCY = 5
const BATCH_DELAY_MS = 400

/** PostgREST sayfa boyutu (varsayilan ust sinir 1000). */
const PAGE = 1000

/** Havuza giren tier'lar — GATE 3 olcum sorgusuyla ayni kume. */
const POOL_TIERS = ['core', 'extended', 'trending'] as const

const FUNCTION_TAG = 'profile-missing-films'

/** Prompt icin gereken kolonlar. */
const FILM_COLUMNS =
  'id, tmdb_id, title, original_title, original_language, overview, release_date, ' +
  'runtime, vote_average, genres, country, director, cast, tmdb_keywords, imdb_id, ' +
  'poster_url, backdrop_url, imdb_rating, imdb_votes, metascore, oscar_wins, ' +
  'oscar_nominations, content_rating, metadata_json'

// ─── Supabase istemcisi ──────────────────────────────────────────────────────

/**
 * `ReturnType<typeof createClient>` KULLANILMAZ: generic'leri
 * varsayilanlariyla ornekler ve `never`-sekilli varyanti uretir.
 * Desen: sync-trending/index.ts:149.
 */
function makeServiceClient(url: string, key: string) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type ServiceClient = ReturnType<typeof makeServiceClient>

// ─── Film secimi ─────────────────────────────────────────────────────────────

/**
 * ONCEKI YAKLASIM (deno-postgres, terk edildi): tek ham SQL, LEFT JOIN ile
 * film_profiles.profile_vector IS NULL. deno-postgres@0.17'nin SCRAM
 * uygulamasi SASLprep icermiyor, DB parolasi ASCII disi karakter tasidigi
 * icin baglanti kurulamiyor (olcum: 13 Agu, iki bagimsiz deneme — ham URL
 * ve elle decodeURIComponent, ikisi de ayni hatayla dustu).
 *
 * BU YAKLASIM (PostgREST, CLI ai-profile-films.ts --from-db ile AYNI desen):
 * film_profiles'i sayfalayarak cek, dolu olan film_id'lerin kumesini kur,
 * films'i cek, kumede olmayanlari filtrele. Sonuc kumesi GATE 3'un ham
 * SQL'iyle ESDEGERDIR ama ifade bicimi farklidir — tek sorguda degil,
 * uygulama katmaninda kesisiyor.
 *
 * Referans (GATE 3 adim 0.3):
 *   SELECT count(*) FROM films f
 *   LEFT JOIN film_profiles fp ON fp.film_id = f.id
 *   WHERE f.curation_tier IN ('core','extended','trending')
 *     AND fp.profile_vector IS NULL;
 *
 * Esdegerlik: tier'daki film id'lerinden, vektoru DOLU olanlari cikariyoruz.
 * Geriye kalan iki durumu da kapsar — (1) profil satiri var ama vektor NULL,
 * (2) profil satiri hic yok. LEFT JOIN'in yakaladigi kume tam olarak budur.
 *
 * CLI'den TEK SAPMA: CLI `profile_vector`i de cekiyor (`film_id,
 * profile_vector`) ve doluluga JS tarafinda bakiyor. Burada filtre sunucuda
 * (`profile_vector=not.is.null`), yalnizca id'ler tasiniyor. Sonuc ayni;
 * gerekce bellek: 3400 x 384 float'i Edge runtime'ina cekmek gereksiz ve
 * riskli.
 */
async function fetchPendingFilmIds(sb: ServiceClient): Promise<string[]> {
  // Havuz tier'larindaki tum film id'leri — deterministik siralama.
  const tierIds: string[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('films')
      .select('id')
      .in('curation_tier', POOL_TIERS as unknown as string[])
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`films query: ${error.message}`)
    if (!data || data.length === 0) break
    tierIds.push(...data.map((r) => r.id as string))
    if (data.length < PAGE) break
  }

  // Vektoru DOLU olan film_id'ler.
  const hasVector = new Set<string>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('film_profiles')
      .select('film_id')
      .not('profile_vector', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`film_profiles query: ${error.message}`)
    if (!data || data.length === 0) break
    for (const r of data) hasVector.add(r.film_id as string)
    if (data.length < PAGE) break
  }

  return tierIds.filter((id) => !hasVector.has(id))
}

interface DbFilmRow {
  id: string
  tmdb_id: number | null
  title: string
  original_title: string | null
  original_language: string | null
  overview: string | null
  release_date: string | null
  runtime: number | null
  vote_average: number | null
  genres: string[] | null
  country: string[] | null
  director: string | null
  cast: string[] | null
  tmdb_keywords: string[] | null
  imdb_id: string | null
  poster_url: string | null
  backdrop_url: string | null
  imdb_rating: number | null
  imdb_votes: number | null
  metascore: number | null
  oscar_wins: number | null
  oscar_nominations: number | null
  content_rating: string | null
  metadata_json: Record<string, unknown> | null
}

/**
 * DB satirini prompt'un bekledigi RawFilmJSON sekline donusturur.
 *
 * ⚠️ BORC: `scripts/ai-profile-films.ts` icindeki `dbRowToRawFilm` ile ayni
 * isi yapar. Ekstraksiyon kapsaminda degildi (onaylanan kume prompt +
 * dogrulama + model/surum idi), bu yuzden simdilik iki kopya var. Ayrisirsa
 * ayni film icin iki farkli prompt girdisi dogar — TEKNIK_BORC.md'de kayitli.
 */
function dbRowToRawFilm(row: DbFilmRow): RawFilmJSON {
  const voteCount = Number(row.metadata_json?.vote_count ?? 0)

  return {
    tmdb_id: row.tmdb_id ?? 0,
    title: row.title,
    original_title: row.original_title ?? row.title,
    original_language: row.original_language ?? 'en',
    overview: row.overview ?? '',
    release_date: row.release_date ?? '',
    runtime: row.runtime,
    vote_average: row.vote_average ?? 0,
    vote_count: isNaN(voteCount) ? 0 : voteCount,
    genres: (row.genres ?? []).map((name) => ({ id: 0, name })),
    production_countries: row.country ?? [],
    director: row.director,
    cast: row.cast ?? [],
    keywords: row.tmdb_keywords ?? [],
    imdb_id: row.imdb_id,
    poster_url: row.poster_url,
    backdrop_url: row.backdrop_url,
    country: row.country?.[0] ?? null,
    imdb_rating: row.imdb_rating,
    imdb_votes: row.imdb_votes,
    metascore: row.metascore,
    oscar_wins: row.oscar_wins ?? 0,
    oscar_nominations: row.oscar_nominations ?? 0,
    content_rating: row.content_rating,
  }
}

// ─── Claude ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Tek filmi profiller. Prompt ve dogrulama ortak modulden gelir —
 * burada YENIDEN YAZILMAZ.
 */
async function profileFilm(
  client: Anthropic,
  film: RawFilmJSON,
): Promise<{ vector: number[]; dimensions: unknown; reasoning: string }> {
  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    system: PROFILING_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPrompt(film) }],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  const content = textBlock?.type === 'text' ? textBlock.text : ''
  if (!content) throw new Error('No text content in Claude response')

  let jsonStr = content.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  let parsed: LLMProfileResponse
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error(`JSON parse failed: ${jsonStr.slice(0, 200)}`)
  }

  const { profile, reasoning } = validateAndConvert(parsed, film)
  return { vector: tasteProfileToVector(profile), dimensions: profile, reasoning }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // Yalnizca cron. Kullanici token'i kabul edilmez.
  const svc = await requireServiceRole(req)
  if (!svc.ok) return unauthorizedResponse(svc, {})

  const started = Date.now()

  try {
    // Ortam degiskenleri fail-closed: eksikse sessizce atlanmaz, patlar.
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!apiKey || !url || !serviceKey) {
      const missing = [
        !apiKey && 'ANTHROPIC_API_KEY',
        !url && 'SUPABASE_URL',
        !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY',
      ].filter(Boolean).join(', ')
      await sentryCapture({
        message: `[${FUNCTION_TAG}] Ortam degiskeni eksik: ${missing}`,
        level: 'fatal',
        tags: { function: FUNCTION_TAG },
      })
      return new Response(
        JSON.stringify({ error: 'MISSING_ENV', missing }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const sb = makeServiceClient(url, serviceKey)

    const pendingIds = await fetchPendingFilmIds(sb)
    const totalPending = pendingIds.length

    // ── 0 film: sessiz gecilmez ──────────────────────────────────────────────
    if (totalPending === 0) {
      await sentryCapture({
        message: `[${FUNCTION_TAG}] cron kostu, islenecek film yoktu`,
        level: 'info',
        tags: { function: FUNCTION_TAG, outcome: 'empty' },
        extra: { duration_ms: Date.now() - started },
      })
      return new Response(
        JSON.stringify({ processed: 0, failed: 0, pending: 0, outcome: 'empty' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Tavan: kalani bir sonraki kosuma birakilir.
    const batchIds = pendingIds.slice(0, MAX_FILMS_PER_RUN)

    const { data: filmRows, error: filmErr } = await sb
      .from('films')
      .select(FILM_COLUMNS)
      .in('id', batchIds)
    if (filmErr) throw new Error(`films detail query: ${filmErr.message}`)

    const films = ((filmRows ?? []) as unknown as DbFilmRow[]).map((r) => ({
      uuid: r.id,
      film: dbRowToRawFilm(r),
    }))

    const anthropic = new Anthropic({ apiKey })
    let processed = 0
    const failures: { title: string; error: string }[] = []

    for (let i = 0; i < films.length; i += BATCH_CONCURRENCY) {
      const batch = films.slice(i, i + BATCH_CONCURRENCY)

      await Promise.all(
        batch.map(async ({ uuid, film }) => {
          try {
            const { vector, dimensions, reasoning } = await profileFilm(anthropic, film)
            const { error } = await sb.from('film_profiles').upsert(
              {
                film_id: uuid,
                profile_vector: vector,
                dimensions_json: dimensions,
                profiling_method: PROFILING_METHOD,
                profiled_at: new Date().toISOString(),
                profiling_reasoning: reasoning,
              },
              { onConflict: 'film_id' },
            )
            if (error) throw new Error(`upsert: ${error.message}`)
            processed++
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            failures.push({ title: film.title, error: msg })
          }
        }),
      )

      if (i + BATCH_CONCURRENCY < films.length) await sleep(BATCH_DELAY_MS)
    }

    const pending = Math.max(0, totalPending - processed)

    // Basarisiz filmler sessiz gecilmez.
    if (failures.length > 0) {
      await sentryCapture({
        message: `[${FUNCTION_TAG}] ${failures.length} film profillenemedi`,
        level: 'error',
        tags: { function: FUNCTION_TAG, outcome: 'partial' },
        extra: { failures: failures.slice(0, 20), processed, pending },
      })
    }

    await sentryCapture({
      message: `[${FUNCTION_TAG}] ${processed} film islendi, ${pending} film bekliyor`,
      level: 'info',
      tags: { function: FUNCTION_TAG, outcome: pending > 0 ? 'capped' : 'drained' },
      extra: {
        processed,
        failed: failures.length,
        pending,
        total_pending: totalPending,
        cap: MAX_FILMS_PER_RUN,
        duration_ms: Date.now() - started,
      },
    })

    return new Response(
      JSON.stringify({
        processed,
        failed: failures.length,
        pending,
        total_pending: totalPending,
        cap: MAX_FILMS_PER_RUN,
        outcome: pending > 0 ? 'capped' : 'drained',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await sentryCapture({
      message: `[${FUNCTION_TAG}] FATAL: ${msg}`,
      level: 'fatal',
      tags: { function: FUNCTION_TAG },
    })
    return new Response(
      JSON.stringify({ error: 'INTERNAL', message: msg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
