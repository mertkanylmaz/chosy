// supabase/functions/curate-posterle/index.ts
//
// Daily posterle puzzle curator. Runs via cron at 23:00 UTC.
// Selects tomorrow's puzzle based on weekly difficulty pattern.
//
// Adapted for MoodFlix schema:
// - films.id is UUID, vote_average for difficulty tiers
// - posterle_puzzles table (not daily_puzzles)

import {
  getServiceClient,
  jsonResponse,
  errorResponse,
  logInfo,
  logError,
  handleCors,
} from '../_shared/posterleUtils.ts'

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const WEEKLY_DIFFICULTY_PATTERN: ReadonlyArray<'easy' | 'medium' | 'hard'> = [
  'easy',    // Sunday
  'easy',    // Monday
  'medium',  // Tuesday
  'easy',    // Wednesday
  'medium',  // Thursday
  'hard',    // Friday
  'medium',  // Saturday
]

// Difficulty mapped to vote_average ranges (higher = easier to recognize)
const VOTE_AVG_BOUNDS = {
  easy:   { min: 7.0, max: 10.0 },  // well-known, highly rated films
  medium: { min: 5.5, max: 7.5 },
  hard:   { min: 3.0, max: 6.5 },   // obscure or niche films
} as const

const RECENCY_EXCLUSION_DAYS = 180
const CANDIDATE_POOL_SIZE = 30
const TOP_N_RANDOM_PICK = 5

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  const url = new URL(req.url)
  const targetDate = computeTargetDate(url.searchParams.get('date'))

  logInfo('curate.start', { target_date: targetDate })

  const supabase = getServiceClient()

  try {
    // Check if already curated (idempotency)
    const { data: existing, error: checkError } = await supabase
      .from('posterle_puzzles')
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

    // Determine difficulty
    const dayOfWeek = new Date(targetDate + 'T00:00:00Z').getUTCDay()
    const difficulty = WEEKLY_DIFFICULTY_PATTERN[dayOfWeek]
    const bounds = VOTE_AVG_BOUNDS[difficulty]

    const exclusionDate = new Date()
    exclusionDate.setDate(exclusionDate.getDate() - RECENCY_EXCLUSION_DAYS)
    const exclusionDateStr = exclusionDate.toISOString().split('T')[0]

    // Fetch candidates via RPC
    const { data: candidates, error: candidatesError } = await supabase.rpc(
      'get_posterle_candidates',
      {
        p_vote_avg_min: bounds.min,
        p_vote_avg_max: bounds.max,
        p_exclude_after_date: exclusionDateStr,
        p_limit: CANDIDATE_POOL_SIZE,
      }
    )

    if (candidatesError) {
      logError('curate.candidates_failed', candidatesError, { difficulty, bounds })
      return errorResponse('CANDIDATES_FAILED', 'Could not fetch candidates', 500)
    }

    if (!candidates || candidates.length === 0) {
      // Fallback: relax bounds
      logInfo('curate.no_candidates_relaxing', { difficulty, bounds })
      const { data: relaxed, error: relaxError } = await supabase.rpc(
        'get_posterle_candidates',
        {
          p_vote_avg_min: Math.max(0, bounds.min - 2),
          p_vote_avg_max: Math.min(10, bounds.max + 2),
          p_exclude_after_date: exclusionDateStr,
          p_limit: CANDIDATE_POOL_SIZE,
        }
      )

      if (relaxError || !relaxed?.length) {
        logError('curate.no_candidates_after_relax', relaxError, { difficulty })
        return errorResponse('NO_CANDIDATES', 'No suitable candidates found', 500)
      }

      return await persistPick(supabase, targetDate, relaxed, difficulty, true)
    }

    // Filter: must have poster_url
    const validated = candidates.filter(
      (c: { poster_url: string | null }) => c.poster_url && c.poster_url.length > 5
    )

    if (validated.length === 0) {
      logError('curate.all_posters_invalid', null, { count: candidates.length })
      return errorResponse('NO_VALID_POSTERS', 'No candidates with valid posters', 500)
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
  id: string // UUID
  title: string
  poster_url: string
  vote_average: number
  year: number | null
  director: string | null
}

async function persistPick(
  supabase: ReturnType<typeof getServiceClient>,
  targetDate: string,
  candidates: Candidate[],
  difficulty: 'easy' | 'medium' | 'hard',
  wasRelaxed: boolean
): Promise<Response> {
  const topN = candidates.slice(0, Math.min(TOP_N_RANDOM_PICK, candidates.length))
  const chosen = topN[Math.floor(Math.random() * topN.length)]

  const notes = [
    'auto',
    `avg=${chosen.vote_average?.toFixed(1) ?? '?'}`,
    `year=${chosen.year ?? '?'}`,
    wasRelaxed ? 'relaxed' : null,
  ]
    .filter(Boolean)
    .join(' ')

  const { data: inserted, error: insertError } = await supabase
    .from('posterle_puzzles')
    .insert({
      puzzle_date: targetDate,
      film_id: chosen.id, // UUID
      difficulty_tier: difficulty,
      curator_notes: notes,
    })
    .select()
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      logInfo('curate.race_resolved', { target_date: targetDate })
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
