/**
 * Splash kalkış kapısı — üç sinyal, failsafe, tek hide.
 * Run: deno test tests/navigation/splashHide.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { createSplashHideController, type SplashHideEvent } from '../../utils/splashHide.ts'

function setup() {
  const events: SplashHideEvent[] = []
  let pending: (() => void) | null = null
  let scheduledMs = -1
  let cancelled = 0
  const c = createSplashHideController({
    hide: (e) => events.push(e),
    failsafeMs: 1500,
    schedule: (fn, ms) => {
      pending = fn
      scheduledMs = ms
      return () => {
        pending = null
        cancelled++
      }
    },
  })
  return {
    c,
    events,
    fireTimer: () => pending?.(),
    scheduledMs: () => scheduledMs,
    cancelled: () => cancelled,
  }
}

Deno.test('üç sinyal gelince ready ile bir kez kalkar, failsafe iptal', () => {
  const s = setup()
  s.c.markFontsReady()
  s.c.markMarkLoaded()
  assertEquals(s.events.length, 0)
  s.c.markGateSettled()
  assertEquals(s.events.length, 1)
  assertEquals(s.events[0].reason, 'ready')
  assertEquals(s.events[0].missing, [])
  assertEquals(s.cancelled(), 1)
})

Deno.test('sıra önemsiz: gate ve görsel fontlardan önce gelse de fontlar beklenir', () => {
  const s = setup()
  s.c.markGateSettled()
  s.c.markMarkLoaded()
  assertEquals(s.events.length, 0)
  s.c.markFontsReady()
  assertEquals(s.events.length, 1)
  assertEquals(s.events[0].reason, 'ready')
})

Deno.test('derin bağlantı: gate odak beklemeden settled bildirir, yalnız font+görsel yeter', () => {
  const s = setup()
  s.c.markGateSettled() // gate mount'ta üstte değilse hemen
  s.c.markFontsReady()
  s.c.markMarkLoaded()
  assertEquals(s.events.map((e) => e.reason), ['ready'])
})

Deno.test('failsafe: fontlardan 1500 ms sonra eksik sinyaller raporlanarak kalkar', () => {
  const s = setup()
  s.c.markFontsReady()
  assertEquals(s.scheduledMs(), 1500)
  s.c.markMarkLoaded()
  s.fireTimer()
  assertEquals(s.events.length, 1)
  assertEquals(s.events[0].reason, 'fallback')
  assertEquals(s.events[0].missing, ['gate'])
})

Deno.test('failsafe fontlar gelmeden başlamaz (fontlar yavaşsa kök null render eder)', () => {
  const s = setup()
  s.c.markGateSettled()
  s.c.markMarkLoaded()
  assertEquals(s.scheduledMs(), -1)
  assertEquals(s.events.length, 0)
})

Deno.test('çift çağrı yok: ready sonrası timer/sinyaller ve fallback sonrası sinyaller hide etmez', () => {
  const a = setup()
  a.c.markFontsReady()
  a.c.markGateSettled()
  a.c.markMarkLoaded()
  a.fireTimer()
  a.c.markMarkLoaded()
  a.c.markFontsReady()
  assertEquals(a.events.length, 1)

  const b = setup()
  b.c.markFontsReady()
  b.fireTimer()
  b.c.markGateSettled()
  b.c.markMarkLoaded()
  assertEquals(b.events.length, 1)
  assertEquals(b.events[0].reason, 'fallback')
  assertEquals(b.events[0].missing, ['gate', 'mark'])
  assertEquals(b.c.isHidden(), true)
})
