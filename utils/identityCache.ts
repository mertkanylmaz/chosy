/**
 * Kimlik çözümü önbelleği — `auth.users.id` → `public.users.id` eşlemesi.
 *
 * Saf mantık: supabase / React Native bağımlılığı YOK, Deno testi doğrudan
 * import eder (bkz. `tests/identity/identityCache.test.ts`). Ağ çağrısı
 * `resolve`'a verilen `fetcher` ile yapılır; `services/auth-utils.ts` bağlar.
 *
 * ── Kurallar (Sprint 10a) ─────────────────────────────────────────────────────
 * - Anahtar `authUid`: kimlik değişirse eşleşmez ve yeniden çözülür. Açık
 *   temizleme (`clear`) ek güvencedir, geçerliliğin tek dayanağı DEĞİLDİR.
 * - Tek-uçuş: aynı `authUid` + aynı `mode` için uçuştaki promise paylaşılır.
 *   `mode` ayrıdır çünkü okuyan çağıran (`null` dönebilir) ile oluşturan
 *   çağıran (satırı açar) aynı sonucu paylaşırsa oluşturma atlanırdı.
 * - Yalnızca BAŞARILI çözüm (`string`) önbelleğe yazılır. `null` ve fırlatılan
 *   hata yazılmaz — bootstrap penceresindeki geçici "satır yok" kalıcılaşmaz.
 * - `clear()` uçuştaki çözümü de geçersiz kılar: eski kimlik için başlamış bir
 *   istek sonradan bitse bile sonucu yazılmaz.
 */

export interface IdentityCache {
  /** Önbellekteyse onu, değilse `fetcher` sonucunu (tek-uçuş) döner. */
  resolve(
    authUid: string,
    mode: string,
    fetcher: () => Promise<string | null>,
  ): Promise<string | null>;
  /** Bilinen çözümü doğrudan yazar (ör. `ensureAppUser` upsert sonucu). */
  set(authUid: string, appUserId: string): void;
  /** Önbelleği ve uçuştaki çözümleri geçersiz kılar. */
  clear(): void;
}

export function createIdentityCache(): IdentityCache {
  let entry: { authUid: string; appUserId: string } | null = null;
  const inflight = new Map<string, Promise<string | null>>();
  let generation = 0;

  return {
    resolve(authUid, mode, fetcher) {
      if (entry && entry.authUid === authUid) {
        return Promise.resolve(entry.appUserId);
      }

      const key = `${authUid}\u0000${mode}`;
      const shared = inflight.get(key);
      if (shared) return shared;

      const startedGeneration = generation;
      // `Promise.resolve().then` — fetcher senkron fırlatsa da reddedilen
      // promise olur ve `finally` her durumda çalışır.
      const promise: Promise<string | null> = Promise.resolve()
        .then(fetcher)
        .then((appUserId) => {
          if (appUserId !== null && startedGeneration === generation) {
            entry = { authUid, appUserId };
          }
          return appUserId;
        })
        .finally(() => {
          if (inflight.get(key) === promise) inflight.delete(key);
        });

      inflight.set(key, promise);
      return promise;
    },

    set(authUid, appUserId) {
      entry = { authUid, appUserId };
    },

    clear() {
      generation += 1;
      entry = null;
      inflight.clear();
    },
  };
}
