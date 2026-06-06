import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VECTOR_DIM = 384
const SIGNAL_LOOKBACK_DAYS = 90
const TIME_DECAY_HALF_LIFE_DAYS = 30
const MIN_MEANINGFUL_STRENGTH = 0.2
// Sprint 3: Threshold 10 → 6. JS katmaninda calculateBlendWeights
// ile senkron (onboarding TasteSwipe 6 signal uretir, hybrid ilk
// aramadan itibaren aktif).
const MIN_SIGNALS_FOR_RECOMPUTE = 6
const SIGNALS_FOR_FULL_PERSONALIZATION = 50
const MIN_VECTOR_MAGNITUDE = 0.1

interface TasteSignalRow {
  film_id: string | null
  strength: number
  created_at: string
}

interface FilmVectorRow {
  id: string
  profile_vector: number[] | string | null
}

/**
 * Exponential time decay.
 * Half-life 30 days: signal 30 gün eski ise %50 ağırlığı kaybeder.
 */
function timeDecay(createdAt: string, now: Date): number {
  const ageDays = (now.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  return Math.pow(0.5, ageDays / TIME_DECAY_HALF_LIFE_DAYS)
}

/**
 * Vector L2 magnitude. Sanity check için.
 */
function magnitude(v: number[]): number {
  let sum = 0
  for (const x of v) sum += x * x
  return Math.sqrt(sum)
}

/**
 * Supabase pgvector formatı: '[0.1,0.2,...]' veya array
 */
function parseVector(raw: number[] | string | null): number[] | null {
  if (!raw) return null
  if (Array.isArray(raw)) return raw
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch { return null }
  return null
}

/**
 * Vector'ü pgvector text formatına çevir
 */
function vectorToPgString(v: number[]): string {
  return '[' + v.join(',') + ']'
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const { user_id } = await req.json()
    if (!user_id || typeof user_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'user_id required' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sb = createClient(supabaseUrl, serviceKey)

    // ── 1. Calibration vector + total signal count ─────────────────────
    const { data: userRow, error: userError } = await sb
      .from('users')
      .select('preferences_vector')
      .eq('id', user_id)
      .single()

    if (userError || !userRow) {
      return new Response(
        JSON.stringify({ error: 'user not found' }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const calibrationVector = parseVector(userRow.preferences_vector)
    if (!calibrationVector) {
      // Kalibrasyonsuz user — onboarding tamamlanmamış, henüz hesaplanamaz
      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'no_calibration_vector' }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // ── 2. Son 90 günün meaningful signal'larını çek ────────────────────
    const since = new Date()
    since.setDate(since.getDate() - SIGNAL_LOOKBACK_DAYS)

    const { data: signals, error: signalsError } = await sb
      .from('user_taste_signals')
      .select('film_id, strength, created_at')
      .eq('user_id', user_id)
      .gte('created_at', since.toISOString())
      .not('film_id', 'is', null)

    if (signalsError) {
      throw new Error('signals fetch failed: ' + signalsError.message)
    }

    const allSignals = (signals ?? []) as TasteSignalRow[]
    const meaningful = allSignals.filter(s =>
      Math.abs(s.strength) >= MIN_MEANINGFUL_STRENGTH && s.film_id != null
    )

    // ── 3. Cold-start check ────────────────────────────────────────────
    if (meaningful.length < MIN_SIGNALS_FOR_RECOMPUTE) {
      // Markaj: dirty=false (signal sayısı eşiğin altında, recompute yapmadık)
      await sb.from('users').update({
        preferences_vector_dirty: false,
        preferences_vector_updated_at: new Date().toISOString(),
      }).eq('id', user_id)

      return new Response(
        JSON.stringify({
          status: 'cold_start',
          meaningful_signals: meaningful.length,
          required: MIN_SIGNALS_FOR_RECOMPUTE
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // ── 4. Signal'ların film vector'lerini çek ──────────────────────────
    const filmIds = [...new Set(meaningful.map(s => s.film_id!))]
    const { data: filmRows, error: filmError } = await sb
      .from('film_profiles')
      .select('film_id, profile_vector')
      .in('film_id', filmIds)

    if (filmError) {
      throw new Error('film_profiles fetch failed: ' + filmError.message)
    }

    const filmVectorMap = new Map<string, number[]>()
    let nullVectorCount = 0
    for (const row of filmRows ?? []) {
      const v = parseVector(row.profile_vector as any)
      if (v && v.length === VECTOR_DIM) {
        filmVectorMap.set(row.film_id as string, v)
      } else {
        nullVectorCount++
      }
    }

    // ── 5. Weighted sum hesapla ─────────────────────────────────────────
    const now = new Date()
    const signalSum = new Array(VECTOR_DIM).fill(0) as number[]
    let totalAbsWeight = 0
    let usedSignals = 0
    let skippedNoVector = 0

    for (const sig of meaningful) {
      const filmVec = filmVectorMap.get(sig.film_id!)
      if (!filmVec) {
        skippedNoVector++
        continue
      }
      const decay = timeDecay(sig.created_at, now)
      const weight = sig.strength * decay   // negative strength → negative contribution

      for (let i = 0; i < VECTOR_DIM; i++) {
        signalSum[i] += filmVec[i] * weight
      }
      totalAbsWeight += Math.abs(weight)
      usedSignals++
    }

    if (totalAbsWeight < 1e-6 || usedSignals === 0) {
      // Tüm signal'lar fail oldu → cold-start gibi davran
      await sb.from('users').update({
        preferences_vector_dirty: false,
        preferences_vector_updated_at: new Date().toISOString(),
      }).eq('id', user_id)
      return new Response(
        JSON.stringify({
          status: 'no_usable_signals',
          fetched: meaningful.length,
          skipped_no_vector: skippedNoVector,
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // Normalize: signal_avg = sum / total_abs_weight
    const signalAvg = signalSum.map(x => x / totalAbsWeight)

    // ── 6. Magnitude check (negatif signal'lar vector'ü sıfırlamış olabilir)
    if (magnitude(signalAvg) < MIN_VECTOR_MAGNITUDE) {
      // Vector çöktü → calibration'a fallback
      await sb.from('users').update({
        preferences_vector_dirty: false,
        preferences_vector_updated_at: new Date().toISOString(),
      }).eq('id', user_id)
      return new Response(
        JSON.stringify({
          status: 'collapsed_to_calibration',
          magnitude: magnitude(signalAvg),
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // ── 7. Calibration vs signal blend ──────────────────────────────────
    let calibrationWeight: number
    let signalWeight: number
    if (usedSignals < SIGNALS_FOR_FULL_PERSONALIZATION) {
      calibrationWeight = 0.5
      signalWeight = 0.5
    } else {
      calibrationWeight = 0.2
      signalWeight = 0.8
    }

    const finalVector = new Array(VECTOR_DIM).fill(0) as number[]
    for (let i = 0; i < VECTOR_DIM; i++) {
      finalVector[i] = calibrationWeight * calibrationVector[i] + signalWeight * signalAvg[i]
    }

    // ── 8. Write back ──────────────────────────────────────────────────
    const { error: updateError } = await sb
      .from('users')
      .update({
        preferences_vector: vectorToPgString(finalVector),
        preferences_vector_updated_at: new Date().toISOString(),
        preferences_vector_dirty: false,
      })
      .eq('id', user_id)

    if (updateError) {
      throw new Error('user update failed: ' + updateError.message)
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        used_signals: usedSignals,
        skipped_no_vector: skippedNoVector,
        null_vector_films: nullVectorCount,
        calibration_weight: calibrationWeight,
        signal_weight: signalWeight,
        final_magnitude: magnitude(finalVector),
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[recompute-user-vector] Unhandled error:', err)
    return new Response(
      JSON.stringify({ error: 'internal error', message: (err as Error).message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
