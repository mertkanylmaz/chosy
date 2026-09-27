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

/** Normal akışın `utcDateString()`'i — bu anda. */
const utcKey = (d: Date) => d.toISOString().slice(0, 10)

// ─── Anahtar hesabı ─────────────────────────────────────────────────────────

Deno.test('anahtar: İstanbul sabah → dün yerel 18:00 (15:00Z) UTC tarihi', () => {
  assertEquals(keyOf('2026-09-27T07:00:00Z', 'Europe/Istanbul'), '2026-09-26')
})

Deno.test('anahtar: İstanbul 01:00 — "önceki UTC günü" iki gün geri düşerdi, burada düşmez', () => {
  // Yerel 28 Eyl 01:00 = 27 Eyl 22:00Z. Etkin döngü 27 Eyl 18:00 yerel.
  assertEquals(keyOf('2026-09-27T22:00:00Z', 'Europe/Istanbul'), '2026-09-27')
})

Deno.test('anahtar: New York sabah (UTC−4) → dün 18:00 EDT = 22:00Z', () => {
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
  assertEquals(keyOf('2026-09-27T20:00:00Z', 'Pacific/Pago_Pago'), '2026-09-27')
})

Deno.test('anahtar: DST geçiş günleri (NY bitiş/başlangıç, Londra bitiş)', () => {
  // 1 Kas 2026 EST sabahı; önceki 18:00 hâlâ EDT (−4) → 22:00Z 31 Eki.
  assertEquals(keyOf('2026-11-01T15:00:00Z', 'America/New_York'), '2026-10-31')
  // 8 Mar 2026 EDT sabahı; önceki 18:00 EST (−5) → 23:00Z 7 Mar.
  assertEquals(keyOf('2026-03-08T14:00:00Z', 'America/New_York'), '2026-03-07')
  // 25 Eki 2026 GMT sabahı; önceki 18:00 BST (+1) → 17:00Z 24 Eki.
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

Deno.test('CTO SARI-1: Chicago yaz saati günü çakışması tespit edilir', () => {
  // 14 Mar 2027 10:00 CDT: dün 18:00 CST = 00:00Z 14 Mar; bugün 18:00 CDT = 23:00Z 14 Mar.
  const r = resolvePreviousCycle(at('2027-03-14T15:00:00Z'), 'America/Chicago')
  assertEquals(r.key, '2027-03-14')
  assertEquals(r.nextKey, '2027-03-14')
  assertEquals(r.collides, true)
})

Deno.test('satır tarihi kuralı: çakışmayan her anahtar, bu akşamki normal akışın anahtarından farklı (2026–27)', () => {
  // Ölçüt normal akışın GERÇEK anahtarı: kapı açıldıktan sonraki her anın
  // utcDateString()'i. İlk sürüm yanlış şeyi (ertesi günün önceki anahtarını)
  // karşılaştırıyordu ve Chicago çakışmasını kaçırdı (CTO SARI-1).
  const zones = [
    'Europe/Istanbul', 'America/New_York', 'America/Chicago', 'America/Winnipeg',
    'America/Denver', 'America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Kiritimati',
    'Pacific/Pago_Pago', 'Europe/London', 'Australia/Lord_Howe', 'Asia/Kolkata',
  ]
  const start = Date.parse('2026-01-01T00:00:00Z')
  const hour = 3_600_000
  let collisions = 0
  for (const tz of zones) {
    for (let t = start; t < start + 2 * 365 * 86_400_000; t += 6 * hour) {
      const r = resolvePreviousCycle(new Date(t), tz)
      if (r.afterUnlock) continue
      assert(r.key <= utcKey(new Date(t)), `${tz} ${new Date(t).toISOString()}`)
      if (r.collides) {
        collisions++
        continue // decidePreviousCycle reddeder (aşağıdaki test)
      }
      // Kapının açıldığı ilk saat: normal akış anahtarı ≠ key. UTC tarihi
      // zamanla monoton arttığı için akşamın geri kalanı bundan büyük/eşittir.
      for (let h = 1; h < 26; h++) {
        const probe = new Date(t + h * hour)
        const pr = resolvePreviousCycle(probe, tz)
        if (!pr.afterUnlock) continue
        assertNotEquals(utcKey(probe), r.key, `${tz} ${new Date(t).toISOString()} → ${probe.toISOString()}`)
        break
      }
    }
  }
  // Çakışma gerçekten var ve yalnız nadir DST günlerinde.
  assert(collisions > 0, 'Chicago/Winnipeg çakışması ölçülmedi')
  assert(collisions < 40, `beklenmedik çakışma sayısı: ${collisions}`)
})

// ─── Uygunluk kararı ────────────────────────────────────────────────────────

const LAUNCH = '2026-10-01'
const row = (id: string, date: string, cycle: string) => ({ id, date, cycle })
const res = (key: string, over: Partial<PreviousCycleResolution> = {}): PreviousCycleResolution => ({
  key,
  nextKey: addDays(key, 1),
  afterUnlock: false,
  collides: false,
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

Deno.test('CTO SARI-1: DST çakışması → açık ret (bu akşamı gölgelemez)', () => {
  assertEquals(decidePreviousCycle([], res('2027-03-14', { collides: true }), LAUNCH), {
    kind: 'reject',
    code: 'PREVIOUS_CYCLE_OUT_OF_WINDOW',
    reason: 'dst_collision',
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
