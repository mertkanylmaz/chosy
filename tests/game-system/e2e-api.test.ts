/**
 * E2E API tests for game system Edge Functions.
 * Runs against PRODUCTION Supabase — cleans up after itself.
 *
 * Run: deno test tests/game-system/e2e-api.test.ts --allow-net --allow-env --allow-read
 */

import {
  assertEquals,
  assertExists,
  assert,
} from 'https://deno.land/std@0.208.0/assert/mod.ts'

// ─── Config ──────────────────────────────────────────────────────────────────

/** Read .env file and parse key=value pairs. */
function loadEnv(path: string): Record<string, string> {
  const text = Deno.readTextFileSync(path)
  const env: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    env[key] = val
  }
  return env
}

const ENV = loadEnv('.env')
const SUPABASE_URL = ENV['EXPO_PUBLIC_SUPABASE_URL'] || 'https://xpcwihldlnlmyopjubdc.supabase.co'
const SERVICE_KEY = ENV['SUPABASE_SERVICE_ROLE_KEY']
const ANON_KEY = ENV['EXPO_PUBLIC_SUPABASE_ANON_KEY']
const TODAY = new Date().toISOString().split('T')[0]

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** REST API call to Supabase (PostgREST). */
async function supabaseRest(
  path: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(opts.headers ?? {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

/** Call an Edge Function. Returns { status, body }. */
async function callFunction(
  name: string,
  body: unknown,
  token?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const text = await res.text()
  return {
    status: res.status,
    body: text ? JSON.parse(text) : {},
  }
}

/** Get a real user JWT via magic link flow. */
async function getUserJwt(email: string): Promise<string> {
  // Generate magic link
  const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', email }),
  })
  const linkData = await linkRes.json()
  const tokenHash = linkData.hashed_token
  if (!tokenHash) throw new Error(`No hashed_token for ${email}: ${JSON.stringify(linkData)}`)

  // Verify to get JWT
  const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', token_hash: tokenHash }),
  })
  const verifyData = await verifyRes.json()
  if (!verifyData.access_token) throw new Error(`No access_token: ${JSON.stringify(verifyData)}`)
  return verifyData.access_token
}

// ─── Test Data Setup ─────────────────────────────────────────────────────────

interface TestContext {
  userId: string
  authEmail: string
  jwt: string
  puzzleId: string
  solutionRef: string
  wrongFilmId: string
  maxAttempts: number
}

let ctx: TestContext

/** One-time setup: gather user, puzzle, JWT. */
async function setup(): Promise<TestContext> {
  // Get users and find one with a real email
  const users = await supabaseRest('users?select=id,auth_id&limit=10') as Array<{ id: string; auth_id: string }>
  assert(users.length > 0, 'No users found in database')

  let user: { id: string; auth_id: string } | null = null
  let email = ''

  for (const u of users) {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${u.auth_id}`, {
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
      },
    })
    const authUser = await authRes.json()
    if (authUser.email && authUser.email.length > 0) {
      user = u
      email = authUser.email
      break
    }
  }

  assert(user, 'No user with email found')
  assert(email, 'No email found')

  // Get JWT
  const jwt = await getUserJwt(email)

  // Get today's puzzle
  const puzzles = await supabaseRest(
    `daily_puzzles?game_type=eq.cinemetrics&date=eq.${TODAY}&select=id,solution_ref,max_attempts`,
  ) as Array<{ id: string; solution_ref: string; max_attempts: number }>
  const puzzle = puzzles[0]
  assert(puzzle, `No cinemetrics puzzle for ${TODAY}`)

  // Get a wrong film
  const wrongFilms = await supabaseRest(
    `films?id=neq.${puzzle.solution_ref}&select=id&limit=1`,
  ) as Array<{ id: string }>
  assert(wrongFilms[0], 'No wrong film found')

  return {
    userId: user.id,
    authEmail: email,
    jwt,
    puzzleId: puzzle.id,
    solutionRef: puzzle.solution_ref,
    wrongFilmId: wrongFilms[0].id,
    maxAttempts: puzzle.max_attempts,
  }
}

/** Clean up game_scores for the test user on today's puzzle. */
async function cleanup(userId: string, puzzleId: string): Promise<void> {
  await supabaseRest(
    `game_scores?user_id=eq.${userId}&puzzle_id=eq.${puzzleId}`,
    { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } },
  )
}

// ─── Global Setup ────────────────────────────────────────────────────────────

// Deno test runs top-level before tests; use a promise-based lazy init
let setupPromise: Promise<TestContext> | null = null
function getCtx(): Promise<TestContext> {
  if (!setupPromise) {
    setupPromise = setup()
  }
  return setupPromise
}

// ─── SENARYO 1: Bulmaca yükleme ─────────────────────────────────────────────

Deno.test('S1: Puzzle load — no solution leakage, puzzle_no > 0, progress null', async () => {
  ctx = await getCtx()
  await cleanup(ctx.userId, ctx.puzzleId)

  const { status, body } = await callFunction('get-daily-challenge', {
    game_id: 'cinemetrics',
    puzzle_date: TODAY,
  }, ctx.jwt)

  assertEquals(status, 200)

  // Solution leakage checks
  const puzzleStr = JSON.stringify(body)
  assertEquals(puzzleStr.includes('"solution"'), false, 'solution key found in response')
  assertEquals(puzzleStr.includes('solution_ref'), false, 'solution_ref found in response')
  assertEquals(puzzleStr.includes('redaction_words'), false, 'redaction_words found in response')

  // puzzle_no
  const puzzleNo = (body as Record<string, unknown>).puzzle_no as number
  assert(typeof puzzleNo === 'number' && puzzleNo > 0, `puzzle_no should be > 0, got ${puzzleNo}`)

  // progress null on first load
  const progress = (body as Record<string, unknown>).progress
  assertEquals(progress, null, 'progress should be null on first load')
})

// ─── SENARYO 2: Yanlış tahmin feedback tutarlılığı ──────────────────────────

Deno.test('S2: Wrong guess — correct feedback structure', async () => {
  ctx = await getCtx()
  await cleanup(ctx.userId, ctx.puzzleId)

  const { status, body } = await callFunction('submit-guess', {
    puzzle_id: ctx.puzzleId,
    guess_film_id: ctx.wrongFilmId,
  }, ctx.jwt)

  assertEquals(status, 200)
  assertEquals(body.correct, false)
  assertEquals(body.completed, false)

  // Feedback structure
  const feedback = body.feedback as Record<string, unknown>
  assertExists(feedback, 'feedback should exist')

  const expectedColumns = ['year', 'genres', 'director', 'rating', 'runtime', 'country']
  for (const col of expectedColumns) {
    const colFeedback = feedback[col] as Record<string, unknown>
    assertExists(colFeedback, `feedback.${col} should exist`)
    assert(
      ['green', 'yellow', 'gray'].includes(colFeedback.result as string),
      `feedback.${col}.result should be green/yellow/gray, got ${colFeedback.result}`,
    )
  }

  // revealed_solution should NOT be present
  assertEquals(body.revealed_solution, null, 'revealed_solution should be null on wrong guess')
})

// ─── SENARYO 3: Doğru tahmin ────────────────────────────────────────────────

Deno.test('S3: Correct guess — won, xp > 0, revealed_solution without solution_ref', async () => {
  ctx = await getCtx()
  await cleanup(ctx.userId, ctx.puzzleId)

  const { status, body } = await callFunction('submit-guess', {
    puzzle_id: ctx.puzzleId,
    guess_film_id: ctx.solutionRef,
  }, ctx.jwt)

  assertEquals(status, 200)
  assertEquals(body.correct, true)
  assertEquals(body.completed, true)
  assertEquals(body.won, true)

  const xp = body.xp_awarded as number
  assert(xp > 0, `xp_awarded should be > 0, got ${xp}`)

  // revealed_solution exists
  const revealed = body.revealed_solution as Record<string, unknown>
  assertExists(revealed, 'revealed_solution should exist on correct guess')
  assertExists(revealed.title, 'revealed_solution.title should exist')

  // No solution_ref UUID leak in revealed_solution
  const revealedStr = JSON.stringify(revealed)
  assertEquals(revealedStr.includes('solution_ref'), false, 'solution_ref leaked in revealed_solution')
  assertEquals(revealedStr.includes(ctx.solutionRef), false, 'solution_ref UUID value leaked')
})

// ─── SENARYO 4: Tamamlanmış bulmacaya ikinci submit ─────────────────────────

Deno.test('S4: Double submit on completed puzzle — 409', async () => {
  ctx = await getCtx()
  // S3 left the puzzle completed — don't cleanup

  const { status, body } = await callFunction('submit-guess', {
    puzzle_id: ctx.puzzleId,
    guess_film_id: ctx.wrongFilmId,
  }, ctx.jwt)

  assertEquals(status, 409)
  const msg = (body.message as string) ?? ''
  assert(
    msg.includes('tamamlandı') || msg.includes('completed') || msg.includes('already'),
    `Error message should mention completion, got: ${msg}`,
  )
})

// ─── SENARYO 5: Auth'suz istek ──────────────────────────────────────────────

Deno.test('S5: No auth header — 401', async () => {
  const { status } = await callFunction('get-daily-challenge', {
    game_id: 'cinemetrics',
    puzzle_date: TODAY,
  }) // no token

  assert(status === 401 || status === 403, `Expected 401 or 403, got ${status}`)
})

// ─── SENARYO 6: Olmayan puzzle_date ─────────────────────────────────────────

Deno.test('S6: Future date — 404 with error message', async () => {
  ctx = await getCtx()

  const { status, body } = await callFunction('get-daily-challenge', {
    game_id: 'cinemetrics',
    puzzle_date: '2099-01-01',
  }, ctx.jwt)

  assertEquals(status, 404)
  assertExists(body.error, 'Error code should exist')
  assertExists(body.message, 'Error message should exist')
  assert((body.message as string).length > 0, 'Error message should not be empty')
})

// ─── SENARYO 7: Rate limit ─────────────────────────────────────────────────

Deno.test('S7: Rate limit — 11th guess returns 429', async () => {
  ctx = await getCtx()
  await cleanup(ctx.userId, ctx.puzzleId)

  // Send 11 guesses rapidly. Rate limit is 10 per 60 seconds.
  let got429 = false
  let lastStatus = 0

  for (let i = 0; i < 11; i++) {
    const { status, body } = await callFunction('submit-guess', {
      puzzle_id: ctx.puzzleId,
      guess_film_id: ctx.wrongFilmId,
    }, ctx.jwt)

    lastStatus = status

    // If we hit max attempts (409) before rate limit, that's also a valid stop
    if (status === 409) {
      // Max attempts reached before rate limit — this is expected if max_attempts < 11
      // Skip rate limit assertion in this case
      break
    }

    if (status === 429) {
      got429 = true
      const msg = (body.message as string) ?? ''
      assert(
        msg.includes('hızlı') || msg.includes('slow') || msg.includes('Too many'),
        `Rate limit message should mention speed, got: ${msg}`,
      )
      break
    }
  }

  // If max_attempts < 11, the puzzle completes before rate limit kicks in
  if (lastStatus !== 409) {
    assert(got429, `Expected 429 rate limit but last status was ${lastStatus}`)
  }
})

// ─── SENARYO 8: Progress restore ───────────────────────────────────────────

Deno.test('S8: Progress restore — guess persists across requests', async () => {
  ctx = await getCtx()
  await cleanup(ctx.userId, ctx.puzzleId)

  // Make 1 wrong guess
  const guessRes = await callFunction('submit-guess', {
    puzzle_id: ctx.puzzleId,
    guess_film_id: ctx.wrongFilmId,
  }, ctx.jwt)
  assertEquals(guessRes.status, 200)

  // "Restart" — call get-daily-challenge again
  const { status, body } = await callFunction('get-daily-challenge', {
    game_id: 'cinemetrics',
    puzzle_date: TODAY,
  }, ctx.jwt)

  assertEquals(status, 200)

  const progress = body.progress as Record<string, unknown>
  assertExists(progress, 'progress should exist after a guess')

  const guesses = progress.guesses as Array<unknown>
  assertExists(guesses, 'progress.guesses should exist')
  assertEquals(guesses.length, 1, 'progress should have 1 guess after restart')
})

// ─── SENARYO 9-12: Günlük tema (get-daily-theme) ────────────────────────────

Deno.test('S9: public_daily_puzzles view — theme_matched sızmıyor', async () => {
  const rows = await supabaseRest('public_daily_puzzles?select=*&limit=5') as Array<Record<string, unknown>>
  assert(rows.length > 0, 'view boş döndü')

  const expected = new Set([
    'id', 'game_id', 'puzzle_date', 'difficulty', 'puzzle_data', 'max_attempts', 'created_at',
  ])
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      assert(expected.has(key), `view beklenmeyen kolon döndürüyor: ${key}`)
    }
    const asText = JSON.stringify(row)
    assertEquals(asText.includes('theme_matched'), false, 'theme_matched view üzerinden sızıyor')
    assertEquals(asText.includes('theme_key'), false, 'theme_key view üzerinden sızıyor')
  }
})

Deno.test('S10: get-daily-theme — auth yoksa 401', async () => {
  const { status } = await callFunction('get-daily-theme', { puzzle_date: TODAY })
  assertEquals(status, 401)
})

Deno.test('S11: get-daily-theme — geçersiz tarih 400, temasız tarih none', async () => {
  ctx = await getCtx()

  const bad = await callFunction('get-daily-theme', { puzzle_date: '28-07-2026' }, ctx.jwt)
  assertEquals(bad.status, 400)

  // Üretim penceresinin (LOOKAHEAD=14) çok ötesi — tema satırı olamaz
  const far = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { status, body } = await callFunction('get-daily-theme', { puzzle_date: far }, ctx.jwt)
  assertEquals(status, 200)
  assertEquals(body.state, 'none')
})

Deno.test('S12: get-daily-theme — kilitliyken tema etiketi DÖNMEZ (Hard Rule 1)', async () => {
  ctx = await getCtx()

  const { status, body } = await callFunction('get-daily-theme', { puzzle_date: TODAY }, ctx.jwt)
  assertEquals(status, 200)

  const state = body.state as string
  assert(['none', 'locked', 'unlocked'].includes(state), `beklenmeyen state: ${state}`)

  if (state === 'locked') {
    const asText = JSON.stringify(body)
    assertEquals(asText.includes('theme_label'), false, 'kilitliyken theme_label sızıyor')
    assertEquals(asText.includes('theme_key'), false, 'kilitliyken theme_key sızıyor')
    assertEquals(asText.includes('theme_type'), false, 'kilitliyken theme_type sızıyor')
    assertEquals(asText.includes('title'), false, 'kilitliyken film başlığı sızıyor')

    const completed = body.completed as number
    const total = body.total as number
    assert(total > 0, 'total > 0 olmalı')
    assert(completed < total, 'kilitli durumda completed < total olmalı')
  }

  if (state === 'unlocked') {
    assertExists(body.theme_label, 'açık durumda theme_label gelmeli')
    const films = body.films as Array<Record<string, unknown>>
    assertEquals(films.length, body.total as number, 'her temalı bulmaca için bir film dönmeli')
  }
})

// ─── Cleanup ─────────────────────────────────────────────────────────────────

Deno.test('CLEANUP: Remove test game_scores', async () => {
  ctx = await getCtx()
  await cleanup(ctx.userId, ctx.puzzleId)
})
