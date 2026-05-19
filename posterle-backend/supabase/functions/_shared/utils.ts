// Shared utilities for Posterle edge functions.
// Import via: import { ... } from '../_shared/utils.ts'

import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ----------------------------------------------------------------------------
// CORS
// ----------------------------------------------------------------------------

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

/**
 * User-context client: respects RLS, uses caller's JWT.
 * Use when the operation should be subject to RLS policies.
 */
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

/**
 * Service-role client: bypasses RLS. Use for trusted server-side mutations
 * (e.g., streak updates, hint reveals) that must succeed atomically.
 */
export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )
}

// ----------------------------------------------------------------------------
// Auth
// ----------------------------------------------------------------------------

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export async function requireUser(
  client: SupabaseClient
): Promise<{ id: string; email?: string }> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser()

  if (error || !user) {
    throw new AuthError(error?.message ?? 'Not authenticated')
  }

  return { id: user.id, email: user.email }
}

// ----------------------------------------------------------------------------
// Title normalization (used for fuzzy guess matching)
// ----------------------------------------------------------------------------

/**
 * Normalizes a film title for fuzzy comparison.
 * Removes diacritics, punctuation, articles, and lowercases.
 *
 * "The Dark Knight" → "darkknight"
 * "Léon: The Professional" → "leontheprofessional"
 * "Spider-Man: Into the Spider-Verse" → "spidermanintospiderverse"
 */
export function normalizeTitle(s: string): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/^(the|a|an|le|la|les|der|die|das|el|los|las)\s+/i, '') // leading articles
    .replace(/[^a-z0-9]/g, '') // strip everything non-alphanumeric
}

/**
 * Checks if guess matches any of the film's known titles.
 * Compares: title, original_title, and alternative_titles array.
 */
export function isTitleMatch(
  guess: string,
  film: {
    title: string
    original_title?: string | null
    alternative_titles?: string[] | null
  }
): boolean {
  const normalizedGuess = normalizeTitle(guess)
  if (!normalizedGuess) return false

  const candidates = [
    film.title,
    film.original_title,
    ...(film.alternative_titles ?? []),
  ].filter((t): t is string => Boolean(t))

  return candidates.some((t) => normalizeTitle(t) === normalizedGuess)
}

// ----------------------------------------------------------------------------
// Logging (structured for log aggregators)
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
