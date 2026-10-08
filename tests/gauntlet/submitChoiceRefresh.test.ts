/**
 * F2.1/A — submit-choice: aday kalmayınca oyun BİTMEZ (409 REFRESH_UNAVAILABLE),
 * `timeout` outcome'u reddedilir. Handler `Deno.serve` içerdiği için import
 * edilemez; kaynak metin üzerinden korunur (cycleDate testindeki desen).
 * Boşluklar ve satır sonları normalize edilir.
 * Run: npm run test:submit-choice
 */

import { assert } from 'https://deno.land/std@0.208.0/assert/mod.ts';

const src = (
  await Deno.readTextFile(
    new URL('../../supabase/functions/submit-choice/index.ts', import.meta.url),
  )
).replace(/\s+/g, ' ');

const DENIED = "'REFRESH_UNAVAILABLE', 'Yenileme";

Deno.test("aday yok: 409 REFRESH_UNAVAILABLE döner, 'no_candidates' exhausted üretilmez", () => {
  assert(src.includes("'REFRESH_UNAVAILABLE'"), 'REFRESH_UNAVAILABLE yok');
  assert(!src.includes("exhaustedReason = 'no_candidates'"), "no_candidates exhausted hâlâ üretiliyor");
  const i = src.indexOf(DENIED);
  assert(i > 0, 'errorResponse çağrısı bulunamadı');
  assert(src.slice(i, i + 200).includes('409'), '409 durum kodu yok');
});

Deno.test('REFRESH_UNAVAILABLE dalı gauntlet state yazmaz (film_ids update öncesinde döner)', () => {
  const denied = src.indexOf(DENIED);
  const update = src.indexOf('.update({ film_ids: nextFilmIds })');
  assert(denied > 0 && update > 0 && denied < update, 'ret, film_ids güncellemesinden ÖNCE gelmeli');
});

Deno.test("timeout outcome'u 400 INVALID_INPUT ile reddedilir ve olay yazımından önce", () => {
  const reject = src.indexOf("outcome 'timeout' kabul edilmiyor");
  const write = src.indexOf("rpc('record_choice_event'");
  assert(reject > 0 && write > 0 && reject < write, 'timeout reddi olay yazımından önce olmalı');
  assert(src.slice(reject, reject + 60).includes('400'), '400 durum kodu yok');
});

Deno.test('F2.2: REFRESH_UNAVAILABLE ham olay yazımından (record_choice_event) ve markWatched çağrısından ÖNCE döner', () => {
  const denied = src.indexOf(DENIED);
  const write = src.indexOf("rpc('record_choice_event'");
  const watched = src.indexOf('await markWatched(');
  assert(denied > 0 && write > 0 && watched > 0, 'işaretçiler bulunamadı');
  assert(denied < write, 'aday yoksa choice_events satırı yazılmamalı: ret, olay yazımından ÖNCE olmalı');
  assert(denied < watched, 'aday yoksa seen için markWatched çalışmamalı');
});

Deno.test('F2.2: hak bitmişse aday aranmaz ve olay yine yazılır (refreshWithinLimit kapısı)', () => {
  assert(src.includes('const refreshWithinLimit = !isAdvancing'), 'refreshWithinLimit kapısı yok');
  const gate = src.indexOf('const refreshWithinLimit');
  const write = src.indexOf("rpc('record_choice_event'");
  assert(gate > 0 && gate < write, 'kapı olay yazımından önce hesaplanmalı');
  assert(src.includes("'refreshPlan yok"), 'plansız düşüş invariant hatası vermeli');
});
