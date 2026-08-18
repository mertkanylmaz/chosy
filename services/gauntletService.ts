/**
 * Gauntlet Service — istemci ↔ backend gauntlet çağrılarının TEK KAYNAĞI.
 *
 * C.2-2: B.2 iskeleti gerçek implementasyona çevrildi.
 * - getTodayGauntlet → generate-gauntlet Edge Function. `progress` alanı
 *   SUNUCUDAN gelir (C.2-0 deriveProgress); istemci progress TÜRETMEZ,
 *   yalnızca gösterir.
 * - submitChoice → submit-choice. Yanıt (`ChoiceResult`) OLDUĞU GİBİ döner;
 *   yorumlama GauntletShell'in işi.
 * - refreshRound → kanonik değil, submitChoice'a delege eden ince sarmalayıcı.
 *
 * Sözleşme `types/gauntlet.ts` içinde KİLİTLİDİR — bu dosyanın imzaları
 * o şekle uyar, şekli değiştirmez.
 */

import * as Sentry from '@sentry/react-native';

import { supabase } from './supabase';
import { logger } from '@/utils/logger';

import type {
  ChoiceSubmission,
  DailyGauntlet,
  GauntletContext,
  GauntletFilm,
  WatchFeedbackResponse,
} from '@/types/gauntlet';

// ─── Yanıt tipleri ───────────────────────────────────────────────────────────

export type NextStep = 'round2' | 'round3' | 'champion' | 'refresh' | 'exhausted';

/**
 * `POST /submit-choice` YANITI.
 *
 * ⚠️ Ayna tip — diğer kopya: `supabase/functions/submit-choice/index.ts:111`
 * (`interface ChoiceResult`). Kilitli sözleşmeye (types/gauntlet.ts) YAZILAMAZ
 * çünkü yanıt şekli B.4'e aittir; derleyici iki kopyayı KONTROL ETMEZ.
 * Biri değişirse ikisi birden değişmeli (TEKNIK_BORC kalemi mevcut).
 */
export interface ChoiceResult {
  next: NextStep;
  /** Yalnız next === 'champion'. */
  champion?: GauntletFilm;
  /** `neither`/`seen` sonrası AYNI tur, yeni çift. */
  replacement?: {
    round: 1 | 2 | 3;
    filmA: GauntletFilm;
    filmB: GauntletFilm;
  };
  /** -1 = sınırsız (Pro). */
  refreshesRemaining: number;
  /** false → yenileme talebi kaydedildi ama UYGULANMADI (hak bitti). */
  refreshAllowed: boolean;
  exhaustedReason?: 'no_candidates' | 'timeout_no_winner';
  suggestSingleFilm?: boolean;
  lowIntentSession?: boolean;
  /** Analytics için: bu seçim hangi gauntlet'e ait. */
  gauntletId: string;
  /** Analytics için: bu seçim hangi algoritma versiyonunda alındı. */
  algorithmVersion: string;
}

/**
 * Bootstrap penceresi: oturum ya da `public.users` satırı henüz hazır değil
 * (generate-gauntlet/submit-choice 401 UNAUTHORIZED döndü). GauntletShell bu
 * hatayı `bootstrapping` durumuna çevirir; ilk denemelerde Sentry'ye
 * YAZILMAZ — kimlik `app/_layout.tsx` auth listener'ındaki `ensureAppUser()`
 * bootstrap'ından gelir, bu ekran kimlik OLUŞTURMAZ (getAppUserId yasak).
 */
export class GauntletAuthPendingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GauntletAuthPendingError';
  }
}

/**
 * Nötr varsayılan bağlam — PRODUCT_OS §4.3: "tahmin güveni <%70 → tahmin
 * etme, nötr varsayılan" ve "ilk oturumda asla tahmin etme". Bağlam seçici
 * C.3'te bağlanınca çağıran taraf gerçek bağlamı geçer (CTO onayı 14.08.2026).
 */
export const NEUTRAL_CONTEXT: GauntletContext = {
  companion: 'alone',
  duration: 'any',
  energy: 'normal',
};

// ─── Auth helper ─────────────────────────────────────────────────────────────

/**
 * Auth session'ı doğrular ve gerekirse refresh eder (gameApi.ts deseninin
 * kopyası — gameApi "oyun API'lerinin tek kaynağı"dır, gauntlet oraya
 * eklenmez ve o dosyaya dokunulmaz).
 */
async function ensureAuthSession(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const nowSec = Math.floor(Date.now() / 1000);
  const isExpiredOrSoon = !session ||
    (session.expires_at != null && session.expires_at < nowSec + 30);

  if (isExpiredOrSoon) {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      logger.warn('[gauntletService] Session refresh failed:', error.message);
    }
  }
}

// ─── Hata ayrıştırma ─────────────────────────────────────────────────────────

/**
 * FunctionsHttpError yalnızca "non-2xx status code" der; asıl sebep yanıt
 * gövdesinde (gameApi.ts resetGameProgress deseni). Status + gövde detayı
 * çıkarılır ki 401 (bootstrap penceresi) diğer hatalardan ayrılabilsin.
 */
/**
 * ⏱ GEÇİCİ — C.2-2 cihaz retest'i için round-trip ölçümü (14 Ağu 2026).
 * Ölçüm sonrası __DEV__ console.log kaldırılacak; Sentry breadcrumb kalıcı
 * debug aracı olarak kalabilir (kalıcı koda konsol logu GİRMEZ kısıtı).
 */
function recordTiming(fn: string, startedAt: number, outcome: 'ok' | 'error'): void {
  const durationMs = Math.round(performance.now() - startedAt);
  Sentry.addBreadcrumb({
    category: 'gauntlet.perf',
    message: `${fn} ${outcome}`,
    level: 'info',
    data: { duration_ms: durationMs },
  });
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[gauntlet.perf] ${fn} ${outcome} — ${durationMs}ms`);
  }
}

async function parseInvokeError(
  error: unknown,
): Promise<{ status: number | null; detail: string }> {
  const response = (error as { context?: Response }).context;
  if (!response || typeof response.text !== 'function') {
    return { status: null, detail: error instanceof Error ? error.message : String(error) };
  }

  const body = await response.text().catch(() => '');
  let detail = body;
  try {
    const parsed = JSON.parse(body) as { error?: string; message?: string };
    detail = parsed.message ?? parsed.error ?? body;
  } catch {
    // Gövde JSON değil — ham metin detay olarak kalır, hata yutulmuyor.
  }
  return { status: response.status, detail: `[${response.status}] ${detail}` };
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Günün gauntlet'ını getirir. Yoksa sunucu üretir.
 * Client "neden bu 4 film" bilgisini ASLA almaz.
 *
 * Dönüş `progress?` taşır (C.2-0, CTO onayı 14.08.2026): sunucu "nerede
 * kaldın"ı `choice_events` + güncel `film_ids`'ten türetir. İstemci
 * `progress` doluysa oradan devam eder; `undefined` ise Tur 1'den başlar.
 * İstemci turu ASLA kendisi saymaz.
 *
 * 401 → `GauntletAuthPendingError` (bootstrap penceresi, çağıran karar verir);
 * diğer hatalar → Sentry + throw. Sessiz fallback YOK.
 */
export async function getTodayGauntlet(
  context: GauntletContext = NEUTRAL_CONTEXT,
): Promise<DailyGauntlet> {
  await ensureAuthSession();

  const startedAt = performance.now();
  const { data, error } = await supabase.functions.invoke('generate-gauntlet', {
    body: { context },
  });

  if (error) {
    recordTiming('generate-gauntlet', startedAt, 'error');
    const { status, detail } = await parseInvokeError(error);
    if (status === 401) {
      // Sentry kararı çağıranda: ilk denemeler beklenen pencere, 5. deneme
      // gerçek kimlik arızası (GauntletShell retry politikası).
      throw new GauntletAuthPendingError(detail);
    }
    Sentry.captureException(error, {
      tags: { fn: 'generate-gauntlet' },
      extra: { detail },
    });
    logger.error('[gauntletService] getTodayGauntlet failed:', detail);
    throw new Error(detail || 'generate-gauntlet failed');
  }

  recordTiming('generate-gauntlet', startedAt, 'ok');
  return data as DailyGauntlet;
}

/**
 * Bir turun seçimini kaydeder ve `ChoiceResult`'ı OLDUĞU GİBİ döner —
 * istemci tarafında ek mantık YOK.
 *
 * `latencyMs` sunucu tarafında doğrulanır (B.4): tam sayı değilse veya
 * 0..600000 dışındaysa 422 ile reddedilir. Clamp EDİLMEZ — sessizce veri
 * değiştirmek yasak.
 */
export async function submitChoice(
  submission: ChoiceSubmission,
): Promise<ChoiceResult> {
  await ensureAuthSession();

  const startedAt = performance.now();
  const { data, error } = await supabase.functions.invoke('submit-choice', {
    body: submission,
  });

  if (error) {
    recordTiming(`submit-choice(${submission.outcome})`, startedAt, 'error');
    const { status, detail } = await parseInvokeError(error);
    if (status === 401) {
      throw new GauntletAuthPendingError(detail);
    }
    Sentry.captureException(error, {
      tags: {
        fn: 'submit-choice',
        outcome: submission.outcome,
        round: String(submission.round),
      },
      extra: { detail, gauntlet_id: submission.gauntletId },
    });
    logger.error('[gauntletService] submitChoice failed:', detail);
    throw new Error(detail || 'submit-choice failed');
  }

  recordTiming(`submit-choice(${submission.outcome})`, startedAt, 'ok');
  return data as ChoiceResult;
}

/**
 * `POST /submit-watch-feedback` YANITI — `supabase/functions/submit-watch-feedback/
 * index.ts:WatchFeedbackResult` ile ayna tip (aynı gerekçe: ChoiceResult).
 */
export interface WatchFeedbackResult {
  status: 'answered' | 'already_answered';
  response: WatchFeedbackResponse;
}

/**
 * "Dün izledin mi?" cevabını kaydeder (C.4).
 *
 * ⚠️ Diğer servis fonksiyonlarından FARKLI olarak burada Sentry.captureException
 * ÇAĞRILMAZ — bu fonksiyon GauntletShell'de fire-and-forget (bloklamayan)
 * bir akıştan çağrılır ve çağıran taraf kendi Sentry raporunu kendi
 * sınıflandırma etiketiyle (`silent_retry`) atar. Burada da rapor edilirse
 * AYNI hata iki kez Sentry'ye düşer — gürültü azaltma amacını boşa çıkarır.
 * Hata burada yalnızca ayrıştırılıp fırlatılır, sessizce YUTULMAZ.
 */
export async function submitWatchFeedback(
  gauntletId: string,
  filmId: string,
  response: WatchFeedbackResponse,
): Promise<WatchFeedbackResult> {
  await ensureAuthSession();

  const startedAt = performance.now();
  const { data, error } = await supabase.functions.invoke('submit-watch-feedback', {
    body: { gauntletId, filmId, response },
  });

  if (error) {
    recordTiming(`submit-watch-feedback(${response})`, startedAt, 'error');
    const { status, detail } = await parseInvokeError(error);
    if (status === 401) {
      throw new GauntletAuthPendingError(detail);
    }
    logger.error('[gauntletService] submitWatchFeedback failed:', detail);
    throw new Error(detail || 'submit-watch-feedback failed');
  }

  recordTiming(`submit-watch-feedback(${response})`, startedAt, 'ok');
  return data as WatchFeedbackResult;
}

/**
 * `POST /submit-context-correction` YANITI — `supabase/functions/
 * submit-context-correction/index.ts:ContextCorrectionResult` ile ayna tip
 * (aynı gerekçe: ChoiceResult).
 */
export interface ContextCorrectionResult {
  status: 'saved';
}

/**
 * ContextBar düzeltmesini kaydeder (C.3, CTO kararı 16.08.2026).
 *
 * Bugünün dörtlüsüne DOKUNMAZ — yalnız `context_corrections`'a ham gözlem
 * yazar, Faz F'in tahmin motorunu besler. YARINKİ gauntlet'ı etkiler.
 */
export async function submitContextCorrection(
  gauntletId: string,
  corrected: GauntletContext,
): Promise<ContextCorrectionResult> {
  await ensureAuthSession();

  const startedAt = performance.now();
  const { data, error } = await supabase.functions.invoke('submit-context-correction', {
    body: { gauntletId, corrected },
  });

  if (error) {
    recordTiming('submit-context-correction', startedAt, 'error');
    const { status, detail } = await parseInvokeError(error);
    if (status === 401) {
      throw new GauntletAuthPendingError(detail);
    }
    Sentry.captureException(error, {
      tags: { fn: 'submit-context-correction' },
      extra: { detail, gauntlet_id: gauntletId },
    });
    logger.error('[gauntletService] submitContextCorrection failed:', detail);
    throw new Error(detail || 'submit-context-correction failed');
  }

  recordTiming('submit-context-correction', startedAt, 'ok');
  return data as ContextCorrectionResult;
}

/**
 * Turu yeniler (yeni çift getirir). KANONİK DEĞİL — tek gerçek yol
 * `submitChoice(outcome: 'neither')`; bu sarmalayıcı geriye dönük uyum için
 * durur ve ona delege eder. Kalan hak yanıttaki `refreshesRemaining`'de;
 * limit kararı SUNUCUDA (`gauntlet_refresh_limit_free/pro`).
 */
export async function refreshRound(
  gauntletId: string,
  round: 1 | 2 | 3,
  filmA: string,
  filmB: string,
  latencyMs: number,
): Promise<ChoiceResult> {
  return submitChoice({
    gauntletId,
    round,
    filmA,
    filmB,
    winner: null,
    outcome: 'neither',
    positionOfWinner: null,
    latencyMs,
  });
}
