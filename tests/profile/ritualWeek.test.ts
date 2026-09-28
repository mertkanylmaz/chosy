/**
 * Unit tests — Profil ritüel halkasının 7 günlük pencere hesabı.
 * Run: npm run test:ritual
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  RITUAL_WEEK_DAYS,
  buildRitualWeek,
  ritualWeekKeys,
  ritualWeekStart,
  utcDayKey,
} from '../../components/Profile/RitualRing/ritualWeek.ts'

const NOW = new Date('2026-09-29T12:00:00Z')

Deno.test('pencere 7 gün, eskiden yeniye, son eleman bugün', () => {
  const keys = ritualWeekKeys(NOW)
  assertEquals(keys.length, RITUAL_WEEK_DAYS)
  assertEquals(keys[0], '2026-09-23')
  assertEquals(keys[6], '2026-09-29')
  assertEquals(ritualWeekStart(NOW), '2026-09-23')
})

Deno.test('ay dönümünü geçer', () => {
  const keys = ritualWeekKeys(new Date('2026-10-02T08:00:00Z'))
  assertEquals(keys, [
    '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29',
    '2026-09-30', '2026-10-01', '2026-10-02',
  ])
})

Deno.test('gün anahtarı UTC — yerel gece yarısı sonrası önceki UTC günü kalır', () => {
  // İstanbul 02:30 (UTC+3) = UTC 23:30 önceki gün: sunucu utcDateString ile aynı
  assertEquals(utcDayKey(new Date('2026-09-28T23:30:00Z')), '2026-09-28')
})

Deno.test('doluluk: yalnız pencere içi tarihler, tekrarlar etkisiz', () => {
  const week = buildRitualWeek(
    ['2026-09-29', '2026-09-27', '2026-09-27', '2026-09-23', '2026-09-22', '2026-10-05'],
    NOW,
  )
  assertEquals(week, [true, false, false, false, true, false, true])
})

Deno.test('hiç şampiyon yok → 7 boş dilim', () => {
  assertEquals(buildRitualWeek([], NOW), Array(RITUAL_WEEK_DAYS).fill(false))
})
