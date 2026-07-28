/**
 * get-daily-chest — Günlük sandığın durumu ve ödül talebi.
 *
 * Bugüne kadar sandık tamamen istemcideydi: "açıldı" state'i lokal, ödüller
 * hiç uygulanmıyordu ve migration 060'taki daily_chest_log boş kalıyordu.
 * Artık tamamlama sayımı, tekillik ve ödül yazımı burada — istemci yalnızca
 * gösterir.
 *
 * GET/POST { puzzle_date, claim? }
 *   claim yoksa: yalnızca durum döner (yan etkisiz)
 *   claim=true : hak edilmişse ödüller GERÇEKTEN verilir (tek sefer)
 *
 * Deploy: supabase functions deploy get-daily-chest
 */

import {
  handleCors,
  jsonResponse,
  errorResponse,
  getUserClient,
  getServiceClient,
  requireAuthUser,
  resolveAppUser,
  AuthError,
  getAppConfig,
  logInfo,
  logError,
} from '../_shared/gameUtils.ts'
import { sentryCapture } from '../_shared/sentry.ts'

interface ChestRewards {
  streak_shield_count?: number
  double_xp_tomorrow?: boolean
}

interface EnabledGames {
  games?: string[]
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  // ─── Auth ──────────────────────────────────────────────────────────────────
  let userId: string
  try {
    const userClient = getUserClient(req)
    const { authUid } = await requireAuthUser(userClient)
    const service = getServiceClient()
    const appUser = await resolveAppUser(service, authUid)
    userId = appUser.id
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse('UNAUTHORIZED', err.message, 401)
    }
    logError('get-daily-chest.auth_failed', err)
    await sentryCapture({ message: `get-daily-chest auth error: ${err}`, tags: { fn: 'get-daily-chest' } })
    return errorResponse('AUTH_ERROR', 'Authentication failed', 500)
  }

  // ─── Parse input ───────────────────────────────────────────────────────────
  let puzzleDate: string
  let claim = false
  try {
    const url = new URL(req.url)
    if (req.method === 'GET') {
      puzzleDate = url.searchParams.get('puzzle_date') ?? ''
      claim = url.searchParams.get('claim') === 'true'
    } else {
      const body = await req.json()
      puzzleDate = body.puzzle_date ?? ''
      claim = body.claim === true
    }
  } catch {
    return errorResponse('INVALID_INPUT', 'Invalid request body', 400)
  }

  if (!puzzleDate || !/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate)) {
    return errorResponse('INVALID_DATE', 'puzzle_date must be YYYY-MM-DD', 400)
  }

  const service = getServiceClient()

  try {
    // ─── 1. Bugünün hedefi: aktif oyunların bulmaca sayısı ──────────────────
    let enabledGames: string[] | null = null
    try {
      const cfg = await getAppConfig<EnabledGames>(service, 'games_enabled')
      enabledGames = Array.isArray(cfg.games) ? cfg.games : null
    } catch (err) {
      // Config yoksa tüm oyunlar sayılır; hata görünür kalır (sessiz fallback değil)
      logError('get-daily-chest.games_config_failed', err)
      await sentryCapture({
        message: 'games_enabled config missing — chest target falls back to all games',
        level: 'warning',
        tags: { fn: 'get-daily-chest' },
      })
    }

    let puzzleQuery = service
      .from('daily_puzzles')
      .select('id, game_type')
      .eq('date', puzzleDate)
      .eq('is_emergency_pool', false)
      .eq('validation_status', 'valid')

    if (enabledGames) {
      puzzleQuery = puzzleQuery.in('game_type', enabledGames)
    }

    const { data: puzzles, error: puzzleError } = await puzzleQuery

    if (puzzleError) {
      logError('get-daily-chest.puzzle_fetch_failed', puzzleError, { puzzleDate })
      await sentryCapture({
        message: `get-daily-chest puzzle fetch error: ${puzzleError.message}`,
        tags: { fn: 'get-daily-chest' },
      })
      return errorResponse('PUZZLE_FETCH_FAILED', 'Could not load daily puzzles', 500)
    }

    const puzzleIds = (puzzles ?? []).map((p: { id: string }) => p.id)
    const total = puzzleIds.length

    // ─── 2. Kullanıcının tamamladıkları ────────────────────────────────────
    let completed = 0
    if (total > 0) {
      const { count, error: scoreError } = await service
        .from('game_scores')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('puzzle_id', puzzleIds)
        .not('completed_at', 'is', null)

      if (scoreError) {
        logError('get-daily-chest.score_fetch_failed', scoreError, { userId, puzzleDate })
        await sentryCapture({
          message: `get-daily-chest score fetch error: ${scoreError.message}`,
          tags: { fn: 'get-daily-chest', user_id: userId },
        })
        return errorResponse('SCORE_FETCH_FAILED', 'Could not load progress', 500)
      }
      completed = count ?? 0
    }

    // ─── 3. Bugün zaten alınmış mı ─────────────────────────────────────────
    const { data: existingLog, error: logError_ } = await service
      .from('daily_chest_log')
      .select('rewards_json')
      .eq('user_id', userId)
      .eq('chest_date', puzzleDate)
      .maybeSingle()

    if (logError_) {
      logError('get-daily-chest.log_fetch_failed', logError_, { userId, puzzleDate })
      return errorResponse('LOG_FETCH_FAILED', 'Could not load chest state', 500)
    }

    const alreadyClaimed = existingLog != null
    const unlocked = total > 0 && completed >= total

    // ─── 4. Talep — ödüller GERÇEKTEN verilir ──────────────────────────────
    if (claim) {
      if (!unlocked) {
        return errorResponse('NOT_UNLOCKED', 'Chest is not unlocked yet', 400)
      }
      if (alreadyClaimed) {
        return jsonResponse({
          total, completed, unlocked: true, claimed: true,
          rewards: existingLog.rewards_json ?? {},
        })
      }

      const rewards = await getAppConfig<ChestRewards>(service, 'daily_chest_rewards')

      // Tekillik: (user_id, chest_date) UNIQUE — yarış durumunda ikinci insert düşer
      const { error: insertError } = await service
        .from('daily_chest_log')
        .insert({ user_id: userId, chest_date: puzzleDate, rewards_json: rewards })

      if (insertError) {
        if (insertError.code === '23505') {
          return jsonResponse({ total, completed, unlocked: true, claimed: true, rewards })
        }
        logError('get-daily-chest.claim_failed', insertError, { userId, puzzleDate })
        await sentryCapture({
          message: `get-daily-chest claim failed: ${insertError.message}`,
          tags: { fn: 'get-daily-chest', user_id: userId },
        })
        return errorResponse('CLAIM_FAILED', 'Could not claim chest', 500)
      }

      // Ödülleri uygula
      const { data: streakRow } = await service
        .from('user_streaks')
        .select('streak_freezes_remaining')
        .eq('user_id', userId)
        .maybeSingle()

      const shield = rewards.streak_shield_count ?? 0
      const tomorrow = new Date(puzzleDate + 'T00:00:00Z')
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

      const update: Record<string, unknown> = {}
      if (shield > 0) {
        update.streak_freezes_remaining = (streakRow?.streak_freezes_remaining ?? 0) + shield
      }
      if (rewards.double_xp_tomorrow) {
        update.double_xp_date = tomorrow.toISOString().split('T')[0]
      }

      if (Object.keys(update).length > 0) {
        // Kullanicinin hic streak satiri olmayabilir (ilk gun) — upsert sart,
        // aksi halde update 0 satir etkiler ve odul sessizce kaybolur.
        const { error: rewardError } = await service
          .from('user_streaks')
          .upsert({ user_id: userId, ...update }, { onConflict: 'user_id' })

        if (rewardError) {
          // Log yazıldı ama ödül uygulanamadı — sessizce geçilmez
          logError('get-daily-chest.reward_apply_failed', rewardError, { userId, puzzleDate })
          await sentryCapture({
            message: `get-daily-chest reward apply failed: ${rewardError.message}`,
            level: 'error',
            tags: { fn: 'get-daily-chest', user_id: userId },
          })
          return errorResponse('REWARD_FAILED', 'Chest opened but rewards could not be applied', 500)
        }
      }

      logInfo('get-daily-chest.claimed', {
        user_id: userId, chest_date: puzzleDate, total, rewards,
      })

      return jsonResponse({ total, completed, unlocked: true, claimed: true, rewards })
    }

    // ─── 5. Yalnızca durum ─────────────────────────────────────────────────
    return jsonResponse(
      {
        total,
        completed,
        unlocked,
        claimed: alreadyClaimed,
        ...(alreadyClaimed ? { rewards: existingLog.rewards_json ?? {} } : {}),
      },
      200,
      { 'Cache-Control': 'private, max-age=30' },
    )
  } catch (err) {
    logError('get-daily-chest.unhandled', err, { userId, puzzleDate })
    await sentryCapture({
      message: `get-daily-chest unhandled error: ${err}`,
      level: 'error',
      tags: { fn: 'get-daily-chest', user_id: userId },
    })
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500)
  }
})
