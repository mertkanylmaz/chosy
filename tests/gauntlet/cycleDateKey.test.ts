/**
 * F2/C4 — cycle tarihi anahtarı doğrulaması ve Spotlight tarih çözümü (saf).
 * Run: npm run test:cycle
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { isCycleDateKey, resolveSpotlightDate } from '../../utils/cycleDateKey.ts';

Deno.test('isCycleDateKey: geçerli takvim tarihleri', () => {
  assertEquals(isCycleDateKey('2026-10-08'), true);
  assertEquals(isCycleDateKey('2028-02-29'), true);
});

Deno.test('isCycleDateKey: biçim, uydurma tarih ve tip hataları reddedilir', () => {
  for (const v of ['2026-2-3', '2026-02-31', '2027-02-29', '2026-13-01', '2026-10-08T00:00', '', 'bugün']) {
    assertEquals(isCycleDateKey(v), false, v);
  }
  for (const v of [undefined, null, 20261008, ['2026-10-08'], {}]) {
    assertEquals(isCycleDateKey(v), false, String(v));
  }
});

Deno.test('resolveSpotlightDate: parametre geçerliyse parametre kazanır', () => {
  assertEquals(resolveSpotlightDate('2026-10-08', '2026-10-07'), '2026-10-08');
});

Deno.test('resolveSpotlightDate: parametre yok/geçersiz → önbellekteki cycle tarihi', () => {
  assertEquals(resolveSpotlightDate(undefined, '2026-10-07'), '2026-10-07');
  assertEquals(resolveSpotlightDate('2026-02-31', '2026-10-07'), '2026-10-07');
  assertEquals(resolveSpotlightDate(['2026-10-08'], '2026-10-07'), '2026-10-07');
});

Deno.test('resolveSpotlightDate: ikisi de yok/geçersiz → null (yerel tarihe sessiz düşüş yok)', () => {
  assertEquals(resolveSpotlightDate(undefined, null), null);
  assertEquals(resolveSpotlightDate('x', 'y'), null);
});
