/**
 * E-21 — istemcinin "önceki döngü sorgusu atılsın mı?" kararı. SAF fonksiyon:
 * ağ, depolama ve saat yok (Deno testi: tests/gauntlet/previousCycleProbe.test.ts).
 * Import'suz tutulur ki Deno `@/` alias'ı olmadan yükleyebilsin.
 *
 * Sunucu yetkili kaynaktır (sıfır satır kontrolü orada). Bu karar yalnız
 * MEVCUT kullanıcının 18:00 öncesi hiç ağ çağrısı yapmamasını sağlar
 * (V-1 Tur 4 onayı: "Cache + marker").
 */

/**
 * Cihazdaki kullanıcı başına iz:
 * - `previous` → önceki döngü gauntlet'i alındı, oyun sürüyor olabilir;
 *   yeniden açılışta sorgu tekrar atılır (kaldığı yerden devam).
 * - `closed`   → sunucu reddetti ya da önceki döngü bitti; bir daha sorulmaz.
 */
export type PreviousCycleMarker = 'previous' | 'closed';

export type ProbeReason =
  | 'unlocked'
  | 'no_timezone'
  | 'marker_closed'
  | 'resume'
  | 'existing_user_cache'
  | 'cache_unknown'
  | 'fresh';

export interface ProbeInput {
  /** 18:00 kapısı açık mı — açıksa E-21 hiç devreye girmez (3f). */
  unlocked: boolean;
  /** Cihaz IANA dilimi; yoksa sunucu anahtarı hesaplayamaz (açık ret). */
  timezone: string | undefined;
  marker: PreviousCycleMarker | null;
  /** `null` = cache okunamadı (hata çağıranda raporlandı). */
  hasCacheForUser: boolean | null;
}

export interface ProbeDecision {
  probe: boolean;
  /** true → çağıran `closed` iz'ini yazar (mevcut kullanıcı bir daha kontrol edilmez). */
  writeClosed: boolean;
  reason: ProbeReason;
}

export function decidePreviousCycleProbe(input: ProbeInput): ProbeDecision {
  if (input.unlocked) return { probe: false, writeClosed: false, reason: 'unlocked' };
  // Sessiz değil: çağıran bu sebebi Sentry warning olarak yazar.
  if (!input.timezone) return { probe: false, writeClosed: false, reason: 'no_timezone' };
  if (input.marker === 'closed') return { probe: false, writeClosed: false, reason: 'marker_closed' };
  if (input.marker === 'previous') return { probe: true, writeClosed: false, reason: 'resume' };
  if (input.hasCacheForUser === true) {
    return { probe: false, writeClosed: true, reason: 'existing_user_cache' };
  }
  // Cache okunamadıysa karar sunucuya bırakılır: yeni kullanıcının ilk
  // oturumunu gizlemek, mevcut kullanıcıya tek bir 409 yaşatmaktan pahalıdır.
  if (input.hasCacheForUser === null) return { probe: true, writeClosed: false, reason: 'cache_unknown' };
  return { probe: true, writeClosed: false, reason: 'fresh' };
}

// ─── generate-gauntlet hata sınıflandırması (3g) ─────────────────────────────

/**
 * `PreviousCycleRejectCode`'un (types/gauntlet.ts, kilitli sözleşme) aynası —
 * bu dosya import'suz kalmak zorunda. Sapma testte yakalanır
 * (tests/gauntlet/previousCycleProbe.test.ts).
 */
export const PREVIOUS_CYCLE_REJECT_CODES = [
  'PREVIOUS_CYCLE_NOT_ELIGIBLE',
  'PREVIOUS_CYCLE_OUT_OF_WINDOW',
] as const;

export type GenerateErrorKind = 'auth_pending' | 'offline' | 'previous_rejected' | 'server';

/**
 * YALNIZ 409 + bilinen ret kodu `previous_rejected`'tır; başka hiçbir hata
 * bekleyiş ekranına düşürmez (sessiz before_18 yasak — 5xx, 400, ağ hatası
 * mevcut `loadError` / cache yollarından geçer).
 */
export function classifyGenerateError(
  status: number | null,
  code: string | null,
): GenerateErrorKind {
  if (status === 401) return 'auth_pending';
  if (status === null) return 'offline';
  if (
    status === 409 &&
    code !== null &&
    (PREVIOUS_CYCLE_REJECT_CODES as readonly string[]).includes(code)
  ) {
    return 'previous_rejected';
  }
  return 'server';
}
