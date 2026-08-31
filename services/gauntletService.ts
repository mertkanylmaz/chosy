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
import { cacheGauntlet, readCachedGauntlet, type GauntletSource } from './gauntletCache';
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
 * Sunucuya HİÇ ULAŞILAMADI — bağlantı yok, DNS düştü, istek zaman aşımına
 * uğradı (K-42). Sunucudan gelen 4xx/5xx bu sınıfa GİRMEZ: oraya ulaşıldı,
 * yanıtı yerel bir kopyayla gizlemek gerçek arızayı saklamak olur.
 *
 * Ayrım ölçütü keşifte doğrulandı: `parseInvokeError` ağ hatasında
 * `status: null` döner, çünkü `FunctionsFetchError`'da `context` (Response)
 * yoktur. Cache geri düşüşü ve seçim kuyruğu YALNIZ bu sınıfa bakar.
 */
export class GauntletFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GauntletFetchError';
  }
}

/**
 * Sunucu YANITLADI ama hata döndü. `status` taşınır çünkü kuyruk kalıcı ile
 * geçici hatayı ayırmak zorundadır: 4xx'i tekrar denemek `tasteSignalService`
 * 30 Tem 2026 kuyruk zehirlenmesinin birebir tekrarı olurdu — tek geçersiz
 * satır kuyruğu kalıcı kilitlemişti.
 */
export class GauntletHttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GauntletHttpError';
    this.status = status;
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

// ─── Saat dilimi ─────────────────────────────────────────────────────────────

/**
 * Cihazın IANA saat dilimi adı (örn. "Europe/Istanbul").
 *
 * M2 Faz 2a write-through: `generate-gauntlet` bu değeri `users.timezone`'a
 * yazar. Ritüel her gün bu çağrıdan geçtiği için kolon, push izninden BAĞIMSIZ
 * olarak dolar — Faz 1 ölçümünde 237 kullanıcının 229'u kolon DEFAULT'unda
 * ('UTC') kalmıştı, çünkü tek yazıcı push token yoluydu.
 *
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` deseni bu kod tabanında
 * yeni değil — `services/pushNotifications.ts` aynı çağrıyı kullanıyor, yani
 * Hermes tarafında çalıştığı sahada kanıtlı.
 *
 * Sunucu geçersiz değeri reddedip yok sayar (isteği düşürmez); burada da
 * `undefined` dönmek güvenlidir — alan gövdeden düşer ve sunucu kolonu
 * DEĞİŞTİRMEDEN bırakır.
 */
function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch (err) {
    // Sessiz yutma değil: Intl'in bulunmadığı bir runtime gerçek bir kurulum
    // arızasıdır ve görünmelidir. Ritüel yine de çalışır — timezone opsiyonel.
    logger.warn('[gauntletService] cihaz saat dilimi okunamadı:', err);
    return undefined;
  }
}

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
    body: { context, timezone: deviceTimeZone() },
  });

  if (error) {
    recordTiming('generate-gauntlet', startedAt, 'error');
    const { status, detail } = await parseInvokeError(error);
    if (status === 401) {
      // Sentry kararı çağıranda: ilk denemeler beklenen pencere, 5. deneme
      // gerçek kimlik arızası (GauntletShell retry politikası).
      throw new GauntletAuthPendingError(detail);
    }
    if (status === null) {
      // Sunucuya HİÇ ULAŞILAMADI (K-42): `error.context` yok. Bu beklenen bir
      // saha durumu — `error` seviyesi gürültü yaratırdı, ama sessiz de
      // geçilmez: uyarı seviyesinde görünür kalır.
      Sentry.captureException(error, {
        level: 'warning',
        tags: { fn: 'generate-gauntlet', error_code: 'GAUNTLET_OFFLINE' },
        extra: { detail },
      });
      logger.warn('[gauntletService] getTodayGauntlet bağlantı hatası:', detail);
      throw new GauntletFetchError(detail || 'generate-gauntlet unreachable');
    }
    Sentry.captureException(error, {
      tags: { fn: 'generate-gauntlet' },
      extra: { detail },
    });
    logger.error('[gauntletService] getTodayGauntlet failed:', detail, { skipBridge: true });
    throw new Error(detail || 'generate-gauntlet failed');
  }

  recordTiming('generate-gauntlet', startedAt, 'ok');
  const gauntlet = data as DailyGauntlet;

  // K-42: başarılı yanıt diske yazılır. `await` EDİLMEZ — cache yazımı
  // kullanıcının ekranını bekletmez; hata durumu modülün kendi içinde
  // loglanır (sessiz değil).
  void cacheOwnerId().then((ownerId) => {
    if (ownerId) return cacheGauntlet(ownerId, gauntlet);
  });

  return gauntlet;
}

/**
 * Cache anahtarının sahibi. `auth.users.id` KULLANILIR, `public.users.id`
 * değil — ikisi bu kod tabanında ayrık uzaylardır ve burada önemli olan
 * tek şey ANAHTARIN TUTARLI olması.
 *
 * Gerekçe ölçülmüş: `readAppUserId()` `users` tablosuna sorgu atar, yani AĞ
 * ister. Tam da cache'e ihtiyaç duyulan anda (offline) `null` dönerdi.
 * `getSession()` ise yerel oturumdan okur ve bağlantı olmadan da çalışır.
 */
async function cacheOwnerId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch (err) {
    logger.warn('[gauntletService] Cache sahibi kimliği okunamadı:', err);
    return null;
  }
}

/**
 * `getTodayGauntlet`'in offline toleranslı sarmalayıcısı (K-42 Parça 2).
 *
 * Ağ yolu başarılıysa davranış BİREBİR aynıdır — yalnız `source: 'network'`
 * etiketi eklenir. Başarısızsa iki katmanlı yerel geri düşüş devreye girer:
 *
 *   1. Bugünün tarihiyle cache → `cache_today`
 *   2. En son yazılmış herhangi bir gün → `cache_stale`
 *   3. Hiçbiri yok → hata YENİDEN FIRLATILIR, çağıran mevcut hata ekranına düşer
 *
 * ── Hangi hata cache'e düşürür ─────────────────────────────────────────────
 * Yalnız BAĞLANTI hataları. `GauntletAuthPendingError` (401) olduğu gibi
 * yukarı geçer — o bootstrap penceresidir, retry politikası çağıranda.
 * Sunucu 4xx/5xx'i de geçer: sunucuya ULAŞILDI, yanıtı yerel bir kopyayla
 * gizlemek gerçek arızayı saklamak olurdu.
 *
 * Bağlantı hatası ölçütü, K-42 keşfinde doğrulanan yol: `parseInvokeError`
 * ağ hatasında `status: null` döner (`error.context` yoktur). `GauntletFetchError`
 * bu ayrımı hata nesnesinde taşır.
 */
export async function getTodayGauntletWithFallback(
  context: GauntletContext = NEUTRAL_CONTEXT,
): Promise<{ gauntlet: DailyGauntlet; source: GauntletSource; cachedDate?: string }> {
  try {
    const gauntlet = await getTodayGauntlet(context);
    return { gauntlet, source: 'network' };
  } catch (err) {
    if (err instanceof GauntletAuthPendingError) throw err;
    if (!(err instanceof GauntletFetchError)) throw err;

    const ownerId = await cacheOwnerId();
    const cached = await readCachedGauntlet(ownerId);

    if (!cached) {
      // Yerel kopya da yok — mevcut hata yolu DEĞİŞMEDEN sürer.
      throw err;
    }

    logger.warn('[gauntletService] Bağlantı yok, yerel kopya kullanıldı:', cached.source);
    return {
      gauntlet: cached.gauntlet,
      source: cached.source,
      cachedDate: cached.date,
    };
  }
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
    if (status === null) {
      // K-42: sunucuya ulaşılamadı. Seçim kuyruğa alınabilir — çağıran karar
      // verir. Uyarı seviyesi: beklenen saha durumu, ama sessiz değil.
      Sentry.captureException(error, {
        level: 'warning',
        tags: {
          fn: 'submit-choice',
          outcome: submission.outcome,
          error_code: 'GAUNTLET_OFFLINE',
        },
        extra: { detail, gauntlet_id: submission.gauntletId },
      });
      logger.warn('[gauntletService] submitChoice bağlantı hatası:', detail);
      throw new GauntletFetchError(detail || 'submit-choice unreachable');
    }
    Sentry.captureException(error, {
      tags: {
        fn: 'submit-choice',
        outcome: submission.outcome,
        round: String(submission.round),
      },
      extra: { detail, gauntlet_id: submission.gauntletId },
    });
    logger.error('[gauntletService] submitChoice failed:', detail, { skipBridge: true });
    throw new GauntletHttpError(detail || 'submit-choice failed', status);
  }

  recordTiming(`submit-choice(${submission.outcome})`, startedAt, 'ok');
  return data as ChoiceResult;
}

/**
 * `POST /submit-choice` (action: 'save_for_later') YANITI — `supabase/functions/
 * submit-choice/index.ts:SaveForLaterResult` ile ayna tip (aynı gerekçe:
 * ChoiceResult).
 */
export interface SaveForLaterResult {
  status: 'saved' | 'already_saved';
  filmId: string;
}

/**
 * Şampiyonu watchlist'e kaydeder — "Sonraya bırak" (C.9b-2).
 *
 * ── Neden `services/watchlist.ts` KULLANILMIYOR ─────────────────────────────
 * O modülün `addToWatchlist(film: Film)` imzası hem tip olarak uymaz
 * (`GauntletFilm` ≠ `Film`) hem de `getAppUserId()` üzerinden kimlik ÇÖZER.
 * Gauntlet ekranları kimlik çözmez ve INSERT yapmaz (GauntletShell:12-14);
 * yazma sunucuda, oturumun JWT'si üzerinden olur. Bu fonksiyon yalnızca
 * çağırır — istemci tarafında hiçbir kimlik işlemi yoktur.
 *
 * Yazılan satır İZLENDİ DEĞİLDİR: `watched_at` NULL kalır, film "kaydedildi"
 * olarak listeye girer.
 */
export async function saveChampionForLater(
  gauntletId: string,
  filmId: string,
): Promise<SaveForLaterResult> {
  await ensureAuthSession();

  const startedAt = performance.now();
  const { data, error } = await supabase.functions.invoke('submit-choice', {
    body: { action: 'save_for_later', gauntletId, filmId },
  });

  if (error) {
    recordTiming('submit-choice(save_for_later)', startedAt, 'error');
    const { status, detail } = await parseInvokeError(error);
    if (status === 401) {
      throw new GauntletAuthPendingError(detail);
    }
    Sentry.captureException(error, {
      tags: { fn: 'submit-choice', action: 'save_for_later' },
      extra: { detail, gauntlet_id: gauntletId, film_id: filmId },
    });
    logger.error('[gauntletService] saveChampionForLater failed:', detail, { skipBridge: true });
    throw new Error(detail || 'save_for_later failed');
  }

  recordTiming('submit-choice(save_for_later)', startedAt, 'ok');
  return data as SaveForLaterResult;
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
    logger.error('[gauntletService] submitContextCorrection failed:', detail, { skipBridge: true });
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

// ─── Arşiv (K-46) ────────────────────────────────────────────────────────────

/** Bir arşiv gününün durumu. Sunucu türetir, istemci yalnızca okur. */
export interface ArchiveDay {
  /** YYYY-MM-DD (UTC gün anahtarı). */
  date: string;
  status: 'completed' | 'missed' | 'too_old';
  /** Yalnız `missed` günlerde ve o günün global seçkisi bulunabildiyse dolu. */
  globalFilms?: GauntletFilm[];
  /** Global seçki bulunamadı — `globalFilms` ile birlikte GELMEZ. */
  unavailable?: boolean;
}

export interface ArchiveStatus {
  missedCount: number;
  completedCount: number;
  archiveEligible: boolean;
  anchorDate: string | null;
  days: ArchiveDay[];
}

/**
 * Kaçırılan gün envanteri (K-46). Sunucu tarafında `get-archive-status`
 * türetir — istemci tarih aritmetiği YAPMAZ, `missedCount`'u kendisi saymaz.
 *
 * Offline/ulaşılamaz durumda `GauntletFetchError` fırlatır; çağıran ekranı
 * boş göstermek yerine hata dalını gösterir (K-43). Sessiz fallback yok.
 */
export async function getArchiveStatus(): Promise<ArchiveStatus> {
  await ensureAuthSession();

  const startedAt = performance.now();
  const { data, error } = await supabase.functions.invoke('get-archive-status', {
    body: {},
  });

  if (error) {
    recordTiming('get-archive-status', startedAt, 'error');
    const { status, detail } = await parseInvokeError(error);
    if (status === 401) {
      throw new GauntletAuthPendingError(detail);
    }
    if (status === null) {
      // Sunucuya hiç ulaşılamadı — beklenen saha durumu, uyarı seviyesi.
      Sentry.captureException(error, {
        level: 'warning',
        tags: { fn: 'get-archive-status', error_code: 'ARCHIVE_OFFLINE' },
        extra: { detail },
      });
      logger.warn('[gauntletService] getArchiveStatus bağlantı hatası:', detail);
      throw new GauntletFetchError(detail || 'get-archive-status unreachable');
    }
    Sentry.captureException(error, {
      tags: { fn: 'get-archive-status' },
      extra: { detail },
    });
    logger.error('[gauntletService] getArchiveStatus failed:', detail, { skipBridge: true });
    throw new Error(detail || 'get-archive-status failed');
  }

  recordTiming('get-archive-status', startedAt, 'ok');
  return data as ArchiveStatus;
}
