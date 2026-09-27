/**
 * Profil avatarının yerel saklanması — kullanıcı bazlı anahtar (V-1 Tur 3, D8).
 *
 * ── Neden ─────────────────────────────────────────────────────────────────
 * Eski anahtar `chosy_user_avatar` cihaz bazlıydı: aynı cihazda oturum açan
 * her hesap bir öncekinin avatarını görüyordu. Yeni anahtar `public.users.id`
 * ile kurulur.
 *
 * ── Taşıma ────────────────────────────────────────────────────────────────
 * İlk okumada eski anahtar varsa değeri yeni anahtara taşınır ve eski anahtar
 * silinir. İdempotent: eski anahtar yoksa hiçbir yazma yapılmaz. Sıra
 * önce yaz, sonra sil; arada kesilirse bir sonraki çağrı eski anahtarı
 * (yeni anahtar artık dolu olduğu için) yalnızca siler.
 *
 * Burada React Native bağımlılığı YOKTUR: depolama enjekte edilir ki mantık
 * cihaz gerektirmeden test edilebilsin (`tests/identity/avatarStorage.test.ts`).
 */

/** Cihaz bazlı eski anahtar — yalnızca taşıma ve hesap silme temizliği okur. */
export const LEGACY_AVATAR_KEY = 'chosy_user_avatar';

export function avatarStorageKey(publicUserId: string): string {
  return `${LEGACY_AVATAR_KEY}_${publicUserId}`;
}

/** AsyncStorage'ın bu modülün ihtiyaç duyduğu kadarı — test'te sahte geçilir. */
export interface AvatarStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * - `none`           — eski anahtar yok; hiçbir yazma yapılmadı.
 * - `migrated`       — eski değer yeni anahtara taşındı, eski anahtar silindi.
 * - `legacy_dropped` — yeni anahtar zaten doluydu; eski anahtar yalnızca silindi
 *                      (yeni değer ezilmez).
 */
export type AvatarMigrationOutcome = 'none' | 'migrated' | 'legacy_dropped';

export async function migrateLegacyAvatar(
  store: AvatarStore,
  publicUserId: string,
): Promise<AvatarMigrationOutcome> {
  const legacy = await store.getItem(LEGACY_AVATAR_KEY);
  if (legacy === null) return 'none';

  const key = avatarStorageKey(publicUserId);
  const current = await store.getItem(key);
  if (current !== null) {
    await store.removeItem(LEGACY_AVATAR_KEY);
    return 'legacy_dropped';
  }

  await store.setItem(key, legacy);
  await store.removeItem(LEGACY_AVATAR_KEY);
  return 'migrated';
}

/** Taşımayı çalıştırır, ardından kullanıcının kayıtlı değerini döndürür. */
export async function readStoredAvatar(
  store: AvatarStore,
  publicUserId: string,
): Promise<string | null> {
  await migrateLegacyAvatar(store, publicUserId);
  return store.getItem(avatarStorageKey(publicUserId));
}

export async function writeStoredAvatar(
  store: AvatarStore,
  publicUserId: string,
  value: string,
): Promise<void> {
  await store.setItem(avatarStorageKey(publicUserId), value);
}

/**
 * Hesap silme temizliği (K-16 istemci ayağı). Eski anahtar da silinir:
 * taşıma hiç çalışmamışsa (kullanıcı güncellemeden sonra Profile'ı hiç
 * açmadıysa) cihaz bazlı değer bir sonraki hesaba sızardı.
 */
export async function clearStoredAvatar(
  store: AvatarStore,
  publicUserId: string,
): Promise<void> {
  await store.removeItem(avatarStorageKey(publicUserId));
  await store.removeItem(LEGACY_AVATAR_KEY);
}
