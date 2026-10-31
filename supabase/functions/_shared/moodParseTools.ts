/**
 * parse-mood v2 (MOOD-VEC-2e): iki paralel zorunlu tool_use çağrısı. Saf fonksiyonlar — ağ yok.
 *
 *   Çağrı A: v1 profil şeması (TasteProfile + search_keywords + profil alanları), v1 prompt'unun aynısı.
 *   Çağrı B: yalnız v2 ek alanları (genres_include/exclude, max_runtime, reference_titles, suggested_titles).
 *
 * tool_choice ile araç zorunlu olduğundan model JSON metni üretmez; şema doğrulaması yine de
 * burada yapılır (enum/aralık dışı değer → çağrı başına 1 retry, bkz. callWithRetry).
 */
import { TMDB_GENRES } from './moodV2.ts'

export const PROFILE_TOOL_NAME = 'emit_taste_profile'
export const V2_TOOL_NAME = 'emit_v2_fields'

const EMOTIONS = ['joy', 'sadness', 'fear', 'anger', 'surprise', 'disgust', 'trust', 'anticipation'] as const
const PACE = ['slow', 'medium', 'fast'] as const
const VISUAL = ['minimalist', 'cinematic', 'experimental', 'lush', 'raw'] as const
const ENDING = ['hopeful', 'bittersweet', 'open', 'tragic', 'triumphant'] as const
const NARRATIVE = ['linear', 'nonlinear', 'anthology', 'dialogue-driven'] as const
const SOCIAL = ['alone', 'couple', 'friends', 'family'] as const

const unit = { type: 'number', minimum: 0, maximum: 1 }
const titleRef = {
  type: 'object',
  properties: { title: { type: 'string' }, year: { type: ['integer', 'null'] } },
  required: ['title', 'year'],
}

export const PROFILE_TOOL = {
  name: PROFILE_TOOL_NAME,
  description: 'Return the 12-dimensional taste profile for the described mood.',
  input_schema: {
    type: 'object' as const,
    properties: {
      emotional_state: {
        type: 'object',
        properties: Object.fromEntries(EMOTIONS.map((e) => [e, unit])),
        required: [...EMOTIONS],
      },
      energy_level: unit,
      pace_preference: { type: 'string', enum: [...PACE] },
      visual_style: { type: 'string', enum: [...VISUAL] },
      thematic_depth: unit,
      ending_preference: { type: 'string', enum: [...ENDING] },
      era_preference: {
        type: 'object',
        properties: { from: { type: 'integer' }, to: { type: 'integer' } },
        required: ['from', 'to'],
      },
      cultural_context: { type: 'array', items: { type: 'string' } },
      avoid_signals: { type: 'array', items: { type: 'string' } },
      narrative_style: { type: 'string', enum: [...NARRATIVE] },
      social_context: { type: 'string', enum: [...SOCIAL] },
      rewatch_tolerance: { type: 'boolean' },
      profile_name: { type: 'string' },
      profile_description: { type: 'string' },
      search_keywords: { type: 'array', items: { type: 'string' } },
    },
    required: [
      'emotional_state', 'energy_level', 'pace_preference', 'visual_style', 'thematic_depth',
      'ending_preference', 'era_preference', 'cultural_context', 'avoid_signals', 'narrative_style',
      'social_context', 'rewatch_tolerance', 'profile_name', 'profile_description', 'search_keywords',
    ],
  },
}

export const V2_TOOL = {
  name: V2_TOOL_NAME,
  description: 'Return genre filters, runtime limit and film title lists for the described mood.',
  input_schema: {
    type: 'object' as const,
    properties: {
      genres_include: { type: 'array', items: { type: 'string', enum: [...TMDB_GENRES] } },
      genres_exclude: { type: 'array', items: { type: 'string', enum: [...TMDB_GENRES] } },
      max_runtime: { type: ['integer', 'null'] },
      reference_titles: { type: 'array', items: titleRef },
      suggested_titles: { type: 'array', items: titleRef },
    },
    required: ['genres_include', 'genres_exclude', 'max_runtime', 'reference_titles', 'suggested_titles'],
  },
}

export const V2_SYSTEM_PROMPT = `You extract film-search hints from a user's mood description (English or Turkish). Call the tool once.

- genres_include / genres_exclude: ONLY the allowed genre names, max 4 each. Include a genre only when the mood clearly implies it ("need a laugh" → ["Comedy"]); otherwise []. Exclude only what the user clearly rejects ("no horror" → ["Horror"]). Never put the same genre in both.
- max_runtime: integer minutes ONLY if the user states a time limit ("I have 90 minutes", "short film"). Otherwise null. Do not infer it from the mood.
- reference_titles: films the user explicitly names as a reference ("like Inception"), with the original release year. [] if none.
- suggested_titles: 5-6 real, well-known films that fit this mood, the kind an average US moviegoer would recognize. Do NOT include the films in reference_titles. Use exact English release titles and the release year.`

const isObj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isUnit = (v: unknown): boolean => isNum(v) && v >= 0 && v <= 1
const inSet = (v: unknown, set: readonly string[]): boolean => typeof v === 'string' && set.includes(v)
const isStrArr = (v: unknown): boolean => Array.isArray(v) && v.every((x) => typeof x === 'string')

/** Çağrı A çıktısı geçerliyse kendisi, değilse null. */
export function validateProfile(input: unknown): Record<string, unknown> | null {
  if (!isObj(input)) return null
  const es = input.emotional_state
  if (!isObj(es) || !EMOTIONS.every((e) => isUnit(es[e]))) return null
  if (!isUnit(input.energy_level) || !isUnit(input.thematic_depth)) return null
  if (!inSet(input.pace_preference, PACE) || !inSet(input.visual_style, VISUAL)) return null
  if (!inSet(input.ending_preference, ENDING) || !inSet(input.narrative_style, NARRATIVE)) return null
  if (!inSet(input.social_context, SOCIAL)) return null
  const era = input.era_preference
  if (!isObj(era) || !isNum(era.from) || !isNum(era.to)) return null
  if (!isStrArr(input.cultural_context) || !isStrArr(input.avoid_signals) || !isStrArr(input.search_keywords)) return null
  if (typeof input.rewatch_tolerance !== 'boolean') return null
  if (typeof input.profile_name !== 'string' || typeof input.profile_description !== 'string') return null
  return input
}

/** Çağrı B çıktısı geçerliyse kendisi, değilse null. Değer temizliği normalizeV2Fields'ın işi. */
export function validateV2Fields(input: unknown): Record<string, unknown> | null {
  if (!isObj(input)) return null
  if (!Array.isArray(input.genres_include) || !Array.isArray(input.genres_exclude)) return null
  if (!Array.isArray(input.reference_titles) || !Array.isArray(input.suggested_titles)) return null
  if (input.max_runtime !== null && !isNum(input.max_runtime)) return null
  return input
}

export interface ToolCallResult {
  /** Doğrulanmış çıktı; iki denemede de geçersizse null. */
  value: Record<string, unknown> | null
  attempts: number
  /** Başarısız (şema) deneme sayısı. */
  schemaFailures: number
  tokensIn: number
  tokensOut: number
}

export interface RawToolResponse {
  /** tool_use bloğunun input'u; blok yoksa undefined. */
  input: unknown
  tokensIn: number
  tokensOut: number
}

/**
 * `call` her çağrıda ham tool_use girdisini döner (API hatası fırlatır ve burada YAKALANMAZ —
 * ağ/kota hataları retry konusu değildir). Şema geçersizse bir kez daha denenir.
 */
export async function callWithRetry(
  call: (attempt: number) => Promise<RawToolResponse>,
  validate: (input: unknown) => Record<string, unknown> | null,
  maxAttempts = 2,
): Promise<ToolCallResult> {
  let tokensIn = 0
  let tokensOut = 0
  let schemaFailures = 0
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const raw = await call(attempt)
    tokensIn += raw.tokensIn
    tokensOut += raw.tokensOut
    const value = validate(raw.input)
    if (value) return { value, attempts: attempt, schemaFailures, tokensIn, tokensOut }
    schemaFailures += 1
  }
  return { value: null, attempts: maxAttempts, schemaFailures, tokensIn, tokensOut }
}

// ─── Paralel çalıştırıcı ──────────────────────────────────────────────────────

export interface ToolMessage {
  content: { type: string; input?: unknown }[]
  usage?: {
    input_tokens?: number
    output_tokens?: number
    cache_creation_input_tokens?: number | null
    cache_read_input_tokens?: number | null
  }
}

/** Anthropic `messages.create` ile uyumlu, SDK'dan bağımsız imza (test + Node ölçüm betiği için). */
export type CreateFn = (params: Record<string, unknown>, timeoutMs: number) => Promise<ToolMessage>

export interface CallStats extends ToolCallResult {
  ms: number
  cacheCreationTokens: number
  cacheReadTokens: number
  /** Yalnız B: API/ağ hatası mesajı (A'da hata fırlatılır). */
  error: string | null
}

export interface ParseV2Result {
  a: CallStats
  b: CallStats
  /** max(A, B) süresi. */
  totalMs: number
}

const MODEL = 'claude-haiku-4-5'
const MIN_RETRY_TIMEOUT_MS = 3_000

async function timed(
  create: CreateFn,
  system: string,
  tool: { name: string },
  toolDef: unknown,
  maxTokens: number,
  rawInput: string,
  validate: (input: unknown) => Record<string, unknown> | null,
  deadlineMs: number,
): Promise<CallStats> {
  const t0 = Date.now()
  let cacheCreationTokens = 0
  let cacheReadTokens = 0
  const result = await callWithRetry(async () => {
    const remaining = Math.max(MIN_RETRY_TIMEOUT_MS, deadlineMs - (Date.now() - t0))
    const msg = await create(
      {
        model: MODEL,
        max_tokens: maxTokens,
        system,
        tools: [toolDef],
        tool_choice: { type: 'tool', name: tool.name },
        messages: [{ role: 'user', content: rawInput }],
      },
      remaining,
    )
    cacheCreationTokens += msg.usage?.cache_creation_input_tokens ?? 0
    cacheReadTokens += msg.usage?.cache_read_input_tokens ?? 0
    return {
      input: msg.content.find((b) => b.type === 'tool_use')?.input,
      tokensIn: msg.usage?.input_tokens ?? 0,
      tokensOut: msg.usage?.output_tokens ?? 0,
    }
  }, validate)
  return { ...result, ms: Date.now() - t0, cacheCreationTokens, cacheReadTokens, error: null }
}

/**
 * A ve B paralel. A'daki API/ağ hatası fırlatılır (mevcut hata yolu); A'nın şema hatası
 * `a.value === null` olarak döner (çağıran karar verir). B'deki herhangi bir hata `b.value = null`
 * olarak döner ve `b.error` dolar — v2 alanları boş kalır, akış v1 kalitesinde sürer.
 */
export async function runParseV2(
  create: CreateFn,
  systemA: string,
  rawInput: string,
  deadlineMs = 25_000,
): Promise<ParseV2Result> {
  const t0 = Date.now()
  const [a, b] = await Promise.all([
    timed(create, systemA, PROFILE_TOOL, PROFILE_TOOL, 1024, rawInput, validateProfile, deadlineMs),
    timed(create, V2_SYSTEM_PROMPT, V2_TOOL, V2_TOOL, 512, rawInput, validateV2Fields, deadlineMs).catch(
      (e: unknown): CallStats => ({
        value: null, attempts: 0, schemaFailures: 0, tokensIn: 0, tokensOut: 0, ms: Date.now() - t0,
        cacheCreationTokens: 0, cacheReadTokens: 0, error: e instanceof Error ? e.message : String(e),
      }),
    ),
  ])
  return { a, b, totalMs: Math.max(a.ms, b.ms) }
}

/** Önbellek anahtarı için prompt sürümü girdisi: iki prompt + iki araç şeması. */
export function parseV2PromptFingerprint(systemA: string): string {
  return [systemA, V2_SYSTEM_PROMPT, JSON.stringify(PROFILE_TOOL), JSON.stringify(V2_TOOL)].join('\n---\n')
}
