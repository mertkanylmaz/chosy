/**
 * revenuecat-webhook — `auth.users` varlık sorgusu (TRANSFER ve appUserMissing
 * ortak kullanır).
 *
 * Eskiden `index.ts` TRANSFER dalında satır içi bir lambdaydı. Silinmiş hesap
 * ayrımı (`rcMissingUserDecision.ts`) aynı sorguya ihtiyaç duyunca tek
 * yardımcıya çıkarıldı; "bulunamadı" ile "sorgu düştü" ayrımı iki yerde de
 * aynı olsun diye.
 *
 * Saf modül: import yok, supabase istemcisi yapısal tiple alınır.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** `auth.users.id` biçimi. `$RCAnonymousID:…` ve benzerleri false döner. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/** `supabase.auth.admin.getUserById` sonucunun kullanılan alt kümesi. */
export interface AuthAdminLookup {
  auth: {
    admin: {
      getUserById(id: string): Promise<{
        data: { user: unknown } | null
        error: { status?: number; code?: string; message: string } | null
      }>
    }
  }
}

/**
 * `auth.users`'ta id var mı?
 *   - Bulundu → true
 *   - 404 / `user_not_found` → false
 *   - Diğer hatalar FIRLATIR (varlık bilinmiyor; çağıran "yok" saymamalı).
 */
export async function authUserExists(client: AuthAdminLookup, id: string): Promise<boolean> {
  const { data, error } = await client.auth.admin.getUserById(id)
  if (error) {
    if (error.status === 404 || error.code === 'user_not_found') return false
    throw new Error(`auth.admin.getUserById düştü — ${error.message}`)
  }
  return data?.user != null
}
