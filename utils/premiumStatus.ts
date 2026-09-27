/**
 * Premium durumunun ÇÖZÜMLENMESİ — `useSubscription().premiumStatus`'un saf
 * karar mantığı (V-1 Tur 1, CTO kararı D3).
 *
 * ── Neden üç durum ──────────────────────────────────────────────────────────
 * `isPremium: boolean` "yükleniyor" ile "free"yi ayırt edemiyordu; ilk
 * açılışta ödeyen kullanıcı bir an free göründü ve paywall'a düştü. Ayrıca
 * RC `chosy_plus` aktifken `subscriptions` satırı henüz yoksa (webhook
 * gecikmesi) sonuç free oluyordu. Kural artık: RC aktif ⇒ premium.
 *
 * ── Neden ayrı bir modül ────────────────────────────────────────────────────
 * Burada ağ, React Native ve SDK bağımlılığı YOKTUR — `utils/identityReset.ts`
 * ile aynı gerekçe: karar mantığı cihaz gerektirmeden test edilebilsin
 * (`tests/subscription/premiumStatus.test.ts`). `errorKind` tipi jenerik
 * alınır; `PurchaseErrorKind` burada yeniden tanımlanmaz.
 *
 * Sentry'ye yazmak ÇAĞIRANIN işidir — bu modül yalnızca bayrak üretir.
 */

/** UI için tek premium kaynağı. `loading` = henüz ne RC ne DB çözüldü. */
export type PremiumStatus = 'loading' | 'premium' | 'free';

export interface PremiumResolution<K extends string> {
  status: PremiumStatus;
  /** RC aktif ama DB satırı yok — webhook gecikmesi ölçümü (Sentry warning) */
  rcActiveDbMissing: boolean;
  /**
   * RC okunamadı; sonuç önceki çözülmüş state'ten ya da `free`'den geldi.
   * Doluysa çağıran Sentry'ye error yazar.
   */
  rcUnreadable: K | 'sdk_error' | null;
}

/**
 * RC + DB okumalarından premium durumunu çözer.
 *
 * Kural sırası:
 * 1. RC okundu ve entitlement aktif → `premium` (DB satırı olmasa da)
 * 2. DB `status === 'active'` → `premium`
 * 3. RC okundu, aktif değil → `free`
 * 4. RC okunamadı → önceki çözülmüş durum korunur; ilk yüklemedeyse `free`.
 *    Geçici ağ hatası ödeme yapmış kullanıcıyı düşürmesin, ama ilk yüklemede
 *    sonsuz `loading` de olmasın.
 *
 * @param rc       RC okuması; `null` = okuma hiç tamamlanmadı (throw)
 * @param db       `subscriptions` satırı; `null` = satır yok
 * @param previous Mevcut `premiumStatus`
 */
export function resolvePremiumStatus<K extends string>(
  rc: { isPremium: boolean; errorKind?: K } | null,
  db: { status: string } | null,
  previous: PremiumStatus,
): PremiumResolution<K> {
  const rcRead = rc !== null && !rc.errorKind;

  if (rcRead && rc.isPremium) {
    return { status: 'premium', rcActiveDbMissing: db === null, rcUnreadable: null };
  }

  if (db?.status === 'active') {
    return { status: 'premium', rcActiveDbMissing: false, rcUnreadable: null };
  }

  if (rcRead) {
    return { status: 'free', rcActiveDbMissing: false, rcUnreadable: null };
  }

  return {
    status: previous !== 'loading' ? previous : 'free',
    rcActiveDbMissing: false,
    rcUnreadable: rc?.errorKind ?? 'sdk_error',
  };
}
