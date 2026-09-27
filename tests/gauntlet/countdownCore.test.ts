/**
 * V-1 Tur 6 — useCountdown'ın saf çekirdeği. Hook yalnız zamanlayıcı ve
 * AppState'i bağlar; her `sync` çağrısı hook'taki bir tik ya da AppState
 * `active` senkronudur.
 * Run: deno test tests/gauntlet/countdownCore.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  countdownParts,
  createCountdownController,
  formatCountdown,
} from '../../hooks/countdownCore.ts'

const H = 3_600_000
const M = 60_000
const S = 1_000

Deno.test('geçmiş hedef: ilk senkronda sıfır + anında elapsed', () => {
  const c = createCountdownController(1_000)
  assertEquals(c.sync(5_000), { remainingMs: 0, elapsedNow: true })
})

Deno.test('onElapsed tek sefer: sıfırdan sonraki senkronlar tetiklemez', () => {
  const c = createCountdownController(10 * S)
  assertEquals(c.sync(0).elapsedNow, false)
  assertEquals(c.sync(10 * S).elapsedNow, true)
  assertEquals(c.sync(11 * S).elapsedNow, false)
  // Arka plan → ön plan senkronu sıfırdan sonra tekrar gelirse
  assertEquals(c.sync(20 * S), { remainingMs: 0, elapsedNow: false })
})

Deno.test('arka plandan dönüş: hedef arka planda geçtiyse dönüşte bir kez elapsed', () => {
  const c = createCountdownController(3 * H)
  assertEquals(c.sync(0), { remainingMs: 3 * H, elapsedNow: false })
  // Uygulama 4 saat arka planda — arada hiç tik yok.
  assertEquals(c.sync(4 * H), { remainingMs: 0, elapsedNow: true })
  assertEquals(c.sync(4 * H + S).elapsedNow, false)
})

Deno.test('arka plandan dönüş: hedef geçmediyse duvar saatinden yeniden senkron', () => {
  const c = createCountdownController(3 * H)
  c.sync(0)
  assertEquals(c.sync(2 * H + 11 * M), { remainingMs: 49 * M, elapsedNow: false })
})

Deno.test('parçalar: 2:49:13', () => {
  assertEquals(countdownParts(2 * H + 49 * M + 13 * S), { hours: 2, minutes: 49, seconds: 13 })
})

Deno.test('parçalar: saniye yukarı yuvarlanır — sıfır yalnız gerçekten sıfırda', () => {
  assertEquals(countdownParts(400), { hours: 0, minutes: 0, seconds: 1 })
  assertEquals(countdownParts(0), { hours: 0, minutes: 0, seconds: 0 })
  assertEquals(countdownParts(-5_000), { hours: 0, minutes: 0, seconds: 0 })
})

Deno.test('biçim: saniyeli ve Reduce Motion (saniyesiz)', () => {
  const p = countdownParts(2 * H + 49 * M + 13 * S)
  assertEquals(formatCountdown(p, true), '02:49:13')
  assertEquals(formatCountdown(p, false), '02:49')
})
