/**
 * Kimlik sıfırlamasının ÖLÇÜLMESİ — E-08'in cold-start yarısı.
 *
 * ── Neden ayrı bir modül ────────────────────────────────────────────────────
 * Faz 2'de eklenen `identity_reset_detected` eventi yalnızca uygulama AÇIKKEN
 * gelen `SIGNED_OUT` olayını yakalıyordu. Kimliğin en sık kaybolduğu yol ise
 * bu değil: AsyncStorage temizlenmesi veya cold start'ta oturumun geri
 * yüklenememesi HİÇ `SIGNED_OUT` yayınlamaz — açılış temiz kurulumdan
 * ayırt edilemez. Bu modül auth token'dan BAĞIMSIZ ikinci bir iz bırakarak
 * o farkı görünür kılar.
 *
 * Burada ağ, React Native ve analytics bağımlılığı YOKTUR: depolama enjekte
 * edilir, olay callback ile dışarı verilir. Sebep, `supabase/functions/
 * _shared/confidence.ts` ile aynı — saf karar mantığı cihaz gerektirmeden
 * test edilebilsin (`tests/identity/identityReset.test.ts`).
 *
 * ── KURTARMA YOK ────────────────────────────────────────────────────────────
 * Bu modül kaybolan kimliği geri getirmez, getirmeyi de denemez. Yalnızca
 * "sıfırlama oldu" bilgisini üretir. Kurtarma ayrı bir mimari karardır.
 */

/**
 * Auth token'dan tamamen bağımsız kendi anahtarımız.
 *
 * ⚠️ Supabase'in `sb-<project-ref>-auth-token` anahtarına DOKUNULMAZ. Ayrı
 * anahtar olmasının bütün amacı bu: token silindiğinde/bozulduğunda bu iz
 * hayatta kalır ve sıfırlamayı görebilmemizi sağlar. Aynı depoda yaşadıkları
 * için deponun tamamen silindiği senaryoda ikisi birlikte gider — o durum
 * `first_install` olarak sınıflanır ve sessiz kalır (aşağıdaki nota bakın).
 */
export const LAST_KNOWN_AUTH_ID_SUFFIX_KEY = 'chosy_last_known_auth_id_suffix';

/**
 * Ham `auth_id`'yi analitiğe sokmadan kimliği ayırt edilebilir kılar.
 *
 * PostHog'a ham auth id GÖNDERİLMEZ: PostHog kimliği kalıcı olarak saklar ve
 * dışa aktarılabilir; ham id ile analitik profili doğrudan auth kaydına
 * bağlanabilir hale gelir. Son 8 karakter iki koşumu ayırt etmeye yeter
 * (`identity_reset_detected` olayında eski/yeni kimliğin farklı olduğunu
 * görmek için) ama tek başına kimliği çözmeye yetmez.
 */
export function authIdSuffix(authId: string | null | undefined): string | null {
  if (!authId) return null;
  return authId.slice(-8);
}

/** AsyncStorage'ın bu modülün ihtiyaç duyduğu kadarı — test'te sahte geçilir. */
export interface IdentitySuffixStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/**
 * - `no_identity`   — çözülmüş bir auth id yok; yazma da yapılmaz.
 * - `first_install` — iz yok, gerçekten ilk kurulum. Olay YOK (normal durum).
 * - `unchanged`     — iz var ve aynı. Olay YOK, gereksiz yazma da YOK.
 * - `reset_detected`— iz var ve FARKLI: kimlik sessizce sıfırlanmış.
 */
export type ColdStartOutcome =
  | 'no_identity'
  | 'first_install'
  | 'unchanged'
  | 'reset_detected';

/**
 * Cold start'ta çözülen kimliği bir önceki koşumun izi ile karşılaştırır.
 *
 * Sıra ÖNEMLİ ve sözleşmenin parçasıdır: önce OKU, sonra (gerekiyorsa)
 * `onIdentityReset` ile haber ver, EN SON yaz. Yazma öne alınırsa referans
 * değer karşılaştırmadan önce ezilir ve sıfırlama sonsuza dek görünmez olur.
 *
 * @param onIdentityReset yalnızca `reset_detected` durumunda, yazmadan ÖNCE
 *   çağrılır. Fırlatırsa hata çağırana yükselir — yeni iz yazılmaz, böylece
 *   olay bir sonraki açılışta yeniden yakalanabilir.
 */
export async function reconcileColdStartIdentity(
  store: IdentitySuffixStore,
  authId: string | null | undefined,
  onIdentityReset: (previousSuffix: string, currentSuffix: string) => void,
): Promise<ColdStartOutcome> {
  const currentSuffix = authIdSuffix(authId);
  if (!currentSuffix) return 'no_identity';

  const previousSuffix = await store.getItem(LAST_KNOWN_AUTH_ID_SUFFIX_KEY);

  if (previousSuffix === currentSuffix) return 'unchanged';

  if (previousSuffix) {
    onIdentityReset(previousSuffix, currentSuffix);
    await store.setItem(LAST_KNOWN_AUTH_ID_SUFFIX_KEY, currentSuffix);
    return 'reset_detected';
  }

  await store.setItem(LAST_KNOWN_AUTH_ID_SUFFIX_KEY, currentSuffix);
  return 'first_install';
}

/**
 * İzi güncel tutar. Cold start uzlaştırmasından SONRAKİ her başarılı oturum
 * kurulumunda çağrılır (sosyal giriş, token yenileme, SIGNED_OUT recovery).
 *
 * Bu olmadan kullanıcının kasıtlı kimlik değişimi (örn. Apple ile giriş) bir
 * sonraki cold start'ta "sessiz sıfırlama" gibi raporlanırdı.
 */
export async function persistAuthIdSuffix(
  store: IdentitySuffixStore,
  authId: string | null | undefined,
): Promise<void> {
  const suffix = authIdSuffix(authId);
  if (!suffix) return;
  await store.setItem(LAST_KNOWN_AUTH_ID_SUFFIX_KEY, suffix);
}
