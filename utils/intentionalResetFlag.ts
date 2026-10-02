/**
 * Kasıtlı sıfırlama bayrağı — saf mantık (identity_reset, Sprint 1).
 *
 * `services/sessionReset.ts` bunun modül düzeyi tek örneğini tutar ve
 * `markIntentionalReset` / `consumeIntentionalReset` olarak dışa verir.
 * Burada RN, ağ ve Sentry bağımlılığı YOKTUR; saat enjekte edilir ki süre
 * sonu cihaz gerektirmeden test edilebilsin
 * (`tests/identity/intentionalResetFlag.test.ts`).
 *
 * Süre sonu: bayrak takılı kalırsa (signOut SIGNED_OUT yaymadan döner,
 * tüketici hiç çalışmaz) sonraki GERÇEK kimlik kaybını bastırmamalı.
 * signOut → SIGNED_OUT birkaç yüz ms; 30 sn bol pay.
 */

/** `mark` sonrası bayrağın geçerli kaldığı süre. */
export const INTENTIONAL_RESET_TTL_MS = 30_000;

export interface IntentionalResetFlag {
  /** Kasıtlı sıfırlama başlıyor — sonraki SIGNED_OUT kimlik kaybı sayılmaz. */
  mark(): void;
  /**
   * Bayrağı TÜKETİR (tek kullanımlık) ve süresi içinde kurulmuş muydu
   * döner. Süresi geçmiş bayrak `false` döner — olay normal ölçülür.
   */
  consume(): boolean;
}

export function createIntentionalResetFlag(
  now: () => number = Date.now,
  ttlMs: number = INTENTIONAL_RESET_TTL_MS,
): IntentionalResetFlag {
  let markedAt: number | null = null;
  return {
    mark() {
      markedAt = now();
    },
    consume() {
      const at = markedAt;
      markedAt = null;
      return at !== null && now() - at <= ttlMs;
    },
  };
}
