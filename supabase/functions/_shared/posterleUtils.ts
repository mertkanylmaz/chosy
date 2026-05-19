/**
 * Shared utilities for Posterle edge functions.
 *
 * Adapted from posterle-backend spec to match MoodFlix schema:
 * - films.id is UUID (not BIGINT)
 * - users.auth_id = auth.uid()::text (not users.id = auth.uid())
 * - Column mapping: overview (not plot), year (not release_date), cast_json (not cast)
 */

import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ----------------------------------------------------------------------------
// CORS
// ----------------------------------------------------------------------------

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}

// ----------------------------------------------------------------------------
// Response helpers
// ----------------------------------------------------------------------------

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
}

export function errorResponse(
  code: string,
  message: string,
  status = 400,
  extra: Record<string, unknown> = {}
): Response {
  return jsonResponse({ error: code, message, ...extra }, status)
}

// ----------------------------------------------------------------------------
// Supabase clients
// ----------------------------------------------------------------------------

/** User-context client: respects RLS, uses caller's JWT. */
export function getUserClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new AuthError('Missing Authorization header')
  }

  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    }
  )
}

/** Service-role client: bypasses RLS for trusted server-side operations. */
export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )
}

// ----------------------------------------------------------------------------
// Auth — resolves Supabase auth.uid() to app user
// ----------------------------------------------------------------------------

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

/** Auth user from JWT. Returns Supabase auth UUID. */
export async function requireAuthUser(
  client: SupabaseClient
): Promise<{ authUid: string }> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser()

  if (error || !user) {
    throw new AuthError(error?.message ?? 'Not authenticated')
  }

  return { authUid: user.id }
}

/**
 * Resolves Supabase auth UID to app user (users table).
 * MoodFlix uses a separate users table where auth_id = auth.uid()::text.
 */
export async function resolveAppUser(
  service: SupabaseClient,
  authUid: string
): Promise<{ id: string; archetype: string | null }> {
  const { data, error } = await service
    .from('users')
    .select('id, archetype')
    .eq('auth_id', authUid)
    .single()

  if (error || !data) {
    throw new AuthError('App user not found for auth_id: ' + authUid)
  }

  return { id: data.id, archetype: data.archetype ?? null }
}

// ----------------------------------------------------------------------------
// Film data mapper — converts DB row to hint-friendly format
// ----------------------------------------------------------------------------

/** Raw film row from Supabase query (actual column names) */
export interface FilmRow {
  id: string // UUID
  tmdb_id: number
  title: string
  year: number | null
  poster_url: string | null
  overview: string | null
  genres: string[] | null
  runtime: number | null
  vote_average: number | null
  director: string | null
  cast_json: unknown | null // JSONB — typically { cast: [{name, character}] }
  metadata_json: unknown | null // JSONB catch-all from TMDb
}

/** Normalized film data for edge function responses and hint engine */
export interface NormalizedFilm {
  id: string
  tmdb_id: number
  title: string
  original_title: string | null
  year: number | null
  poster_url: string | null
  overview: string | null
  genres: string[] | null
  runtime: number | null
  vote_average: number | null
  director: string | null
  cast: string[] | null
  original_language: string | null
}

/** Normalize a film row to a consistent shape, extracting metadata_json fields */
export function normalizeFilm(row: FilmRow): NormalizedFilm {
  const meta = (row.metadata_json ?? {}) as Record<string, unknown>
  const castJson = row.cast_json as Record<string, unknown> | null

  // Extract cast names from cast_json
  let castNames: string[] | null = null
  if (castJson) {
    if (Array.isArray(castJson)) {
      castNames = castJson
        .slice(0, 10)
        .map((c: unknown) => {
          if (typeof c === 'string') return c
          if (typeof c === 'object' && c && 'name' in c) return (c as Record<string, string>).name
          return null
        })
        .filter((n): n is string => Boolean(n))
    } else if ('cast' in castJson && Array.isArray(castJson.cast)) {
      castNames = (castJson.cast as Array<Record<string, string>>)
        .slice(0, 10)
        .map((c) => c.name)
        .filter(Boolean)
    }
  }

  return {
    id: row.id,
    tmdb_id: row.tmdb_id,
    title: row.title,
    original_title: (meta.original_title as string) ?? null,
    year: row.year,
    poster_url: row.poster_url,
    overview: row.overview,
    genres: row.genres,
    runtime: row.runtime,
    vote_average: row.vote_average,
    director: row.director,
    cast: castNames,
    original_language: (meta.original_language as string) ?? null,
  }
}

// ----------------------------------------------------------------------------
// Title normalization (fuzzy guess matching)
// ----------------------------------------------------------------------------

/**
 * Normalizes a film title for comparison.
 * Removes diacritics, punctuation, articles, lowercases.
 */
export function normalizeTitle(s: string): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/^(the|a|an|le|la|les|der|die|das|el|los|las)\s+/i, '')
    .replace(/[^a-z0-9]/g, '')
}

/** Check if guess matches the film title or original_title */
export function isTitleMatch(
  guess: string,
  film: { title: string; original_title?: string | null }
): boolean {
  const normalizedGuess = normalizeTitle(guess)
  if (!normalizedGuess) return false

  const candidates = [film.title, film.original_title].filter(
    (t): t is string => Boolean(t)
  )

  return candidates.some((t) => normalizeTitle(t) === normalizedGuess)
}

// ----------------------------------------------------------------------------
// Film select query — standard columns for posterle edge functions
// ----------------------------------------------------------------------------

export const FILM_SELECT_COLUMNS = `
  id, tmdb_id, title, year, poster_url, overview, genres,
  runtime, vote_average, director, cast_json, metadata_json
`

// ----------------------------------------------------------------------------
// Logging (structured)
// ----------------------------------------------------------------------------

export function logInfo(event: string, data: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ level: 'info', event, ...data, ts: new Date().toISOString() }))
}

export function logError(event: string, error: unknown, data: Record<string, unknown> = {}): void {
  const errorObj =
    error instanceof Error
      ? { message: error.message, name: error.name, stack: error.stack }
      : { value: String(error) }
  console.error(
    JSON.stringify({
      level: 'error',
      event,
      error: errorObj,
      ...data,
      ts: new Date().toISOString(),
    })
  )
}
