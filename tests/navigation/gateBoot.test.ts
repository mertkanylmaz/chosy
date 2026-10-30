/**
 * Gate açılış mantığı — getSession eşiği, geç çözülme, hata raporlama (COLD-START-1).
 * Run: deno test --allow-read tests/navigation/gateBoot.test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  GATE_SESSION_TIMEOUT_MS,
  handleGateFailure,
  raceWithTimeout,
  type GateFailure,
  type GateFailureReason,
} from '../../utils/gateBoot.ts'

/** Elle ilerletilen sahte zamanlayıcı (splashHide.test.ts'teki enjeksiyon deseni). */
function fakeClock() {
  let now = 0
  const timers: { at: number; fn: () => void; live: boolean }[] = []
  return {
    schedule: (fn: () => void, ms: number) => {
      const t = { at: now + ms, fn, live: true }
      timers.push(t)
      return () => {
        t.live = false
      }
    },
    advance(ms: number) {
      now += ms
      for (const t of timers) {
        if (t.live && t.at <= now) {
          t.live = false
          t.fn()
        }
      }
    },
  }
}

/** Mikro görev kuyruğunu boşaltır. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0))

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

Deno.test('eşik 6 sn: 5999 ms\'de beklemede, 6000 ms\'de timeout', async () => {
  assertEquals(GATE_SESSION_TIMEOUT_MS, 6000)
  const clock = fakeClock()
  const d = deferred<string>()
  let settled: string | null = null
  void raceWithTimeout(d.promise, GATE_SESSION_TIMEOUT_MS, clock.schedule).then((r) => {
    settled = r.status
  })

  clock.advance(5999)
  await flush()
  assertEquals(settled, null)

  clock.advance(1)
  await flush()
  assertEquals(settled, 'timeout')
})

Deno.test('süre dolmadan çözülürse resolved, zamanlayıcı iptal', async () => {
  const clock = fakeClock()
  const d = deferred<number>()
  const race = raceWithTimeout(d.promise, GATE_SESSION_TIMEOUT_MS, clock.schedule)
  d.resolve(42)
  const r = await race
  assertEquals(r, { status: 'resolved', value: 42 })

  // İptal edilmiş zamanlayıcı geç tetiklense de sonuç değişmez.
  clock.advance(GATE_SESSION_TIMEOUT_MS)
  await flush()
  assertEquals(r.status, 'resolved')
})

Deno.test('timeout sonrası geç çözülen promise: late AYNI promise, iptal edilmedi', async () => {
  const clock = fakeClock()
  const d = deferred<string>()
  const race = raceWithTimeout(d.promise, GATE_SESSION_TIMEOUT_MS, clock.schedule)
  clock.advance(GATE_SESSION_TIMEOUT_MS)
  const r = await race
  assertEquals(r.status, 'timeout')
  if (r.status !== 'timeout') throw new Error('unreachable')

  assert(r.late === d.promise, 'late orijinal promise olmalı (sarmalanmadı/iptal edilmedi)')

  // Gate bu noktada kararı yeniden çalıştırır: late çözülünce devam sinyali gelir.
  let resumed: string | null = null
  void r.late.then((v) => {
    resumed = v
  })
  d.resolve('session')
  await flush()
  assertEquals(resumed, 'session')
})

Deno.test('timeout sonrası geç reddedilen promise late üzerinden reddedilir', async () => {
  const clock = fakeClock()
  const d = deferred<string>()
  const race = raceWithTimeout(d.promise, GATE_SESSION_TIMEOUT_MS, clock.schedule)
  clock.advance(GATE_SESSION_TIMEOUT_MS)
  const r = await race
  if (r.status !== 'timeout') throw new Error('unreachable')

  let rejected: unknown = null
  r.late.catch((e) => {
    rejected = e
  })
  d.reject(new Error('refresh failed'))
  await flush()
  assert(rejected instanceof Error)
})

Deno.test('süre dolmadan reddedilirse red olduğu gibi geçer', async () => {
  const clock = fakeClock()
  const d = deferred<string>()
  const race = raceWithTimeout(d.promise, GATE_SESSION_TIMEOUT_MS, clock.schedule)
  d.reject(new Error('boom'))
  let msg = ''
  await race.catch((e: Error) => {
    msg = e.message
  })
  assertEquals(msg, 'boom')
})

Deno.test('catch dalı: handleGateFailure önce Sentry raporunu, sonra görünür hatayı çağırır', () => {
  const calls: string[] = []
  const failure: GateFailure = { reason: 'gate_decision_error', elapsedMs: 123, error: new Error('x') }
  let shown: GateFailureReason | null = null
  handleGateFailure(failure, {
    report: (f) => calls.push(`report:${f.reason}:${f.elapsedMs}`),
    showError: (r) => {
      calls.push('show')
      shown = r
    },
  })
  assertEquals(calls, ['report:gate_decision_error:123', 'show'])
  assertEquals(shown, 'gate_decision_error')
})

Deno.test('auth_timeout da raporlanır ve gösterilir (sessiz değil)', () => {
  let reported = 0
  let shown: GateFailureReason | null = null
  handleGateFailure(
    { reason: 'auth_timeout', elapsedMs: 6000 },
    { report: () => reported++, showError: (r) => (shown = r) },
  )
  assertEquals(reported, 1)
  assertEquals(shown, 'auth_timeout')
})

Deno.test('gate.tsx: boş catch yok, catch dalı failGate çağırıyor, sessiz /(tabs) düşüşü yok', async () => {
  const src = await Deno.readTextFile(new URL('../../app/gate.tsx', import.meta.url))
  assert(!/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(src), 'boş catch bloğu')
  assert(!/catch\s*\{/.test(src), "parametresiz catch (eski sessiz düşüş) kalmamalı")
  assert(/catch \(err\) \{[\s\S]{0,400}failGate\('gate_decision_error', err\)/.test(src))
})

Deno.test('locales: gate bloğu en/tr parite, anahtarlar dolu', async () => {
  const read = async (l: string) =>
    JSON.parse(await Deno.readTextFile(new URL(`../../locales/${l}.json`, import.meta.url)))
  const en = await read('en')
  const tr = await read('tr')
  assertEquals(Object.keys(en.gate).sort(), ['loadError', 'retry'])
  assertEquals(Object.keys(tr.gate).sort(), Object.keys(en.gate).sort())
  for (const k of Object.keys(en.gate)) {
    assert(en.gate[k].length > 0 && tr.gate[k].length > 0)
  }
})

Deno.test('locales: en/tr tüm anahtar yolları birebir aynı', async () => {
  const read = async (l: string) =>
    JSON.parse(await Deno.readTextFile(new URL(`../../locales/${l}.json`, import.meta.url)))
  const paths = (o: unknown, p = ''): string[] =>
    o !== null && typeof o === 'object'
      ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => paths(v, p ? `${p}.${k}` : k))
      : [p]
  const en = paths(await read('en')).sort()
  const tr = paths(await read('tr')).sort()
  assertEquals(en.length, tr.length)
  assertEquals(en, tr)
})
