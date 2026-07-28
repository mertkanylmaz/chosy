/**
 * recompute-cinema-dna — Internal-only Edge Function.
 *
 * Called by other Edge Functions (submit-guess, etc.) to update a user's
 * Cinema DNA after completing a daily puzzle.
 *
 * Auth: ONLY service_role key accepted. Client calls → 403.
 * Config: lazy-read from app_config every request (no module-level cache).
 */

import {
  handleCors,
  jsonResponse,
  errorResponse,
  getServiceClient,
  getAppConfig,
  logInfo,
  logError,
} from '../_shared/gameUtils.ts'
import { sentryCapture } from '../_shared/sentry.ts'
import {
  applyEWMA,
  calcCinemaScore,
  calcRank,
  pickIdentityTitle,
  type DimValues,
  type Weights,
} from '../_shared/dnaCalc.ts'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DnaConfig {
  ewma_alpha: number
  weights: Weights
  rank_thresholds: number[]
  rank_min_dailies: number[]
}

interface Signal {
  dim: string
  val: number
}

interface RequestBody {
  user_id: string
  signals: Signal[]
  daily_completed: boolean
}

/** Updatable DNA dimensions (visual_sense excluded). */
const ALLOWED_DIMS = ['knowledge', 'deduction', 'auteur_sense', 'instinct'] as const

/** Maps signal dim names to DB column names. */
const DIM_TO_COLUMN: Record<string, keyof DimValues> = {
  knowledge: 'knowledge',
  deduction: 'deduction',
  auteur_sense: 'auteur_sense',
  auteur: 'auteur_sense', // config uses short name
  instinct: 'instinct',
}

// ─── Main ────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Use POST', 405)
  }

  // ─── Auth: service_role only ───────────────────────────────────────────
  // Supabase gateway rewrites Authorization header, so we check the JWT
  // role claim instead of comparing raw keys.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  let isServiceRole = false
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      isServiceRole = payload.role === 'service_role'
    } catch {
      // Invalid JWT → not service role
    }
  }
  if (!isServiceRole) {
    return errorResponse('FORBIDDEN', 'Internal only endpoint', 403)
  }

  // ─── Parse input ───────────────────────────────────────────────────────
  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return errorResponse('INVALID_INPUT', 'Invalid request body', 400)
  }

  const { user_id, signals, daily_completed } = body
  if (!user_id || !Array.isArray(signals)) {
    return errorResponse('MISSING_PARAMS', 'user_id and signals are required', 400)
  }

  const service = getServiceClient()

  try {
    // ─── 1. Read dna_config (lazy, every request) ──────────────────────
    const dnaConfig = await getAppConfig<DnaConfig>(service, 'dna_config')
    const alpha = dnaConfig.ewma_alpha

    // ─── 2. Upsert cinema_dna row ─────────────────────────────────────
    await service
      .from('cinema_dna')
      .upsert({ user_id }, { onConflict: 'user_id', ignoreDuplicates: true })

    const { data: dnaRow, error: dnaError } = await service
      .from('cinema_dna')
      .select('*')
      .eq('user_id', user_id)
      .single()

    if (dnaError || !dnaRow) {
      logError('recompute-dna.fetch_failed', dnaError, { user_id })
      await sentryCapture({
        message: `recompute-dna: cinema_dna fetch failed: ${dnaError?.message}`,
        tags: { fn: 'recompute-cinema-dna', user_id },
      })
      return errorResponse('DNA_FETCH_FAILED', 'Could not load cinema DNA', 500)
    }

    // ─── 3. EWMA update for signal dimensions ─────────────────────────
    const updatedDims: DimValues = {
      knowledge: dnaRow.knowledge,
      deduction: dnaRow.deduction,
      auteur_sense: dnaRow.auteur_sense,
      instinct: dnaRow.instinct,
      consistency: dnaRow.consistency,
    }

    const updatedDimNames: string[] = []

    for (const signal of signals) {
      const colName = DIM_TO_COLUMN[signal.dim]
      if (!colName || !ALLOWED_DIMS.includes(colName as typeof ALLOWED_DIMS[number])) {
        continue // Skip unknown or disallowed dims (visual_sense, consistency)
      }
      updatedDims[colName] = applyEWMA(updatedDims[colName], signal.val, alpha)
      updatedDimNames.push(colName)
    }

    // ─── 4. Consistency: from streak + recent activity ─────────────────
    let consistencyUpdated = false
    try {
      const { data: streakRow, error: streakError } = await service
        .from('user_streaks')
        .select('current_streak')
        .eq('user_id', user_id)
        .maybeSingle()

      if (streakError || !streakRow) {
        logError('recompute-dna.streak_fetch_failed', streakError, { user_id })
        await sentryCapture({
          message: `recompute-dna: streak fetch failed for ${user_id}`,
          level: 'warning',
          tags: { fn: 'recompute-cinema-dna', user_id },
        })
        // Do NOT silently skip — Sentry warned, but consistency stays unchanged
      } else {
        // Streak score
        const streakScore = Math.min(100, streakRow.current_streak * 4)

        // Recent activity: solved games in last 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { count: recentCount, error: recentError } = await service
          .from('game_scores')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user_id)
          .gte('completed_at', sevenDaysAgo)
          .eq('solved', true)

        if (recentError) {
          logError('recompute-dna.recent_count_failed', recentError, { user_id })
        }

        const recentScoreNormalized = Math.min(100, (recentCount ?? 0) * (100 / 7))
        updatedDims.consistency = 0.60 * streakScore + 0.40 * recentScoreNormalized
        consistencyUpdated = true
        updatedDimNames.push('consistency')
      }
    } catch (err) {
      logError('recompute-dna.consistency_error', err, { user_id })
      await sentryCapture({
        message: `recompute-dna: consistency calc error: ${err}`,
        level: 'warning',
        tags: { fn: 'recompute-cinema-dna', user_id },
      })
    }

    // ─── 5. Cinema score ───────────────────────────────────────────────
    const cinemaScore = calcCinemaScore(updatedDims, dnaConfig.weights)

    // ─── 6. Dailies count ──────────────────────────────────────────────
    const totalDailies = daily_completed
      ? (dnaRow.total_dailies_completed ?? 0) + 1
      : (dnaRow.total_dailies_completed ?? 0)

    // ─── 7. Rank ───────────────────────────────────────────────────────
    const oldRankId = dnaRow.rank_id ?? 1
    const newRankId = calcRank(
      cinemaScore,
      totalDailies,
      dnaConfig.rank_thresholds,
      dnaConfig.rank_min_dailies,
    )
    const rankChanged = newRankId > oldRankId

    // ─── 8. Identity title ─────────────────────────────────────────────
    const identityTitle = pickIdentityTitle(updatedDims)

    // ─── 9. Update cinema_dna ──────────────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      knowledge: updatedDims.knowledge,
      deduction: updatedDims.deduction,
      auteur_sense: updatedDims.auteur_sense,
      instinct: updatedDims.instinct,
      cinema_score: cinemaScore,
      rank_id: Math.max(newRankId, oldRankId), // Never demote
      identity_title: identityTitle,
      total_dailies_completed: totalDailies,
    }
    // Only write consistency if it was actually recalculated
    if (consistencyUpdated) {
      updatePayload.consistency = updatedDims.consistency
    }

    const { error: updateError } = await service
      .from('cinema_dna')
      .update(updatePayload)
      .eq('user_id', user_id)

    if (updateError) {
      logError('recompute-dna.update_failed', updateError, { user_id })
      await sentryCapture({
        message: `recompute-dna: update failed: ${updateError.message}`,
        tags: { fn: 'recompute-cinema-dna', user_id },
      })
      return errorResponse('UPDATE_FAILED', 'Could not update cinema DNA', 500)
    }

    // ─── 10. PostHog event (fire-and-forget) ───────────────────────────
    const posthogKey = Deno.env.get('POSTHOG_API_KEY')
    if (posthogKey) {
      try {
        await fetch('https://us.i.posthog.com/capture/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: posthogKey,
            event: 'dna_updated',
            distinct_id: user_id,
            properties: {
              cinema_score: cinemaScore,
              rank_changed: rankChanged,
              rank_id: Math.max(newRankId, oldRankId),
            },
          }),
        })
      } catch (err) {
        logError('recompute-dna.posthog_failed', err, { user_id })
        // Non-blocking: don't fail the request
      }
    } else {
      logError('recompute-dna.posthog_key_missing', null, { user_id })
      await sentryCapture({
        message: 'recompute-dna: POSTHOG_API_KEY not set',
        level: 'warning',
        tags: { fn: 'recompute-cinema-dna' },
      })
    }

    // ─── 11. Response ──────────────────────────────────────────────────
    logInfo('recompute-dna.success', {
      user_id,
      cinema_score: cinemaScore,
      rank_id: Math.max(newRankId, oldRankId),
      rank_changed: rankChanged,
      updated_dims: updatedDimNames,
    })

    return jsonResponse({
      success: true,
      cinema_score: cinemaScore,
      rank_id: Math.max(newRankId, oldRankId),
      rank_changed: rankChanged,
      identity_title: identityTitle,
      updated_dims: updatedDimNames,
    })
  } catch (err) {
    logError('recompute-dna.unhandled', err, { user_id })
    await sentryCapture({
      message: `recompute-dna unhandled error: ${err}`,
      level: 'error',
      tags: { fn: 'recompute-cinema-dna', user_id },
    })
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500)
  }
})
