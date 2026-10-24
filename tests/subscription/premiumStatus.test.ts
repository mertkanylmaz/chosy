/**
 * Unit tests — üç durumlu premium çözümlemesi (V-1 Tur 1, CTO D3).
 *
 * Saf fonksiyon; ağ/SDK/cihaz gerektirmez.
 * Run: deno test tests/subscription/premiumStatus.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { isDbEntitled, resolvePremiumStatus } from '../../utils/premiumStatus.ts'

type Kind = 'network' | 'sdk_error'

const RC_ACTIVE = { isPremium: true }
const RC_NONE = { isPremium: false }
const RC_NETWORK_ERROR: { isPremium: boolean; errorKind: Kind } = { isPremium: false, errorKind: 'network' }
const DB_ACTIVE = { status: 'active' }
const DB_TRIAL = { status: 'trial' }
const DB_EXPIRED = { status: 'expired' }

// ─── 1. RC aktif + DB satırı yok (webhook gecikmesi) ─────────────────────────

Deno.test('RC aktif, DB yok → premium + webhook gecikmesi bayrağı', () => {
  assertEquals(resolvePremiumStatus<Kind>(RC_ACTIVE, null, 'loading'), {
    status: 'premium',
    rcActiveDbMissing: true,
    rcUnreadable: null,
  })
})

// ─── 2. RC yok + DB aktif ────────────────────────────────────────────────────

Deno.test('RC aktif değil, DB aktif → premium', () => {
  assertEquals(resolvePremiumStatus<Kind>(RC_NONE, DB_ACTIVE, 'loading'), {
    status: 'premium',
    rcActiveDbMissing: false,
    rcUnreadable: null,
  })
})

// ─── 3. İkisi de yok ─────────────────────────────────────────────────────────

Deno.test('RC aktif değil, DB yok → free', () => {
  assertEquals(resolvePremiumStatus<Kind>(RC_NONE, null, 'loading'), {
    status: 'free',
    rcActiveDbMissing: false,
    rcUnreadable: null,
  })
})

// ─── 4. RC hata ──────────────────────────────────────────────────────────────

Deno.test('RC hata, DB yok, ilk yükleme → free + rcUnreadable (sonsuz loading yok)', () => {
  assertEquals(resolvePremiumStatus<Kind>(RC_NETWORK_ERROR, null, 'loading'), {
    status: 'free',
    rcActiveDbMissing: false,
    rcUnreadable: 'network',
  })
})

Deno.test('RC hata, DB yok, önceden premium → premium korunur', () => {
  assertEquals(resolvePremiumStatus<Kind>(RC_NETWORK_ERROR, null, 'premium'), {
    status: 'premium',
    rcActiveDbMissing: false,
    rcUnreadable: 'network',
  })
})

Deno.test('RC hata, DB aktif → premium (DB yeterli)', () => {
  assertEquals(resolvePremiumStatus<Kind>(RC_NETWORK_ERROR, DB_ACTIVE, 'loading'), {
    status: 'premium',
    rcActiveDbMissing: false,
    rcUnreadable: null,
  })
})

Deno.test('RC okuması patladı (null), ilk yükleme → free + sdk_error', () => {
  assertEquals(resolvePremiumStatus<Kind>(null, null, 'loading'), {
    status: 'free',
    rcActiveDbMissing: false,
    rcUnreadable: 'sdk_error',
  })
})

Deno.test('RC okuması patladı (null), önceden premium → premium korunur (catch yolu)', () => {
  assertEquals(resolvePremiumStatus<Kind>(null, null, 'premium'), {
    status: 'premium',
    rcActiveDbMissing: false,
    rcUnreadable: 'sdk_error',
  })
})

// ─── Kural sırası: RC hatası errorKind'lı isPremium:true'yu premium SAYMAZ ───

Deno.test('RC errorKind dolu ama isPremium:true → RC güvenilmez, ilk yüklemede free', () => {
  assertEquals(
    resolvePremiumStatus<Kind>({ isPremium: true, errorKind: 'network' }, null, 'loading').status,
    'free',
  )
})

// ─── trial (MONEY-1A): webhook artık `trial` yazar, DB dalı onu da premium sayar ──

Deno.test('RC aktif değil, DB trial → premium', () => {
  assertEquals(resolvePremiumStatus<Kind>(RC_NONE, DB_TRIAL, 'loading'), {
    status: 'premium',
    rcActiveDbMissing: false,
    rcUnreadable: null,
  })
})

Deno.test('çevrimdışı: RC hata, DB trial, ilk yükleme → premium (free değil)', () => {
  assertEquals(resolvePremiumStatus<Kind>(RC_NETWORK_ERROR, DB_TRIAL, 'loading'), {
    status: 'premium',
    rcActiveDbMissing: false,
    rcUnreadable: null,
  })
})

Deno.test('çevrimdışı: RC okuması patladı (null), DB trial → premium', () => {
  assertEquals(resolvePremiumStatus<Kind>(null, DB_TRIAL, 'loading').status, 'premium')
})

Deno.test('RC aktif + DB trial → premium, rcActiveDbMissing false', () => {
  assertEquals(resolvePremiumStatus<Kind>(RC_ACTIVE, DB_TRIAL, 'loading'), {
    status: 'premium',
    rcActiveDbMissing: false,
    rcUnreadable: null,
  })
})

Deno.test('RC okundu aktif değil, DB expired → free (trial süresi dolmuş)', () => {
  assertEquals(resolvePremiumStatus<Kind>(RC_NONE, DB_EXPIRED, 'premium').status, 'free')
})

Deno.test('isDbEntitled: yalnız active ve trial', () => {
  assertEquals(
    ['active', 'trial', 'free', 'expired', 'cancelled', ''].map(isDbEntitled),
    [true, true, false, false, false, false],
  )
})
