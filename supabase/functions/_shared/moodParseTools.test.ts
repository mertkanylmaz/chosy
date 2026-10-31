import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import {
  callWithRetry,
  limitWords,
  PROFILE_TOOL,
  trimProfilePrompt,
  type CreateFn,
  parseV2PromptFingerprint,
  PROFILE_TOOL_NAME,
  runParseV2,
  V2_TOOL_NAME,
  validateProfile,
  validateV2Fields,
} from './moodParseTools.ts'

const SYS = 'p\n  "profile_description": "One sentence explaining the mood and what kind of film experience this person needs",\n- profile_name and profile_description must always be in English'
const goodProfile = () => ({
  emotional_state: { joy: 0.9, sadness: 0.1, fear: 0.1, anger: 0.1, surprise: 0.2, disgust: 0.1, trust: 0.5, anticipation: 0.2 },
  energy_level: 0.4,
  pace_preference: 'medium',
  visual_style: 'cinematic',
  thematic_depth: 0.2,
  ending_preference: 'hopeful',
  era_preference: { from: 1970, to: 2025 },
  cultural_context: [],
  avoid_signals: [],
  narrative_style: 'linear',
  social_context: 'alone',
  rewatch_tolerance: true,
  profile_name: 'Light Laughs',
  profile_description: 'Wants something funny.',
  search_keywords: ['comedy'],
})
const goodV2 = () => ({
  genres_include: ['Comedy'],
  genres_exclude: [],
  max_runtime: null,
  reference_titles: [],
  suggested_titles: [{ title: 'Superbad', year: 2007 }],
})

Deno.test('validateProfile: geçerli profil geçer, enum/aralık dışı değer null', () => {
  assertEquals(validateProfile(goodProfile()) !== null, true)
  assertEquals(validateProfile({ ...goodProfile(), pace_preference: 'sonic' }), null)
  assertEquals(validateProfile({ ...goodProfile(), energy_level: 1.5 }), null)
  assertEquals(validateProfile({ ...goodProfile(), emotional_state: { joy: 1 } }), null)
  assertEquals(validateProfile({ ...goodProfile(), search_keywords: 'a' }), null)
  assertEquals(validateProfile({ ...goodProfile(), rewatch_tolerance: 'yes' }), null)
  assertEquals(validateProfile(null), null)
  assertEquals(validateProfile([goodProfile()]), null)
})

Deno.test('validateV2Fields: geçerli geçer, eksik/yanlış tip null', () => {
  assertEquals(validateV2Fields(goodV2()) !== null, true)
  assertEquals(validateV2Fields({ ...goodV2(), max_runtime: 90 }) !== null, true)
  assertEquals(validateV2Fields({ ...goodV2(), suggested_titles: undefined }), null)
  assertEquals(validateV2Fields({ ...goodV2(), max_runtime: 'x' }), null)
  assertEquals(validateV2Fields('x'), null)
})

Deno.test('callWithRetry: ilk deneme geçerliyse retry yok', async () => {
  let n = 0
  const r = await callWithRetry(async () => { n++; return { input: goodV2(), tokensIn: 10, tokensOut: 5 } }, validateV2Fields)
  assertEquals([n, r.attempts, r.schemaFailures, r.tokensIn, r.tokensOut], [1, 1, 0, 10, 5])
})

Deno.test('callWithRetry: şema hatasında 1 retry, token toplanır', async () => {
  let n = 0
  const r = await callWithRetry(async () => {
    n++
    return { input: n === 1 ? { bad: true } : goodV2(), tokensIn: 10, tokensOut: 5 }
  }, validateV2Fields)
  assertEquals([n, r.attempts, r.schemaFailures, r.tokensIn, r.tokensOut], [2, 2, 1, 20, 10])
  assertEquals(r.value !== null, true)
})

Deno.test('callWithRetry: iki kez geçersiz → null (3. deneme yok)', async () => {
  let n = 0
  const r = await callWithRetry(async () => { n++; return { input: undefined, tokensIn: 1, tokensOut: 1 } }, validateV2Fields)
  assertEquals([n, r.value, r.schemaFailures], [2, null, 2])
})

Deno.test('callWithRetry: API hatası yakalanmaz, retry edilmez', async () => {
  let n = 0
  let thrown = ''
  try {
    await callWithRetry(async () => { n++; throw new Error('529 overloaded') }, validateV2Fields)
  } catch (e) {
    thrown = (e as Error).message
  }
  assertEquals([n, thrown], [1, '529 overloaded'])
})

function fakeCreate(opts: { aBad?: number; bBad?: number; bThrows?: boolean }): { create: CreateFn; calls: string[] } {
  const calls: string[] = []
  let aN = 0
  let bN = 0
  const create: CreateFn = async (params) => {
    const tc = (params.tool_choice as { name: string }).name
    calls.push(tc)
    if (tc === PROFILE_TOOL_NAME) {
      aN++
      return { content: [{ type: 'tool_use', input: aN <= (opts.aBad ?? 0) ? {} : goodProfile() }], usage: { input_tokens: 100, output_tokens: 50 } }
    }
    if (opts.bThrows) throw new Error('overloaded')
    bN++
    return { content: [{ type: 'tool_use', input: bN <= (opts.bBad ?? 0) ? {} : goodV2() }], usage: { input_tokens: 40, output_tokens: 20 } }
  }
  return { create, calls }
}

Deno.test('runParseV2: A ve B ikisi de çağrılır, tool_choice zorunlu', async () => {
  const { create, calls } = fakeCreate({})
  const r = await runParseV2(create, SYS, 'need a laugh')
  assertEquals(calls.sort(), [PROFILE_TOOL_NAME, V2_TOOL_NAME].sort())
  assertEquals(r.a.value !== null && r.b.value !== null, true)
  assertEquals(r.a.tokensIn + r.b.tokensIn, 140)
})

Deno.test('runParseV2: B iki kez geçersiz → b.value null, A etkilenmez', async () => {
  const { create, calls } = fakeCreate({ bBad: 2 })
  const r = await runParseV2(create, SYS, 'x')
  assertEquals(r.b.value, null)
  assertEquals(r.b.attempts, 2)
  assertEquals(r.a.value !== null, true)
  assertEquals(calls.filter((c) => c === V2_TOOL_NAME).length, 2)
})

Deno.test('runParseV2: B bir kez geçersiz → retry ile düzelir', async () => {
  const { create } = fakeCreate({ bBad: 1 })
  const r = await runParseV2(create, SYS, 'x')
  assertEquals(r.b.value !== null, true)
  assertEquals(r.b.schemaFailures, 1)
})

Deno.test('runParseV2: B API hatası fırlatmaz, error dolar; A hatası fırlatır', async () => {
  const r = await runParseV2(fakeCreate({ bThrows: true }).create, SYS, 'x')
  assertEquals(r.b.value, null)
  assertEquals(r.b.error, 'overloaded')
  assertEquals(r.a.value !== null, true)

  let thrown = false
  try {
    await runParseV2(async () => { throw new Error('credit balance is too low') }, SYS, 'x')
  } catch {
    thrown = true
  }
  assertEquals(thrown, true)
})

Deno.test('runParseV2: A iki kez geçersiz → a.value null (çağıran PARSE_FAILED atar)', async () => {
  const r = await runParseV2(fakeCreate({ aBad: 2 }).create, SYS, 'x')
  assertEquals(r.a.value, null)
})

Deno.test('parseV2PromptFingerprint: A prompt\'u değişince değişir', () => {
  assertNotEquals(parseV2PromptFingerprint(SYS), parseV2PromptFingerprint(SYS + 'x'))
})

// ─── 2e-2: profile_description yok, profile_name ≤ 4 kelime ───────────────────

async function serverSystemPrompt(): Promise<string> {
  const src = (await Deno.readTextFile(new URL('../parse-mood/index.ts', import.meta.url))).replace(/\r\n/g, '\n')
  const m = /const SYSTEM_PROMPT = `([\s\S]*?)`\n\n\/\/ ─── Quota Check/.exec(src)
  if (!m) throw new Error('SYSTEM_PROMPT bulunamadı')
  return m[1]
}

Deno.test('trimProfilePrompt: gerçek v1 prompt\'undan profile_description çıkar, kalan aynı', async () => {
  const v1 = await serverSystemPrompt()
  const v2 = trimProfilePrompt(v1)
  assertEquals(v1.includes('profile_description'), true) // v1 prompt'u değişmedi
  assertEquals(v2.includes('profile_description'), false)
  assertEquals(v2.includes('"profile_name": "2-3 word mood summary in English"'), true)
  assertEquals(v2.includes('"search_keywords"'), true)
  // Yalnız iki yer değişir: açıklama satırı silinir, İngilizce kuralı kısalır.
  assertEquals(
    v1.replace(/\n  "profile_description": "[^"]*",/, '').replace(
      '- profile_name and profile_description must always be in English',
      '- profile_name must always be in English (at most 4 words)',
    ),
    v2,
  )
})

Deno.test('trimProfilePrompt: beklenen satır yoksa fırlatır (sessiz fallback yok)', () => {
  let thrown = false
  try { trimProfilePrompt('başka bir prompt') } catch { thrown = true }
  assertEquals(thrown, true)
})

Deno.test('araç şeması: profile_description yok, profile_name var', () => {
  const props = PROFILE_TOOL.input_schema.properties as Record<string, unknown>
  assertEquals('profile_description' in props, false)
  assertEquals('profile_name' in props, true)
  assertEquals(PROFILE_TOOL.input_schema.required.includes('profile_description'), false)
})

Deno.test('validateProfile: profile_description olmadan geçerli', () => {
  const p: Record<string, unknown> = { ...goodProfile() }
  delete p.profile_description
  assertEquals(validateProfile(p) !== null, true)
})

Deno.test('limitWords: ≤ 4 kelime', () => {
  assertEquals(limitWords('Light  Warm Cozy Evening Vibes Tonight', 4), 'Light Warm Cozy Evening')
  assertEquals(limitWords('  Two Words ', 4), 'Two Words')
  assertEquals(limitWords('', 4), '')
})

Deno.test('runParseV2: A sistem prompt\'u profile_description içermez', async () => {
  const v1 = await serverSystemPrompt()
  const seen: string[] = []
  const create: CreateFn = async (params) => {
    seen.push(String(params.system))
    const tc = (params.tool_choice as { name: string }).name
    return { content: [{ type: 'tool_use', input: tc === PROFILE_TOOL_NAME ? goodProfile() : goodV2() }] }
  }
  await runParseV2(create, v1, 'x')
  assertEquals(seen.some((s) => s.includes('profile_description')), false)
})
