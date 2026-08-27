/**
 * Gauntlet offline seçim kuyruğu — TEK bekleyen seçim (K-42 Parça 3).
 *
 * ── Neden var ──────────────────────────────────────────────────────────────
 * K-42 keşfinde ölçüldü: offline'da yapılan seçim TAMAMEN KAYBOLUYOR.
 * `GauntletShell.handleChoice` → `submit(...)` → hata → `return null`; gönderilen
 * `ChoiceSubmission` nesnesi hiçbir yere yazılmadan çöp oluyor. Kullanıcı
 * turu tekrar oynamak zorunda, sunucuda hiçbir iz yok.
 *
 * ── Neden TEK işlem (dizi değil) ───────────────────────────────────────────
 * Seçenek B'nin tasarımı "kuyrukla + dondur": bekleyen bir seçim varken UI
 * donar, kullanıcı ikinci bir seçim YAPAMAZ. Dizi tutmak var olmayan bir
 * durumu modellemek olurdu. Sıra da anlamsız: turlar sunucu tarafından
 * zincirlenir, 2. tur 1. turun yanıtı gelmeden ÜRETİLEMEZ.
 *
 * ── tasteSignalService dersi (30 Tem 2026) ─────────────────────────────────
 * O kuyruk tek geçersiz satır yüzünden kalıcı kilitlenmişti: her açılışta
 * aynı hata, hiçbir sinyal yazılamıyor. Buradaki karşılığı iki koruma:
 *   1. Kalıcı hata (4xx) → kayıt ATILIR, Sentry'ye görünür yazılır
 *   2. Yaş sınırı → dünkü seçim bugünkü gauntlet'e yazılamaz, atılır
 * Geçici hata (bağlantı yok, 5xx) → kayıt KALIR, bir sonraki tetikleyiciyi
 * bekler. Sessiz kayıp yok: her atılan kayıt iz bırakır.
 *
 * Bu modül `tasteSignalService.ts`'ten ESİNLENİR ama ona DOKUNMAZ — ayrı
 * anahtar, ayrı yaşam döngüsü, ayrı veri.
 */

import * as Sentry from '@sentry/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  GauntletAuthPendingError,
  GauntletFetchError,
  GauntletHttpError,
  submitChoice,
  type ChoiceResult,
} from './gauntletService';
import { logger } from '@/utils/logger';

import type { ChoiceSubmission } from '@/types/gauntlet';

// ─── Sabitler ────────────────────────────────────────────────────────────────

const PENDING_CHOICE_KEY = 'chosy_gauntlet_pending_choice';

/**
 * Bekleyen seçimin azami yaşı. Gauntlet günlük bir ritüel: dünkü seçimin
 * `gauntletId`'si bugün geçersizdir, sunucu 404 döner. Kaydı o noktaya kadar
 * taşımak yerine burada düşürülür — 404 sayısı ölçümü kirletmesin.
 */
const MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 saat

// ─── Tipler ──────────────────────────────────────────────────────────────────

/** Diskteki kayıt. `submission` sözleşme tipidir, DEĞİŞTİRİLMEZ. */
interface PendingChoice {
  submission: ChoiceSubmission;
  /** Kuyruğa alınma anı (ISO 8601). */
  queuedAt: string;
}

/**
 * Flush sonucu — çağıran UI kararını buna göre verir.
 *   `sent`          → sunucuya yazıldı, `result` dolu, kuyruk temiz
 *   `still_offline` → bağlantı hâlâ yok, kayıt duruyor, UI donuk kalır
 *   `dropped`       → kalıcı hata veya yaş aşımı, kayıt atıldı, UI çözülür
 *   `empty`         → bekleyen seçim yoktu
 */
export type FlushOutcome =
  | { status: 'sent'; result: ChoiceResult; submission: ChoiceSubmission }
  | { status: 'still_offline' }
  | { status: 'dropped'; reason: 'expired' | 'rejected'; detail: string }
  | { status: 'empty' };

// ─── Kuyruk işlemleri ────────────────────────────────────────────────────────

/**
 * Bekleyen seçimi yazar. Var olan kaydın ÜZERİNE yazar — "dondur" tasarımında
 * ikinci bir bekleyen seçim oluşamaz, oluştuysa yenisi doğru olandır.
 */
export async function enqueuePendingChoice(submission: ChoiceSubmission): Promise<void> {
  try {
    const entry: PendingChoice = {
      submission,
      queuedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(PENDING_CHOICE_KEY, JSON.stringify(entry));
    logger.log('[gauntletQueue] Seçim kuyruğa alındı, tur:', submission.round);
  } catch (err) {
    // Yazamadıysak seçim GERÇEKTEN kaybolur — bu sessiz geçilemez.
    logger.error(
      '[gauntletQueue] Bekleyen seçim yazılamadı:', err,
      {
        code: 'GAUNTLET_QUEUE_WRITE_FAILED',
        sampleRate: 1,
      },
    );
    Sentry.captureException(err, {
      tags: { flow: 'gauntlet_offline_queue', error_code: 'GAUNTLET_QUEUE_WRITE_FAILED' },
      extra: { round: submission.round, gauntlet_id: submission.gauntletId },
    });
  }
}

/** Bekleyen seçimi okur. Kayıt yoksa veya bozuksa `null`. */
export async function getPendingChoice(): Promise<ChoiceSubmission | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_CHOICE_KEY);
    if (!raw) return null;

    const entry = JSON.parse(raw) as PendingChoice;
    if (!entry.submission || !entry.queuedAt) return null;

    return entry.submission;
  } catch (err) {
    logger.error(
      '[gauntletQueue] Bekleyen seçim okunamadı:', err,
      {
        code: 'GAUNTLET_QUEUE_READ_FAILED',
        sampleRate: 0.2,
      },
    );
    return null;
  }
}

/** Bekleyen seçimi siler. */
export async function clearPendingChoice(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_CHOICE_KEY);
  } catch (err) {
    logger.error(
      '[gauntletQueue] Bekleyen seçim silinemedi:', err,
      {
        code: 'GAUNTLET_QUEUE_CLEAR_FAILED',
        sampleRate: 0.2,
      },
    );
  }
}

/** Kaydı yaş sınırına göre değerlendirir. Bozuk zaman damgası = süresi dolmuş. */
function isExpired(queuedAt: string): boolean {
  const t = Date.parse(queuedAt);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > MAX_AGE_MS;
}

/**
 * Bekleyen seçimi göndermeyi dener.
 *
 * Tetikleyicileri (Parça 4): app açılışı, "bağlantı geri geldi" olayı,
 * kullanıcının "Tekrar dene" eylemi. Bu modül tetiklemez — yalnız uygular.
 *
 * Aynı anda iki kez çalışmaya karşı korumalıdır: `inFlight` guard'ı, açılış
 * ile reconnect olayının çakışıp aynı seçimi iki kez göndermesini engeller.
 * (Sunucu tarafı zaten idempotent — 072 partial UNIQUE + migration 108 RPC
 * 'duplicate' döner — ama iki isteği hiç açmamak daha ucuz.)
 */
let inFlight: Promise<FlushOutcome> | null = null;

export function flushPendingChoice(): Promise<FlushOutcome> {
  if (inFlight) return inFlight;
  inFlight = runFlush().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runFlush(): Promise<FlushOutcome> {
  let entry: PendingChoice;

  try {
    const raw = await AsyncStorage.getItem(PENDING_CHOICE_KEY);
    if (!raw) return { status: 'empty' };
    entry = JSON.parse(raw) as PendingChoice;
    if (!entry.submission || !entry.queuedAt) {
      await clearPendingChoice();
      return { status: 'dropped', reason: 'rejected', detail: 'kayıt bozuk' };
    }
  } catch (err) {
    logger.error(
      '[gauntletQueue] Flush okuma hatası:', err,
      {
        code: 'GAUNTLET_QUEUE_READ_FAILED',
        sampleRate: 0.2,
      },
    );
    return { status: 'empty' };
  }

  if (isExpired(entry.queuedAt)) {
    await clearPendingChoice();
    logger.warn('[gauntletQueue] Bekleyen seçim süresi doldu, atıldı');
    Sentry.captureMessage('gauntlet: bekleyen seçim süresi doldu', {
      level: 'warning',
      tags: { flow: 'gauntlet_offline_queue', error_code: 'GAUNTLET_QUEUE_EXPIRED' },
      extra: {
        queued_at: entry.queuedAt,
        gauntlet_id: entry.submission.gauntletId,
        round: entry.submission.round,
      },
    });
    return { status: 'dropped', reason: 'expired', detail: entry.queuedAt };
  }

  try {
    const result = await submitChoice(entry.submission);
    await clearPendingChoice();
    logger.log('[gauntletQueue] Bekleyen seçim gönderildi, tur:', entry.submission.round);
    return { status: 'sent', result, submission: entry.submission };
  } catch (err) {
    // ── Geçici: kayıt KALIR ──────────────────────────────────────────────
    if (err instanceof GauntletFetchError) {
      // Hâlâ offline. Sessizce bekler — bir sonraki tetikleyici dener.
      return { status: 'still_offline' };
    }
    if (err instanceof GauntletAuthPendingError) {
      // Oturum henüz hazır değil (bootstrap penceresi). Token yenilenince
      // tekrar denenir; kayıt korunur.
      logger.warn('[gauntletQueue] Oturum hazır değil, bekleyen seçim korundu');
      return { status: 'still_offline' };
    }
    if (err instanceof GauntletHttpError && err.status >= 500) {
      // Sunucu arızası — geçici sayılır, kayıt korunur.
      logger.warn('[gauntletQueue] Sunucu hatası, bekleyen seçim korundu:', err.status);
      return { status: 'still_offline' };
    }

    // ── Kalıcı: kayıt ATILIR ─────────────────────────────────────────────
    // 4xx (404 gauntlet yok, 422 kural ihlali, 400 geçersiz gövde). Tekrar
    // denemek kuyruğu kilitler — tasteSignalService'in yaşadığı hata.
    const detail = err instanceof Error ? err.message : String(err);
    await clearPendingChoice();
    logger.error(
      '[gauntletQueue] Bekleyen seçim kalıcı olarak reddedildi, atıldı:', detail,
      {
        code: 'GAUNTLET_QUEUE_REJECTED',
        sampleRate: 1,
      },
    );
    Sentry.captureException(err, {
      tags: { flow: 'gauntlet_offline_queue', error_code: 'GAUNTLET_QUEUE_REJECTED' },
      extra: {
        gauntlet_id: entry.submission.gauntletId,
        round: entry.submission.round,
        outcome: entry.submission.outcome,
        queued_at: entry.queuedAt,
      },
    });
    return { status: 'dropped', reason: 'rejected', detail };
  }
}
