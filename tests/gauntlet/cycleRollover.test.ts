/**
 * F2/C2 — cycle geçiş kuralları (saf). React/ağ/saat gerektirmez.
 * Run: npm run test:cycle
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { canRollOver, isNewCycle, shouldRefetch } from '../../components/gauntlet/GauntletShell/cycleRules.ts';

const at = (iso: string) => new Date(iso);
const NEXT = '2026-10-08T15:00:00.000Z'; // İstanbul 18:00

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

Deno.test('isNewCycle: aynı date → hayır (remount/event yok); farklı ya da gauntlet yok → evet', () => {
  assertEquals(isNewCycle('2026-10-08', '2026-10-08'), false);
  assertEquals(isNewCycle('2026-10-08', '2026-10-09'), true);
  assertEquals(isNewCycle(null, '2026-10-08'), true);
  assertEquals(isNewCycle(undefined, '2026-10-08'), true);
});

Deno.test('isNewCycle: İstanbul 03:30 cycle değişmez (sunucu date=2026-10-08 döner)', () => {
  // 03:30 yerel: sunucu cycle_date'i hâlâ 2026-10-08 → istemci no-op.
  assertEquals(isNewCycle('2026-10-08', '2026-10-08'), false);
});

Deno.test('canRollOver: yalnız ready/completed_today ve meşgul değilken', () => {
  assertEquals(canRollOver({ state: 'completed_today', busy: false }), true);
  assertEquals(canRollOver({ state: 'ready', busy: false }), true);
  assertEquals(canRollOver({ state: 'in_progress', busy: false }), false);
  assertEquals(canRollOver({ state: 'bootstrapping', busy: false }), false);
  assertEquals(canRollOver({ state: 'completed_today', busy: true }), false);
  assertEquals(canRollOver({ state: 'ready', busy: true }), false);
});

Deno.test('senaryo: tur ortasında 18:00 geçer → ertelenir; şampiyon sonrası uygulanır', () => {
  const now = at('2026-10-08T15:02:00Z');
  assertEquals(shouldRefetch(now, NEXT), true);
  assertEquals(canRollOver({ state: 'in_progress', busy: false }), false);
  assertEquals(canRollOver({ state: 'completed_today', busy: false }), true);
});
