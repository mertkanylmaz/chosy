/**
 * revenuecat-webhook — TRANSFER karar mantığı ve applyEntitlement (Sprint 7).
 *
 * Koşum:  npm run test:rc-webhook
 *         (cd supabase/functions && deno test _shared/rcTransfer.test.ts)
 */

import { assertEquals, assertRejects } from 'jsr:@std/assert@1'

import {
  applyEntitlement,
  buildTransferDiagnostic,
  environmentFromSubscriber,
  type EntitlementWriter,
  fetchRcSubscriber,
  pickActiveEntitlement,
  processTransfer,
  RcRestError,
  type RcSubscriberInfo,
  type ReportParams,
  type SubscriptionUpsertRow,
  type TransferDeps,
  type UserTierFields,
} from './rcTransfer.ts'

const NOW = Date.parse('2026-10-03T12:00:00Z')
const FUTURE = '2026-11-03T12:00:00Z'
const PAST = '2026-09-03T12:00:00Z'

const B_AUTH = '11111111-2222-4333-8444-555555555555'
const B_APP = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

// ─── Sahte bağımlılıklar ────────────────────────────────────────────────────────

type Fake = {
  deps: TransferDeps
  userUpdates: Array<{ id: string; fields: UserTierFields }>
  upserts: SubscriptionUpsertRow[]
  reports: ReportParams[]
  restCalls: string[]
}

function fake(opts: {
  authUsers?: string[]
  appUsers?: Record<string, string>
  rc?: Record<string, RcSubscriberInfo>
  rcError?: RcRestError
  usersCount?: number
} = {}): Fake {
  const f: Fake = {
    userUpdates: [],
    upserts: [],
    reports: [],
    restCalls: [],
    deps: undefined as unknown as TransferDeps,
  }
  const writer: EntitlementWriter = {
    updateUserTier: (id, fields) => {
      f.userUpdates.push({ id, fields })
      return Promise.resolve({ error: null, count: opts.usersCount ?? 1 })
    },
    upsertSubscription: (row) => {
      f.upserts.push(row)
      return Promise.resolve({ error: null })
    },
  }
  f.deps = {
    authUserExists: (id) => Promise.resolve((opts.authUsers ?? []).includes(id)),
    resolveAppUserId: (id) => Promise.resolve(opts.appUsers?.[id] ?? null),
    fetchSubscriber: (id) => {
      f.restCalls.push(id)
      if (opts.rcError) return Promise.reject(opts.rcError)
      return Promise.resolve(opts.rc?.[id] ?? { entitlements: {}, subscriptions: {} })
    },
    writer,
    report: (p) => {
      f.reports.push(p)
      return Promise.resolve()
    },
    nowMs: () => NOW,
  }
  return f
}

const activeMonthly: RcSubscriberInfo = {
  entitlements: { chosy_plus: { expires_date: FUTURE, product_identifier: 'com.chosy.monthly' } },
  subscriptions: { 'com.chosy.monthly': { unsubscribe_detected_at: null } },
}

const ctx = { rcEventId: 'evt_1', transferredFrom: ['anon'], environment: 'SANDBOX' as const }

// ─── processTransfer: karar ağacı ───────────────────────────────────────────────

Deno.test('(a) $RCAnonymousID → 200 + error (TRANSFER_TARGET_UNRESOLVED), REST çağrılmaz, yazılmaz', async () => {
  const f = fake()
  const r = await processTransfer(['$RCAnonymousID:abc123'], ctx, f.deps)
  assertEquals(r.status, 200)
  assertEquals(r.outcomes, [{ id: '$RCAnonymousID:abc123', kind: 'unresolvable', reason: 'rc_anonymous' }])
  assertEquals(f.restCalls, [])
  assertEquals(f.userUpdates.length + f.upserts.length, 0)
  assertEquals(f.reports.map((p) => [p.level, p.tags.error_code]), [['error', 'TRANSFER_TARGET_UNRESOLVED']])
})

Deno.test('(a) UUID olmayan id ve auth.users\'ta olmayan UUID → 200, REST yok', async () => {
  const f = fake()
  const r = await processTransfer(['test_user_matrix_k49', B_AUTH], ctx, f.deps)
  assertEquals(r.status, 200)
  assertEquals(r.outcomes.map((o) => o.kind === 'unresolvable' ? o.reason : o.kind), ['not_uuid', 'auth_user_missing'])
  assertEquals(f.restCalls, [])
})

Deno.test('(b) auth var, public.users yok (giriş yarışı) → 500, REST yok', async () => {
  const f = fake({ authUsers: [B_AUTH] })
  const r = await processTransfer([B_AUTH], ctx, f.deps)
  assertEquals(r.status, 500)
  assertEquals(r.errorCode, 'RC_TRANSFER_APP_USER_RACE')
  assertEquals(f.restCalls, [])
  assertEquals(f.userUpdates.length + f.upserts.length, 0)
})

Deno.test('(c) çözülen hedef → REST + users ve subscriptions yazılır', async () => {
  const f = fake({ authUsers: [B_AUTH], appUsers: { [B_AUTH]: B_APP }, rc: { [B_AUTH]: activeMonthly } })
  const r = await processTransfer([B_AUTH], ctx, f.deps)
  assertEquals(r.status, 200)
  assertEquals(r.outcomes, [{ id: B_AUTH, kind: 'applied', tier: 'monthly', plan: 'monthly' }])
  assertEquals(f.restCalls, [B_AUTH])
  assertEquals(f.userUpdates[0].id, B_APP)
  assertEquals(f.userUpdates[0].fields.subscription_tier, 'monthly')
  assertEquals(f.userUpdates[0].fields.subscription_active_until, '2026-11-03T12:00:00.000Z')
  assertEquals(f.userUpdates[0].fields.subscription_will_renew, true)
  assertEquals(f.upserts, [{
    user_id: B_APP,
    plan: 'monthly',
    status: 'active',
    expires_at: '2026-11-03T12:00:00.000Z',
    entitlement_id: 'chosy_plus',
    environment: 'SANDBOX',
  }])
})

Deno.test('(c) aktif entitlement yok → hiçbir şey yazılmaz, info, 200', async () => {
  const expired: RcSubscriberInfo = {
    entitlements: { chosy_plus: { expires_date: PAST, product_identifier: 'com.chosy.monthly' } },
    subscriptions: {},
  }
  const f = fake({ authUsers: [B_AUTH], appUsers: { [B_AUTH]: B_APP }, rc: { [B_AUTH]: expired } })
  const r = await processTransfer([B_AUTH], ctx, f.deps)
  assertEquals(r.status, 200)
  assertEquals(r.outcomes[0].kind, 'no_active_entitlement')
  assertEquals(f.userUpdates.length + f.upserts.length, 0)
  assertEquals(f.reports.map((p) => p.level), ['info'])
})

Deno.test('RC REST hatası → 500, yazılmaz', async () => {
  const f = fake({
    authUsers: [B_AUTH],
    appUsers: { [B_AUTH]: B_APP },
    rcError: new RcRestError('RC_REST_HTTP', 'RC REST HTTP 503', 503),
  })
  const r = await processTransfer([B_AUTH], ctx, f.deps)
  assertEquals(r.status, 500)
  assertEquals(r.errorCode, 'RC_REST_HTTP')
  assertEquals(f.userUpdates.length + f.upserts.length, 0)
})

Deno.test('İdempotency: aynı TRANSFER iki kez → aynı değerler, aynı sonuç', async () => {
  const f = fake({ authUsers: [B_AUTH], appUsers: { [B_AUTH]: B_APP }, rc: { [B_AUTH]: activeMonthly } })
  const r1 = await processTransfer([B_AUTH], ctx, f.deps)
  const r2 = await processTransfer([B_AUTH], ctx, f.deps)
  assertEquals(r1, r2)
  assertEquals(f.upserts[0], f.upserts[1])
  const strip = (u: { fields: UserTierFields }) => ({ ...u.fields, updated_at: '' })
  assertEquals(strip(f.userUpdates[0]), strip(f.userUpdates[1]))
})

Deno.test('Karışık hedefler: biri anonim, biri çözülür → 200, yalnız çözülen yazılır', async () => {
  const f = fake({ authUsers: [B_AUTH], appUsers: { [B_AUTH]: B_APP }, rc: { [B_AUTH]: activeMonthly } })
  const r = await processTransfer(['$RCAnonymousID:x', B_AUTH], ctx, f.deps)
  assertEquals(r.status, 200)
  assertEquals(f.restCalls, [B_AUTH])
  assertEquals(f.upserts.length, 1)
})

Deno.test('Lifetime → yalnız tier/plan, active_until null, info raporu', async () => {
  const lifetime: RcSubscriberInfo = {
    entitlements: { chosy_plus: { expires_date: null, product_identifier: 'com.chosy.lifetime' } },
    subscriptions: {},
  }
  const f = fake({ authUsers: [B_AUTH], appUsers: { [B_AUTH]: B_APP }, rc: { [B_AUTH]: lifetime } })
  const r = await processTransfer([B_AUTH], ctx, f.deps)
  assertEquals(r.outcomes[0], { id: B_AUTH, kind: 'applied', tier: 'lifetime', plan: 'lifetime' })
  assertEquals(f.userUpdates[0].fields.subscription_active_until, null)
  assertEquals(f.upserts[0].expires_at, null)
  assertEquals(f.reports.map((p) => [p.level, p.tags.error_code]), [['info', 'RC_TRANSFER_LIFETIME']])
})

Deno.test('transferred_to geçersiz/boş → 200 + warning', async () => {
  for (const bad of [undefined, [], 'x', [1]]) {
    const f = fake()
    const r = await processTransfer(bad, ctx, f.deps)
    assertEquals(r.status, 200)
    assertEquals(f.reports[0].tags.error_code, 'RC_TRANSFER_PAYLOAD_INVALID')
  }
})

// ─── applyEntitlement ───────────────────────────────────────────────────────────

Deno.test('applyEntitlement: tanınmayan ürün → hiçbir tabloya yazmaz', async () => {
  const f = fake()
  const r = await applyEntitlement(f.deps.writer, B_APP, 'com.unknown', FUTURE, true, 'SANDBOX')
  assertEquals(r, { kind: 'unmapped_product', tier: 'free' })
  assertEquals(f.userUpdates.length + f.upserts.length, 0)
})

Deno.test('applyEntitlement: users 0 satır → subscriptions yazılmaz', async () => {
  const f = fake({ usersCount: 0 })
  const r = await applyEntitlement(f.deps.writer, B_APP, 'com.chosy.annual', FUTURE, true, 'SANDBOX')
  assertEquals(r, { kind: 'users_row_vanished' })
  assertEquals(f.upserts.length, 0)
})

Deno.test('applyEntitlement: legacy weekly → plan weekly', async () => {
  const f = fake()
  const r = await applyEntitlement(f.deps.writer, B_APP, 'chosyai_weekly', FUTURE, false, 'SANDBOX')
  assertEquals(r, { kind: 'applied', tier: 'weekly_legacy', plan: 'weekly' })
  assertEquals(f.userUpdates[0].fields.subscription_will_renew, false)
})

// ─── pickActiveEntitlement ──────────────────────────────────────────────────────

Deno.test('pickActiveEntitlement: iptal edilmiş ama süresi dolmamış → willRenew false', () => {
  const info: RcSubscriberInfo = {
    entitlements: { chosy_plus: { expires_date: FUTURE, product_identifier: 'com.chosy.annual' } },
    subscriptions: { 'com.chosy.annual': { unsubscribe_detected_at: PAST } },
  }
  assertEquals(pickActiveEntitlement(info, NOW), {
    productId: 'com.chosy.annual',
    expiresAt: '2026-11-03T12:00:00.000Z',
    willRenew: false,
  })
})

Deno.test('pickActiveEntitlement: yalnız chosy_plus okunur', () => {
  const info: RcSubscriberInfo = {
    entitlements: { premium: { expires_date: FUTURE, product_identifier: 'com.chosy.monthly' } },
    subscriptions: {},
  }
  assertEquals(pickActiveEntitlement(info, NOW), null)
})

// ─── fetchRcSubscriber: anahtar sızmaz ──────────────────────────────────────────

const SECRET = 'sk_TEST_DO_NOT_LEAK'

Deno.test('fetchRcSubscriber: anahtar yok → RC_SECRET_KEY_MISSING, fetch yok', async () => {
  let called = false
  const fetchImpl = (() => {
    called = true
    return Promise.resolve(new Response('{}'))
  }) as typeof fetch
  const err = await assertRejects(() => fetchRcSubscriber(B_AUTH, undefined, fetchImpl), RcRestError)
  assertEquals(err.code, 'RC_SECRET_KEY_MISSING')
  assertEquals(called, false)
})

Deno.test('fetchRcSubscriber: HTTP hatası mesajı anahtarı ve gövdeyi içermez', async () => {
  const fetchImpl = (() =>
    Promise.resolve(new Response(`echo ${SECRET}`, { status: 401 }))) as typeof fetch
  const err = await assertRejects(() => fetchRcSubscriber(B_AUTH, SECRET, fetchImpl), RcRestError)
  assertEquals(err.code, 'RC_REST_HTTP')
  assertEquals(err.httpStatus, 401)
  assertEquals(err.message.includes(SECRET), false)
  assertEquals(err.message.includes('echo'), false)
})

Deno.test('RC hata yolu uçtan uca: anahtar Sentry raporuna ve konsola GİRMEZ', async () => {
  // Gerçek `fetchRcSubscriber` + gerçek `processTransfer`; yalnız fetch sahte.
  // Üç hata biçimi: anahtarı yansıtan HTTP gövdesi, mesajında anahtar taşıyan
  // ağ hatası, anahtarı içeren bozuk JSON.
  const failingFetches: Array<typeof fetch> = [
    (() => Promise.resolve(new Response(`invalid key ${SECRET}`, { status: 401 }))) as typeof fetch,
    (() => Promise.reject(new TypeError(`connect failed Bearer ${SECRET}`))) as typeof fetch,
    (() => Promise.resolve(new Response(`{"bad": ${SECRET}`))) as typeof fetch,
  ]

  for (const fetchImpl of failingFetches) {
    const f = fake({ authUsers: [B_AUTH], appUsers: { [B_AUTH]: B_APP } })
    f.deps.fetchSubscriber = (id) => fetchRcSubscriber(id, SECRET, fetchImpl)

    const consoleOut: string[] = []
    const orig = { log: console.log, warn: console.warn, error: console.error }
    const capture = (...args: unknown[]) => consoleOut.push(args.map(String).join(' '))
    console.log = capture
    console.warn = capture
    console.error = capture
    let r
    try {
      r = await processTransfer([B_AUTH], ctx, f.deps)
    } finally {
      Object.assign(console, orig)
    }

    assertEquals(r.status, 500)
    assertEquals(f.reports.length, 1)
    assertEquals(f.reports[0].level, 'error')
    assertEquals(JSON.stringify(f.reports).includes(SECRET), false, JSON.stringify(f.reports))
    assertEquals(consoleOut.join('\n').includes(SECRET), false, consoleOut.join('\n'))
  }
})

Deno.test('fetchRcSubscriber: Bearer başlığı, URL kodlaması, yanıt ayrıştırma', async () => {
  let seenUrl = ''
  let seenAuth = ''
  const fetchImpl = ((url: string, init: RequestInit) => {
    seenUrl = url
    seenAuth = new Headers(init.headers).get('Authorization') ?? ''
    return Promise.resolve(new Response(JSON.stringify({ subscriber: activeMonthly })))
  }) as unknown as typeof fetch
  const info = await fetchRcSubscriber('$RCAnonymousID:a/b', SECRET, fetchImpl)
  assertEquals(seenUrl, 'https://api.revenuecat.com/v1/subscribers/%24RCAnonymousID%3Aa%2Fb')
  assertEquals(seenAuth, `Bearer ${SECRET}`)
  assertEquals(info, activeMonthly)
})

Deno.test('fetchRcSubscriber: subscriber alanı yok → RC_REST_MALFORMED', async () => {
  const fetchImpl = (() => Promise.resolve(new Response('{"x":1}'))) as typeof fetch
  const err = await assertRejects(() => fetchRcSubscriber(B_AUTH, SECRET, fetchImpl), RcRestError)
  assertEquals(err.code, 'RC_REST_MALFORMED')
})

// ─── R-B-0e: environment, anonim hedef, tanı logu ───────────────────────────────

Deno.test('TRANSFER: anonim hedef + gerçek hedef → anonim error, gerçek hedef yazılır (PRODUCTION)', async () => {
  const f = fake({ authUsers: [B_AUTH], appUsers: { [B_AUTH]: B_APP }, rc: { [B_AUTH]: activeMonthly } })
  const r = await processTransfer(
    ['$RCAnonymousID:d26168fb7c13439d8df25cc43f53c621', B_AUTH],
    { ...ctx, environment: 'PRODUCTION' },
    f.deps,
  )
  assertEquals(r.status, 200)
  assertEquals(r.outcomes.map((o) => o.kind), ['unresolvable', 'applied'])
  assertEquals(f.restCalls, [B_AUTH])
  assertEquals(f.upserts[0].environment, 'PRODUCTION')
  const un = f.reports.find((p) => p.tags.error_code === 'TRANSFER_TARGET_UNRESOLVED')
  assertEquals(un?.level, 'error')
  assertEquals(un?.tags.reason, 'rc_anonymous')
})

Deno.test('TRANSFER: silinmiş hesap (auth yok) aynı kod, warning seviyesi', async () => {
  const f = fake()
  await processTransfer([B_AUTH], ctx, f.deps)
  assertEquals(f.reports.map((p) => [p.level, p.tags.error_code, p.tags.reason]), [
    ['warning', 'TRANSFER_TARGET_UNRESOLVED', 'auth_user_missing'],
  ])
})

Deno.test('applyEntitlement: INITIAL_PURCHASE SANDBOX / EXPIRATION-sonrası UNCANCELLATION — environment satıra yazılır', async () => {
  const f = fake()
  const r = await applyEntitlement(f.deps.writer, B_APP, 'com.chosy.annual', FUTURE, true, 'SANDBOX')
  assertEquals(r.kind, 'applied')
  assertEquals(f.upserts[0].environment, 'SANDBOX')
})

Deno.test('buildTransferDiagnostic: lifetime ürün gösteren entitlement alanları, plan mantığından bağımsız', () => {
  const info: RcSubscriberInfo = {
    entitlements: {
      chosy_plus: { product_identifier: 'com.chosy.lifetime', purchase_date: '2026-10-08T22:00:00Z', expires_date: null },
    },
    subscriptions: {
      'com.chosy.lifetime': { store: 'app_store', period_type: 'normal', purchase_date: '2026-10-08T22:00:00Z' },
      'com.chosy.annual': { store: 'app_store', period_type: 'normal' },
    },
  }
  assertEquals(buildTransferDiagnostic(B_AUTH, info), {
    tag: 'rc_transfer_diag',
    target: '11111111',
    entitlement: 'chosy_plus',
    product_identifier: 'com.chosy.lifetime',
    purchase_date: '2026-10-08T22:00:00Z',
    expires_date: null,
    store: 'app_store',
    period_type: 'normal',
    is_sandbox: null,
    subscription_product_ids: ['com.chosy.lifetime', 'com.chosy.annual'],
  })
})

Deno.test('buildTransferDiagnostic: chosy_plus yok → entitlement null, çökmez', () => {
  const d = buildTransferDiagnostic(B_AUTH, { entitlements: {}, subscriptions: {} })
  assertEquals(d.entitlement, null)
  assertEquals(d.product_identifier, null)
})

// ─── TRANSFER: environment olay yoksa RC REST is_sandbox'tan ────────────────────

const noEnvCtx = { rcEventId: 'evt_2', transferredFrom: ['anon'], environment: null }
const annualWith = (is_sandbox?: boolean): RcSubscriberInfo => ({
  entitlements: { chosy_plus: { expires_date: FUTURE, product_identifier: 'com.chosy.annual' } },
  subscriptions: { 'com.chosy.annual': { unsubscribe_detected_at: null, ...(is_sandbox === undefined ? {} : { is_sandbox }) } },
})

Deno.test('TRANSFER environment yok + is_sandbox:true → SANDBOX yazılır', async () => {
  const f = fake({ authUsers: [B_AUTH], appUsers: { [B_AUTH]: B_APP }, rc: { [B_AUTH]: annualWith(true) } })
  const r = await processTransfer([B_AUTH], noEnvCtx, f.deps)
  assertEquals(r.status, 200)
  assertEquals(f.upserts[0].environment, 'SANDBOX')
})

Deno.test('TRANSFER environment yok + is_sandbox:false → PRODUCTION yazılır', async () => {
  const f = fake({ authUsers: [B_AUTH], appUsers: { [B_AUTH]: B_APP }, rc: { [B_AUTH]: annualWith(false) } })
  await processTransfer([B_AUTH], noEnvCtx, f.deps)
  assertEquals(f.upserts[0].environment, 'PRODUCTION')
})

Deno.test("TRANSFER olay environment'ı varsa o kullanılır (is_sandbox ezmez)", async () => {
  const f = fake({ authUsers: [B_AUTH], appUsers: { [B_AUTH]: B_APP }, rc: { [B_AUTH]: annualWith(true) } })
  await processTransfer([B_AUTH], { ...noEnvCtx, environment: 'PRODUCTION' }, f.deps)
  assertEquals(f.upserts[0].environment, 'PRODUCTION')
})

Deno.test('TRANSFER environment yok + is_sandbox yok → yazım YOK, 200, Sentry error RC_ENVIRONMENT_MISSING', async () => {
  const f = fake({ authUsers: [B_AUTH], appUsers: { [B_AUTH]: B_APP }, rc: { [B_AUTH]: annualWith() } })
  const r = await processTransfer([B_AUTH], noEnvCtx, f.deps)
  assertEquals(r.status, 200)
  assertEquals(r.outcomes, [{ id: B_AUTH, kind: 'environment_missing' }])
  assertEquals(f.userUpdates.length + f.upserts.length, 0)
  assertEquals(f.reports.map((p) => [p.level, p.tags.error_code]), [['error', 'RC_ENVIRONMENT_MISSING']])
})

Deno.test('environmentFromSubscriber: boolean olmayan değer null', () => {
  const info = { entitlements: {}, subscriptions: { p: { is_sandbox: 'true' as unknown as boolean } } }
  assertEquals(environmentFromSubscriber(info, 'p'), null)
  assertEquals(environmentFromSubscriber(info, 'yok'), null)
})
