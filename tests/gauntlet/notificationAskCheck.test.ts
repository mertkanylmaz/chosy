/**
 * Unit tests — bildirim izni sheet kontrolü (utils/notificationAskCheck.ts).
 * Run: npm run test:notif-ask
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  checkShouldAskForNotification,
  type NotificationAskDeps,
} from '../../utils/notificationAskCheck.ts'

/** Sahte bağımlılıklar — çağrıları ve raporlanan hataları kaydeder. */
function deps(over: Partial<NotificationAskDeps> = {}) {
  const state = { marked: 0, reported: [] as unknown[] }
  const d: NotificationAskDeps = {
    readAsked: () => Promise.resolve(null),
    isGranted: () => Promise.resolve(false),
    markAsked: () => {
      state.marked += 1
      return Promise.resolve()
    },
    reportError: (err) => {
      state.reported.push(err)
    },
    ...over,
  }
  return { state, d }
}

Deno.test('hiç sorulmadı, izin yok → true, rapor yok', async () => {
  const { state, d } = deps()
  assertEquals(await checkShouldAskForNotification(d), true)
  assertEquals(state.reported.length, 0)
})

Deno.test('daha önce soruldu → false', async () => {
  const { state, d } = deps({ readAsked: () => Promise.resolve('true') })
  assertEquals(await checkShouldAskForNotification(d), false)
  assertEquals(state.marked, 0)
})

Deno.test('izin zaten verilmiş → false ve bayrak yazılır', async () => {
  const { state, d } = deps({ isGranted: () => Promise.resolve(true) })
  assertEquals(await checkShouldAskForNotification(d), false)
  assertEquals(state.marked, 1)
})

Deno.test('HATA: okuma başarısız → false + hata raporlanır (sessiz değil)', async () => {
  const boom = new Error('AsyncStorage okunamadı')
  const { state, d } = deps({ readAsked: () => Promise.reject(boom) })
  assertEquals(await checkShouldAskForNotification(d), false)
  assertEquals(state.reported, [boom])
})

Deno.test('HATA: bayrak yazımı başarısız → false + hata raporlanır', async () => {
  const boom = new Error('AsyncStorage yazılamadı')
  const { state, d } = deps({
    isGranted: () => Promise.resolve(true),
    markAsked: () => Promise.reject(boom),
  })
  assertEquals(await checkShouldAskForNotification(d), false)
  assertEquals(state.reported, [boom])
})
