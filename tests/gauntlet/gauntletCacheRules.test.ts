/**
 * F2/C1 — önbellek kopyası "mevcut cycle'ın mı": sunucunun `next_cycle_at`'ine bakar,
 * cihaz yerel tarihine değil. Saf fonksiyon; ağ/depolama/saat gerektirmez.
 * Run: npm run test:cycle
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { cacheSourceFor } from '../../services/gauntletCacheRules.ts';

const at = (iso: string) => new Date(iso);

Deno.test('geçiş anı gelecekte → cache_today', () => {
  assertEquals(cacheSourceFor('2026-10-09T15:00:00.000Z', at('2026-10-09T14:59:59Z')), 'cache_today');
});

Deno.test('geçiş anı tam şimdi → cache_stale (sınır dahil değil)', () => {
  assertEquals(cacheSourceFor('2026-10-09T15:00:00.000Z', at('2026-10-09T15:00:00Z')), 'cache_stale');
});

Deno.test('geçiş anı geçmiş → cache_stale', () => {
  assertEquals(cacheSourceFor('2026-10-09T15:00:00.000Z', at('2026-10-10T08:00:00Z')), 'cache_stale');
});

Deno.test('İstanbul 02:30: gece yarısını geçmiş ama cycle sürüyor → cache_today (yerel tarih "dün" derdi)', () => {
  // Cycle 8 Eki 18:00 yerel başladı; next_cycle_at = 9 Eki 15:00Z. 9 Eki 02:30 yerel = 8 Eki 23:30Z.
  assertEquals(cacheSourceFor('2026-10-09T15:00:00.000Z', at('2026-10-08T23:30:00Z')), 'cache_today');
});

Deno.test('next_cycle_at yok ya da bozuk → cache_stale (iyimser varsayım yok)', () => {
  assertEquals(cacheSourceFor(undefined, at('2026-10-09T10:00:00Z')), 'cache_stale');
  assertEquals(cacheSourceFor('', at('2026-10-09T10:00:00Z')), 'cache_stale');
  assertEquals(cacheSourceFor('yarın', at('2026-10-09T10:00:00Z')), 'cache_stale');
});
