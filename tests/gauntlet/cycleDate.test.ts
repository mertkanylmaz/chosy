/**
 * F1 — cycle tarihi (`supabase/functions/_shared/cycleDate.ts`).
 * Saf fonksiyonlar; ağ/DB yok.
 * Run: npm run test:cycle
 *
 * Tanım: cycle_date = en son geçilmiş yerel 18:00'in YEREL takvim tarihi.
 */

import { assert, assertEquals, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  addDays,
  chosenBeforeCycleStart,
  cycleDate,
  cycleStartAt,
  isValidTimeZone,
  localDateString,
  nextCycleAt,
} from '../../supabase/functions/_shared/cycleDate.ts'

const at = (iso: string) => new Date(iso)
const HOUR = 3_600_000

/** Tek satırda: [anlık UTC, beklenen cycle tarihi, beklenen sonraki 18:00 UTC]. */
type Case = [label: string, nowUtc: string, date: string, next: string]

function run(tz: string, cases: Case[]) {
  for (const [label, nowUtc, date, next] of cases) {
    assertEquals(cycleDate(tz, at(nowUtc)), date, `${tz} ${label}: cycleDate`)
    assertEquals(nextCycleAt(tz, at(nowUtc)), next, `${tz} ${label}: nextCycleAt`)
  }
}

// ─── İstanbul (UTC+3, DST yok) ──────────────────────────────────────────────

Deno.test('İstanbul: 17:59 / 18:00 / 02:30 / 03:30 (CTO örneği)', () => {
  run('Europe/Istanbul', [
    ['8 Eki 17:59', '2026-10-08T14:59:00Z', '2026-10-07', '2026-10-08T15:00:00.000Z'],
    ['8 Eki 18:00', '2026-10-08T15:00:00Z', '2026-10-08', '2026-10-09T15:00:00.000Z'],
    // UTC gece yarısından ÖNCE (23:30Z = 02:30 yerel) ve SONRA (00:30Z = 03:30 yerel)
    // aynı döngü: eski UTC anahtarı burada 03:00'te yeni gün üretiyordu.
    ['9 Eki 02:30', '2026-10-08T23:30:00Z', '2026-10-08', '2026-10-09T15:00:00.000Z'],
    ['9 Eki 03:30', '2026-10-09T00:30:00Z', '2026-10-08', '2026-10-09T15:00:00.000Z'],
    ['9 Eki 10:00', '2026-10-09T07:00:00Z', '2026-10-08', '2026-10-09T15:00:00.000Z'],
    ['9 Eki 17:59:59', '2026-10-09T14:59:59Z', '2026-10-08', '2026-10-09T15:00:00.000Z'],
  ])
})

// ─── New York — DST bitişi 1 Kas 2026 02:00 EDT → 01:00 EST ─────────────────

Deno.test('New York: 31 Eki (EDT) 17:59 / 18:00 / 19:30', () => {
  run('America/New_York', [
    ['31 Eki 17:59 EDT', '2026-10-31T21:59:00Z', '2026-10-30', '2026-10-31T22:00:00.000Z'],
    // Bu 18:00'den sonraki 18:00 EST: DST bitiş günü → 25 saat sonra.
    ['31 Eki 18:00 EDT', '2026-10-31T22:00:00Z', '2026-10-31', '2026-11-01T23:00:00.000Z'],
    ['31 Eki 19:30 EDT', '2026-10-31T23:30:00Z', '2026-10-31', '2026-11-01T23:00:00.000Z'],
  ])
})

Deno.test('New York: 1 Kas (EST) 17:59 / 18:00 / 19:30', () => {
  run('America/New_York', [
    ['1 Kas 17:59 EST', '2026-11-01T22:59:00Z', '2026-10-31', '2026-11-01T23:00:00.000Z'],
    ['1 Kas 18:00 EST', '2026-11-01T23:00:00Z', '2026-11-01', '2026-11-02T23:00:00.000Z'],
    // 19:30 EST = 00:30Z 2 Kas: UTC günü döndü, cycle DÖNMEDİ.
    ['1 Kas 19:30 EST', '2026-11-02T00:30:00Z', '2026-11-01', '2026-11-02T23:00:00.000Z'],
  ])
})

Deno.test('New York: EDT akşamı 19:30 aynı cycle (UTC 23:30), 20:30 hâlâ aynı (UTC 00:30)', () => {
  run('America/New_York', [
    ['8 Eki 18:30 EDT', '2026-10-08T22:30:00Z', '2026-10-08', '2026-10-09T22:00:00.000Z'],
    ['8 Eki 19:30 EDT', '2026-10-08T23:30:00Z', '2026-10-08', '2026-10-09T22:00:00.000Z'],
    ['8 Eki 20:30 EDT', '2026-10-09T00:30:00Z', '2026-10-08', '2026-10-09T22:00:00.000Z'],
  ])
})

// ─── Diğer dilimler ─────────────────────────────────────────────────────────

Deno.test('Chicago: CDT (UTC−5) ve CST (UTC−6)', () => {
  run('America/Chicago', [
    ['8 Eki 17:59 CDT', '2026-10-08T22:59:00Z', '2026-10-07', '2026-10-08T23:00:00.000Z'],
    ['8 Eki 18:00 CDT', '2026-10-08T23:00:00Z', '2026-10-08', '2026-10-09T23:00:00.000Z'],
    // 19:00 CDT = 00:00Z 9 Eki: UTC günü döndü, cycle DÖNMEDİ.
    ['8 Eki 19:00 CDT', '2026-10-09T00:00:00Z', '2026-10-08', '2026-10-09T23:00:00.000Z'],
    // CST: 18:00 yerel = 00:00Z ertesi gün → cycle tarihi UTC tarihinden BİR GERİDE.
    ['15 Ara 18:00 CST', '2026-12-16T00:00:00Z', '2026-12-15', '2026-12-17T00:00:00.000Z'],
  ])
})

Deno.test('Seoul (UTC+9)', () => {
  run('Asia/Seoul', [
    ['8 Eki 17:59', '2026-10-08T08:59:00Z', '2026-10-07', '2026-10-08T09:00:00.000Z'],
    ['8 Eki 18:00', '2026-10-08T09:00:00Z', '2026-10-08', '2026-10-09T09:00:00.000Z'],
    ['9 Eki 03:30', '2026-10-08T18:30:00Z', '2026-10-08', '2026-10-09T09:00:00.000Z'],
  ])
})

Deno.test('Makassar (UTC+8, WITA)', () => {
  run('Asia/Makassar', [
    ['8 Eki 17:59', '2026-10-08T09:59:00Z', '2026-10-07', '2026-10-08T10:00:00.000Z'],
    ['8 Eki 18:00', '2026-10-08T10:00:00Z', '2026-10-08', '2026-10-09T10:00:00.000Z'],
  ])
})

Deno.test('Kiritimati (UTC+14): cycle D en erken 04:00Z D', () => {
  run('Pacific/Kiritimati', [
    ['8 Eki 17:59', '2026-10-08T03:59:00Z', '2026-10-07', '2026-10-08T04:00:00.000Z'],
    ['8 Eki 18:00', '2026-10-08T04:00:00Z', '2026-10-08', '2026-10-09T04:00:00.000Z'],
  ])
})

Deno.test('Pago Pago (UTC−11): cycle D en geç 05:00Z D+1', () => {
  run('Pacific/Pago_Pago', [
    ['8 Eki 17:59', '2026-10-09T04:59:00Z', '2026-10-07', '2026-10-09T05:00:00.000Z'],
    ['8 Eki 18:00', '2026-10-09T05:00:00Z', '2026-10-08', '2026-10-10T05:00:00.000Z'],
  ])
})

Deno.test('UTC: cycle UTC 18:00 sınırında döner', () => {
  run('UTC', [
    ['17:59Z', '2026-10-08T17:59:00Z', '2026-10-07', '2026-10-08T18:00:00.000Z'],
    ['18:00Z', '2026-10-08T18:00:00Z', '2026-10-08', '2026-10-09T18:00:00.000Z'],
  ])
})

// ─── nextCycleAt değişmezleri (süpürme) ─────────────────────────────────────

Deno.test('nextCycleAt: her durumda gelecekte, ≤24 saat (DST bitiş günü ≤25 saat) ve sınırı doğru yerde', () => {
  const zones = [
    'Europe/Istanbul', 'America/New_York', 'America/Chicago', 'Asia/Seoul',
    'Asia/Makassar', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'UTC',
    'Europe/London', 'Australia/Lord_Howe', 'Asia/Kolkata', 'America/Sao_Paulo',
  ]
  const start = Date.parse('2026-01-01T00:00:00Z')
  const end = Date.parse('2027-04-01T00:00:00Z')
  const step = 37 * 60_000 + 11_000 // asal-ish adım: tüm dakika/saniye fazlarını gezer
  let over24 = 0
  let checked = 0
  for (const tz of zones) {
    for (let t = start; t < end; t += step) {
      const now = new Date(t)
      const next = new Date(nextCycleAt(tz, now))
      const delta = next.getTime() - t
      assert(delta > 0, `${tz} ${now.toISOString()}: gelecekte değil`)
      assert(delta <= 25 * HOUR, `${tz} ${now.toISOString()}: ${delta / HOUR}s > 25s`)
      if (delta > 24 * HOUR) over24++
      // Sınır: next'ten 1 sn önce hâlâ aynı cycle, next'te cycle ilerlemiş.
      const before = cycleDate(tz, now)
      assertEquals(cycleDate(tz, new Date(next.getTime() - 1000)), before, `${tz} ${now.toISOString()}: sınır öncesi`)
      assertEquals(cycleDate(tz, next), addDays(before, 1), `${tz} ${now.toISOString()}: sınır sonrası`)
      checked++
    }
  }
  assert(checked > 50_000, `beklenenden az örnek: ${checked}`)
  // 24 saati aşan tek durum DST-bitiş günü (ve Lord_Howe 30 dk kayması gibi
  // nadir geçişler); gündelik akışta yok.
  assert(over24 > 0, 'DST bitiş günü (25 saat) ölçülmedi')
  assert(over24 < checked / 100, `24 saati aşan örnek sayısı beklenmedik: ${over24}/${checked}`)
})

Deno.test('cycleDate: zamanla monoton, aynı anda tek değer (UTC gece yarısı sıçraması yok)', () => {
  const zones = ['Europe/Istanbul', 'America/New_York', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']
  const start = Date.parse('2026-10-01T00:00:00Z')
  for (const tz of zones) {
    let prev = ''
    let changes = 0
    for (let t = start; t < start + 30 * 24 * HOUR; t += 60_000) {
      const d = cycleDate(tz, new Date(t))
      assert(d >= prev, `${tz}: geriye gitti`)
      if (d !== prev) changes++
      prev = d
    }
    // 30 gün → 30 sınır (+ ilk atama).
    assertEquals(changes, 31, `${tz}: sınır sayısı`)
  }
})

// ─── Doğrulama ──────────────────────────────────────────────────────────────

Deno.test('isValidTimeZone: geçerli IANA adları', () => {
  for (const tz of ['UTC', 'Europe/Istanbul', 'America/New_York', 'America/Argentina/Buenos_Aires', 'Pacific/Kiritimati']) {
    assert(isValidTimeZone(tz), tz)
  }
})

Deno.test('isValidTimeZone: boş, uydurma, offset, tip hatası, aşırı uzun', () => {
  for (const tz of ['', 'Mars/Olympus', 'UTC+3', '+03:00', 'Istanbul', 'Europe/', '/Istanbul', `${'a'.repeat(65)}/x`]) {
    assert(!isValidTimeZone(tz), JSON.stringify(tz))
  }
  for (const v of [undefined, null, 3, {}, []]) {
    assert(!isValidTimeZone(v), String(v))
  }
})

Deno.test('cycleDate / nextCycleAt: geçersiz ya da boş tz → RangeError (sessiz UTC yok)', () => {
  const now = at('2026-10-08T12:00:00Z')
  assertThrows(() => cycleDate('Mars/Olympus', now), RangeError)
  assertThrows(() => cycleDate('', now), RangeError)
  assertThrows(() => nextCycleAt('Mars/Olympus', now), RangeError)
  assertThrows(() => nextCycleAt('', now), RangeError)
})

// ─── Yardımcılar ve entegrasyon koruması ────────────────────────────────────

Deno.test('addDays / localDateString: ay-yıl sınırı ve geçersiz tarih', () => {
  assertEquals(addDays('2026-12-31', 1), '2027-01-01')
  assertEquals(addDays('2026-03-01', -1), '2026-02-28')
  assertThrows(() => addDays('nope', 1))
  assertEquals(localDateString('Europe/Istanbul', at('2026-12-31T22:00:00Z')), '2027-01-01')
})

Deno.test('generate-gauntlet: UTC gün anahtarı kalmadı, tz zorunlu ve next_cycle_at dönüyor', async () => {
  const src = await Deno.readTextFile(
    new URL('../../supabase/functions/generate-gauntlet/index.ts', import.meta.url),
  )
  assert(!src.includes('utcDateString'), 'generate-gauntlet utcDateString kullanıyor')
  assert(src.includes("'TZ_REQUIRED'"), 'TZ_REQUIRED yok')
  assertEquals(src.split('next_cycle_at: nextCycle').length - 1, 3, 'üç yanıt yolunun üçünde next_cycle_at olmalı')
})

// ─── F2.2 · "Dün izledin mi?" zaman kapısı ──────────────────────────────────

Deno.test("cycleStartAt: cycle tarihinin yerel 18:00'i (İstanbul, New York DST bitişi, Kiritimati)", () => {
  assertEquals(cycleStartAt('Europe/Istanbul', '2026-10-08'), '2026-10-08T15:00:00.000Z');
  assertEquals(cycleStartAt('America/New_York', '2026-10-31'), '2026-10-31T22:00:00.000Z'); // EDT
  assertEquals(cycleStartAt('America/New_York', '2026-11-01'), '2026-11-01T23:00:00.000Z'); // EST
  assertEquals(cycleStartAt('Pacific/Kiritimati', '2026-10-08'), '2026-10-08T04:00:00.000Z');
});

Deno.test("cycleStartAt: her an now'dan önce ya da eşit, cycle uzunluğu ≤25 saat", () => {
  const zones = ['Europe/Istanbul', 'America/New_York', 'Pacific/Pago_Pago', 'Asia/Makassar'];
  const start = Date.parse('2026-10-01T00:00:00Z');
  for (const tz of zones) {
    for (let t = start; t < start + 60 * 24 * HOUR; t += 47 * 60_000) {
      const now = new Date(t);
      const cs = Date.parse(cycleStartAt(tz, cycleDate(tz, now)));
      assert(cs <= t, `${tz} ${now.toISOString()}: başlangıç now'dan sonra`);
      const span = Date.parse(nextCycleAt(tz, now)) - cs;
      assert(span > 0 && span <= 25 * HOUR, `${tz} ${now.toISOString()}: cycle uzunluğu ${span / HOUR}s`);
    }
  }
});

Deno.test("pending feedback: önceki cycle şampiyonu 18:03'te seçildi, 18:05'te yükleme → aday DEĞİL", () => {
  const tz = 'Europe/Istanbul';
  const chosenAt = '2026-10-08T15:03:00.000Z'; // 18:03 yerel — cycle 2026-10-07 hâlâ oynanıyordu
  const loadAt = at('2026-10-08T15:05:00Z'); // 18:05 yerel
  const start = cycleStartAt(tz, cycleDate(tz, loadAt));
  assertEquals(cycleDate(tz, loadAt), '2026-10-08');
  assertEquals(chosenBeforeCycleStart(chosenAt, start), false);
});

Deno.test("pending feedback: aynı şampiyon ertesi cycle'da aday", () => {
  const tz = 'Europe/Istanbul';
  const chosenAt = '2026-10-08T15:03:00.000Z';
  const loadAt = at('2026-10-09T15:05:00Z'); // ertesi gün 18:05 yerel
  const start = cycleStartAt(tz, cycleDate(tz, loadAt));
  assertEquals(cycleDate(tz, loadAt), '2026-10-09');
  assertEquals(chosenBeforeCycleStart(chosenAt, start), true);
});

Deno.test("pending feedback: 17:59'da seçilen şampiyon 18:05 yüklemesinde aday; tam 18:00 aday değil", () => {
  const start = cycleStartAt('Europe/Istanbul', '2026-10-08'); // 15:00Z
  assertEquals(chosenBeforeCycleStart('2026-10-08T14:59:00.000Z', start), true);
  assertEquals(chosenBeforeCycleStart('2026-10-08T15:00:00.000Z', start), false); // kesin küçük
});

Deno.test('pending feedback: New York DST bitiş günü sınırı doğru (EDT→EST)', () => {
  const tz = 'America/New_York';
  // 31 Eki 18:03 EDT = 22:03Z seçildi; 31 Eki 18:05 EDT yükleme → aday değil.
  const loadSame = at('2026-10-31T22:05:00Z');
  assertEquals(chosenBeforeCycleStart('2026-10-31T22:03:00.000Z', cycleStartAt(tz, cycleDate(tz, loadSame))), false);
  // 1 Kas 18:05 EST = 23:05Z yükleme → ertesi cycle, aday.
  const loadNext = at('2026-11-01T23:05:00Z');
  assertEquals(chosenBeforeCycleStart('2026-10-31T22:03:00.000Z', cycleStartAt(tz, cycleDate(tz, loadNext))), true);
});

Deno.test('pending feedback: okunamayan zaman → false (iyimser varsayım yok)', () => {
  assertEquals(chosenBeforeCycleStart('dün', '2026-10-08T15:00:00.000Z'), false);
  assertEquals(chosenBeforeCycleStart('2026-10-08T14:00:00.000Z', 'yarın'), false);
});

Deno.test('generate-gauntlet: aday sorgusu şampiyon seçim anını (choice_events round 3) cycle başlangıcıyla karşılaştırır', async () => {
  const src = (
    await Deno.readTextFile(new URL('../../supabase/functions/generate-gauntlet/index.ts', import.meta.url))
  ).replace(/\s+/g, ' ');
  assert(src.includes('chosenBeforeCycleStart(at, cycleStartIso)'), 'zaman kapısı yok');
  assert(src.includes('cycleStartAt(tz, cycleToday)'), 'cycle başlangıcı hesaplanmıyor');
  assert(src.includes(".eq('round', 3) .eq('outcome', 'choice')"), 'şampiyon olayı (round 3, choice) sorgulanmıyor');
});
