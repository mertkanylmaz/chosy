/**
 * Edge Function: generate-puzzles
 * 14 gün ilerisine kadar günlük bulmacalar üretir.
 * Service role ile çalışır. Bellek-optimize: küçük batch sorgular.
 *
 * Deploy: supabase functions deploy generate-puzzles --no-verify-jwt
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sentryCapture } from '../_shared/sentry.ts'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FilmRow {
  id: string
  tmdb_id: number
  title: string
  year: number
  poster_url: string | null
  /** Spotlight V2 gorseli — afis degil, filmden bir kare/backdrop */
  backdrop_url: string | null
  overview: string | null
  genres: string[]
  runtime: number
  vote_average: number
  director: string
  country: string[]
  imdb_rating: number | null
  cast_json: Array<{ name: string; profile_path: string | null }> | null
}

interface Report {
  generated: number
  rejected: number
  emergency_used: number
  per_game: Record<string, { generated: number; rejected: number }>
  errors: string[]
  min_vote_count?: number
  pool_sizes?: Record<string, number>
  themes?: { generated: number; dropped: number; per_type: Record<string, number> }
}

type ThemeType = 'director' | 'actor' | 'genre' | 'decade' | 'country'

interface ThemeRow {
  theme_date: string
  theme_type: ThemeType
  theme_key: string
  theme_label: string
  game_types: string[]
}

interface ThemeConfig {
  enabled: boolean
  target_game_count: number
  min_matched_games: number
  repeat_cooldown_days: number
  type_weights: Record<ThemeType, number>
  min_pool_per_type: Record<ThemeType, number>
  eligible_games: string[]
}

type GameType = 'cinemetrics' | 'logline' | 'spotlight' | 'imposter' | 'fadein' | 'quoted' | 'detective'

const LOOKAHEAD = 14
const EMERGENCY_PER_GAME = 15
// Zorluk: gün (0=Pzt) → difficulty
const DIFF: Record<number, number> = { 0:1, 1:2, 2:3, 3:3, 4:4, 5:5, 6:3 }

// ─── Admin (lazy) ───────────────────────────────────────────────────────────

let _db: ReturnType<typeof createClient> | null = null
function db() {
  if (!_db) {
    _db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  }
  return _db
}

// ─── Deterministik seed ─────────────────────────────────────────────────────

async function seed(date: string, game: string): Promise<number> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${date}:${game}:chosy`),
  )
  return Math.abs(new DataView(buf).getInt32(0))
}

/** Film sıralama hash'i — UUID'nin tamamını kullanır (Bug #3 fix) */
function hashFilm(id: string, s: number): number {
  let h = s
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(31, h) + id.charCodeAt(i) | 0
  }
  return h >>> 0
}

// ─── Eksik tarihler ─────────────────────────────────────────────────────────

async function missingDates(game: string): Promise<string[]> {
  const today = new Date()
  const dates: string[] = []
  for (let i = 0; i < LOOKAHEAD; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    dates.push(d.toISOString().split('T')[0])
  }

  const { data } = await db()
    .from('daily_puzzles')
    .select('date')
    .eq('game_type', game)
    .in('date', dates)
    .eq('is_emergency_pool', false)

  const have = new Set((data || []).map((r: { date: string }) => r.date))
  return dates.filter(d => !have.has(d))
}

// ─── Son kullanılan filmler ─────────────────────────────────────────────────

/** Cross-game: tüm oyunlardan son 365 günlük kullanılmış film ID'leri (Bug #4 fix) */
async function recentFilmIds(): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - 365*24*60*60*1000).toISOString().split('T')[0]
  const { data } = await db()
    .from('daily_puzzles')
    .select('solution_ref')
    .not('solution_ref', 'is', null)
    .gte('date', cutoff)

  return new Set(
    (data || []).map((r: { solution_ref: string }) => r.solution_ref).filter(Boolean)
  )
}

/** Cross-game: tüm oyunlardan son 14 günlük kullanılmış yönetmenler (Bug #5 fix) */
async function recentDirectors(): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - 14*24*60*60*1000).toISOString().split('T')[0]
  const { data } = await db()
    .from('daily_puzzles')
    .select('solution_ref')
    .not('solution_ref', 'is', null)
    .gte('date', cutoff)

  const ids = (data || []).map((r: { solution_ref: string }) => r.solution_ref).filter(Boolean)
  if (ids.length === 0) return new Set()

  const { data: films } = await db()
    .from('films')
    .select('director')
    .in('id', ids)

  return new Set(
    (films || []).map((f: { director: string }) => f.director?.toLowerCase()).filter(Boolean)
  )
}

// ─── Faz konfigürasyonu (lazy, her çağrıda okunur — module-level cache YASAK) ─

interface PhaseEntry { from_day: number; to_day: number; min_vote_count: number }

async function getMinVoteCount(rpt: Report): Promise<number> {
  const { data, error } = await db()
    .from('app_config')
    .select('value')
    .eq('key', 'puzzle_phase_config')
    .single()

  if (error) {
    console.error(`[gen] app_config okunamadı: ${error.message}`)
    rpt.errors.push(`config_error: ${error.message}`)
  }

  const phases: PhaseEntry[] = data?.value?.phases ?? []
  console.log(`[gen] Config phases: ${phases.length}, data: ${JSON.stringify(data?.value)}`)

  // day_number: cinemetrics/logline'ın ilk bulmacasından bugüne kaç gün geçti
  const { data: minRow } = await db()
    .from('daily_puzzles')
    .select('date')
    .in('game_type', ['cinemetrics', 'logline'])
    .not('date', 'is', null)
    .eq('is_emergency_pool', false)
    .order('date', { ascending: true })
    .limit(1)
    .single()

  let dayNumber = 1
  if (minRow?.date) {
    const firstDate = new Date(minRow.date + 'T00:00:00Z')
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    dayNumber = Math.max(1, Math.floor((today.getTime() - firstDate.getTime()) / (24*60*60*1000)) + 1)
  }

  for (const p of phases) {
    if (dayNumber >= p.from_day && dayNumber <= p.to_day) {
      console.log(`[gen] Faz: gün ${dayNumber}, min_vote_count=${p.min_vote_count}`)
      rpt.min_vote_count = p.min_vote_count
      return p.min_vote_count
    }
  }

  // Fallback: en yüksek eşik
  rpt.min_vote_count = 15000
  return 15000
}

// ─── Günlük tema ────────────────────────────────────────────────────────────
// Günün oyunlarından bir kısmı gizli bir bağlantıyla birbirine bağlanır.
// Tema puzzle_data'ya YAZILMAZ ve public_daily_puzzles view'ına girmez —
// etiket oynanmamış bulmaca için çözüm ipucudur (Hard Rule 1).

/** Tema config'i her çağrıda app_config'ten okunur (Hard Rule 4) */
async function getThemeConfig(rpt: Report): Promise<ThemeConfig | null> {
  const { data, error } = await db()
    .from('app_config')
    .select('value')
    .eq('key', 'daily_theme_config')
    .single()

  if (error) {
    console.error(`[gen] daily_theme_config okunamadı: ${error.message}`)
    rpt.errors.push(`theme_config_error: ${error.message}`)
    return null
  }

  const cfg = (data as { value?: ThemeConfig } | null)?.value
  if (!cfg?.enabled) return null
  return cfg
}

/** Film o günün temasına uyuyor mu? */
function filmMatchesTheme(f: FilmRow, theme: ThemeRow): boolean {
  const key = theme.theme_key
  switch (theme.theme_type) {
    case 'director':
      return (f.director ?? '').toLowerCase() === key
    case 'actor':
      return (f.cast_json ?? []).some(c => c.name?.toLowerCase() === key)
    case 'genre':
      return (f.genres ?? []).some(g => g.toLowerCase() === key)
    case 'decade':
      return f.year != null && String(Math.floor(f.year / 10) * 10) === key
    case 'country':
      return (f.country ?? []).some(c => c.toLowerCase() === key)
  }
}

interface ThemeCandidate { type: ThemeType; key: string; label: string; count: number }

/** Havuzdan tema adaylarını çıkarır; havuzu yetersiz olanlar elenir */
function buildThemeCandidates(pool: FilmRow[], cfg: ThemeConfig): ThemeCandidate[] {
  const buckets: Record<ThemeType, Map<string, { label: string; count: number }>> = {
    director: new Map(), actor: new Map(), genre: new Map(), decade: new Map(), country: new Map(),
  }

  const bump = (type: ThemeType, key: string, label: string) => {
    if (!key) return
    const m = buckets[type]
    const cur = m.get(key)
    if (cur) cur.count++
    else m.set(key, { label, count: 1 })
  }

  for (const f of pool) {
    if (f.director) bump('director', f.director.toLowerCase(), f.director)
    for (const c of (f.cast_json ?? []).slice(0, 3)) {
      if (c.name) bump('actor', c.name.toLowerCase(), c.name)
    }
    for (const g of f.genres ?? []) bump('genre', g.toLowerCase(), g)
    if (f.year) {
      const dec = Math.floor(f.year / 10) * 10
      bump('decade', String(dec), `${dec}s`)
    }
    for (const c of f.country ?? []) bump('country', c.toLowerCase(), c)
  }

  const out: ThemeCandidate[] = []
  for (const type of Object.keys(buckets) as ThemeType[]) {
    const min = cfg.min_pool_per_type[type] ?? 6
    for (const [key, v] of buckets[type]) {
      if (v.count >= min) out.push({ type, key, label: v.label, count: v.count })
    }
  }
  return out
}

/**
 * Ağırlıklı deterministik seçim (A-Res): u^(1/w) en büyük olan kazanır.
 * Aynı tarih için her çalıştırmada aynı temayı verir (Hard Rule 10).
 */
function pickThemeCandidate(
  candidates: ThemeCandidate[],
  cfg: ThemeConfig,
  s: number,
): ThemeCandidate | null {
  let best: ThemeCandidate | null = null
  let bestScore = -1
  for (const c of candidates) {
    const w = cfg.type_weights[c.type] ?? 1
    if (w <= 0) continue
    const u = (hashFilm(`${c.type}:${c.key}`, s) + 1) / 4294967297
    const score = Math.pow(u, 1 / w)
    if (score > bestScore) { bestScore = score; best = c }
  }
  return best
}

/**
 * Eksik tarihler için tema satırlarını oluşturur.
 * Tema yalnızca o tarihte HENÜZ ÜRETİLMEMİŞ uygun oyunlara atanır —
 * zaten üretilmiş bulmacalar tema baskısını göremezdi.
 */
async function ensureThemes(
  dates: string[],
  pool: FilmRow[],
  cfg: ThemeConfig,
  rpt: Report,
): Promise<Map<string, ThemeRow>> {
  const themes = new Map<string, ThemeRow>()
  if (dates.length === 0) return themes

  // Mevcut tema satırları
  const { data: existing } = await db()
    .from('daily_themes')
    .select('theme_date, theme_type, theme_key, theme_label, game_types')
    .in('theme_date', dates)

  for (const row of (existing ?? []) as ThemeRow[]) themes.set(row.theme_date, row)

  // Cooldown: son N günde kullanılmış tema anahtarları
  const cutoff = new Date(Date.now() - cfg.repeat_cooldown_days * 24*60*60*1000)
    .toISOString().split('T')[0]
  const { data: recent } = await db()
    .from('daily_themes')
    .select('theme_key')
    .gte('theme_date', cutoff)
  const blocked = new Set((recent ?? []).map((r: { theme_key: string }) => r.theme_key))

  // O tarihlerde zaten üretilmiş bulmacalar
  const { data: puzzles } = await db()
    .from('daily_puzzles')
    .select('date, game_type')
    .in('date', dates)
    .eq('is_emergency_pool', false)
  const done = new Set(
    (puzzles ?? []).map((p: { date: string; game_type: string }) => `${p.date}:${p.game_type}`),
  )

  const candidates = buildThemeCandidates(pool, cfg)
  console.log(`[gen] Tema adayı: ${candidates.length}`)

  for (const d of dates) {
    if (themes.has(d)) continue

    const openGames = cfg.eligible_games.filter(g => !done.has(`${d}:${g}`))
    if (openGames.length < cfg.min_matched_games) continue

    const s = await seed(d, 'theme')
    const usable = candidates.filter(c => !blocked.has(c.key))
    const pick = pickThemeCandidate(usable, cfg, s)
    if (!pick) continue

    // Oyun seçimi de deterministik
    const gameTypes = [...openGames]
      .sort((a, b) => hashFilm(a, s) - hashFilm(b, s))
      .slice(0, cfg.target_game_count)

    const row: ThemeRow = {
      theme_date: d,
      theme_type: pick.type,
      theme_key: pick.key,
      theme_label: pick.label,
      game_types: gameTypes,
    }

    const { error } = await db().from('daily_themes').insert({
      ...row,
      meta: { pool_count: pick.count },
    })

    if (error) {
      if (error.code !== '23505') {
        console.error(`[gen] Tema INSERT ${d}: ${error.message}`)
        rpt.errors.push(`theme_insert/${d}: ${error.message}`)
        continue
      }
    }

    blocked.add(pick.key)
    themes.set(d, row)
    if (!rpt.themes) rpt.themes = { generated: 0, dropped: 0, per_type: {} }
    rpt.themes.generated++
    rpt.themes.per_type[pick.type] = (rpt.themes.per_type[pick.type] ?? 0) + 1
    console.log(`[gen] Tema ${d}: ${pick.type}/${pick.label} → ${gameTypes.join(',')}`)
  }

  return themes
}

/**
 * Üretim sonrası: game_types'ı gerçekten eşleşen oyunlarla günceller.
 * Eşik altında kalan temalar silinir — 2 oyunluk "bağlantı" bağlantı değildir.
 */
async function reconcileThemes(
  themes: Map<string, ThemeRow>,
  cfg: ThemeConfig,
  rpt: Report,
): Promise<void> {
  for (const [date, theme] of themes) {
    const { data } = await db()
      .from('daily_puzzles')
      .select('game_type')
      .eq('date', date)
      .eq('theme_matched', true)
      .eq('is_emergency_pool', false)

    const matched = (data ?? []).map((r: { game_type: string }) => r.game_type)

    if (matched.length < cfg.min_matched_games) {
      await db().from('daily_puzzles')
        .update({ theme_matched: false })
        .eq('date', date)
        .eq('theme_matched', true)
      await db().from('daily_themes').delete().eq('theme_date', date)

      if (!rpt.themes) rpt.themes = { generated: 0, dropped: 0, per_type: {} }
      rpt.themes.dropped++
      console.warn(`[gen] Tema ${date} düşürüldü: yalnızca ${matched.length} eşleşme`)
      continue
    }

    if (matched.length !== theme.game_types.length ||
        matched.some(g => !theme.game_types.includes(g))) {
      const { error } = await db().from('daily_themes')
        .update({ game_types: matched })
        .eq('theme_date', date)
      if (error) rpt.errors.push(`theme_update/${date}: ${error.message}`)
    }
  }
}

// ─── Film havuzu — KÜÇÜK BATCH ─────────────────────────────────────────────

async function fetchFilms(game: GameType, usedIds: Set<string>, usedDirs: Set<string>, rpt: Report): Promise<FilmRow[]> {
  let minVotes = await getMinVoteCount(rpt)

  // Cast gerektiren oyunlar (Imposter/Spotlight/Detective) ve FadeIn:
  // görsel/oyuncu kalitesi önemli, popülerlik eşiği düşürülebilir
  const needsCast = game === 'imposter' || game === 'detective'
  // Spotlight V3 gorsel tanima oyunu — FadeIn gibi populerlik esigi dusuk
  // tutulur. (V2'de spotlight needsCast icindeydi ve tabani oradan aliyordu.)
  if ((needsCast || game === 'fadein' || game === 'spotlight') && minVotes > 3000) {
    minVotes = 3000
  }

  // Bellek limiti için yalnızca gerekli kolonlar, küçük limit
  const cols = 'id,tmdb_id,title,year,poster_url,backdrop_url,overview,genres,runtime,vote_average,director,country,imdb_rating,cast_json'

  // metadata_json->>vote_count TEXT döner → vote_count filtresi client-side kalır.
  // cast_json/imdb_rating filtresi SUNUCUDA: veritabanında cast_json dolu film
  // sayısı sınırlı (~500); istemci tarafında elemek satır bütçesini kullanılamaz
  // filmlerle doldurup Spotlight/Detective havuzunu kurutuyordu.
  let query = db()
    .from('films')
    .select(cols + ',metadata_json')
    .in('curation_tier', ['core', 'extended'])
    .not('vote_average', 'is', null)
    .not('runtime', 'is', null)
    .not('director', 'is', null)
    .not('year', 'is', null)

  if (needsCast) {
    query = query.not('cast_json', 'is', null)
  }
  if (game === 'detective') {
    query = query.not('imdb_rating', 'is', null)
  }
  // Spotlight V3: oyunun tamami gorsel uzerine kurulu — backdrop sart
  if (game === 'spotlight') {
    query = query.not('backdrop_url', 'is', null)
  }

  const { data, error } = await query
    .order('vote_average', { ascending: false })
    // Logline'ın 30-80 kelime overview filtresi client-side; dar havuzu
    // telafi etmek için satır bütçesi geniş tutulur.
    .limit(needsCast || game === 'fadein' || game === 'logline' || game === 'spotlight' ? 500 : 300)

  if (error) throw new Error(`Film sorgusu: ${error.message}`)
  if (!data?.length) throw new Error('Film havuzu boş')

  // vote_count client-side filter (metadata_json JSONB'den — integer cast)
  let pool = (data as (FilmRow & { metadata_json?: Record<string,unknown> })[]).filter(f => {
    const vc = Number(f.metadata_json?.vote_count ?? 0)
    if (vc < minVotes) return false
    if (usedIds.has(f.id)) return false
    if (f.director && usedDirs.has(f.director.toLowerCase())) return false
    if (!f.genres?.length || !f.country?.length) return false
    if (!f.poster_url) return false
    return true
  }) as FilmRow[]

  if (game === 'logline') {
    pool = pool.filter(f => {
      if (!f.overview) return false
      const wc = f.overview.trim().split(/\s+/).length
      return wc >= 30 && wc <= 80
    })
  } else if (game === 'detective') {
    pool = pool.filter(f =>
      f.cast_json != null && f.cast_json.length >= 3 &&
      f.imdb_rating != null
    )
  } else if (game === 'spotlight') {
    pool = pool.filter(f => f.backdrop_url != null)
  } else if (game === 'imposter') {
    // Imposter: en az 3 cast member gerekli
    pool = pool.filter(f =>
      f.cast_json != null && f.cast_json.length >= 3
    )
  } else if (game === 'fadein') {
    // FadeIn: poster ve temel metadata gerekli
    pool = pool.filter(f =>
      f.poster_url != null && f.poster_url.length > 0
    )
  }

  if (!rpt.pool_sizes) rpt.pool_sizes = {}
  rpt.pool_sizes[game] = pool.length
  console.log(`[gen] ${game} havuz: ${pool.length} film (minVotes=${minVotes})`)

  return pool
}

// ─── CineMetrics puzzle_data ────────────────────────────────────────────────

function cmData(f: FilmRow): Record<string, unknown> {
  return {
    columns: {
      year: f.year,
      genres: f.genres,
      directors: f.director.includes(',') ? f.director.split(',').map(s => s.trim()) : [f.director],
      rating: f.vote_average,
      runtime: f.runtime,
      country: f.country,
    },
    film_title: f.title,
    poster_url: f.poster_url,
    tmdb_id: f.tmdb_id,
  }
}

// ─── Logline sansür haritası (raw fetch, SDK yok) ───────────────────────────

interface Redaction { word: string; reveal_order: number }

async function loglineData(f: FilmRow): Promise<{
  puzzleData: Record<string, unknown>
  redactionWords: string[]
} | null> {
  if (!f.overview) return null

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    console.error('[gen] ANTHROPIC_API_KEY eksik')
    return null
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: 'Film tahmin oyunu için sansür haritası çıkar. Overview\'daki filmi ele veren kelimeleri seç: TÜM özel isimler + başlık kelimeleri zorunlu; ek olarak yüksek bilgi değerli 2-4 kelime. Her sansürlü kelimeye 1-9 arası reveal_order ata (1=en az bilgi, ilk açılacak). SADECE JSON dön: {"redactions":[{"word":"x","reveal_order":1}]}',
        messages: [{ role: 'user', content: `Film: "${f.title}" (${f.year})\nOverview: ${f.overview}` }],
      }),
    })

    if (!resp.ok) {
      console.error(`[gen] Haiku ${resp.status}`)
      return null
    }

    const body = await resp.json()
    const text: string = body.content?.[0]?.text || ''
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return null

    const parsed = JSON.parse(m[0]) as { redactions: Redaction[] }
    const reds = parsed.redactions
    if (!reds || reds.length < 5 || reds.length > 9) return null

    const words = f.overview.trim().split(/\s+/)
    const redSet = new Set(reds.map(r => r.word.toLowerCase()))
    const vis = words.filter(w => !redSet.has(w.toLowerCase().replace(/[^a-zA-Z0-9]/g, ''))).length
    if (vis / words.length < 0.4) return null

    const masked = words.map(w => {
      const clean = w.replace(/[^a-zA-Z0-9']/g, '')
      const r = reds.find(rd => rd.word.toLowerCase() === clean.toLowerCase())
      return r ? { w, r: r.reveal_order } : w
    })

    return {
      puzzleData: {
        overview_masked: masked,
        word_count: words.length,
        film_title: f.title,
        poster_url: f.poster_url,
        tmdb_id: f.tmdb_id,
      },
      redactionWords: reds.map(r => r.word),
    }
  } catch (e) {
    console.error(`[gen] Logline hata (${f.title}):`, e)
    return null
  }
}

// ─── Spotlight puzzle_data ─────────────────────────────────────────────────

interface SpotlightClue {
  turn: number
  type: 'year_range' | 'genres' | 'runtime' | 'imdb_rating' | 'cast' | 'director'
  value: string | string[] | number
}

interface SpotlightOption {
  film_id: string
  title: string
  year: number
  poster_url: string
}

/** Fisher-Yates shuffle (in-place) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Spotlight decoy havuzu: vote_count >= 5000, daha geniş havuz.
 * Solution havuzundan bağımsız — decoylar daha düşük eşikle seçilir.
 */
async function fetchDecoyPool(rpt: Report): Promise<FilmRow[]> {
  const cols = 'id,tmdb_id,title,year,poster_url,backdrop_url,overview,genres,runtime,vote_average,director,country,imdb_rating,cast_json'

  const { data, error } = await db()
    .from('films')
    .select(cols + ',metadata_json')
    .in('curation_tier', ['core', 'extended'])
    .not('vote_average', 'is', null)
    .not('runtime', 'is', null)
    .not('director', 'is', null)
    .not('year', 'is', null)
    .not('poster_url', 'is', null)
    .order('vote_average', { ascending: false })
    .limit(600)

  if (error) throw new Error(`Decoy havuz sorgusu: ${error.message}`)

  const pool = (data as (FilmRow & { metadata_json?: Record<string, unknown> })[]).filter(f => {
    const vc = Number(f.metadata_json?.vote_count ?? 0)
    return vc >= 5000 && f.genres?.length > 0
  }) as FilmRow[]

  if (!rpt.pool_sizes) rpt.pool_sizes = {}
  rpt.pool_sizes['spotlight_decoy'] = pool.length
  console.log(`[gen] spotlight decoy havuz: ${pool.length} film`)
  return pool
}

/** Verilen filtrelere uyan decoyları seç, usedDecoyIds'ten kaçın ve seçilenleri ekle */
function pickDecoys(
  candidates: FilmRow[],
  solutionId: string,
  usedDecoyIds: Set<string>,
  count: number,
): FilmRow[] {
  const valid = candidates.filter(f => f.id !== solutionId && !usedDecoyIds.has(f.id))
  const picked = shuffle([...valid]).slice(0, count)
  for (const p of picked) usedDecoyIds.add(p.id)
  return picked
}

/**
 * Spotlight V3: tek gorsel + harf harf acilan baslik.
 *
 * Eski V2 (6 film eleme) Detective'in kucuk kopyasiydi — ayni fiil, ayni his.
 * V3 farkli bir soru soruyor: "bu kareyi taniyor musun?"
 *
 * Mekanik:
 *   - Filmden bir kare (backdrop) bulanik baslar
 *   - Baslik maskeli: her harf bir kutu
 *   - Oyuncu harf tahmin eder; dogru harf acilir ve bulaniklik azalir,
 *     yanlis harf bir hak goturur
 *   - Filmi istedigi an arama kutusundan tahmin edebilir
 *
 * HARD RULE 1: Baslik metni puzzle_data'ya GIRMEZ. Istemciye yalnizca
 * maskenin yapisi (hangi pozisyon harf, hangisi ayrac) iner. Dogrulama
 * submit-guess'te solution_ref uzerinden yapilir.
 */

/** Maske tokeni — istemci yalnizca bu yapiyi gorur, harfleri gormez */
interface TitleMaskToken {
  /** 'slot' = tahmin edilecek karakter · 'sep' = gorunur ayrac */
  t: 'slot' | 'sep'
  /** Yalnizca 'sep' icin: gorunen karakter (bosluk, tire, iki nokta...) */
  c?: string
}

/**
 * Basligi maskeye cevirir.
 *
 * Alfanumerik karakterler tahmin edilecek yuva olur; noktalama ve bosluk
 * gorunur kalir (hangman gelenegi — kelime sinirlari gorunur).
 */
function buildTitleMask(title: string): { tokens: TitleMaskToken[]; letterCount: number } {
  const tokens: TitleMaskToken[] = []
  let letterCount = 0
  for (const ch of title) {
    if (/[\p{L}\p{N}]/u.test(ch)) {
      tokens.push({ t: 'slot' })
      letterCount++
    } else {
      tokens.push({ t: 'sep', c: ch })
    }
  }
  return { tokens, letterCount }
}

function spotlightData(solution: FilmRow): Record<string, unknown> | null {
  // Gorsel olmadan oyun yok — afise dusmek FadeIn ile ayni ekrani uretirdi
  if (!solution.backdrop_url) {
    console.warn(`[gen] Spotlight reject: backdrop yok — ${solution.title}`)
    return null
  }

  const { tokens, letterCount } = buildTitleMask(solution.title)

  // Cok kisa baslik tahmin edilemeyecek kadar acik, cok uzun baslik ekrana sigmaz
  if (letterCount < 3 || letterCount > 30) {
    console.warn(`[gen] Spotlight reject: baslik uzunlugu ${letterCount} — ${solution.title}`)
    return null
  }

  return {
    v: 3,
    backdrop_url: solution.backdrop_url,
    title_mask: tokens,
    letter_count: letterCount,
  }
}

// ─── Detective puzzle_data (12 film + entropy-based decoys) ───────────────

/**
 * Detective: 12 film (1 cozum + 11 decoy) + 6 ipucu + CineMetrics columns.
 *
 * Entropy-based decoy secimi: her aday film icin "bu film yanlis secilirse
 * kac baska aday elenebilir?" hesaplanir. Bilgi kazanci yuksek olan filmler
 * secilir. Minimum 3 yuksek-overlap decoy zorluk garantisi saglar.
 */
function detectiveData(
  solution: FilmRow,
  decoyPool: FilmRow[],
): Record<string, unknown> | null {
  if (!solution.cast_json?.length || !solution.imdb_rating || !solution.director) {
    console.warn(`[gen] Detective reject: eksik veri — ${solution.title}`)
    return null
  }

  const decade = Math.floor(solution.year / 10) * 10
  const yearRange = `${decade}s`
  const sGenres = new Set(solution.genres.map(g => g.toLowerCase()))
  const sDirector = solution.director.toLowerCase()
  const castNames = solution.cast_json.slice(0, 3).map(c => c.name)

  // --- Entropy-based decoy secimi ---
  // Her aday icin: overlap skoru hesapla (ne kadar cok overlapse, o kadar "zor" decoy)
  const candidates = decoyPool.filter(f =>
    f.id !== solution.id && f.poster_url
  )

  interface ScoredCandidate { film: FilmRow; overlap: number; traits: string[] }
  const scored: ScoredCandidate[] = candidates.map(f => {
    let overlap = 0
    const traits: string[] = []

    // Yonetmen overlap
    if (f.director && f.director.toLowerCase() === sDirector) {
      overlap += 3
      traits.push('director')
    }

    // Cast overlap
    const fCastNames = new Set((f.cast_json ?? []).slice(0, 5).map(c => c.name.toLowerCase()))
    const solCastNames = new Set(solution.cast_json!.slice(0, 5).map(c => c.name.toLowerCase()))
    const castOverlap = [...fCastNames].filter(n => solCastNames.has(n)).length
    if (castOverlap > 0) {
      overlap += castOverlap * 2
      traits.push('cast')
    }

    // Dekad overlap
    const fDecade = Math.floor(f.year / 10) * 10
    if (fDecade === decade) {
      overlap += 2
      traits.push('decade')
    }

    // Tur overlap
    const fGenres = new Set(f.genres.map(g => g.toLowerCase()))
    const genreOverlap = [...fGenres].filter(g => sGenres.has(g)).length
    if (genreOverlap > 0) {
      overlap += genreOverlap
      traits.push('genre')
    }

    // Rating yakinligi
    if (Math.abs(f.vote_average - solution.vote_average) <= 0.5) {
      overlap += 1
      traits.push('rating')
    }

    return { film: f, overlap, traits }
  })

  // Overlap'e gore sirala (yuksek = zor decoy)
  scored.sort((a, b) => b.overlap - a.overlap)

  // En az 3 yuksek-overlap (zorluk garantisi) + kalan entropy-diverse
  const selected: ScoredCandidate[] = []
  const usedIds = new Set<string>()

  // 3 yuksek overlap (zor decoylar)
  for (const c of scored) {
    if (selected.length >= 3) break
    if (c.overlap >= 2 && !usedIds.has(c.film.id)) {
      selected.push(c)
      usedIds.add(c.film.id)
    }
  }

  // 6 orta overlap
  for (const c of scored) {
    if (selected.length >= 9) break
    if (!usedIds.has(c.film.id) && c.overlap >= 1) {
      selected.push(c)
      usedIds.add(c.film.id)
    }
  }

  // 2 kolay (dusuk overlap — tamamen farkli)
  const easyPool = scored.filter(c => !usedIds.has(c.film.id) && c.overlap === 0)
  const easyDecoys = shuffle([...easyPool]).slice(0, 2)
  for (const c of easyDecoys) {
    selected.push(c)
    usedIds.add(c.film.id)
  }

  // Fallback: yeterli decoy yoksa rastgele doldur
  if (selected.length < 11) {
    const remaining = scored.filter(c => !usedIds.has(c.film.id))
    const extra = shuffle([...remaining]).slice(0, 11 - selected.length)
    selected.push(...extra)
  }

  if (selected.length < 11) {
    console.error(`[gen] Detective REJECT: yetersiz decoy (${selected.length}/11) — ${solution.title}`)
    return null
  }

  // 6 ipucu (Stage 1 sirasi)
  const clues: SpotlightClue[] = [
    { turn: 1, type: 'year_range', value: yearRange },
    { turn: 2, type: 'genres', value: solution.genres },
    { turn: 3, type: 'runtime', value: solution.runtime },
    { turn: 4, type: 'imdb_rating', value: solution.imdb_rating },
    { turn: 5, type: 'cast', value: castNames },
    { turn: 6, type: 'director', value: solution.director },
  ]

  // Tum 12 filmi karistir
  const options: SpotlightOption[] = shuffle([
    {
      film_id: solution.id,
      title: solution.title,
      year: solution.year,
      poster_url: solution.poster_url ?? '',
    },
    ...selected.map(c => ({
      film_id: c.film.id,
      title: c.film.title,
      year: c.film.year,
      poster_url: c.film.poster_url ?? '',
    })),
  ])

  // CineMetrics columns (Stage 2 feedback icin — sunucu tarafinda kalir)
  const columns = {
    year: solution.year,
    genres: solution.genres,
    directors: solution.director.includes(',')
      ? solution.director.split(',').map(s => s.trim())
      : [solution.director],
    rating: solution.vote_average,
    runtime: solution.runtime,
    country: solution.country,
  }

  // Decoy-cozum iliskileri (WhyThisMovie karti icin)
  const decoy_connections = selected.slice(0, 4).map(c => ({
    decoy_title: c.film.title,
    shared_traits: c.traits,
  }))

  return {
    clues,
    options,
    columns,
    decoy_connections,
    film_title: solution.title,
    poster_url: solution.poster_url,
    tmdb_id: solution.tmdb_id,
  }
}

// ─── Imposter V2 puzzle_data (3 round) ────────────────────────────────────

interface ImposterRound {
  round: number
  film_title: string
  poster_url: string | null
  tmdb_id: number
  options: Array<{ id: number; name: string; profile_path: string | null }>
  /** Sahte aktör ID'leri — view tarafından striplenir */
  imposter_ids: number[]
}

/**
 * Imposter V2: 3 round, artan zorluk.
 * Round 1: 4 seçenek, 1 sahte (kolay — farklı dönem/tür aktörü)
 * Round 2: 5 seçenek, 2 sahte (orta — benzer dönem aktörleri)
 * Round 3: 6 seçenek, 2 sahte (zor — aynı türden aktörler)
 *
 * Her round ayrı bir film kullanır.
 * imposter_ids sunucu tarafında kalır — view strip eder.
 */
async function imposterData(
  solution: FilmRow,
  allPool: FilmRow[],
): Promise<Record<string, unknown> | null> {
  // 3 farklı film seç (solution + 2 ek)
  const candidateFilms = allPool.filter(
    f => f.cast_json && f.cast_json.length >= 4 && f.poster_url,
  )
  if (candidateFilms.length < 3) return null

  const shuffledFilms = shuffle([...candidateFilms])
  // Solution her zaman ilk round'lardan birine girer
  const roundFilms: FilmRow[] = [solution]
  const usedIds = new Set([solution.id])
  for (const f of shuffledFilms) {
    if (usedIds.has(f.id)) continue
    roundFilms.push(f)
    usedIds.add(f.id)
    if (roundFilms.length >= 3) break
  }
  if (roundFilms.length < 3) return null

  // Round konfigürasyonları
  const roundConfigs = [
    { round: 1, realCount: 3, fakeCount: 1 },  // 4 seçenek, 1 sahte
    { round: 2, realCount: 3, fakeCount: 2 },  // 5 seçenek, 2 sahte
    { round: 3, realCount: 4, fakeCount: 2 },  // 6 seçenek, 2 sahte
  ]

  // Tüm roundlardan kullanılan aktör isimlerini takip et (çakışma engeli)
  const allUsedNames = new Set<string>()
  const rounds: ImposterRound[] = []

  for (let i = 0; i < 3; i++) {
    const film = roundFilms[i]
    const cfg = roundConfigs[i]
    const cast = film.cast_json!

    // Gerçek aktörler — ilk 10'dan seç
    const topCast = cast.slice(0, 10)
    const availableReal = topCast.filter(a => !allUsedNames.has(a.name.toLowerCase()))
    if (availableReal.length < cfg.realCount) return null

    const realActors = shuffle([...availableReal]).slice(0, cfg.realCount)
    realActors.forEach(a => allUsedNames.add(a.name.toLowerCase()))

    // Sahte aktörler — diğer filmlerden
    // profile_path UI icin — gercek ve sahte aktorlerin ikisi de tasir,
    // dolayisiyla cozum sizintisi degildir (Hard Rule 1).
    const fakeActors: Array<{ id: number; name: string; profile_path: string | null }> = []
    const otherFilms = shuffle(allPool.filter(
      f => f.id !== film.id && f.cast_json && f.cast_json.length >= 3,
    ))

    for (const otherFilm of otherFilms) {
      if (fakeActors.length >= cfg.fakeCount) break
      const otherCast = otherFilm.cast_json!.slice(0, 8)
      for (const actor of otherCast) {
        if (fakeActors.length >= cfg.fakeCount) break
        const nameLower = actor.name.toLowerCase()
        if (!allUsedNames.has(nameLower)) {
          fakeActors.push({
            id: hashFilmName(actor.name),
            name: actor.name,
            profile_path: actor.profile_path ?? null,
          })
          allUsedNames.add(nameLower)
        }
      }
    }

    if (fakeActors.length < cfg.fakeCount) return null

    const imposterIds = fakeActors.map(a => a.id)
    const options = shuffle([
      ...realActors.map(a => ({
        id: hashFilmName(a.name),
        name: a.name,
        profile_path: a.profile_path ?? null,
      })),
      ...fakeActors,
    ])

    rounds.push({
      round: cfg.round,
      film_title: film.title,
      poster_url: film.poster_url,
      tmdb_id: film.tmdb_id,
      options,
      imposter_ids: imposterIds,
    })
  }

  return {
    film_title: solution.title,
    poster_url: solution.poster_url,
    tmdb_id: solution.tmdb_id,
    rounds,
    // Tüm round'ların imposter_ids'lerini üst seviyeye de koy (view strip için)
    imposter_actor_id: rounds[0].imposter_ids[0], // Backward compat — view strip
    all_imposter_ids: rounds.flatMap(r => r.imposter_ids),
  }
}

/** İsimden deterministik ID üret */
function hashFilmName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(31, h) + name.charCodeAt(i) | 0
  }
  return h >>> 0
}

// ─── FadeIn puzzle_data ──────────────────────────────────────────────────

/**
 * FadeIn: poster blur + 5 ipucu (genre, decade, director, actor, overview).
 */
function fadeinData(f: FilmRow): Record<string, unknown> | null {
  if (!f.poster_url) return null

  const genres = f.genres?.slice(0, 2) ?? []
  const decade = f.year > 0 ? `${Math.floor(f.year / 10) * 10}s` : 'Unknown'
  const director = f.director ?? ''
  const cast = f.cast_json?.slice(0, 2).map(c => c.name) ?? []
  const overview = f.overview?.split(/[.!?]/).filter(s => s.trim().length > 10)[0]?.trim() ?? ''

  const hints = [
    { order: 2, type: 'genre', content: genres.join(', ') || 'Film' },
    { order: 3, type: 'decade', content: decade },
    { order: 4, type: 'director', content: director ? `Directed by ${director}` : genres[0] ?? 'Drama' },
    { order: 5, type: 'actor', content: cast.length > 0 ? `Starring ${cast[0]}` : `Released in ${f.year}` },
    { order: 6, type: 'overview', content: overview || `A ${(genres[0] ?? 'classic').toLowerCase()} film` },
  ]

  return {
    film_title: f.title,
    poster_url: f.poster_url,
    tmdb_id: f.tmdb_id,
    hints,
  }
}

// ─── Quoted replik veritabanı ────────────────────────────────────────────────

interface QuotedItem {
  id: string
  movie: string
  year: number
  genre: string
  originalQuote: string
  contextHint: string
  hints: { character: string; actor: string; director: string }
}

const QUOTED_DB: QuotedItem[] = [
  { id:'q_001', movie:'The Godfather', year:1972, genre:'Suç / Drama', originalQuote:"I'm gonna make him an offer he can't refuse.", contextHint:"70'lerin başında geçen, aile içi güç dengelerini ve mafya dünyasını işleyen bir Amerikan draması.", hints:{ character:'Vito Corleone', actor:'Marlon Brando', director:'Francis Ford Coppola' } },
  { id:'q_002', movie:'Star Wars: Episode V - The Empire Strikes Back', year:1980, genre:'Bilim Kurgu / Macera', originalQuote:'No, I am your father.', contextHint:"80'ler bilim kurgu efsanesi; galaktik bir savaşın tam ortasında geçen büyük bir aile ifşası.", hints:{ character:'Darth Vader', actor:'James Earl Jones (Ses)', director:'Irvin Kershner' } },
  { id:'q_003', movie:'Casablanca', year:1942, genre:'Romantik / Drama', originalQuote:"Here's looking at you, kid.", contextHint:"2. Dünya Savaşı sırasında Kuzey Afrika'da geçen, aşk ve fedakarlık temalı siyah-beyaz bir klasik.", hints:{ character:'Rick Blaine', actor:'Humphrey Bogart', director:'Michael Curtiz' } },
  { id:'q_004', movie:'The Wizard of Oz', year:1939, genre:'Fantastik / Müzikal', originalQuote:"There's no place like home.", contextHint:'Ailesinden uzakta, rengarenk fantastik bir dünyada kaybolan genç bir kızın özlemi.', hints:{ character:'Dorothy Gale', actor:'Judy Garland', director:'Victor Fleming' } },
  { id:'q_005', movie:'Scarface', year:1983, genre:'Suç / Aksiyon', originalQuote:'Say hello to my little friend!', contextHint:"80'ler Miami'sinde bir göçmenin mafya imparatorluğu kurmasını anlatan bir suç destanı.", hints:{ character:'Tony Montana', actor:'Al Pacino', director:'Brian De Palma' } },
  { id:'q_006', movie:'Fight Club', year:1999, genre:'Drama / Psikolojik Thriller', originalQuote:'The first rule of Fight Club is: You do not talk about Fight Club.', contextHint:"90'ların sonundan modern tüketim kültürünü ve erkeklik krizini eleştiren karanlık bir kült eser.", hints:{ character:'Tyler Durden', actor:'Brad Pitt', director:'David Fincher' } },
  { id:'q_007', movie:'The Dark Knight', year:2008, genre:'Aksiyon / Çizgi Roman', originalQuote:'Why so serious?', contextHint:"Kaos ve düzen arasındaki ince çizgiyi sorgulayan 2000'lerin en ikonik çizgi roman uyarlaması.", hints:{ character:'Joker', actor:'Heath Ledger', director:'Christopher Nolan' } },
  { id:'q_008', movie:'Pulp Fiction', year:1994, genre:'Suç / Bağımsız', originalQuote:"Say 'what' again. I dare you, I double dare you!", contextHint:"Doğrusal olmayan kurgusu ve diyaloglarıyla bilinen 90'lar bağımsız sinema devrimi.", hints:{ character:'Jules Winnfield', actor:'Samuel L. Jackson', director:'Quentin Tarantino' } },
  { id:'q_009', movie:'The Matrix', year:1999, genre:'Bilim Kurgu / Aksiyon', originalQuote:'You take the blue pill, the story ends. You take the red pill, you stay in Wonderland.', contextHint:"Gerçekliğin bir simülasyondan ibaret olduğunu savunan çığır açıcı 90'lar bilim kurgusu.", hints:{ character:'Morpheus', actor:'Laurence Fishburne', director:'Lana & Lilly Wachowski' } },
  { id:'q_010', movie:'Forrest Gump', year:1994, genre:'Drama / Romantik', originalQuote:"Life was like a box of chocolates. You never know what you're gonna get.", contextHint:'Saf bir adamın gözünden Amerikan tarihinin dönüm noktalarını anlatan dokunaklı bir film.', hints:{ character:'Forrest Gump', actor:'Tom Hanks', director:'Robert Zemeckis' } },
  { id:'q_011', movie:'The Sixth Sense', year:1999, genre:'Gerilim / Gizem', originalQuote:'I see dead people.', contextHint:"Çocuk bir hastanın sıra dışı algılarını konu alan, sürpriz sonlu bir 90'lar sonu gerilimi.", hints:{ character:'Cole Sear', actor:'Haley Joel Osment', director:'M. Night Shyamalan' } },
  { id:'q_012', movie:'The Silence of the Lambs', year:1991, genre:'Suç / Psikolojik Gerilim', originalQuote:'A census taker once tried to test me. I ate his liver with some fava beans and a nice Chianti.', contextHint:'Genç bir FBI ajanının seri katili yakalamak için dahi bir yamyamdan yardım aldığı psikolojik gerilim.', hints:{ character:'Dr. Hannibal Lecter', actor:'Anthony Hopkins', director:'Jonathan Demme' } },
  { id:'q_013', movie:'The Shining', year:1980, genre:'Korku / Psikolojik', originalQuote:"Here's Johnny!", contextHint:'Kışın kapalı kalan ıssız bir otelde akıl sağlığını yitiren bir yazarın hikayesi.', hints:{ character:'Jack Torrance', actor:'Jack Nicholson', director:'Stanley Kubrick' } },
  { id:'q_014', movie:'Taxi Driver', year:1976, genre:'Drama / Psikolojik Suç', originalQuote:"You talkin' to me?", contextHint:"70'ler New York'unun yozlaşmış sokaklarında uykusuzluk çeken ve yalnızlaşan bir adamın hezeyanları.", hints:{ character:'Travis Bickle', actor:'Robert De Niro', director:'Martin Scorsese' } },
  { id:'q_015', movie:'The Lord of the Rings: The Fellowship of the Ring', year:2001, genre:'Fantastik / Macera', originalQuote:'One does not simply walk into Mordor.', contextHint:"Orta Dünya'nın kaderini belirleyecek bir konseyde dile getirilen tarihi bir uyarı.", hints:{ character:'Boromir', actor:'Sean Bean', director:'Peter Jackson' } },
  { id:'q_016', movie:'Terminator 2: Judgment Day', year:1991, genre:'Bilim Kurgu / Aksiyon', originalQuote:'Hasta la vista, baby.', contextHint:"Gelecekten gönderilen sibernetik bir koruyucunun 90'lar aksiyonundaki efsaneleşmiş vedası.", hints:{ character:'The Terminator', actor:'Arnold Schwarzenegger', director:'James Cameron' } },
  { id:'q_017', movie:'Titanic', year:1997, genre:'Romantik / Drama', originalQuote:"I'm the king of the world!", contextHint:'Tarihi bir deniz felaketinin gölgesinde yeşeren tutkulu bir sınıf farkı aşkı.', hints:{ character:'Jack Dawson', actor:'Leonardo DiCaprio', director:'James Cameron' } },
  { id:'q_018', movie:'A Few Good Men', year:1992, genre:'Drama / Mahkeme', originalQuote:"You can't handle the truth!", contextHint:"Askeri bir mahkemede yüksek rütbeli bir subayın sorgulandığı gerilim dolu 90'lar draması.", hints:{ character:'Col. Nathan R. Jessep', actor:'Jack Nicholson', director:'Rob Reiner' } },
  { id:'q_019', movie:'Jaws', year:1975, genre:'Gerilim / Macera', originalQuote:"You're gonna need a bigger boat.", contextHint:'Bir sahil kasabasında dehşet saçan devasa bir yırtıcıyla yüzleşen ekibin şaşkınlığı.', hints:{ character:'Martin Brody', actor:'Roy Scheider', director:'Steven Spielberg' } },
  { id:'q_020', movie:'Gladiator', year:2000, genre:'Aksiyon / Tarih', originalQuote:'Are you not entertained?', contextHint:'Roma İmparatorluğu döneminde ihanete uğrayan bir generalin arenadaki öfke haykırışı.', hints:{ character:'Maximus', actor:'Russell Crowe', director:'Ridley Scott' } },
  { id:'q_021', movie:'Psycho', year:1960, genre:'Korku / Psikolojik Gerilim', originalQuote:"A boy's best friend is his mother.", contextHint:'Sapa bir yol üstü motelinde işlenen cinayetleri konu alan psikolojik siyah-beyaz gerilim.', hints:{ character:'Norman Bates', actor:'Anthony Perkins', director:'Alfred Hitchcock' } },
  { id:'q_022', movie:'Goodfellas', year:1990, genre:'Suç / Drama', originalQuote:"Funny how? Like I'm a clown, I amuse you?", contextHint:"90'lar mafya sinemasının zirvelerinden; masadaki küçük bir şakanın anında gerilime dönüştüğü an.", hints:{ character:'Tommy DeVito', actor:'Joe Pesci', director:'Martin Scorsese' } },
  { id:'q_023', movie:'Apocalypse Now', year:1979, genre:'Savaş / Drama', originalQuote:'I love the smell of napalm in the morning.', contextHint:"Vietnam Savaşı'nın yıkımını ve insan zihninin karanlığını konu alan psikolojik savaş filmi.", hints:{ character:'Lt. Col. Bill Kilgore', actor:'Robert Duvall', director:'Francis Ford Coppola' } },
  { id:'q_024', movie:'Back to the Future', year:1985, genre:'Bilim Kurgu / Komedi', originalQuote:"Roads? Where we're going, we don't need roads.", contextHint:"Zaman yolculuğu yapan bir araba ve eksantrik bir bilim insanının 80'ler macerası.", hints:{ character:'Dr. Emmett Brown', actor:'Christopher Lloyd', director:'Robert Zemeckis' } },
  { id:'q_025', movie:'Gone with the Wind', year:1939, genre:'Romantik / Tarih', originalQuote:"Frankly, my dear, I don't give a damn.", contextHint:'Amerikan İç Savaşı zemininde geçen destansı bir aşk ve gurur hikayesi.', hints:{ character:'Rhett Butler', actor:'Clark Gable', director:'Victor Fleming' } },
  { id:'q_026', movie:'The Social Network', year:2010, genre:'Biyografi / Drama', originalQuote:"A million dollars isn't cool. You know what's cool? A billion dollars.", contextHint:"2000'lerin başında bir yurt odasında kurulan dijital bir imparatorluğun hırslı kuruluş öyküsü.", hints:{ character:'Sean Parker', actor:'Justin Timberlake', director:'David Fincher' } },
  { id:'q_027', movie:'Whiplash', year:2014, genre:'Drama / Müzik', originalQuote:"There are no two words in the English language more harmful than 'good job'.", contextHint:'Mükemmelliyetçi bir caz eğitmeni ile genç bir davulcu arasındaki acımasız psikolojik savaş.', hints:{ character:'Terrence Fletcher', actor:'J.K. Simmons', director:'Damien Chazelle' } },
  { id:'q_028', movie:'Interstellar', year:2014, genre:'Bilim Kurgu / Drama', originalQuote:'Mankind was born on Earth. It was never meant to die here.', contextHint:"Tükenmekte olan Dünya'yı kurtarmak için solucan deliğinden geçen astronotların uzay yolculuğu.", hints:{ character:'Cooper', actor:'Matthew McConaughey', director:'Christopher Nolan' } },
  { id:'q_029', movie:'No Country for Old Men', year:2007, genre:'Suç / Gerilim', originalQuote:"What's the most you ever lost on a coin toss?", contextHint:'Teksas kırsalında kayıp bir para çantasının peşine düşen acımasız bir kiralık katilin gerilimi.', hints:{ character:'Anton Chigurh', actor:'Javier Bardem', director:'Joel & Ethan Coen' } },
  { id:'q_030', movie:'Inglourious Basterds', year:2009, genre:'Savaş / Drama', originalQuote:'Au revoir, Shoshanna!', contextHint:"2. Dünya Savaşı Fransa'sında kurnaz bir Nazi subayının kaçan bir kızı izlerken attığı nida.", hints:{ character:'Col. Hans Landa', actor:'Christoph Waltz', director:'Quentin Tarantino' } },
  { id:'q_031', movie:'Oppenheimer', year:2023, genre:'Biyografi / Drama', originalQuote:'Now I am become Death, the destroyer of worlds.', contextHint:'Atom bombasının geliştirilme sürecini ve vicdani hesaplaşmasını konu alan tarihi biyografi.', hints:{ character:'J. Robert Oppenheimer', actor:'Cillian Murphy', director:'Christopher Nolan' } },
  { id:'q_032', movie:'Joker', year:2019, genre:'Psikolojik Gerilim / Drama', originalQuote:"I used to think that my life was a tragedy, but now I realize, it's a comedy.", contextHint:'Toplum tarafından dışlanan başarısız bir komedyenin kaos sembolüne dönüşme hikayesi.', hints:{ character:'Arthur Fleck', actor:'Joaquin Phoenix', director:'Todd Phillips' } },
  { id:'q_033', movie:'The Truman Show', year:1998, genre:'Bilim Kurgu / Drama', originalQuote:"In case I don't see ya, good afternoon, good evening, and good night!", contextHint:'Tüm hayatının devasa bir televizyon seti ve şovdan ibaret olduğunu anlayan bir adamın ikonik selamı.', hints:{ character:'Truman Burbank', actor:'Jim Carrey', director:'Peter Weir' } },
  { id:'q_034', movie:'Dead Poets Society', year:1989, genre:'Drama', originalQuote:'Oh Captain! My Captain!', contextHint:'Disiplinli bir erkek yatılı okulunda öğrencilerine edebiyatı ve özgür düşünceyi aşılayan bir öğretmen.', hints:{ character:'John Keating', actor:'Robin Williams', director:'Peter Weir' } },
  { id:'q_035', movie:'The Matrix', year:1999, genre:'Bilim Kurgu', originalQuote:'I know kung fu.', contextHint:'Zihnine saniyeler içinde dövüş sanatı verileri yüklenen bir seçilmiş kişinin şaşkınlık dolu tespiti.', hints:{ character:'Neo', actor:'Keanu Reeves', director:'Lana & Lilly Wachowski' } },
  { id:'q_036', movie:'Braveheart', year:1995, genre:'Biyografi / Tarih', originalQuote:"They may take our lives, but they'll never take our freedom!", contextHint:"İskoçya'nın bağımsızlığı için İngiliz kraliyetine karşı ordularını toplayan bir halk kahramanının tiradı.", hints:{ character:'William Wallace', actor:'Mel Gibson', director:'Mel Gibson' } },
  { id:'q_037', movie:'Wall Street', year:1987, genre:'Drama / Suç', originalQuote:'Greed, for lack of a better word, is good.', contextHint:"80'lerin borsa dünyasında hırs ve finansal manipülasyonları öven acımasız bir yatırımcının söylevi.", hints:{ character:'Gordon Gekko', actor:'Michael Douglas', director:'Oliver Stone' } },
  { id:'q_038', movie:'The Prestige', year:2006, genre:'Drama / Gizem', originalQuote:'Every magic trick consists of three parts or acts.', contextHint:"19. yüzyıl sonu Londra'sında rekabet eden iki sihirbazın takıntı ve sırlarla dolu mücadelesi.", hints:{ character:'Cutter', actor:'Michael Caine', director:'Christopher Nolan' } },
  { id:'q_039', movie:'Se7en', year:1995, genre:'Suç / Gizem', originalQuote:"What's in the box?", contextHint:'Yedi ölümcül günahı işleyen bir seri katilin peşindeki dedektiflerin çöl ortasındaki şok edici finali.', hints:{ character:'David Mills', actor:'Brad Pitt', director:'David Fincher' } },
  { id:'q_040', movie:'V for Vendetta', year:2005, genre:'Aksiyon / Drama', originalQuote:'People should not be afraid of their governments. Governments should be afraid of their people.', contextHint:'Baskıcı ve totaliter bir gelecekte maskeli bir özgürlük savaşçısının devrim çağrısı.', hints:{ character:'V', actor:'Hugo Weaving', director:'James McTeigue' } },
  { id:'q_041', movie:'Alien', year:1979, genre:'Korku / Bilim Kurgu', originalQuote:'In space no one can hear you scream.', contextHint:'Ticari bir uzay gemisi mürettebatının bilinmeyen bir yaratıkla kapalı alandaki hayatta kalma mücadelesi.', hints:{ character:'Tagline', actor:'Sigourney Weaver', director:'Ridley Scott' } },
  { id:'q_042', movie:'The Big Lebowski', year:1998, genre:'Komedi / Suç', originalQuote:'The Dude abides.', contextHint:'Kendi halinde bir kase oyuncusunun yanlış anlaşılmalar sonucu karıştığı saçma mafya olayları.', hints:{ character:'The Dude', actor:'Jeff Bridges', director:'Joel & Ethan Coen' } },
  { id:'q_043', movie:'Jerry Maguire', year:1996, genre:'Drama / Romantik', originalQuote:'Show me the money!', contextHint:"Kendi ajansını kuran bir spor menajerinin hırslı sporcusuyla telefonda bağırdığı 90'lar klasiği.", hints:{ character:'Rod Tidwell', actor:'Cuba Gooding Jr.', director:'Cameron Crowe' } },
  { id:'q_044', movie:'Apollo 13', year:1995, genre:'Biyografi / Drama', originalQuote:'Houston, we have a problem.', contextHint:'Uzay görevi sırasında patlama yaşayan astronot ekibinin merkeze bildirdiği hayati teknik arıza.', hints:{ character:'Jim Lovell', actor:'Tom Hanks', director:'Ron Howard' } },
  { id:'q_045', movie:'Dirty Harry', year:1971, genre:'Aksiyon / Suç', originalQuote:'Do I feel lucky? Well, do ya, punk?', contextHint:"Kural tanımaz bir polisin silahındaki son mermiyi sorgulatarak suçluyu tehdit ettiği 70'ler aksiyonu.", hints:{ character:'Harry Callahan', actor:'Clint Eastwood', director:'Don Siegel' } },
  { id:'q_046', movie:'Spiderman', year:2002, genre:'Aksiyon / Çizgi Roman', originalQuote:'With great power comes great responsibility.', contextHint:'Sıradan bir gencin süper güçler kazandıktan sonra amcasından aldığı hayat dersi.', hints:{ character:'Uncle Ben', actor:'Cliff Robertson', director:'Sam Raimi' } },
  { id:'q_047', movie:'Mean Girls', year:2004, genre:'Komedi / Gençlik', originalQuote:'On Wednesdays we wear pink.', contextHint:"2000'ler lise hiyerarşisinde popüler kız grubunun katı giyim kurallarından biri.", hints:{ character:'Karen Smith', actor:'Amanda Seyfried', director:'Mark Waters' } },
  { id:'q_048', movie:'The Wolf of Wall Street', year:2013, genre:'Biyografi / Suç', originalQuote:'Sell me this pen.', contextHint:'Yasadışı yöntemlerle servet kazanan bir borsa simsarının ikna yeteneğini sınamak için sorduğu soru.', hints:{ character:'Jordan Belfort', actor:'Leonardo DiCaprio', director:'Martin Scorsese' } },
  { id:'q_049', movie:'Inception', year:2010, genre:'Bilim Kurgu / Aksiyon', originalQuote:'An idea is like a virus. Resilient. Highly contagious.', contextHint:'İnsanların rüyalarına girerek bilgi çalan uzmanın, zihne fikir ekme üzerine yaptığı analiz.', hints:{ character:'Dom Cobb', actor:'Leonardo DiCaprio', director:'Christopher Nolan' } },
  { id:'q_050', movie:'12 Angry Men', year:1957, genre:'Drama / Mahkeme', originalQuote:"It's always tough to keep personal prejudice out of a thing like this.", contextHint:'Bir cinayet davasında idam kararını tartışan 12 jüri üyesinin kapalı odadaki vicdan mücadelesi.', hints:{ character:'Juror 8', actor:'Henry Fonda', director:'Sidney Lumet' } },
]

/**
 * Quoted puzzle_data: replik veritabanından deterministik seçim + films tablosundan eşleşme.
 * Dönen puzzle_data: { quote, context_hint, hints, film_title, poster_url, tmdb_id, quote_id }
 */
async function quotedData(dateStr: string, usedQuoteIds: Set<string>): Promise<{
  puzzleData: Record<string, unknown>
  solutionRef: string
} | null> {
  // Deterministik seed ile replik seç (daha önce kullanılmamış)
  const s = await seed(dateStr, 'quoted')
  const available = QUOTED_DB.filter(q => !usedQuoteIds.has(q.id))
  if (available.length === 0) return null

  const sorted = [...available].sort((a, b) => {
    const ha = hashFilm(a.id, s)
    const hb = hashFilm(b.id, s)
    return ha - hb
  })
  const quote = sorted[0]

  // Films tablosundan eşleş (title + year)
  const { data: filmRows } = await db()
    .from('films')
    .select('id,tmdb_id,title,poster_url')
    .ilike('title', quote.movie)
    .eq('year', quote.year)
    .limit(1)

  // title tam eşleşmezse sadece title ile dene
  let film = filmRows?.[0]
  if (!film) {
    const { data: fallback } = await db()
      .from('films')
      .select('id,tmdb_id,title,poster_url')
      .ilike('title', quote.movie)
      .limit(1)
    film = fallback?.[0]
  }

  if (!film) {
    console.warn(`[gen] Quoted: "${quote.movie}" (${quote.year}) films tablosunda bulunamadı`)
    return null
  }

  // puzzle_data: context_hint replikten ÖNCE gösterilecek (GAME_INNER_DYNAMICS Katman 2)
  const puzzleData: Record<string, unknown> = {
    quote: quote.originalQuote,
    context_hint: quote.contextHint,
    genre: quote.genre,
    year: quote.year,
    hints: [
      { order: 1, content: `Character: ${quote.hints.character}` },
      { order: 2, content: `Actor: ${quote.hints.actor}` },
      { order: 3, content: `Director: ${quote.hints.director} (${quote.year})` },
    ],
    film_title: film.title,
    poster_url: film.poster_url,
    tmdb_id: film.tmdb_id,
    quote_id: quote.id,
  }

  return { puzzleData, solutionRef: film.id }
}

// ─── Tek bulmaca üret ───────────────────────────────────────────────────────

/** Spotlight için decoy havuzu referansı — run başına bir kez yüklenir */
let _spotlightDecoyPool: FilmRow[] | null = null

async function genOne(
  game: GameType,
  dateStr: string,
  pool: FilmRow[],
  rpt: Report,
  usedInRun: Set<string>,
  theme: ThemeRow | null,
): Promise<boolean> {
  const s = await seed(dateStr, game)
  const dow = new Date(dateStr + 'T00:00:00Z').getUTCDay()
  const diffKey = dow === 0 ? 6 : dow - 1
  const diff = DIFF[diffKey] ?? 3

  // Run içinde kullanılmamış filmleri filtrele
  const available = pool.filter(f => !usedInRun.has(f.id))
  const sorted = [...available].sort((a, b) => hashFilm(a.id, s) - hashFilm(b.id, s))

  // Yumuşak tema baskısı: önce temaya uyanlar denenir, tükenirse normal havuz.
  // Tema hiçbir zaman bulmacayı üretilemez hale getirmez.
  const themeApplies = theme != null && theme.game_types.includes(game)
  const themed = themeApplies ? sorted.filter(f => filmMatchesTheme(f, theme!)) : []
  const themedIds = new Set(themed.map(f => f.id))

  if (themed.length > 0 && await tryCandidates(themed, true)) return true
  return await tryCandidates(sorted.filter(f => !themedIds.has(f.id)), false)

  /** Aday listesinden ilk üretilebilen bulmacayı yazar */
  async function tryCandidates(list: FilmRow[], isThemed: boolean): Promise<boolean> {
  for (let i = 0; i < 3 && i < list.length; i++) {
    const f = list[i]

    let puzzleData: Record<string, unknown>
    let redWords: string[] | undefined

    if (game === 'cinemetrics') {
      puzzleData = cmData(f)
    } else if (game === 'logline') {
      const res = await loglineData(f)
      if (!res) { rpt.rejected++; rpt.per_game[game].rejected++; continue }
      puzzleData = { ...res.puzzleData, redaction_words: res.redactionWords }
      redWords = res.redactionWords
    } else if (game === 'spotlight') {
      // V3: decoy havuzu gerekmiyor — tek gorsel + baslik maskesi
      const spData = spotlightData(f)
      if (!spData) { rpt.rejected++; rpt.per_game[game].rejected++; continue }
      puzzleData = spData
    } else if (game === 'detective') {
      if (!_spotlightDecoyPool) {
        _spotlightDecoyPool = await fetchDecoyPool(rpt)
      }
      const detData = detectiveData(f, _spotlightDecoyPool)
      if (!detData) { rpt.rejected++; rpt.per_game[game].rejected++; continue }

      const dataSize = JSON.stringify(detData).length
      console.log(`[gen] Detective puzzle_data boyutu: ${(dataSize / 1024).toFixed(1)} KB — ${f.title}`)

      puzzleData = detData
    } else if (game === 'imposter') {
      const impData = await imposterData(f, pool)
      if (!impData) { rpt.rejected++; rpt.per_game[game].rejected++; continue }
      puzzleData = impData
    } else if (game === 'fadein') {
      const fiData = fadeinData(f)
      if (!fiData) { rpt.rejected++; rpt.per_game[game].rejected++; continue }
      puzzleData = fiData
    } else if (game === 'quoted') {
      // Quoted: ayrı akış — aşağıdaki genQuoted() kullanılır, buraya düşmemeli
      rpt.rejected++; continue
    } else {
      rpt.rejected++; continue
    }

    // clues: backward-compat fallback field
    const cluesValue = game === 'cinemetrics'
      ? puzzleData
      : game === 'detective'
        ? { clues: puzzleData.clues }
      : game === 'spotlight'
        // V3: ipucu yok — istemci maske ve gorseli puzzle_data'dan okur
        ? { v: puzzleData.v, backdrop_url: puzzleData.backdrop_url,
            title_mask: puzzleData.title_mask, letter_count: puzzleData.letter_count }
        : game === 'imposter'
          ? { rounds: (puzzleData.rounds as ImposterRound[]).map(r => ({
              round: r.round,
              film_title: r.film_title,
              poster_url: r.poster_url,
              options: r.options,
            })) }
          : game === 'fadein'
            ? { poster_url: puzzleData.poster_url, hints: puzzleData.hints }
            : { overview_masked: puzzleData.overview_masked }

    // Per-game max attempts (detective: tek fazli eleme, 6 yanlis hak)
    const maxAttempts = game === 'imposter' ? 3
      : game === 'logline' ? 5
      : game === 'quoted' ? 4
      : game === 'detective' ? 6
      : 6

    const { error } = await db().from('daily_puzzles').insert({
      date: dateStr,
      game_type: game,
      film_id: f.tmdb_id,
      puzzle_data: puzzleData,
      solution_ref: f.id,
      difficulty: diff,
      validation_status: 'valid',
      max_attempts: maxAttempts,
      clues: cluesValue,
      theme_matched: isThemed,
    })

    if (error) {
      if (error.code === '23505') return true // zaten var
      console.error(`[gen] INSERT ${game}/${dateStr}: ${error.message}`)
      rpt.rejected++; rpt.per_game[game].rejected++
      continue
    }

    usedInRun.add(f.id)
    rpt.generated++; rpt.per_game[game].generated++
    return true
  }
  return false
  }
}

// ─── Acil havuz ─────────────────────────────────────────────────────────────

async function fillEmergency(game: GameType, pool: FilmRow[], rpt: Report) {
  const { count } = await db()
    .from('daily_puzzles')
    .select('*', { count: 'exact', head: true })
    .eq('game_type', game)
    .eq('is_emergency_pool', true)
    .eq('validation_status', 'valid')

  const need = EMERGENCY_PER_GAME - (count ?? 0)
  if (need <= 0) return

  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  let made = 0

  for (const f of shuffled) {
    if (made >= need) break

    let pd: Record<string, unknown>
    if (game === 'cinemetrics') {
      pd = cmData(f)
    } else if (game === 'spotlight') {
      const spData = spotlightData(f)
      if (!spData) continue
      pd = spData
    } else if (game === 'detective') {
      if (!_spotlightDecoyPool) {
        _spotlightDecoyPool = await fetchDecoyPool(rpt)
      }
      const detData = detectiveData(f, _spotlightDecoyPool)
      if (!detData) continue
      pd = detData
    } else if (game === 'imposter') {
      const impData = await imposterData(f, pool)
      if (!impData) continue
      pd = impData
    } else if (game === 'fadein') {
      const fiData = fadeinData(f)
      if (!fiData) continue
      pd = fiData
    } else {
      const res = await loglineData(f)
      if (!res) continue
      pd = { ...res.puzzleData, redaction_words: res.redactionWords }
    }

    const emergencyMaxAttempts = game === 'imposter' ? 3
      : game === 'logline' ? 5
      : game === 'quoted' ? 4
      : game === 'detective' ? 6
      : 6

    const { error } = await db().from('daily_puzzles').insert({
      date: null,
      game_type: game,
      film_id: f.tmdb_id,
      puzzle_data: pd,
      solution_ref: f.id,
      difficulty: 3,
      validation_status: 'valid',
      is_emergency_pool: true,
      max_attempts: emergencyMaxAttempts,
      clues: pd,
    })

    if (!error) made++
  }
  console.log(`[gen] Acil havuz ${game}: +${made}`)
}

async function useEmergency(game: GameType, dateStr: string, rpt: Report): Promise<boolean> {
  const { data } = await db()
    .from('daily_puzzles')
    .select('id')
    .eq('game_type', game)
    .eq('is_emergency_pool', true)
    .eq('validation_status', 'valid')
    .is('date', null)
    .limit(1)
    .single()

  if (!data) {
    await sentryCapture({
      message: `[gen] ACİL HAVUZ BOŞ: ${game}/${dateStr}`,
      level: 'fatal',
      tags: { function: 'generate-puzzles', game, date: dateStr },
    })
    return false
  }

  const { error } = await db()
    .from('daily_puzzles')
    .update({ date: dateStr, is_emergency_pool: false })
    .eq('id', data.id)

  if (error) return false
  rpt.emergency_used++
  return true
}

// ─── PostHog ────────────────────────────────────────────────────────────────

async function postHog(rpt: Report) {
  const key = Deno.env.get('POSTHOG_API_KEY')
  if (!key) { console.warn('[gen] POSTHOG_API_KEY yok'); return }
  const host = Deno.env.get('POSTHOG_HOST') || 'https://us.i.posthog.com'
  try {
    await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        event: 'puzzle_generation_report',
        distinct_id: 'system:generate-puzzles',
        properties: { ...rpt, ts: new Date().toISOString() },
      }),
    })
  } catch (e) { console.error('[gen] PostHog:', e) }
}

// ─── Ana ────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const t0 = Date.now()

  // Opsiyonel: sadece belirli oyunu çalıştır (?game=cinemetrics)
  const url = new URL(req.url)
  const onlyGame = url.searchParams.get('game') as GameType | null
  const allGames: GameType[] = ['cinemetrics', 'logline', 'spotlight', 'imposter', 'fadein', 'quoted', 'detective']

  // Devre disi oyunlar icin uretim denenmez — quoted'in tukenmis replik havuzu
  // her calismada 13 gereksiz hata + Sentry kaydi uretiyordu (app_config: games_enabled).
  const { data: enabledCfg } = await db()
    .from('app_config')
    .select('value')
    .eq('key', 'games_enabled')
    .single()
  const enabledList = (enabledCfg as { value?: { games?: string[] } } | null)?.value?.games
  const enabledGames = Array.isArray(enabledList) ? enabledList : allGames

  const games: GameType[] = onlyGame
    ? [onlyGame]
    : allGames.filter(g => enabledGames.includes(g))

  const rpt: Report = {
    generated: 0, rejected: 0, emergency_used: 0,
    per_game: {
      cinemetrics: { generated:0, rejected:0 },
      logline: { generated:0, rejected:0 },
      spotlight: { generated:0, rejected:0 },
      imposter: { generated:0, rejected:0 },
      fadein: { generated:0, rejected:0 },
      quoted: { generated:0, rejected:0 },
      detective: { generated:0, rejected:0 },
    },
    errors: [],
  }

  try {
    // Reset spotlight decoy pool for new run
    _spotlightDecoyPool = null

    // Cross-game duplikat kontrolü: tüm oyunlar aynı set'i paylaşır
    const used = await recentFilmIds()
    const dirs = await recentDirectors()
    const usedInRun = new Set(used)

    // ─── Günlük tema (oyun döngüsünden ÖNCE — tema tarih eksenlidir) ────────
    // ?game= ile tek oyun çalıştırıldığında tema atlanır: tek oyunla
    // "bağlantı" kurulamaz, yarım tema satırı reconciliation'da düşerdi.
    let themes = new Map<string, ThemeRow>()
    let themeCfg: ThemeConfig | null = null

    if (!onlyGame) {
      themeCfg = await getThemeConfig(rpt)
      if (themeCfg) {
        const themeDates = new Set<string>()
        for (const g of themeCfg.eligible_games) {
          for (const d of await missingDates(g)) themeDates.add(d)
        }
        if (themeDates.size > 0) {
          const themePool = await fetchFilms('cinemetrics', usedInRun, dirs, rpt)
          themes = await ensureThemes([...themeDates].sort(), themePool, themeCfg, rpt)
        }
        console.log(`[gen] Tema: ${themes.size} gün`)
      }
    }

    for (const game of games) {
      console.log(`\n[gen] ═══ ${game.toUpperCase()} ═══`)

      const missing = await missingDates(game)
      console.log(`[gen] Eksik: ${missing.length} tarih`)
      if (missing.length === 0) continue

      // Quoted: replik havuzundan seçim — ayrı akış
      if (game === 'quoted') {
        // Daha önce kullanılmış quote_id'leri bul
        const { data: usedQuotes } = await db()
          .from('daily_puzzles')
          .select('puzzle_data')
          .eq('game_type', 'quoted')
          .not('puzzle_data', 'is', null)

        const usedQuoteIds = new Set<string>()
        for (const row of usedQuotes ?? []) {
          const qid = (row.puzzle_data as Record<string, unknown>)?.quote_id
          if (typeof qid === 'string') usedQuoteIds.add(qid)
        }
        console.log(`[gen] Quoted: ${QUOTED_DB.length} replik, ${usedQuoteIds.size} kullanılmış`)

        for (const d of missing) {
          const dow = new Date(d + 'T00:00:00Z').getUTCDay()
          const diffKey = dow === 0 ? 6 : dow - 1
          const diff = DIFF[diffKey] ?? 3

          const result = await quotedData(d, usedQuoteIds)
          if (!result) {
            rpt.rejected++; rpt.per_game.quoted.rejected++
            rpt.errors.push(`quoted/${d}: uygun replik bulunamadı`)
            continue
          }

          const { error } = await db().from('daily_puzzles').insert({
            date: d,
            game_type: 'quoted',
            film_id: (result.puzzleData.tmdb_id as number) ?? null,
            puzzle_data: result.puzzleData,
            solution_ref: result.solutionRef,
            difficulty: diff,
            validation_status: 'valid',
            max_attempts: 4,
            clues: { quote: result.puzzleData.quote, context_hint: result.puzzleData.context_hint },
          })

          if (error) {
            if (error.code === '23505') continue // zaten var
            rpt.rejected++; rpt.per_game.quoted.rejected++
            console.error(`[gen] INSERT quoted/${d}: ${error.message}`)
          } else {
            // Kullanılan quote_id'yi işaretle
            usedQuoteIds.add(result.puzzleData.quote_id as string)
            rpt.generated++; rpt.per_game.quoted.generated++
          }
        }
        continue
      }

      const pool = await fetchFilms(game, usedInRun, dirs, rpt)
      console.log(`[gen] Havuz: ${pool.length} film`)

      if (pool.length < 5) {
        const msg = `Havuz çok küçük: ${game} — ${pool.length}`
        rpt.errors.push(msg)
        await sentryCapture({ message: `[gen] ${msg}`, level: 'error', tags: { function: 'generate-puzzles', game } })
      }

      for (const d of missing) {
        const ok = await genOne(game, d, pool, rpt, usedInRun, themes.get(d) ?? null)
        if (!ok) {
          console.warn(`[gen] ${game}/${d}: acil havuza düşülüyor`)
          const eOk = await useEmergency(game, d, rpt)
          if (!eOk) rpt.errors.push(`${game}/${d}: üretilemedi`)
        }
      }

      // Acil havuzu tamamla (logline AI çağrısı ağır — skip, quoted replik havuzundan — skip)
      if (game !== 'logline') {
        await fillEmergency(game, pool, rpt)
      }
    }

    // Tema uzlaştırma: gerçekten eşleşen oyunları yaz, eşik altındakileri düşür
    if (themeCfg && themes.size > 0) {
      await reconcileThemes(themes, themeCfg, rpt)
    }

    await postHog(rpt)

    const out = { status: rpt.errors.length ? 'partial' : 'ok', ms: Date.now()-t0, ...rpt }
    console.log(`[gen] RAPOR:`, JSON.stringify(out))
    return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } })

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    rpt.errors.push(msg)
    await sentryCapture({ message: `[gen] FATAL: ${msg}`, level: 'fatal', tags: { function: 'generate-puzzles' } })
    await postHog(rpt)
    return new Response(JSON.stringify({ error: msg, ...rpt }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
