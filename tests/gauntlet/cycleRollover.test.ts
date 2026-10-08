/**
 * F2.1/C — cycle geçiş kuralları (saf). React/ağ/saat gerektirmez.
 * Run: npm run test:cycle
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  cycleRowPhase,
  isNewCycle,
  retryDelayMs,
  rolloverOnActive,
  shouldRefetch,
  showsCycleRow,
  type CycleShellState,
} from '../../components/gauntlet/GauntletShell/cycleRules.ts';

const at = (iso: string) => new Date(iso);
const NEXT = '2026-10-08T15:00:00.000Z'; // İstanbul 18:00

// ─── shouldRefetch / isNewCycle ─────────────────────────────────────────────

Deno.test('shouldRefetch: 17:59:59 → hayır, 18:00:00 → evet (sınır dahil)', () => {
  assertEquals(shouldRefetch(at('2026-10-08T14:59:59Z'), NEXT), false);
  assertEquals(shouldRefetch(at('2026-10-08T15:00:00Z'), NEXT), true);
  assertEquals(shouldRefetch(at('2026-10-08T15:00:01Z'), NEXT), true);
});

Deno.test('shouldRefetch: arka plandan 18:00 sonrası dönüş → evet', () => {
  assertEquals(shouldRefetch(at('2026-10-08T19:12:00Z'), NEXT), true);
});

Deno.test('shouldRefetch: next_cycle_at yok ya da bozuk → hayır (tahmini sınır yok)', () => {
  assertEquals(shouldRefetch(at('2026-10-08T19:12:00Z'), undefined), false);
  assertEquals(shouldRefetch(at('2026-10-08T19:12:00Z'), ''), false);
  assertEquals(shouldRefetch(at('2026-10-08T19:12:00Z'), 'yarın'), false);
});

Deno.test('isNewCycle: aynı date → hayır; farklı ya da gauntlet yok → evet', () => {
  assertEquals(isNewCycle('2026-10-08', '2026-10-08'), false);
  assertEquals(isNewCycle('2026-10-08', '2026-10-09'), true);
  assertEquals(isNewCycle(null, '2026-10-08'), true);
  assertEquals(isNewCycle(undefined, '2026-10-08'), true);
});

// ─── rolloverOnActive (yalnız arka plandan dönüş) ───────────────────────────

Deno.test('rolloverOnActive: ready ve completed_today otomatik geçer', () => {
  assertEquals(rolloverOnActive({ state: 'ready', busy: false }), true);
  assertEquals(rolloverOnActive({ state: 'completed_today', busy: false }), true);
});

Deno.test('rolloverOnActive: in_progress ve bootstrapping için KAPALI (F2.2)', () => {
  assertEquals(rolloverOnActive({ state: 'in_progress', busy: false }), false);
  assertEquals(rolloverOnActive({ state: 'bootstrapping', busy: false }), false);
});

Deno.test('rolloverOnActive: busy (seçim uçuşta / kuyrukta) her durumda KAPALI', () => {
  const states: CycleShellState[] = ['ready', 'in_progress', 'completed_today', 'bootstrapping'];
  for (const state of states) {
    assertEquals(rolloverOnActive({ state, busy: true }), false, state);
  }
});

// ─── cycleRowPhase ──────────────────────────────────────────────────────────

Deno.test('cycleRowPhase: sınır gelmeden sayaç; gelince buton; basınca kontrol; aynı cycle → birazdan', () => {
  assertEquals(cycleRowPhase({ boundaryPassed: false, status: 'idle' }), 'counting');
  assertEquals(cycleRowPhase({ boundaryPassed: true, status: 'idle' }), 'ready');
  assertEquals(cycleRowPhase({ boundaryPassed: true, status: 'checking' }), 'checking');
  assertEquals(cycleRowPhase({ boundaryPassed: true, status: 'any_moment' }), 'any_moment');
});

Deno.test('cycleRowPhase: sınır gelmediyse durum ne olursa olsun sayaç (bayat durum görünmez)', () => {
  assertEquals(cycleRowPhase({ boundaryPassed: false, status: 'any_moment' }), 'counting');
  assertEquals(cycleRowPhase({ boundaryPassed: false, status: 'checking' }), 'counting');
});

Deno.test('showsCycleRow: yalnız bitmiş ekranda (champion/exhausted); oyun sürerken yok', () => {
  assertEquals(showsCycleRow('completed_today'), true);
  assertEquals(showsCycleRow('ready'), false);
  assertEquals(showsCycleRow('in_progress'), false);
  assertEquals(showsCycleRow('bootstrapping'), false);
});

// ─── retryDelayMs ───────────────────────────────────────────────────────────

Deno.test('retryDelayMs: 30 sn başlar, ikiye katlanır, 5 dk tavan', () => {
  assertEquals([0, 1, 2, 3, 4, 5, 9].map(retryDelayMs), [
    30_000, 60_000, 120_000, 240_000, 300_000, 300_000, 300_000,
  ]);
});

Deno.test('retryDelayMs: negatif / kesirli deneme güvenli', () => {
  assertEquals(retryDelayMs(-3), 30_000);
  assertEquals(retryDelayMs(1.9), 60_000);
});

// ─── Senaryolar (state × tetikleyici) ───────────────────────────────────────

Deno.test('senaryo: ön planda 18:00 geçti, oyun sürüyor → satır yok, içerik değişmez', () => {
  assertEquals(shouldRefetch(at('2026-10-08T15:02:00Z'), NEXT), true);
  assertEquals(showsCycleRow('in_progress'), false);
  assertEquals(showsCycleRow('ready'), false);
});

Deno.test('senaryo: oyun 18:03\'te biter → satır hemen "hazır" butonu (zaman türetilmiş)', () => {
  const boundaryPassed = shouldRefetch(at('2026-10-08T15:03:00Z'), NEXT);
  assertEquals(showsCycleRow('completed_today'), true);
  assertEquals(cycleRowPhase({ boundaryPassed, status: 'idle' }), 'ready');
});

Deno.test('senaryo: arka plandan 18:10 dönüş, tur ortasında → geçiş YOK; tur biter, satır butona döner', () => {
  assertEquals(shouldRefetch(at('2026-10-08T15:10:00Z'), NEXT), true);
  assertEquals(rolloverOnActive({ state: 'in_progress', busy: false }), false);
  // Tur bitince (completed_today) satır zamandan türetilir: sınır geçmiş → buton.
  assertEquals(showsCycleRow('completed_today'), true);
  assertEquals(cycleRowPhase({ boundaryPassed: true, status: 'idle' }), 'ready');
});

Deno.test('senaryo: arka plandan dönüş, ready (hiç seçim yok) → otomatik geçer', () => {
  assertEquals(shouldRefetch(at('2026-10-08T15:10:00Z'), NEXT), true);
  assertEquals(rolloverOnActive({ state: 'ready', busy: false }), true);
});

Deno.test('senaryo: İstanbul 03:30 — sunucu aynı date döner → isNewCycle false, satır sayaçta kalır', () => {
  assertEquals(isNewCycle('2026-10-08', '2026-10-08'), false);
  assertEquals(shouldRefetch(at('2026-10-09T00:30:00Z'), '2026-10-09T15:00:00.000Z'), false);
});
