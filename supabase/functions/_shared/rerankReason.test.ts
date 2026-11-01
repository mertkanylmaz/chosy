/**
 * rerank-films gerekçe prompt'u + ayrı günlük sayaç (Faz 2-1b).
 * Run: deno test --allow-read --unstable-sloppy-imports supabase/functions/_shared/rerankReason.test.ts
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  REASON_DEFAULT_MODEL,
  REASON_HARD_MAX_WORDS,
  countWords,
  enforceNoDigits,
  enforceReasonLength,
  REASON_MAX_WORDS,
  REASON_SYSTEM_PROMPT,
  RERANK_IDS_DAILY_KEY,
  RERANK_REASONS_DAILY_KEY,
  dailyCounterKey,
} from './rerankReason.ts'
import { RERANK_DAILY_FREE, RERANK_DAILY_PREMIUM } from './dailyLimit.ts'

const words = (s: string): number => s.trim().split(/\s+/).filter((w) => w.length > 0).length

/** Prompt'taki tırnaklı örnek satırlar (2 boşluk girintili "…"). */
const examples = (): string[] =>
  [...REASON_SYSTEM_PROMPT.matchAll(/^ {2}"(.+)"$/gm)].map((m) => m[1])

Deno.test('REASON_MAX_WORDS = 12 ve prompt bu sayiyi kullanir', () => {
  assertEquals(REASON_MAX_WORDS, 12)
  assertMatch(REASON_SYSTEM_PROMPT, /at most 12 words/)
  assertMatch(REASON_SYSTEM_PROMPT, /Max 12 words/)
  assert(!/15 words/.test(REASON_SYSTEM_PROMPT))
})

Deno.test('"filmin adini koru" satiri kalkti; yerine adi tekrarlama + ozet yok kurali', () => {
  assert(!/Keep the film title/i.test(REASON_SYSTEM_PROMPT))
  assertMatch(REASON_SYSTEM_PROMPT, /Do not repeat the film title and do not summarize the plot/)
  assertMatch(REASON_SYSTEM_PROMPT, /why this film suits THIS mood tonight, not what the film is about/)
  assertMatch(REASON_SYSTEM_PROMPT, /Do not mention the film title/)
})

Deno.test('3 EN + 3 TR ornek, hepsi <=12 kelime, tek cumle, film adi/ozet biciminde degil', () => {
  const ex = examples()
  assertEquals(ex.length, 6)
  const [en, tr] = [ex.slice(0, 3), ex.slice(3)]
  assertEquals(en, [
    'Warm enough to unwind, sharp enough that your brain still plays.',
    'A twisty mystery that asks for attention, not energy: right for tonight.',
    "Gentle and funny, with a small twist that won't wear you out.",
  ])
  assertEquals(tr, [
    'Yorgun bir akşama göre: sıcak, hafif ve sonunda küçük bir sürpriz.',
    'Yağmurlu bir akşam için yavaş, sakin ve içine çeken bir hikâye.',
    'Kafanı yormadan güldürür; arkadaşlarla rahatça izlenecek bir akşam filmi.',
  ])
  for (const e of ex) {
    assert(words(e) <= REASON_MAX_WORDS, `${words(e)} kelime: ${e}`)
    assert(!/ follows | tells the story | is about /i.test(e), `ozet bicimi: ${e}`)
    assertEquals(e.match(/[.!?](\s|$)/g)?.length ?? 0, 1, `tek cumle degil: ${e}`)
  }
})

Deno.test('eski ornekler (adla baslayan) prompt\'ta kalmadi', () => {
  for (const old of ['Amélie,', 'Memento,', 'Superbad,']) assert(!REASON_SYSTEM_PROMPT.includes(old), old)
})

Deno.test('id-rerank mevcut sayaci, gerekce AYRI sayaci kullanir; ikisi de -daily ile biter', () => {
  assertEquals(dailyCounterKey(false), 'rerank-films-daily')
  assertEquals(dailyCounterKey(true), 'rerank-films-reasons-daily')
  assertEquals(RERANK_IDS_DAILY_KEY, 'rerank-films-daily')
  assertEquals(RERANK_REASONS_DAILY_KEY, 'rerank-films-reasons-daily')
  assert(RERANK_IDS_DAILY_KEY.endsWith('-daily') && RERANK_REASONS_DAILY_KEY.endsWith('-daily'))
  assert(dailyCounterKey(true) !== dailyCounterKey(false))
})

Deno.test('limitler ayni (free 15 / premium+legacy 60) ve index.ts ayni lookupDailyLimit ile iki sayaca da uygular', () => {
  assertEquals([RERANK_DAILY_FREE, RERANK_DAILY_PREMIUM], [15, 60])
  const src = Deno.readTextFileSync(new URL('../rerank-films/index.ts', import.meta.url)).replaceAll('\r\n', '\n')
  assertMatch(src, /const withReason = body\.reason === true/)
  assertMatch(src, /const maxPerDay = await lookupDailyLimit\(auth\.appUserId\)/)
  assertMatch(src, /checkDailyLimit\(auth\.authUserId, dailyCounterKey\(withReason\), maxPerDay\)/)
  // sayac govde dogrulamasindan SONRA (gecersiz govde sayaci yakmaz)
  assert(src.indexOf('missing or empty candidates') < src.indexOf('dailyCounterKey(withReason)'))
  // reasonGuard aynen
  assertMatch(src, /guardReasons\(reasons, moodText, titlesById\)/)
  assertMatch(src, /import \{ guardReasons \} from '\.\.\/_shared\/reasonGuard\.ts'/)
})

// ─── Uzunluk koruması ────────────────────────────────────────────────────────

const nWords = (n: number): string => Array.from({ length: n }, (_, i) => `k${i}`).join(' ')

Deno.test('uzunluk korumasi: >16 kelime "" olur (anahtar kalir), <=16 aynen kabul', () => {
  assertEquals(REASON_HARD_MAX_WORDS, 16)
  const r = enforceReasonLength({ a: nWords(16), b: nWords(17), c: nWords(12), d: nWords(40) })
  assertEquals(r.reasons.a, nWords(16)) // sinir dahil kabul
  assertEquals(r.reasons.b, '')
  assertEquals(r.reasons.c, nWords(12))
  assertEquals(r.reasons.d, '')
  assertEquals(r.dropped.sort(), ['b', 'd'])
})

Deno.test('uzunluk korumasi: bos/bosluk dokunulmaz, sayim tek bosluga duyarsiz, TR 14 kelimelik ornek kabul', () => {
  assertEquals(countWords('  iki   kelime \n'), 2)
  assertEquals(countWords(''), 0)
  assertEquals(enforceReasonLength({ a: '' }).dropped, [])
  // smoke'ta cikan 14 kelimelik TR gerekce artik KABUL (12 prompt hedefi, 16 sert sinir)
  const fourteen = "Yalnızlık ve sessizlik üzerine; Tokyo'nun ıslak sokaklarında iki kayıp ruh: tam bu akşam için."
  assertEquals(countWords(fourteen), 14)
  assertEquals(enforceReasonLength({ a: fourteen }).reasons.a, fourteen)
})

// ─── Model zinciri (TR gerekce: Sonnet → Haiku) ──────────────────────────────

Deno.test('tek model: Haiku; Sonnet adimi kaldirildi', () => {
  assertEquals(REASON_DEFAULT_MODEL, 'claude-haiku-4-5')
  const mod = Deno.readTextFileSync(new URL('./rerankReason.ts', import.meta.url))
  assert(!/sonnet/i.test(mod.replace(/\/\*[\s\S]*?\*\//g, '')), 'kodda Sonnet kalmamali')
})

Deno.test('TR prompt: gunluk konusma kurali vurgulu + iki kotu ornek (yatislayici, Parizyali cekintisizligi) nedenleriyle', () => {
  assertMatch(REASON_SYSTEM_PROMPT, /plain spoken everyday Turkish \(günlük konuşma Türkçesi\)/)
  assertMatch(REASON_SYSTEM_PROMPT, /BAD: "yatışlayıcı görüntüler" — "yatışlayıcı" is an invented word/)
  assertMatch(REASON_SYSTEM_PROMPT, /BAD: "Parizyalı çekintisizliği" — a word-for-word calque/)
  assertEquals((REASON_SYSTEM_PROMPT.match(/BAD:/g) ?? []).length, 2)
})

Deno.test('index.ts sozlesmesi: tek Haiku modeli, guard sirasi, reasons_dropped toplami', () => {
  const src = Deno.readTextFileSync(new URL('../rerank-films/index.ts', import.meta.url)).replaceAll('\r\n', '\n')
  assertMatch(src, /const usedModel = REASON_DEFAULT_MODEL/)
  assertMatch(src, /const parsed = await generate\(usedModel\)/)
  assert(!/reasonModelChain|REASON_MODEL_FALLBACK|sonnet/i.test(src))
  // reasonGuard once, uzunluk korumasi sonra; sayac toplanir
  assert(src.indexOf('guardReasons(reasons, moodText, titlesById)') < src.indexOf('enforceReasonLength(guarded.reasons)'))
  assert(src.indexOf('enforceReasonLength(guarded.reasons)') < src.indexOf('enforceNoDigits(lengthPass.reasons)'))
  assertMatch(src, /reasons_dropped: guarded\.dropped\.length \+ \(lengthPass\?\.dropped\.length \?\? 0\) \+ lengthChecked\.dropped\.length/)
  // model adi sabit degil, zincirden gelir
  assert(!/model: 'claude-haiku-4-5'/.test(src))
})

Deno.test('enforceNoDigits: rakam iceren gerekce "" olur, anahtar korunur, rakamsiz aynen', () => {
  const r = enforceNoDigits({ a: 'Sadece 90 dakika, hafif.', b: 'A 2019 classic.', c: 'Sakin ve hafif bir akşam.', d: '' })
  assertEquals(r.reasons, { a: '', b: '', c: 'Sakin ve hafif bir akşam.', d: '' })
  assertEquals(r.dropped.sort(), ['a', 'b'])
})

Deno.test('reason prompt: olgusal iddia/sayi yasagi + olduğundan hafif/agir gosterme + temkinli uyum', () => {
  assertMatch(REASON_SYSTEM_PROMPT, /Never write factual claims or numbers: no runtime, year, cast, awards or counts/)
  assertMatch(REASON_SYSTEM_PROMPT, /Do not make a film sound lighter or heavier than it is; if the fit is weak, say so more cautiously/)
})

Deno.test('index.ts: aday satirinda runtime, genres_exclude yalniz pick yolunda, pick prompt kisit kurali', () => {
  const src = Deno.readTextFileSync(new URL('../rerank-films/index.ts', import.meta.url)).replaceAll('\r\n', '\n')
  assertMatch(src, /\(\$\{c\.year \?\? '\?'\}\)\$\{runtime\} \| \$\{genres\} \| \$\{overview\}/)
  assertMatch(src, /const excluded = !withReason && Array\.isArray\(body\.genres_exclude\)/)
  assertMatch(src, /Respect explicit constraints: if the mood says "not intense", "not scary"/)
  assertMatch(src, /never select a film that has any of those genres/)
})
