/**
 * Spotlight sonuç durumu (resultState) — hak türetmesi ve FLAWLESS tanımı.
 *
 * Sunucu `attempts`'a doğru film tahminini de ekler (submit-guess:677), bu yüzden
 * kazanılan oyunda misses = attempts - 1. FLAWLESS = doğru tahminden önce sıfır
 * hak kaybı; harf seçimleri etiketi etkilemez.
 *
 * Run: npm run test:spotlight-result
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { resultState } from '../../components/games/Spotlight/resultState.ts'

const MAX = 6

Deno.test('kazanç attempts=1 → flawless, 6/6', () => {
  assertEquals(resultState({ won: true, attempts: 1, maxAttempts: MAX }), {
    ok: true, variant: 'flawless', chancesLeft: 6, total: 6,
  })
})

Deno.test('kazanç attempts=3 → found, 4 kaldı', () => {
  assertEquals(resultState({ won: true, attempts: 3, maxAttempts: MAX }), {
    ok: true, variant: 'found', chancesLeft: 4, total: 6,
  })
})

Deno.test('kazanç attempts=6 → found, 1 kaldı', () => {
  assertEquals(resultState({ won: true, attempts: 6, maxAttempts: MAX }), {
    ok: true, variant: 'found', chancesLeft: 1, total: 6,
  })
})

Deno.test('kayıp → lost, 0 kaldı', () => {
  assertEquals(resultState({ won: false, attempts: 6, maxAttempts: MAX }), {
    ok: true, variant: 'lost', chancesLeft: 0, total: 6,
  })
})

Deno.test('anomali: won && attempts<1 → ok:false', () => {
  assertEquals(resultState({ won: true, attempts: 0, maxAttempts: MAX }), {
    ok: false, reason: 'won_without_attempt',
  })
})

Deno.test('anomali: attempts>maxAttempts → ok:false (kenetleme yok)', () => {
  assertEquals(resultState({ won: true, attempts: 7, maxAttempts: MAX }), {
    ok: false, reason: 'attempts_exceed_max',
  })
  assertEquals(resultState({ won: false, attempts: 7, maxAttempts: MAX }), {
    ok: false, reason: 'attempts_exceed_max',
  })
})

Deno.test('anomali: maxAttempts<=0 → ok:false', () => {
  assertEquals(resultState({ won: true, attempts: 1, maxAttempts: 0 }), {
    ok: false, reason: 'invalid_max_attempts',
  })
  assertEquals(resultState({ won: false, attempts: 0, maxAttempts: -6 }), {
    ok: false, reason: 'invalid_max_attempts',
  })
})

Deno.test('tam sayı olmayan / negatif girdi → ok:false', () => {
  assertEquals(resultState({ won: false, attempts: NaN, maxAttempts: MAX }), {
    ok: false, reason: 'invalid_attempts',
  })
  assertEquals(resultState({ won: false, attempts: -1, maxAttempts: MAX }), {
    ok: false, reason: 'invalid_attempts',
  })
})

Deno.test('8 doğru harf açıp ilk film tahminini bilen oyun (attempts=1) → flawless', () => {
  // Doğru harfler hak harcamaz: sunucuda attempts yalnız doğru film tahminiyle 1 olur.
  // resultState harf verisi KABUL ETMEZ — etiket harf sayısından bağımsızdır.
  assertEquals(resultState({ won: true, attempts: 1, maxAttempts: MAX }), {
    ok: true, variant: 'flawless', chancesLeft: 6, total: 6,
  })
})
