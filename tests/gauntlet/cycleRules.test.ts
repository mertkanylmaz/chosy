/**
 * E-21 — GauntletShell önceki döngü geçiş kuralları (3e, 3i + K-42 etkileşimi).
 * Saf fonksiyonlar; React/ağ/saat gerektirmez.
 * Run: deno test tests/gauntlet/cycleRules.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  gauntletCycleProps,
  previousLoadOutcome,
  previousOfflineOutcome,
  pulseAction,
  requestOptionsFor,
  type PulseInput,
} from '../../components/gauntlet/GauntletShell/cycleRules.ts'

const pulse = (over: Partial<PulseInput>) =>
  pulseAction({ state: 'before_18', mode: 'current', unlocked: false, dateKeyChanged: false, ...over })

// ─── İstek seçeneği ─────────────────────────────────────────────────────────

Deno.test('current modda gövdeye cycle GİRMEZ (mevcut akış birebir)', () => {
  assertEquals(requestOptionsFor('current'), {})
})

Deno.test('K-42: previous modda her yükleme cycle:previous taşır (reconnect/401/retry dahil)', () => {
  // `load` modu tetikleyiciden değil moddan okur; tetikleyici girdisi yok.
  assertEquals(requestOptionsFor('previous'), { cycle: 'previous' })
})

// ─── 3e: yükleme sonrası ────────────────────────────────────────────────────

Deno.test('3e: yeniden açılışta (bootstrapping) bitmiş önceki döngü → before_18 (close)', () => {
  assertEquals(previousLoadOutcome('champion', 'bootstrapping'), 'close')
  assertEquals(previousLoadOutcome('exhausted', 'bootstrapping'), 'close')
})

Deno.test('3e: yarım ya da yeni önceki döngü → oyna', () => {
  assertEquals(previousLoadOutcome('in_progress', 'bootstrapping'), 'play')
  assertEquals(previousLoadOutcome(undefined, 'bootstrapping'), 'play')
})

Deno.test('CTO SARI-2: K-42 kuyruğundaki final reconnect ile gönderildi → şampiyon GÖSTERİLİR', () => {
  assertEquals(previousLoadOutcome('champion', 'in_progress'), 'play')
})

Deno.test('CTO SARI-2: reveal ekrandayken bağlantı döndü → reveal kalır', () => {
  assertEquals(previousLoadOutcome('champion', 'completed_today'), 'play')
})

Deno.test('CTO SARI-4: açılışta ağ yok → before_18 (hata ekranı değil); oyun içinde → mevcut yol', () => {
  assertEquals(previousOfflineOutcome('bootstrapping'), 'before_18')
  assertEquals(previousOfflineOutcome('in_progress'), 'load_error')
})

// ─── 3e: dakikalık nabız ────────────────────────────────────────────────────

Deno.test('mevcut davranış: before_18 kapı kapalı → none; açık → open_gate', () => {
  assertEquals(pulse({}), 'none')
  assertEquals(pulse({ unlocked: true }), 'open_gate')
})

Deno.test('3e: önceki döngü şampiyonu gösterilirken 18:00 → bugünün gauntlet i yüklenir', () => {
  assertEquals(pulse({ state: 'completed_today', mode: 'previous', unlocked: true }), 'reset_and_load')
})

Deno.test('3e: önceki döngü şampiyonu 18:00 öncesi → reveal kalır', () => {
  assertEquals(pulse({ state: 'completed_today', mode: 'previous', unlocked: false }), 'none')
})

Deno.test('E-21: önceki döngü OYUNU 18:00de kesilmez', () => {
  assertEquals(pulse({ state: 'in_progress', mode: 'previous', unlocked: true }), 'none')
  assertEquals(pulse({ state: 'ready', mode: 'previous', unlocked: true }), 'none')
})

Deno.test('mevcut davranış: current şampiyon 18:00 sonrası aynı gün → none', () => {
  assertEquals(pulse({ state: 'completed_today', mode: 'current', unlocked: true }), 'none')
})

Deno.test('mevcut davranış: gece yarısı → kapı kapalıysa before_18, açıksa yükle', () => {
  assertEquals(pulse({ state: 'completed_today', dateKeyChanged: true }), 'reset_to_before_18')
  assertEquals(
    pulse({ state: 'completed_today', dateKeyChanged: true, unlocked: true }),
    'reset_and_load',
  )
  assertEquals(
    pulse({ state: 'completed_today', mode: 'previous', dateKeyChanged: true }),
    'reset_to_before_18',
  )
})

Deno.test('bootstrapping (hata overlay dahil) nabızla değişmez', () => {
  assertEquals(pulse({ state: 'bootstrapping', mode: 'previous', unlocked: true }), 'none')
})

// ─── 3i: analytics ──────────────────────────────────────────────────────────

Deno.test('3i: önceki döngü gauntlet olaylarına cycle:previous', () => {
  assertEquals(gauntletCycleProps('g-prev', 'g-prev'), { cycle: 'previous' })
})

Deno.test('3i: bugünün gauntlet i (ve önceki döngü yoksa) cycle:current', () => {
  assertEquals(gauntletCycleProps('g-today', 'g-prev'), { cycle: 'current' })
  assertEquals(gauntletCycleProps('g-today', null), { cycle: 'current' })
  assertEquals(gauntletCycleProps(null, null), { cycle: 'current' })
})
