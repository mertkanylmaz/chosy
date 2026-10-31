/**
 * Pro Mode arama hakkı yorumlama + erişim kapısı (MONEY-1C).
 * Run: npm run test:mood-offer
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  decideProModeGate,
  interpretParseMoodQuota,
  interpretQuotaStatus,
  resetsIn,
} from '../../utils/searchQuota.ts'

const status = (used: number, limit: number, bonus = 0) => ({
  searches: { used, limit, bonus_available: bonus },
  reset_at: '2026-10-25T00:00:00.000Z',
})

Deno.test('get_quota_status: hak var', () => {
  assertEquals(interpretQuotaStatus(status(0, 1)), {
    kind: 'available', remaining: 1, resetsAt: '2026-10-25T00:00:00.000Z',
  })
})

Deno.test('get_quota_status: hak bitti', () => {
  assertEquals(interpretQuotaStatus(status(1, 1)).kind, 'exhausted')
  assertEquals(interpretQuotaStatus(status(3, 1)).kind, 'exhausted')
})

Deno.test('get_quota_status: bonus hak kalan sayısına eklenir', () => {
  assertEquals(interpretQuotaStatus(status(1, 1, 2)), {
    kind: 'available', remaining: 2, resetsAt: '2026-10-25T00:00:00.000Z',
  })
})

Deno.test('get_quota_status: -1 ve 999999 sınırsız', () => {
  assertEquals(interpretQuotaStatus(status(40, -1)), { kind: 'available', remaining: null, resetsAt: null })
  assertEquals(interpretQuotaStatus(status(40, 999999)).kind, 'available')
})

Deno.test('get_quota_status: anlaşılmaz şekiller unknown (hak varsayılır, kilitlemez)', () => {
  for (const bad of [null, undefined, 'x', {}, { error: 'USER_NOT_FOUND' }, { searches: {} }, { searches: { used: '1', limit: 1 } }]) {
    assertEquals(interpretQuotaStatus(bad), { kind: 'unknown' })
  }
})

Deno.test('parse-mood yanıtı: remaining 0 → exhausted, null → sınırsız, alan yok → unknown', () => {
  assertEquals(interpretParseMoodQuota({ remaining: 0, limit: 1, resets_at: '2026-10-25T00:00:00.000Z' }).kind, 'exhausted')
  assertEquals(interpretParseMoodQuota({ remaining: null, limit: null, resets_at: null }), { kind: 'available', remaining: null, resetsAt: null })
  assertEquals(interpretParseMoodQuota({ profile: 1 }), { kind: 'unknown' })
})

Deno.test('kapı: bayrak KAPALI → bugünkü davranış (allowed ? enter : locked), hak ne olursa olsun', () => {
  const quotas = ['checking', { kind: 'unknown' }, { kind: 'exhausted', resetsAt: null }, { kind: 'available', remaining: 1, resetsAt: null }] as const
  for (const quota of quotas) {
    assertEquals(decideProModeGate({ offerEnabled: false, entitled: true, quota }), 'enter')
    assertEquals(decideProModeGate({ offerEnabled: false, entitled: false, quota }), 'locked')
  }
})

Deno.test('kapı: bayrak AÇIK', () => {
  const ex = { kind: 'exhausted', resetsAt: null } as const
  assertEquals(decideProModeGate({ offerEnabled: true, entitled: true, quota: ex }), 'enter')
  assertEquals(decideProModeGate({ offerEnabled: true, entitled: false, quota: 'checking' }), 'checking')
  assertEquals(decideProModeGate({ offerEnabled: true, entitled: false, quota: { kind: 'available', remaining: 1, resetsAt: null } }), 'enter')
  assertEquals(decideProModeGate({ offerEnabled: true, entitled: false, quota: { kind: 'unknown' } }), 'enter')
  assertEquals(decideProModeGate({ offerEnabled: true, entitled: false, quota: ex }), 'offer')
})

Deno.test('resetsIn: saat/dakika, yukarı yuvarlar; geçmiş/geçersiz null', () => {
  const now = new Date('2026-10-24T20:30:30.000Z')
  assertEquals(resetsIn('2026-10-25T00:00:00.000Z', now), { hours: 3, minutes: 30 })
  assertEquals(resetsIn('2026-10-24T20:40:00.000Z', now), { hours: 0, minutes: 10 })
  assertEquals(resetsIn('2026-10-24T20:00:00.000Z', now), null)
  assertEquals(resetsIn('nope', now), null)
  assertEquals(resetsIn(null, now), null)
})
