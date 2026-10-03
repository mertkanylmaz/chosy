/**
 * Unit tests — champion sonrası tek ask kararı (utils/askDecision.ts).
 * Run: npm run test:ask
 */

import { assertEquals, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  AUTH_COOLDOWN_MS,
  AUTH_MAX_SHOWS,
  EMPTY_ASK_STATE,
  isCardFullyVisible,
  localDayKey,
  parseAskState,
  recordAskShown,
  shouldShowAsk,
  spotlightStateFrom,
  type AskInputs,
} from '../../utils/askDecision.ts'

const NOW = Date.UTC(2026, 9, 3, 19, 0, 0)
const TODAY = '2026-10-03'
const DAY = 24 * 60 * 60 * 1000

function input(over: Partial<AskInputs> = {}): AskInputs {
  return {
    today: TODAY,
    now: NOW,
    dayIndex: 2,
    spotlightState: 'completed',
    askState: EMPTY_ASK_STATE,
    isAnonymous: true,
    authConverted: false,
    notifAsked: false,
    ...over,
  }
}

// ── Günde 1 ask ──────────────────────────────────────────────────────────────

Deno.test('bugün ask gösterildiyse → null (gün 1 ve gün 2+)', () => {
  const askState = { ...EMPTY_ASK_STATE, lastAskDay: TODAY }
  assertEquals(shouldShowAsk(input({ askState, dayIndex: 1 })), null)
  assertEquals(shouldShowAsk(input({ askState, dayIndex: 5 })), null)
})

Deno.test('dün ask gösterildiyse bugün yeniden sorulabilir', () => {
  const askState = { ...EMPTY_ASK_STATE, lastAskDay: '2026-10-02' }
  assertEquals(shouldShowAsk(input({ askState, dayIndex: 1 })), 'notif')
})

// ── Spotlight ────────────────────────────────────────────────────────────────

Deno.test('Spotlight in_progress → null (her gün, her ask)', () => {
  assertEquals(shouldShowAsk(input({ spotlightState: 'in_progress', dayIndex: 1 })), null)
  assertEquals(shouldShowAsk(input({ spotlightState: 'in_progress', dayIndex: 3 })), null)
})

Deno.test('Spotlight hiç başlanmadı (dwell) → karar normal işler', () => {
  assertEquals(shouldShowAsk(input({ spotlightState: 'not_started', dayIndex: 1 })), 'notif')
  assertEquals(shouldShowAsk(input({ spotlightState: 'not_started', dayIndex: 2 })), 'auth')
})

// ── Gün 1 ────────────────────────────────────────────────────────────────────

Deno.test('gün 1 → notif (hiç sorulmadıysa)', () => {
  assertEquals(shouldShowAsk(input({ dayIndex: 1 })), 'notif')
})

Deno.test('gün 1, bildirim sorulmuş → null (anonim olsa da auth YOK)', () => {
  assertEquals(shouldShowAsk(input({ dayIndex: 1, notifAsked: true })), null)
})

Deno.test('gün 0 (sayım gecikmesi) → null', () => {
  assertEquals(shouldShowAsk(input({ dayIndex: 0 })), null)
})

// ── Gün 2+ ───────────────────────────────────────────────────────────────────

Deno.test('gün 2, anonim, hiç gösterilmemiş → auth', () => {
  assertEquals(shouldShowAsk(input({ dayIndex: 2 })), 'auth')
})

Deno.test('gün 2, kayıtlı kullanıcı → notif; sorulmuşsa null', () => {
  assertEquals(shouldShowAsk(input({ isAnonymous: false })), 'notif')
  assertEquals(shouldShowAsk(input({ isAnonymous: false, notifAsked: true })), null)
})

Deno.test('gün 2, girişe dönüşmüş (auth_prompt_seen) → notif', () => {
  assertEquals(shouldShowAsk(input({ authConverted: true })), 'notif')
})

Deno.test('gün 2, cooldown içinde (< 3 gün) → notif; sorulmuşsa null', () => {
  const askState = {
    lastAskDay: '2026-10-01',
    auth: { count: 1, lastAt: NOW - AUTH_COOLDOWN_MS + 60_000 },
  }
  assertEquals(shouldShowAsk(input({ askState })), 'notif')
  assertEquals(shouldShowAsk(input({ askState, notifAsked: true })), null)
})

Deno.test('gün 2, cooldown tam doldu (= 3 gün) → auth', () => {
  const askState = {
    lastAskDay: '2026-09-30',
    auth: { count: 1, lastAt: NOW - AUTH_COOLDOWN_MS },
  }
  assertEquals(shouldShowAsk(input({ askState })), 'auth')
})

Deno.test('gün 2, count=2 ve cooldown dolmuş → auth (3. gösterim)', () => {
  const askState = { lastAskDay: '2026-09-20', auth: { count: 2, lastAt: NOW - 10 * DAY } }
  assertEquals(shouldShowAsk(input({ askState })), 'auth')
})

Deno.test('gün 2, count=3 → auth bir daha YOK; notif ya da null', () => {
  const askState = {
    lastAskDay: '2026-09-01',
    auth: { count: AUTH_MAX_SHOWS, lastAt: NOW - 30 * DAY },
  }
  assertEquals(shouldShowAsk(input({ askState })), 'notif')
  assertEquals(shouldShowAsk(input({ askState, notifAsked: true })), null)
})

// ── Durum işleme ─────────────────────────────────────────────────────────────

Deno.test('recordAskShown: auth sayacı artar, lastAt yazılır', () => {
  const s = recordAskShown(EMPTY_ASK_STATE, 'auth', TODAY, NOW)
  assertEquals(s, { lastAskDay: TODAY, auth: { count: 1, lastAt: NOW } })
})

Deno.test('recordAskShown: notif yalnız günü yazar, auth sayacına dokunmaz', () => {
  const prev = { lastAskDay: '2026-09-01', auth: { count: 2, lastAt: 123 } }
  const s = recordAskShown(prev, 'notif', TODAY, NOW)
  assertEquals(s, { lastAskDay: TODAY, auth: { count: 2, lastAt: 123 } })
})

Deno.test('gösterim sonrası aynı gün ikinci karar → null', () => {
  const s = recordAskShown(EMPTY_ASK_STATE, 'notif', TODAY, NOW)
  assertEquals(shouldShowAsk(input({ askState: s, dayIndex: 1 })), null)
})

Deno.test('parseAskState: yoksa boş durum, geçerliyse aynen', () => {
  assertEquals(parseAskState(null), EMPTY_ASK_STATE)
  const v = { lastAskDay: TODAY, auth: { count: 2, lastAt: NOW } }
  assertEquals(parseAskState(JSON.stringify(v)), v)
})

Deno.test('parseAskState: bozuk değer FIRLATIR (sessiz sıfırlama yok)', () => {
  assertThrows(() => parseAskState('{'))
  assertThrows(() => parseAskState('null'))
  assertThrows(() => parseAskState(JSON.stringify({ lastAskDay: 5, auth: { count: 0, lastAt: null } })))
  assertThrows(() => parseAskState(JSON.stringify({ lastAskDay: null })))
  assertThrows(() => parseAskState(JSON.stringify({ lastAskDay: null, auth: { count: -1, lastAt: null } })))
  assertThrows(() => parseAskState(JSON.stringify({ lastAskDay: null, auth: { count: 1, lastAt: 'x' } })))
})

Deno.test('spotlightStateFrom: ilerleme yok / yarıda / bitti', () => {
  assertEquals(spotlightStateFrom(null), 'not_started')
  assertEquals(spotlightStateFrom(undefined), 'not_started')
  assertEquals(spotlightStateFrom({ completed: false }), 'in_progress')
  assertEquals(spotlightStateFrom({ completed: true }), 'completed')
})

Deno.test('localDayKey: yerel, sıfır dolgulu', () => {
  assertEquals(localDayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05')
})

// ── Dwell görünürlüğü ────────────────────────────────────────────────────────

Deno.test('isCardFullyVisible: tamamen görünür / tab bar altında / üstte kaymış', () => {
  const base = { cardY: 600, cardHeight: 80, scrollY: 0, viewportHeight: 800, bottomInset: 100 }
  assertEquals(isCardFullyVisible(base), true) // 680 ≤ 700
  assertEquals(isCardFullyVisible({ ...base, cardY: 640 }), false) // 720 > 700, bar altında
  assertEquals(isCardFullyVisible({ ...base, cardY: 900, scrollY: 300 }), true)
  assertEquals(isCardFullyVisible({ ...base, scrollY: 620 }), false) // üst kenar dışarıda
  assertEquals(isCardFullyVisible({ ...base, cardHeight: 0 }), false) // ölçülmedi
  assertEquals(isCardFullyVisible({ ...base, viewportHeight: 0 }), false)
})
