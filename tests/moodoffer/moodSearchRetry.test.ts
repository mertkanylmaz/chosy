/**
 * Mood aramasında idempotency kimliği, 429 ayrımı ve satın alma sonrası etkinleşme (MONEY-1C Faz 2b-g).
 * Run: npm run test:mood-offer
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  ACTIVATION_MAX_ATTEMPTS,
  ACTIVATION_RETRY_MS,
  classifyMoodSearchError,
  createSearchAttempts,
  inProgressWaitMs,
  nextActivationStep,
} from '../../utils/moodSearchRetry.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

Deno.test('429 ayrımı: paywall YALNIZ günlük kota kodunda', () => {
  assertEquals(classifyMoodSearchError('QUOTA_EXCEEDED'), 'paywall')
  for (const c of ['RATE_LIMIT_EXCEEDED', 'IN_PROGRESS', 'SERVICE_UNAVAILABLE', 'QUOTA_UNAVAILABLE', 'TIER_NOT_CONFIGURED',
    'RERANK_DAILY_LIMIT', 'PARSE_FAILED', 'NETWORK_ERROR', 'INVALID_INPUT', 'APP_USER_MISSING', '', 'unknown']) {
    assert(classifyMoodSearchError(c) !== 'paywall', c)
  }
  assertEquals(classifyMoodSearchError('RATE_LIMIT_EXCEEDED'), 'rate_limited')
  assertEquals(classifyMoodSearchError('IN_PROGRESS'), 'retry_same_id')
  assertEquals(classifyMoodSearchError('SERVICE_UNAVAILABLE'), 'unavailable')
})

Deno.test('client_search_id: aynı metin bitmemişse AYNI kimlik; başarıdan sonra yeni; farklı metin yeni', () => {
  let n = 0
  const a = createSearchAttempts(() => `id-${++n}`)
  assertEquals(a.idFor('rainy sunday'), { id: 'id-1', isRetry: false })
  assertEquals(a.idFor('rainy sunday'), { id: 'id-1', isRetry: true }) // yeniden dene / 409 / satın alma sonrası
  assertEquals(a.idFor('rainy sunday'), { id: 'id-1', isRetry: true })
  a.succeeded()
  assertEquals(a.idFor('rainy sunday'), { id: 'id-2', isRetry: false }) // yeni arama = yeni hak
  assertEquals(a.idFor('something else'), { id: 'id-3', isRetry: false }) // farklı metin = farklı arama
  assertEquals(a.idFor('rainy sunday'), { id: 'id-4', isRetry: false })
})

Deno.test('etkinleşme: hak duvarı/hız sınırı/IN_PROGRESS → 3 sn arayla yeniden; 10. denemede vazgeç; diğerleri ilerler', () => {
  assertEquals(nextActivationStep(null, 1), { kind: 'proceed' })
  assertEquals(nextActivationStep('QUOTA_EXCEEDED', 1), { kind: 'retry', waitMs: ACTIVATION_RETRY_MS })
  assertEquals(nextActivationStep('QUOTA_EXCEEDED', ACTIVATION_MAX_ATTEMPTS - 1), { kind: 'retry', waitMs: 3000 })
  assertEquals(nextActivationStep('QUOTA_EXCEEDED', ACTIVATION_MAX_ATTEMPTS), { kind: 'give_up' })
  assertEquals(nextActivationStep('RATE_LIMIT_EXCEEDED', 2, 12_000), { kind: 'retry', waitMs: 12_000 })
  assertEquals(nextActivationStep('IN_PROGRESS', 2, 1000), { kind: 'retry', waitMs: 3000 })
  for (const c of ['SERVICE_UNAVAILABLE', 'PARSE_FAILED', 'NETWORK_ERROR', 'INVALID_INPUT']) {
    assertEquals(nextActivationStep(c, 1), { kind: 'proceed' }, c)
  }
  assert(ACTIVATION_MAX_ATTEMPTS * ACTIVATION_RETRY_MS >= 30_000 - ACTIVATION_RETRY_MS)
})

Deno.test('IN_PROGRESS bekleme: retry_after sn → 1..8 sn', () => {
  assertEquals(inProgressWaitMs(5), 5000)
  assertEquals(inProgressWaitMs(0.2), 1000)
  assertEquals(inProgressWaitMs(60), 8000)
  for (const bad of [undefined, null, 'x', -3, 0]) assertEquals(inProgressWaitMs(bad), 5000)
})

Deno.test('kaynak: kimlik YALNIZ bayrak açıkken gönderilir; tasteParser alanı yalnız verilince yazar', () => {
  const screen = read('components/Home/MoodSearchScreen/index.tsx')
  assertMatch(screen, /const attempt = offerEnabled \? attempts\.current\.idFor\(trimmed\) : null/)
  assertMatch(screen, /attempts\.current\.succeeded\(\)/)
  const parser = read('services/tasteParser.ts')
  assertMatch(parser, /clientSearchId \? \{ raw_input: input, client_search_id: clientSearchId \} : \{ raw_input: input \}/)
  assertMatch(parser, /code === 'IN_PROGRESS'/)
  // yeniden denemede istemci içi dakikalık sınır sayılmaz (yeni arama değil)
  assertMatch(parser, /if \(!\(opts\.isRetry && opts\.clientSearchId\)\) await checkRateLimit\(\)/)
})

Deno.test('kaynak: paywall yalnız classify==="paywall"; etkinleşme döngüsü paywall açmaz; bekleyen arama yetki geçişinde', () => {
  const screen = read('components/Home/MoodSearchScreen/index.tsx')
  assertMatch(screen, /classifyMoodSearchError\(errorCode\) === 'paywall'/)
  assert(!/userError\.type === 'quota'/.test(screen))
  // etkinleşme modunda hata/paywall gösterilmeden döner
  assertMatch(screen, /opts\?\.activation && nextActivationStep\(errorCode, 1\)\.kind !== 'proceed'/)
  assertMatch(screen, /!prevEntitled\.current && proEntitled/)
  assertMatch(screen, /pendingActivation\.current = trimmed/)
})

Deno.test('kaynak: PRODUCT_ALREADY_PURCHASED → ödeme hatası değil, otomatik restore', () => {
  assertMatch(read('services/purchaseService.ts'), /PRODUCT_ALREADY_PURCHASED_ERROR:\s*\n?\s*return 'already_purchased'/)
  const pw = read('components/paywalls/PaywallBase/index.tsx')
  assertMatch(pw, /result\.errorKind === 'already_purchased'[\s\S]{0,400}await performRestore\(\)/)
})

Deno.test('rerank 429 (RERANK_DAILY_LIMIT / hız sınırı): deste rerank olmadan sürer, paywall yok', () => {
  const rec = read('services/recommendations.ts')
  // !res.ok → http_error; hiçbir 429 dalı paywall tetiklemez
  assertMatch(rec, /RERANK_HTTP_ERROR[\s\S]{0,200}failure: 'http_error'/)
  assert(!/triggerPaywall|mood_offer/.test(rec))
})

Deno.test('locales: yeni anahtarlar en/tr parite', () => {
  const en = JSON.parse(read('locales/en.json')).moodOffer
  const tr = JSON.parse(read('locales/tr.json')).moodOffer
  for (const k of ['activating', 'activatingTimeout', 'errorInProgress']) {
    assert(typeof en[k] === 'string' && en[k].length > 0, `en.${k}`)
    assert(typeof tr[k] === 'string' && tr[k].length > 0, `tr.${k}`)
  }
})
