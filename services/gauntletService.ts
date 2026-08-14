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

  const { data, error } = await supabase.functions.invoke('generate-gauntlet', {
    body: { context },
  });

  if (error) {
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

  const { data, error } = await supabase.functions.invoke('submit-choice', {
    body: submission,
  });

  if (error) {
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

  return data as ChoiceResult;
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
