/**
 * E-21 önceki döngü testleri.
 *
 * Koşum:  npm run test:previous-cycle
 *         (cd supabase/functions && deno test --allow-read _shared/previousCycle.test.ts)
 *
 * Handler'lar `Deno.serve` içerdiği için import edilemez; karar yüzeyi
 * `previousCycle.ts`'te yaşar ve burada doğrudan test edilir. Kenar durum
 * etiketleri (3a…3h) V-1 Tur 4 görev metnindeki maddelere karşılık gelir.
 */

import { assert, assertEquals, assertNotEquals, assertThrows } from 'jsr:@std/assert@1'
import { cycleDate } from './cycleDate.ts'
import {
  addDays,
  decidePreviousCycle,
  effectiveArchiveAnchor,
  type PreviousCycleResolution,
  resolvePreviousCycle,
} from './previousCycle.ts'

const at = (iso: string) => new Date(iso)

function keyOf(now: string, tz: string): string {
  const r = resolvePreviousCycle(at(now), tz)
  if (r.afterUnlock) throw new Error(`beklenmedik afterUnlock: ${now} ${tz}`)
  return r.key
}

// ─── Anahtar hesabı ─────────────────────────────────────────────────────────

Deno.test('anahtar: İstanbul sabah → dünün yerel tarihi', () => {
  assertEquals(keyOf('2026-09-27T07:00:00Z', 'Europe/Istanbul'), '2026-09-26')
})

Deno.test('anahtar: İstanbul 01:00 — "önceki UTC günü" iki gün geri düşerdi, burada düşmez', () => {
  // Yerel 28 Eyl 01:00 = 27 Eyl 22:00Z. Etkin döngü 27 Eyl 18:00 yerel → 27 Eyl.
  assertEquals(keyOf('2026-09-27T22:00:00Z', 'Europe/Istanbul'), '2026-09-27')
})

Deno.test('anahtar: New York sabah (UTC−4) → dünün yerel tarihi', () => {
  assertEquals(keyOf('2026-09-27T14:00:00Z', 'America/New_York'), '2026-09-26')
})

Deno.test('anahtar: New York gece 01:00 → önceki akşam 18:00 EDT', () => {
  assertEquals(keyOf('2026-09-28T05:00:00Z', 'America/New_York'), '2026-09-27')
})

Deno.test('anahtar: Tokyo (+9) sabah 08:00', () => {
  assertEquals(keyOf('2026-09-27T23:00:00Z', 'Asia/Tokyo'), '2026-09-27')
})

Deno.test('anahtar: Kiritimati (+14) ve Pago Pago (−11) uç dilimler', () => {
  assertEquals(keyOf('2026-09-27T20:00:00Z', 'Pacific/Kiritimati'), '2026-09-27')
  // 27 Eyl 20:00Z = Pago Pago 09:00 (27 Eyl) → dün 26 Eyl. Eski UTC anahtarı
  // (dün 18:00 SST = 05:00Z 27 Eyl) burada 27 Eyl veriyordu; yerel tarih 26.
  assertEquals(keyOf('2026-09-27T20:00:00Z', 'Pacific/Pago_Pago'), '2026-09-26')
})

Deno.test('anahtar: DST geçiş günleri (NY bitiş/başlangıç, Londra bitiş)', () => {
  // 1 Kas 2026 EST sabahı → dün 31 Eki.
  assertEquals(keyOf('2026-11-01T15:00:00Z', 'America/New_York'), '2026-10-31')
  // 8 Mar 2026 EDT sabahı → dün 7 Mar.
  assertEquals(keyOf('2026-03-08T14:00:00Z', 'America/New_York'), '2026-03-07')
  // 25 Eki 2026 GMT sabahı → dün 24 Eki.
  assertEquals(keyOf('2026-10-25T10:00:00Z', 'Europe/London'), '2026-10-24')
})

Deno.test('3f: yerel 18:00 ve sonrası → afterUnlock; anahtar aynı kalır (sürdürme için)', () => {
  const r = resolvePreviousCycle(at('2026-09-27T15:30:00Z'), 'Europe/Istanbul')
  assertEquals(r.afterUnlock, true)
  assertEquals(r.key, '2026-09-26')
  // 17:59 yerel hâlâ kapalı.
  assertEquals(resolvePreviousCycle(at('2026-09-27T14:59:00Z'), 'Europe/Istanbul').afterUnlock, false)
})

Deno.test('anahtar: geçersiz timezone RangeError fırlatır (sessiz geri dönüş yok)', () => {
  assertThrows(() => resolvePreviousCycle(at('2026-09-27T07:00:00Z'), 'Mars/Olympus'), RangeError)
})

Deno.test('F1: Chicago yaz saati günü artık çakışmaz — yerel takvimde ardışık günler', () => {
  // 14 Mar 2027 10:00 CDT. Eski UTC anahtarında dün 18:00 CST (00:00Z 14 Mar) ile
  // bugün 18:00 CDT (23:00Z 14 Mar) AYNI güne düşüyordu; yerel tarihte düşmez.
  const r = resolvePreviousCycle(at('2027-03-14T15:00:00Z'), 'America/Chicago')
  assertEquals(r.key, '2027-03-13')
  assertEquals(r.nextKey, '2027-03-14')
})

Deno.test('F1: key = nextKey − 1 gün; kapı kapalıyken key === cycleDate (2026–27, çakışma 0)', () => {
  const zones = [
    'Europe/Istanbul', 'America/New_York', 'America/Chicago', 'America/Winnipeg',
    'America/Denver', 'America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Kiritimati',
    'Pacific/Pago_Pago', 'Europe/London', 'Australia/Lord_Howe', 'Asia/Kolkata',
  ]
  const start = Date.parse('2026-01-01T00:00:00Z')
  const hour = 3_600_000
  for (const tz of zones) {
    for (let t = start; t < start + 2 * 365 * 86_400_000; t += 6 * hour) {
      const now = new Date(t)
      const r = resolvePreviousCycle(now, tz)
      assertEquals(r.key, addDays(r.nextKey, -1), `${tz} ${now.toISOString()}`)
      assertNotEquals(r.key, r.nextKey, `${tz} ${now.toISOString()}`)
      if (!r.afterUnlock) {
        // Kapı kapalıyken önceki döngü anahtarı normal akışın anahtarıdır.
        assertEquals(r.key, cycleDate(tz, now), `${tz} ${now.toISOString()}`)
      } else {
        // Kapı açıkken normal akışın anahtarı bu akşamınkidir — önceki döngüyle çakışmaz.
        assertEquals(cycleDate(tz, now), r.nextKey, `${tz} ${now.toISOString()}`)
      }
    }
  }
})

// ─── Uygunluk kararı ────────────────────────────────────────────────────────

const LAUNCH = '2026-10-01'
const row = (id: string, date: string, cycle: string) => ({ id, date, cycle })
const res = (key: string, over: Partial<PreviousCycleResolution> = {}): PreviousCycleResolution => ({
  key,
  nextKey: addDays(key, 1),
  afterUnlock: false,
  ...over,
})

Deno.test('3a: sıfır satır → üret', () => {
  assertEquals(decidePreviousCycle([], res('2026-10-05'), LAUNCH), { kind: 'generate' })
})

Deno.test('3a/3h: kendi önceki döngü satırı, aynı anahtar → aynı satırı sürdür (ikinci üretim yok)', () => {
  assertEquals(
    decidePreviousCycle([row('g1', '2026-10-05', 'previous')], res('2026-10-05'), LAUNCH),
    { kind: 'serve', rowId: 'g1' },
  )
})

Deno.test('E-21: önceki döngü oyunu 18:00 sonrası da sürdürülür (kapı açık, aynı anahtar)', () => {
  assertEquals(
    decidePreviousCycle(
      [row('g1', '2026-10-05', 'previous')],
      res('2026-10-05', { afterUnlock: true }),
      LAUNCH,
    ),
    { kind: 'serve', rowId: 'g1' },
  )
})

Deno.test('CTO SARI-3: kapı açık + satır yok → current DÖNMEZ, açık ret', () => {
  assertEquals(decidePreviousCycle([], res('2026-10-05', { afterUnlock: true }), LAUNCH), {
    kind: 'reject',
    code: 'PREVIOUS_CYCLE_OUT_OF_WINDOW',
    reason: 'gate_open',
  })
})

Deno.test('3a: önceki döngüyü bir kez almış kullanıcı ertesi sabah ikinci kez alamaz', () => {
  assertEquals(
    decidePreviousCycle([row('g1', '2026-10-05', 'previous')], res('2026-10-06'), LAUNCH),
    { kind: 'reject', code: 'PREVIOUS_CYCLE_NOT_ELIGIBLE', reason: 'has_rows' },
  )
})

Deno.test('3a: tek current satırlı mevcut kullanıcı dünkü yarım oyununu sabah sürdüremez', () => {
  assertEquals(
    decidePreviousCycle([row('g1', '2026-10-05', 'current')], res('2026-10-05'), LAUNCH),
    { kind: 'reject', code: 'PREVIOUS_CYCLE_NOT_ELIGIBLE', reason: 'has_rows' },
  )
})

Deno.test('3a: iki+ satır → her zaman ret', () => {
  assertEquals(
    decidePreviousCycle(
      [row('g1', '2026-10-05', 'previous'), row('g2', '2026-10-06', 'current')],
      res('2026-10-05'),
      LAUNCH,
    ),
    { kind: 'reject', code: 'PREVIOUS_CYCLE_NOT_ELIGIBLE', reason: 'has_rows' },
  )
})

Deno.test('OUT_OF_WINDOW: anahtar launch_date öncesi (editorialDayNumber < 1) → ret', () => {
  assertEquals(decidePreviousCycle([], res(addDays(LAUNCH, -1)), LAUNCH), {
    kind: 'reject',
    code: 'PREVIOUS_CYCLE_OUT_OF_WINDOW',
    reason: 'before_launch',
  })
  // Gün 1 ve takvim sonrası (>100 → algoritmik dal) ret DEĞİL.
  assertEquals(decidePreviousCycle([], res(LAUNCH), LAUNCH), { kind: 'generate' })
  assertEquals(decidePreviousCycle([], res(addDays(LAUNCH, 100)), LAUNCH), { kind: 'generate' })
})

// ─── Arşiv anchor'ı (3b) ────────────────────────────────────────────────────

Deno.test('3b: yalnız önceki döngü satırı → anchor ertesi gün (bedava kaçırma tüketilmez)', () => {
  assertEquals(effectiveArchiveAnchor([{ date: '2026-10-05', cycle: 'previous' }]), '2026-10-06')
})

Deno.test('3b: önceki + current satır → ilk gerçek döngü', () => {
  assertEquals(
    effectiveArchiveAnchor([
      { date: '2026-10-05', cycle: 'previous' },
      { date: '2026-10-06', cycle: 'current' },
    ]),
    '2026-10-06',
  )
})

Deno.test('3b: mevcut kullanıcı (yalnız current) → anchor değişmez', () => {
  assertEquals(
    effectiveArchiveAnchor([
      { date: '2026-09-20', cycle: 'current' },
      { date: '2026-09-22', cycle: 'current' },
    ]),
    '2026-09-20',
  )
  assertEquals(effectiveArchiveAnchor([]), null)
})

Deno.test('addDays: ay/yıl sınırı ve geçersiz tarih', () => {
  assertEquals(addDays('2026-12-31', 1), '2027-01-01')
  assertEquals(addDays('2026-03-01', -1), '2026-02-28')
  assertThrows(() => addDays('nope', 1))
})

// ─── 3c: streak yazımı yok ──────────────────────────────────────────────────

Deno.test('3c: gauntlet yolları user_streaks tablosuna dokunmaz', async () => {
  const files = [
    '../generate-gauntlet/index.ts',
    '../submit-choice/index.ts',
    '../get-archive-status/index.ts',
    './previousCycle.ts',
  ]
  for (const f of files) {
    const src = await Deno.readTextFile(new URL(f, import.meta.url))
    assert(!src.includes('user_streaks'), `${f} user_streaks içeriyor`)
  }
})
