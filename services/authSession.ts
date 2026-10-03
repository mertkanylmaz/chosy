/**
 * Oturum güvencesi — TEK TANIM (Sprint 10b).
 *
 * İki dışa aktarım:
 * - `ensureAuthSession()`: Edge Function / RLS yazması öncesi; FIRLATMAZ.
 * - `getFreshSession()`: oturumun KENDİSİNİ isteyenler için (token gerekli).
 *
 * `gameApi.ts` ve `gauntletService.ts`'te birebir aynı iki, `recommendations.ts`
 * içinde istisna yutan bir, `tasteParser.ts` / `recommendations.ts`
 * `callRerankFilms` içinde satır içi birer kopya vardı; hepsi buraya toplandı.
 *
 * ── Yenileme: neden artık `expires_at` kontrolü ve `refreshSession()` yok ──────
 * auth-js 2.105.1 `getSession()` (GoTrueClient `__loadSession`) süresi
 * `EXPIRY_MARGIN_MS` içinde dolacak oturumu KENDİSİ yeniler.
 * `EXPIRY_MARGIN_MS = AUTO_REFRESH_TICK_THRESHOLD (3) × AUTO_REFRESH_TICK_DURATION_MS (30 s)
 * = 90 s` (`lib/constants.js`). Eski kopyaların eşiği 30 sn idi (< 90 sn): o dal
 * `getSession()` döndükten sonra fiilen ulaşılamazdı.
 *
 * ── İkinci `refreshSession()` denemesi KALDIRILDI (Sprint 10b, CTO kararı) ───
 * Eski kopyalar `getSession()` oturum döndürmezse (`null`) bir de
 * `refreshSession()` çağırıyordu. İki durumda `null` gelir:
 *   1. Cihazda hiç oturum yok → `refreshSession()` ağa gitmeden
 *      `AuthSessionMissingError` verirdi, yani hiçbir şey kazandırmazdı.
 *   2. `getSession()`'ın KENDİ yenilemesi ağ hatasıyla düştü → ikinci deneme
 *      AYNI ağa ikinci bir `/auth/v1/token` isteği atıyor ve bekleme süresi
 *      ikiye katlanıyordu (p95'te bu ekranı donduran şey).
 * Artık tek deneme var. Yenileme başarısızsa çağıran isteği yine gönderir ve
 * sunucu 401 dönerse Gauntlet'in 401 backoff'u (300–4800 ms) sonraki denemede
 * oturumu yeniler; `autoRefreshToken` de arka planda dener.
 *
 * ── Hata görünürlüğü ───────────────────────────────────────────────────────
 * Hiçbir hata yutulmaz. Oturum başına (süreç başına) İLK hata Sentry'ye
 * `flow=auth_session` ile yazılır; sonrakiler breadcrumb olur (aynı kök neden —
 * ör. çevrimdışılık — Sentry'yi doldurmasın). Kullanıcıya metin gösterilmez.
 */
import * as Sentry from '@sentry/react-native';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './supabase';
import { logger } from '@/utils/logger';

/** Süreç başına bir capture; gerisi breadcrumb. */
let reportedThisSession = false;

function reportAuthSessionFailure(step: 'ensure' | 'fresh', err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  logger.warn(`[authSession] ${step}: oturum okunamadı/yenilenemedi:`, message);

  if (reportedThisSession) {
    Sentry.addBreadcrumb({
      category: 'auth_session',
      level: 'warning',
      message: `${step} failed`,
      data: { error: message },
    });
    return;
  }
  reportedThisSession = true;
  Sentry.captureException(err instanceof Error ? err : new Error(message), {
    level: 'warning',
    tags: { flow: 'auth_session', step },
  });
}

/**
 * Oturumun güncel olmasını sağlar (`getSession()` süresi dolmak üzere olanı
 * yeniler). FIRLATMAZ — çağıran isteğini yine gönderir.
 */
export async function ensureAuthSession(): Promise<void> {
  await readSession('ensure');
}

/**
 * Güncel oturumu döner; oturum yoksa ya da yenilenemediyse `null`.
 * Çağıran `session?.access_token ?? anonKey` kararını kendi verir
 * (oturum yoksa mevcut anon-anahtar davranışı AYNEN).
 */
export async function getFreshSession(): Promise<Session | null> {
  return readSession('fresh');
}

async function readSession(step: 'ensure' | 'fresh'): Promise<Session | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      reportAuthSessionFailure(step, error);
    }
    return session;
  } catch (err) {
    reportAuthSessionFailure(step, err);
    return null;
  }
}
