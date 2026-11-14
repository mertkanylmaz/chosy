/**
 * Güvenlik P0 (145) kaynak kilitleri — Edge Function giriş noktaları `Deno.serve` çağırdığı
 * için import edilerek sınanamıyor; bu dosya DAVRANIŞI değil, açığı geri getirecek kod
 * biçimlerinin YOKLUĞUNU kilitler. Davranış kanıtı: supabase/tests/145_dryrun.sql (DB) ve
 * docs/security/145_VERIFICATION.md (yayın sonrası HTTP denemeleri).
 * Saf mantık testleri: supabase/functions/_shared/explainLimit.test.ts.
 * Run: npm run test:security-p0
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { isExpectedExplainThrottle } from '../../services/explainThrottle.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

/** Yorum satırlarını atar — kilitler yoruma değil koda bakar. */
const code = (src: string) =>
  src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

for (const fn of ['slot-mood-filtered', 'slot-pure-random', 'slot-triple']) {
  Deno.test(`${fn}: kimlik gövdeden okunmaz (body.user_id yedek yolu yok)`, () => {
    const src = code(read(`supabase/functions/${fn}/index.ts`))
    assert(!/body\.user_id/.test(src), 'body.user_id koda geri dönmüş')
    assert(!/bodyUserId/.test(src))
    // users araması yalnız doğrulanmış JWT'nin auth id'siyle yapılır
    const resolve = src.slice(src.indexOf('async function resolveUser'), src.indexOf("error: 'NO_USER_CONTEXT'"))
    assertEquals([...resolve.matchAll(/\.eq\('(\w+)', ([\w.]+)\)/g)].map((m) => `${m[1]}=${m[2]}`), ['auth_id=user.id'])
    assertMatch(resolve, /auth\.getUser\(\)/)
  })
}

Deno.test('slot-mood-filtered: rate limit kimlikten SONRA, LLM çağrısından ÖNCE', () => {
  const src = code(read('supabase/functions/slot-mood-filtered/index.ts'))
  const handler = src.slice(src.indexOf('Deno.serve('))
  const auth = handler.indexOf('await resolveUser(req)')
  const limit = handler.indexOf("await checkRateLimit(userId, 'slot-mood-filtered')")
  const llm = handler.indexOf('parseMoodToVector(')
  assert(auth >= 0 && limit > auth && llm > limit, `sıra bozuk: auth=${auth} limit=${limit} llm=${llm}`)
  assertMatch(read('supabase/functions/_shared/rateLimit.ts'), /'slot-mood-filtered': \{ maxRequests: 5, windowMs: 60_000 \}/)
})

Deno.test('process-referral: check_activations service-role kapısından geçmeden veri okumaz', () => {
  const src = code(read('supabase/functions/process-referral/index.ts'))
  const branch = src.slice(src.indexOf("body.action === 'check_activations'"))
  const gate = branch.indexOf('await requireServiceRole(req)')
  const firstRead = branch.indexOf(".from('referrals')")
  assert(gate >= 0 && firstRead > gate, `kapı ilk okumadan önce değil: gate=${gate} read=${firstRead}`)
  assertMatch(branch.slice(gate, firstRead), /if \(!svc\.ok\) return unauthorizedResponse\(svc, CORS_HEADERS\)/)
})

Deno.test('process-referral: aktivasyon yalnız sunucunun tamamladığı aramaları sayar', () => {
  const src = code(read('supabase/functions/process-referral/index.ts'))
  const q = src.slice(src.indexOf(".from('mood_searches')"), src.indexOf('if (countError)'))
  assertMatch(q, /\.eq\('status', 'completed'\)/)
})

Deno.test('process-referral: config.toml verify_jwt = false beyanı (sb_secret gateway\'de takılmasın)', () => {
  assertMatch(read('supabase/config.toml'), /\[functions\.process-referral\]\nverify_jwt = false/)
})

Deno.test('explain-match: sınır kapıları kimlikten sonra, LLM çağrısından önce', () => {
  const src = code(read('supabase/functions/explain-match/index.ts'))
  const auth = src.indexOf('await requireUser(req)')
  const limits = src.indexOf('await enforceExplainLimits(auth.authUserId')
  const llm = src.indexOf('client.messages.create(')
  assert(auth >= 0 && limits > auth && llm > limits, `sıra bozuk: auth=${auth} limits=${limits} llm=${llm}`)
})

Deno.test('explain-match: günlük tavan aşımı Sentry\'ye yazılmaz, log satırı düşer', () => {
  const src = code(read('supabase/functions/explain-match/index.ts'))
  const branch = src.slice(src.indexOf('err instanceof ExplainDailyLimitError'), src.indexOf('let userProfile'))
  assertMatch(branch, /console\.warn\(JSON\.stringify\(explainLimitLog\(err\)\)\)/)
  assert(!/sentryCapture/.test(branch.slice(0, branch.indexOf('return rateLimitResponse'))))
})

Deno.test('istemci: 429 beklenen sınırdır (exception değil); diğer her durum hatadır', () => {
  assertEquals(isExpectedExplainThrottle(429), true)
  for (const s of [null, 400, 401, 403, 500, 502, 503]) assertEquals(isExpectedExplainThrottle(s), false)
})

Deno.test('istemci: matchExplanation 429\'da captureException çağırmaz, şablona düşer', () => {
  const src = code(read('services/matchExplanation.ts'))
  const errBranch = src.slice(src.indexOf('if (error) {'), src.indexOf('} else if (data?.explanations'))
  assertMatch(errBranch, /if \(isExpectedExplainThrottle\(httpStatus\)\) \{\s+Sentry\.addBreadcrumb\(/)
  assertMatch(errBranch, /\} else \{\s+Sentry\.captureException\(error/)
})

Deno.test('migration 145: dört görünüm + grant_streak_rewards revoke', () => {
  const sql = read('supabase/migrations/145_security_p0.sql').split('\n').filter((l) => !l.startsWith('--')).join('\n')
  for (const v of ['mood_history', 'user_stats', 'v_posterle_daily_stats']) {
    assert(sql.includes(`ALTER VIEW public.${v} SET (security_invoker = true);`), `${v}: security_invoker yok`)
    assert(sql.includes(`REVOKE ALL ON public.${v} FROM PUBLIC, anon, authenticated;`), `${v}: revoke yok`)
  }
  // public_daily_puzzles bilinçli olarak definer kalır (daily_puzzles'ta policy yok)
  assert(!sql.includes('ALTER VIEW public.public_daily_puzzles'))
  assertMatch(sql, /REVOKE ALL ON public\.public_daily_puzzles FROM PUBLIC, anon, authenticated;/)
  assertMatch(sql, /GRANT SELECT \(id, game_id, puzzle_date\) ON public\.public_daily_puzzles TO authenticated;/)
  assert(!/GRANT[^;]*TO[^;]*\banon\b/.test(sql), 'anon\'a grant var')
  assertMatch(sql, /REVOKE EXECUTE ON FUNCTION public\.grant_streak_rewards\(uuid, integer\) FROM PUBLIC, anon, authenticated;/)
})
