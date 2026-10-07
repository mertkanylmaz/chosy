/**
 * Unit tests — Spotlight haptik haritası (olay → en fazla bir haptik).
 *
 * Run: npm run test:spotlight-layout
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  hapticForEvent,
  keyPressState,
  type SpotlightHapticEvent,
} from '../../components/games/Spotlight/hapticMap.ts'

Deno.test('uygun tuş basışı: hafif haptik', () => {
  assertEquals(hapticForEvent({ type: 'key_press', state: 'available' }), 'light')
})

Deno.test('kullanılmış ve kilitli tuş: haptik yok', () => {
  assertEquals(hapticForEvent({ type: 'key_press', state: 'used' }), null)
  assertEquals(hapticForEvent({ type: 'key_press', state: 'locked' }), null)
})

Deno.test('tuş durumu: kullanılmış > kilitli > uygun', () => {
  assertEquals(keyPressState(true, true), 'used')
  assertEquals(keyPressState(true, false), 'used')
  assertEquals(keyPressState(false, true), 'locked')
  assertEquals(keyPressState(false, false), 'available')
})

Deno.test('doğru harf sonucu: ek haptik yok', () => {
  assertEquals(hapticForEvent({ type: 'letter_result', hit: true, completed: false }), null)
})

Deno.test('yanlış harf: tek uyarı haptiği; haklar biterse oyun-sonu haptiği', () => {
  assertEquals(hapticForEvent({ type: 'letter_result', hit: false, completed: false }), 'warning')
  assertEquals(hapticForEvent({ type: 'letter_result', hit: false, completed: true }), 'medium')
})

Deno.test('CTA: hafif haptik', () => {
  assertEquals(hapticForEvent({ type: 'cta_press' }), 'light')
})

Deno.test('sonuç satırı seçimi: kendi haptiği yok', () => {
  assertEquals(hapticForEvent({ type: 'result_row_select' }), null)
})

Deno.test('film tahmini: yanlış → uyarı, doğru → başarı, haklar biterse oyun-sonu', () => {
  assertEquals(hapticForEvent({ type: 'guess_result', won: false, completed: false }), 'warning')
  assertEquals(hapticForEvent({ type: 'guess_result', won: true, completed: true }), 'success')
  assertEquals(hapticForEvent({ type: 'guess_result', won: false, completed: true }), 'medium')
})

Deno.test('her olay en fazla BİR haptik üretir (tür tek değer, dizi değil)', () => {
  const events: SpotlightHapticEvent[] = [
    { type: 'key_press', state: 'available' },
    { type: 'key_press', state: 'used' },
    { type: 'key_press', state: 'locked' },
    { type: 'letter_result', hit: true, completed: false },
    { type: 'letter_result', hit: false, completed: false },
    { type: 'letter_result', hit: false, completed: true },
    { type: 'cta_press' },
    { type: 'result_row_select' },
    { type: 'guess_result', won: true, completed: true },
    { type: 'guess_result', won: false, completed: false },
    { type: 'guess_result', won: false, completed: true },
    { type: 'action_error' },
  ]
  for (const e of events) {
    const h = hapticForEvent(e)
    assertEquals(Array.isArray(h), false, JSON.stringify(e))
    assertEquals(h === null || typeof h === 'string', true, JSON.stringify(e))
  }
})

Deno.test('ağ hatası (istek gitmedi): mevcut uyarı haptiği, tek', () => {
  assertEquals(hapticForEvent({ type: 'action_error' }), 'warning')
})
