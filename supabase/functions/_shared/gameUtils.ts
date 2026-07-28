/**
 * Shared utilities for game system Edge Functions.
 * Auth, CORS, response helpers, Supabase client factories.
 */

import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ─── CORS ────────────────────────────────────────────────────────────────────

export const corsHeaders: Record<string, string> = {
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

// ─── Response helpers ────────────────────────────────────────────────────────

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
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
): Response {
  return jsonResponse({ error: code, message }, status)
}

// ─── Supabase clients ────────────────────────────────────────────────────────

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
    },
  )
}

/** Service-role client: bypasses RLS. */
export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

/** Extracts authenticated user from JWT. */
export async function requireAuthUser(
  client: SupabaseClient,
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

/** Resolves Supabase auth UID to app user (users table). */
export async function resolveAppUser(
  service: SupabaseClient,
  authUid: string,
): Promise<{ id: string }> {
  const { data, error } = await service
    .from('users')
    .select('id')
    .eq('auth_id', authUid)
    .single()
  if (error || !data) {
    throw new AuthError('App user not found for auth_id: ' + authUid)
  }
  return { id: data.id }
}

// ─── Config lazy getter ──────────────────────────────────────────────────────

/** Reads a config value from app_config table (lazy, never cached at module level). */
export async function getAppConfig<T>(
  service: SupabaseClient,
  key: string,
): Promise<T> {
  const { data, error } = await service
    .from('app_config')
    .select('value')
    .eq('key', key)
    .single()
  if (error || !data) {
    throw new Error(`app_config key "${key}" not found: ${error?.message}`)
  }
  return data.value as T
}

// ─── Logging ─────────────────────────────────────────────────────────────────

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
    }),
  )
}
