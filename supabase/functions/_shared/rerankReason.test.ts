/**
 * rerank-films gerekçe prompt'u + ayrı günlük sayaç (Faz 2-1b).
 * Run: deno test --allow-read --unstable-sloppy-imports supabase/functions/_shared/rerankReason.test.ts
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
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
