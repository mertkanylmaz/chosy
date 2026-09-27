/**
 * E-21 — istemcinin önceki döngü sorgu kararı ve hata sınıflandırması.
 * Saf fonksiyonlar; ağ/depolama/cihaz gerektirmez.
 * Run: deno test tests/gauntlet/previousCycleProbe.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  classifyGenerateError,
  decidePreviousCycleProbe,
  PREVIOUS_CYCLE_REJECT_CODES,
  type ProbeInput,
} from '../../services/previousCycleRules.ts'
import { isPreviousCycleRejectCode } from '../../types/gauntlet.ts'

const base: ProbeInput = {
  unlocked: false,
  timezone: 'Europe/Istanbul',
  marker: null,
  hasCacheForUser: false,
}

// ─── Sorgu kararı ────────────────────────────────────────────────────────────

Deno.test('3a: temiz kurulum (iz yok, cache yok) → sorgu atılır', () => {
  assertEquals(decidePreviousCycleProbe(base), { probe: true, writeClosed: false, reason: 'fresh' })
})

Deno.test('mevcut kullanıcı (cache var) → AĞ ÇAĞRISI YOK, closed yazılır', () => {
  assertEquals(decidePreviousCycleProbe({ ...base, hasCacheForUser: true }), {
    probe: false,
    writeClosed: true,
    reason: 'existing_user_cache',
  })
})

Deno.test('3a: closed iz → bir daha sorulmaz', () => {
  assertEquals(decidePreviousCycleProbe({ ...base, marker: 'closed' }).probe, false)
})

Deno.test('previous iz → yeniden açılışta sorgu (kaldığı yerden devam), cache olsa bile', () => {
  assertEquals(decidePreviousCycleProbe({ ...base, marker: 'previous', hasCacheForUser: true }), {
    probe: true,
    writeClosed: false,
    reason: 'resume',
  })
})

Deno.test('3f: kapı açık (18:00 sonrası) → E-21 devreye girmez', () => {
  assertEquals(decidePreviousCycleProbe({ ...base, unlocked: true }).reason, 'unlocked')
  assertEquals(decidePreviousCycleProbe({ ...base, unlocked: true }).probe, false)
})

Deno.test('timezone yok → sorgu yok, sebep raporlanır (sessiz değil)', () => {
  assertEquals(decidePreviousCycleProbe({ ...base, timezone: undefined }).reason, 'no_timezone')
})

Deno.test('cache okunamadı → karar sunucuya bırakılır', () => {
  assertEquals(decidePreviousCycleProbe({ ...base, hasCacheForUser: null }), {
    probe: true,
    writeClosed: false,
    reason: 'cache_unknown',
  })
})

// ─── 3g: hata sınıflandırması ───────────────────────────────────────────────

Deno.test('3g: YALNIZ 409 + bilinen kod before_18e düşürür', () => {
  assertEquals(classifyGenerateError(409, 'PREVIOUS_CYCLE_NOT_ELIGIBLE'), 'previous_rejected')
  assertEquals(classifyGenerateError(409, 'PREVIOUS_CYCLE_OUT_OF_WINDOW'), 'previous_rejected')
})

Deno.test('3g: üretim hatası (503), 400, bilinmeyen 409 → server (loadError + Sentry)', () => {
  assertEquals(classifyGenerateError(503, 'GAUNTLET_GENERATION_FAILED'), 'server')
  assertEquals(classifyGenerateError(400, 'INVALID_INPUT'), 'server')
  assertEquals(classifyGenerateError(409, 'SOMETHING_ELSE'), 'server')
  assertEquals(classifyGenerateError(409, null), 'server')
})

Deno.test('3g: 401 ve ağ hatası mevcut yollarında kalır', () => {
  assertEquals(classifyGenerateError(401, 'UNAUTHORIZED'), 'auth_pending')
  assertEquals(classifyGenerateError(null, null), 'offline')
})

Deno.test('ret kodu aynası kilitli sözleşmeyle (types/gauntlet.ts) birebir', () => {
  for (const code of PREVIOUS_CYCLE_REJECT_CODES) {
    assertEquals(isPreviousCycleRejectCode(code), true, code)
  }
  assertEquals(isPreviousCycleRejectCode('GAUNTLET_GENERATION_FAILED'), false)
})
