// supabase/functions/curate-daily-puzzle/index.ts
//
// Daily puzzle curator. Runs via cron at 23:00 UTC daily.
// Selects tomorrow's puzzle based on weekly difficulty pattern and recency.
//
// Idempotency: protected by UNIQUE(puzzle_date) constraint + advisory lock.
// Safe to run multiple times — second call returns 'already_curated'.

import { getServiceClient, jsonResponse, errorResponse, logInfo, logError, handleCors } from '../_shared/utils.ts'

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

// Difficulty rotation: Mon-Sun. Tweak based on win-rate metrics post-launch.
const WEEKLY_DIFFICULTY_PATTERN: ReadonlyArray<'easy' | 'medium' | 'hard'> = [
  'easy',    // Sunday (JS getUTCDay() == 0)
  'easy',    // Monday
  'medium',  // Tuesday
  'easy',    // Wednesday
  'medium',  // Thursday
  'hard',    // Friday
  'medium',  // Saturday
]

const POPULARITY_BOUNDS = {
  easy:   { min: 50, max: 150 },
  medium: { min: 20, max: 70 },
  hard:   { min: 8,  max: 30 },
} as const

const MIN_VOTE_COUNT = 500
const RECENCY_EXCLUSION_DAYS = 180
const CANDIDATE_POOL_SIZE = 30
const TOP_N_RANDOM_PICK = 5
const ADVISORY_LOCK_KEY = 4242042 // arbitrary unique int

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  // Allow optional ?date=YYYY-MM-DD override for backfill (otherwise tomorrow)
  const url = new URL(req.url)
  const targetDate = computeTargetDate(url.searchParams.get('date'))

  logInfo('curate.start', { target_date: targetDate })

  const supabase = getServiceClient()

  try {
    // Acquire advisory lock to prevent concurrent curation
    const { data: lockAcquired, error: lockError } = await supabase.rpc('pg_try_advisory_lock', {
      key: ADVISORY_LOCK_KEY,
    } as never).then(() => ({ data: true, error: null }), (err) => ({ data: false, error: err }))

    // Note: pg_try_advisory_lock may not be exposed as RPC by default.
    // Fall back to the unique constraint as primary protection.
    if (lockError) {
      logInfo('curate.advisory_lock_unavailable', { note: 'relying on UNIQUE constraint' })
    }

    // Check if already curated (idempotency)
    const { data: existing, error: checkError } = await supabase
      .from('daily_puzzles')
      .select('id, film_id, difficulty_tier')
      .eq('puzzle_date', targetDate)
      .maybeSingle()

    if (checkError) {
      logError('curate.check_failed', checkError)
      return errorResponse('CHECK_FAILED', 'Could not check existing puzzle', 500)
    }

    if (existing) {
      logInfo('curate.already_curated', {
        target_date: targetDate,
        film_id: existing.film_id,
      })
      return jsonResponse({
        status: 'already_curated',
        date: targetDate,
        puzzle: existing,
      })
    }

    // Determine difficulty for this date
    const dayOfWeek = new Date(targetDate + 'T00:00:00Z').getUTCDay()
    const difficulty = WEEKLY_DIFFICULTY_PATTERN[dayOfWeek]
    const bounds = POPULARITY_BOUNDS[difficulty]

    const exclusionDate = new Date()
    exclusionDate.setDate(exclusionDate.getDate() - RECENCY_EXCLUSION_DAYS)
    const exclusionDateStr = exclusionDate.toISOString().split('T')[0]

    // Fetch candidate pool
    const { data: candidates, error: candidatesError } = await supabase.rpc(
      'get_puzzle_candidates',
      {
        p_popularity_min: bounds.min,
        p_popularity_max: bounds.max,
        p_min_vote_count: MIN_VOTE_COUNT,
        p_exclude_after_date: exclusionDateStr,
        p_limit: CANDIDATE_POOL_SIZE,
      }
    )

    if (candidatesError) {
      logError('curate.candidates_failed', candidatesError, { difficulty, bounds })
      return errorResponse('CANDIDATES_FAILED', 'Could not fetch candidates', 500)
    }

    if (!candidates || candidates.length === 0) {
      // Fallback: relax popularity bounds by 50%
      logInfo('curate.no_candidates_relaxing', { difficulty, bounds })
      const relaxed = await fetchRelaxedCandidates(supabase, difficulty, exclusionDateStr)
      if (!relaxed || relaxed.length === 0) {
        logError('curate.no_candidates_even_after_relax', null, { difficulty })
        return errorResponse(
          'NO_CANDIDATES',
          'No suitable candidates found even after relaxing bounds',
          500
        )
      }
      return await persistPick(supabase, targetDate, relaxed, difficulty, true)
    }

    // Filter candidates with poster quality validation
    const validated = validatePosterQuality(candidates)
    if (validated.length === 0) {
      logError('curate.all_posters_invalid', null, { candidate_count: candidates.length })
      return errorResponse('NO_VALID_POSTERS', 'No candidates passed poster validation', 500)
    }

    return await persistPick(supabase, targetDate, validated, difficulty, false)
  } catch (err) {
    logError('curate.unhandled', err)
    return errorResponse('INTERNAL_ERROR', 'Curation failed', 500)
  }
})

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function computeTargetDate(override: string | null): string {
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) {
    return override
  }
  const tomorrow = new Date()
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  return tomorrow.toISOString().split('T')[0]
}

interface Candidate {
  id: number
  title: string
  poster_url: string
  popularity: number
  vote_count: number
  original_language: string | null
  release_year: number | null
}

function validatePosterQuality(candidates: Candidate[]): Candidate[] {
  return candidates.filter((c) => {
    if (!c.poster_url || c.poster_url.length < 10) return false
    // TMDb poster paths typically include size segments. /w500/ or /original/ are usable.
    if (!/\/w\d+\/|\/original\//.test(c.poster_url)) return false
    return true
  })
}

async function fetchRelaxedCandidates(
  supabase: ReturnType<typeof getServiceClient>,
  difficulty: 'easy' | 'medium' | 'hard',
  exclusionDateStr: string
): Promise<Candidate[] | null> {
  const bounds = POPULARITY_BOUNDS[difficulty]
  const relaxedMin = bounds.min * 0.5
  const relaxedMax = bounds.max * 1.5

  const { data, error } = await supabase.rpc('get_puzzle_candidates', {
    p_popularity_min: relaxedMin,
    p_popularity_max: relaxedMax,
    p_min_vote_count: Math.floor(MIN_VOTE_COUNT * 0.5),
    p_exclude_after_date: exclusionDateStr,
    p_limit: CANDIDATE_POOL_SIZE,
  })

  if (error) {
    logError('curate.relaxed_fetch_failed', error)
    return null
  }
  return validatePosterQuality(data ?? [])
}

async function persistPick(
  supabase: ReturnType<typeof getServiceClient>,
  targetDate: string,
  candidates: Candidate[],
  difficulty: 'easy' | 'medium' | 'hard',
  wasRelaxed: boolean
): Promise<Response> {
  // Pick from top N randomly (more popular ones get slight preference via SQL ORDER)
  const topN = candidates.slice(0, Math.min(TOP_N_RANDOM_PICK, candidates.length))
  const chosen = topN[Math.floor(Math.random() * topN.length)]

  const notes = [
    `auto`,
    `pop=${chosen.popularity.toFixed(1)}`,
    `votes=${chosen.vote_count}`,
    `lang=${chosen.original_language ?? '??'}`,
    wasRelaxed ? 'relaxed' : null,
  ]
    .filter(Boolean)
    .join(' ')

  const { data: inserted, error: insertError } = await supabase
    .from('daily_puzzles')
    .insert({
      puzzle_date: targetDate,
      film_id: chosen.id,
      difficulty_tier: difficulty,
      curator_notes: notes,
    })
    .select()
    .single()

  if (insertError) {
    // Possible race: another invocation inserted between our check and insert.
    if (insertError.code === '23505') {
      logInfo('curate.race_condition_resolved', { target_date: targetDate })
      return jsonResponse({ status: 'race_resolved', date: targetDate })
    }
    logError('curate.insert_failed', insertError)
    return errorResponse('INSERT_FAILED', 'Could not persist puzzle', 500)
  }

  logInfo('curate.success', {
    date: targetDate,
    film_id: chosen.id,
    title: chosen.title,
    difficulty,
    pool_size: candidates.length,
    was_relaxed: wasRelaxed,
  })

  return jsonResponse({
    status: 'curated',
    date: targetDate,
    puzzle: inserted,
  })
}
