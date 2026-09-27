/**
 * Unit tests — avatar anahtarının kullanıcı bazlı taşınması (V-1 Tur 3, D8).
 *
 * Saf fonksiyonlar; ağ/DB/cihaz gerektirmez. Depo sahte geçilir.
 * Run: deno test tests/identity/avatarStorage.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  avatarStorageKey,
  clearStoredAvatar,
  LEGACY_AVATAR_KEY,
  migrateLegacyAvatar,
  readStoredAvatar,
  type AvatarStore,
} from '../../utils/avatarStorage.ts'

const USER = '11111111-2222-3333-4444-aaaaaaaaaaaa'
const OTHER = '99999999-8888-7777-6666-bbbbbbbbbbbb'

/** AsyncStorage'ın sahtesi + yazma çağrılarının kaydı. */
function fakeStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  const writes: string[] = []
  const store: AvatarStore = {
    getItem(key) {
      return Promise.resolve(data.get(key) ?? null)
    },
    setItem(key, value) {
      writes.push(`set:${key}=${value}`)
      data.set(key, value)
      return Promise.resolve()
    },
    removeItem(key) {
      writes.push(`remove:${key}`)
      data.delete(key)
      return Promise.resolve()
    },
  }
  return { store, data, writes }
}

Deno.test('avatarStorageKey — publicUserId ile kurulur', () => {
  assertEquals(avatarStorageKey(USER), `chosy_user_avatar_${USER}`)
})

Deno.test('eski anahtar var → yeni anahtara taşınır, eskisi silinir', async () => {
  const { store, data, writes } = fakeStore({ [LEGACY_AVATAR_KEY]: 'tripod' })

  assertEquals(await migrateLegacyAvatar(store, USER), 'migrated')
  assertEquals(data.get(avatarStorageKey(USER)), 'tripod')
  assertEquals(data.has(LEGACY_AVATAR_KEY), false)
  assertEquals(writes, [
    `set:${avatarStorageKey(USER)}=tripod`,
    `remove:${LEGACY_AVATAR_KEY}`,
  ])
})

Deno.test('ikinci çalıştırma → değişiklik yok (idempotent)', async () => {
  const { store, data, writes } = fakeStore({ [LEGACY_AVATAR_KEY]: 'tripod' })
  await migrateLegacyAvatar(store, USER)
  const snapshot = new Map(data)
  writes.length = 0

  assertEquals(await migrateLegacyAvatar(store, USER), 'none')
  assertEquals(writes, [])
  assertEquals(data, snapshot)
})

Deno.test('eski anahtar yok → hiçbir yazma yapılmaz', async () => {
  const { store, writes } = fakeStore({ [avatarStorageKey(USER)]: 'megaphone' })

  assertEquals(await migrateLegacyAvatar(store, USER), 'none')
  assertEquals(writes, [])
})

Deno.test('yeni anahtar zaten dolu → ezilmez, eski anahtar yalnızca silinir', async () => {
  const { store, data } = fakeStore({
    [LEGACY_AVATAR_KEY]: 'tripod',
    [avatarStorageKey(USER)]: 'megaphone',
  })

  assertEquals(await migrateLegacyAvatar(store, USER), 'legacy_dropped')
  assertEquals(data.get(avatarStorageKey(USER)), 'megaphone')
  assertEquals(data.has(LEGACY_AVATAR_KEY), false)
})

Deno.test('taşıma sonrası başka hesap eski değeri görmez', async () => {
  const { store } = fakeStore({ [LEGACY_AVATAR_KEY]: 'tripod' })

  assertEquals(await readStoredAvatar(store, USER), 'tripod')
  assertEquals(await readStoredAvatar(store, OTHER), null)
})

Deno.test('clearStoredAvatar — kullanıcı anahtarı ve eski anahtar silinir, diğer hesap kalır', async () => {
  const { store, data } = fakeStore({
    [LEGACY_AVATAR_KEY]: 'tripod',
    [avatarStorageKey(USER)]: 'megaphone',
    [avatarStorageKey(OTHER)]: 'boom_mic',
  })

  await clearStoredAvatar(store, USER)
  assertEquals(data.has(avatarStorageKey(USER)), false)
  assertEquals(data.has(LEGACY_AVATAR_KEY), false)
  assertEquals(data.get(avatarStorageKey(OTHER)), 'boom_mic')
})
