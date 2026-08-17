/**
 * Unit tests — cold-start kimlik sıfırlama tespiti (E-08 / M0 Faz 3).
 *
 * Saf fonksiyonlar; ağ/DB/cihaz gerektirmez. Depo sahte geçilir, olay
 * callback ile yakalanır.
 * Run: deno test tests/identity/identityReset.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  authIdSuffix,
  LAST_KNOWN_AUTH_ID_SUFFIX_KEY,
  persistAuthIdSuffix,
  reconcileColdStartIdentity,
  type IdentitySuffixStore,
} from '../../utils/identityReset.ts'

const KEY = LAST_KNOWN_AUTH_ID_SUFFIX_KEY

/** AsyncStorage'ın sahtesi + hangi çağrıların yapıldığının kaydı. */
function fakeStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  const calls: string[] = []
  const store: IdentitySuffixStore = {
    getItem(key) {
      calls.push(`get:${key}`)
      return Promise.resolve(data.get(key) ?? null)
    },
    setItem(key, value) {
      calls.push(`set:${key}=${value}`)
      data.set(key, value)
      return Promise.resolve()
    },
  }
  return { store, data, calls }
}

/** Olayı yakalayan sahte tracker. */
function fakeTracker() {
  const events: Array<{ previous: string; current: string }> = []
  return {
    events,
    onReset: (previous: string, current: string) => {
      events.push({ previous, current })
    },
  }
}

const OLD_ID = '11111111-2222-3333-4444-aaaaaaaaaaaa' // suffix: aaaaaaaa
const NEW_ID = '99999999-8888-7777-6666-bbbbbbbbbbbb' // suffix: bbbbbbbb

// ─── authIdSuffix ────────────────────────────────────────────────────────────

Deno.test('authIdSuffix — son 8 karakter, ham id sızmaz', () => {
  assertEquals(authIdSuffix(OLD_ID), 'aaaaaaaa')
  assertEquals(authIdSuffix(OLD_ID)!.length, 8)
})

Deno.test('authIdSuffix — kimlik yoksa null', () => {
  assertEquals(authIdSuffix(null), null)
  assertEquals(authIdSuffix(undefined), null)
  assertEquals(authIdSuffix(''), null)
})

// ─── Sıfırlama tespiti: ateşlenmesi GEREKEN tek durum ────────────────────────

Deno.test('reconcile — iz VAR ve FARKLI: olay ateşlenir, iz güncellenir', async () => {
  const { store, data, calls } = fakeStore({ [KEY]: 'aaaaaaaa' })
  const tracker = fakeTracker()

  const outcome = await reconcileColdStartIdentity(store, NEW_ID, tracker.onReset)

  assertEquals(outcome, 'reset_detected')
  assertEquals(tracker.events, [{ previous: 'aaaaaaaa', current: 'bbbbbbbb' }])
  assertEquals(data.get(KEY), 'bbbbbbbb')
  // Sıra sözleşmesi: ÖNCE oku, SONRA yaz. Yazma öne geçerse referans ezilir.
  assertEquals(calls, [`get:${KEY}`, `set:${KEY}=bbbbbbbb`])
})

// ─── Ateşlenmemesi GEREKEN durumlar ──────────────────────────────────────────

Deno.test('reconcile — iz YOK (gerçek ilk kurulum): olay YOK, iz yazılır', async () => {
  const { store, data } = fakeStore()
  const tracker = fakeTracker()

  const outcome = await reconcileColdStartIdentity(store, NEW_ID, tracker.onReset)

  assertEquals(outcome, 'first_install')
  assertEquals(tracker.events.length, 0)
  assertEquals(data.get(KEY), 'bbbbbbbb')
})

Deno.test('reconcile — iz VAR ve AYNI: olay YOK, gereksiz yazma da YOK', async () => {
  const { store, calls } = fakeStore({ [KEY]: 'bbbbbbbb' })
  const tracker = fakeTracker()

  const outcome = await reconcileColdStartIdentity(store, NEW_ID, tracker.onReset)

  assertEquals(outcome, 'unchanged')
  assertEquals(tracker.events.length, 0)
  assertEquals(calls, [`get:${KEY}`])
})

Deno.test('reconcile — çözülmüş kimlik yok: depoya hiç dokunulmaz', async () => {
  const { store, calls } = fakeStore({ [KEY]: 'aaaaaaaa' })
  const tracker = fakeTracker()

  const outcome = await reconcileColdStartIdentity(store, null, tracker.onReset)

  assertEquals(outcome, 'no_identity')
  assertEquals(tracker.events.length, 0)
  assertEquals(calls, [])
})

// ─── Olay gönderimi patlarsa iz YAZILMAZ ─────────────────────────────────────

Deno.test('reconcile — onIdentityReset fırlarsa iz yazılmaz (olay kaybolmaz)', async () => {
  const { store, data } = fakeStore({ [KEY]: 'aaaaaaaa' })

  let threw = false
  try {
    await reconcileColdStartIdentity(store, NEW_ID, () => {
      throw new Error('posthog down')
    })
  } catch {
    threw = true
  }

  assertEquals(threw, true)
  // Eski iz duruyor: sıfırlama bir sonraki açılışta yeniden yakalanabilir.
  assertEquals(data.get(KEY), 'aaaaaaaa')
})

// ─── İzin tazelenmesi ────────────────────────────────────────────────────────

Deno.test('persist — kasıtlı kimlik değişimi izi tazeler', async () => {
  const { store, data } = fakeStore({ [KEY]: 'aaaaaaaa' })

  await persistAuthIdSuffix(store, NEW_ID)

  assertEquals(data.get(KEY), 'bbbbbbbb')
})

Deno.test('persist — kimlik yoksa iz bozulmaz', async () => {
  const { store, data } = fakeStore({ [KEY]: 'aaaaaaaa' })

  await persistAuthIdSuffix(store, null)

  assertEquals(data.get(KEY), 'aaaaaaaa')
})

// ─── Uçtan uca senaryo: iki cold start arası sessiz sıfırlama ────────────────

Deno.test('senaryo — 1. açılış iz bırakır, AsyncStorage token silinir, 2. açılışta yakalanır', async () => {
  const { store, data } = fakeStore()
  const first = fakeTracker()

  // 1. açılış: temiz kurulum, kimlik OLD_ID. Olay beklenmez.
  assertEquals(
    await reconcileColdStartIdentity(store, OLD_ID, first.onReset),
    'first_install',
  )
  assertEquals(first.events.length, 0)
  assertEquals(data.get(KEY), 'aaaaaaaa')

  // Arada: Supabase auth token'ı kayboldu (bizim anahtarımız ayrı, hayatta).
  // Uygulama yeni anonim kimlik açtı: NEW_ID. Hiç SIGNED_OUT yayınlanmadı.
  const second = fakeTracker()
  assertEquals(
    await reconcileColdStartIdentity(store, NEW_ID, second.onReset),
    'reset_detected',
  )
  assertEquals(second.events, [{ previous: 'aaaaaaaa', current: 'bbbbbbbb' }])

  // 3. açılış: aynı kimlik, tekrar raporlanmaz (çift sayım yok).
  const third = fakeTracker()
  assertEquals(
    await reconcileColdStartIdentity(store, NEW_ID, third.onReset),
    'unchanged',
  )
  assertEquals(third.events.length, 0)
})
