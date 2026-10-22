/**
 * Cihaz saati sapması tespiti — saf mantık (AUTH-LOOP Faz 1, telemetri).
 *
 * Yeni verilmiş bir oturumda `expires_at − expires_in` sunucunun token'ı
 * verdiği andır (saniye). Cihaz saatiyle farkı, saat sapmasını gösterir:
 * saat sunucudan çok ilerideyse taze oturum `expires_at` kıyasında hemen
 * "süresi dolmak üzere" görünür ve auth-js her `getSession()`'da yeniler.
 *
 * Yalnız ölçer; davranışı DEĞİŞTİRMEZ. Yalnız TAZE verilmiş oturumlarda
 * anlamlıdır (SIGNED_IN, TOKEN_REFRESHED) — diskten geri yüklenen oturumun
 * (INITIAL_SESSION) verilme anı eskidir.
 */

/** Bu eşiğin üstündeki |sapma| raporlanır (sn). */
export const CLOCK_SKEW_THRESHOLD_S = 60;

export interface SessionTimes {
  expires_at?: number | null;
  expires_in?: number | null;
}

export interface ClockSkew {
  /** İşaretli: (sunucu − cihaz). Pozitif = cihaz saati geride, negatif = ileride. */
  skewS: number;
  expiresIn: number;
}

/** |sapma| eşiği aşıyorsa sapmayı, aşmıyorsa ya da alanlar eksikse `null` döner. */
export function detectClockSkew(session: SessionTimes, nowMs: number): ClockSkew | null {
  const { expires_at: expiresAt, expires_in: expiresIn } = session;
  if (typeof expiresAt !== 'number' || typeof expiresIn !== 'number') return null;
  if (!Number.isFinite(expiresAt) || !Number.isFinite(expiresIn)) return null;

  const skewS = Math.round(expiresAt - expiresIn - nowMs / 1000);
  if (Math.abs(skewS) <= CLOCK_SKEW_THRESHOLD_S) return null;
  return { skewS, expiresIn };
}
