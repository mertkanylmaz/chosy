/**
 * 🔒 KİLİTLİ SÖZLEŞME
 * Bu arayüzü değiştirmek CTO onayı gerektirir.
 * Arkadaki algoritma serbestçe değişebilir; bu şekil değişemez.
 * Değiştirmek zorundaysan DUR ve sor.
 */

export interface GauntletContext {
  companion: 'alone' | 'partner' | 'friends' | 'family';
  duration: 'short' | 'medium' | 'any';
  energy: 'drained' | 'normal' | 'open';
}

export interface OklchColor {
  l: number;
  c: number;
  h: number;
}

export interface GauntletFilm {
  id: string;
  title: string;
  year: number;
  runtime: number;
  posterUrl: string;
  dominantColor?: OklchColor; // opsiyonel — ışık sızması
}

/**
 * "Bu gauntlet'ta nerede kaldın" — resume yolu (CTO onayı 14.08.2026).
 * Yalnızca DURUM bilgisi taşır; skor, aday havuzu ya da eleme gerekçesi
 * ASLA taşımaz.
 *
 * Invariant:
 *   status === 'in_progress' → defender ve challenger dolu, champion null
 *   status === 'champion'    → defender/challenger null, champion dolu,
 *                              completedRounds === 3
 *   status === 'exhausted'   → defender/challenger/champion hepsi null
 *                              olabilir, exhaustedReason dolu
 *   progress undefined       → istemci Tur 1'den başlar (eski istemci yolu)
 */
export interface GauntletProgress {
  /** Tamamlanmış tur sayısı. 3 = gauntlet bitti. */
  completedRounds: 0 | 1 | 2 | 3;
  status: 'in_progress' | 'champion' | 'exhausted';
  /** "Şu anki seçimin". */
  defender: GauntletFilm | null;
  /** Karşısına çıkan film. */
  challenger: GauntletFilm | null;
  /** Yalnızca status === 'champion' ise dolu. */
  champion: GauntletFilm | null;
  /** Yalnızca status === 'exhausted' ise dolu. */
  exhaustedReason?: 'no_candidates' | 'timeout_no_winner';
}

export interface DailyGauntlet {
  gauntletId: string;
  date: string;
  context: GauntletContext;
  contextPredicted: boolean;
  films: GauntletFilm[]; // tam 4, sırası karışık
  slotTypes: ('global' | 'personal' | 'discovery')[];
  userConfidence: number; // 0-1
  refreshesRemaining: number;
  algorithmVersion: string;
  progress?: GauntletProgress; // opsiyonel — geriye dönük uyumlu
  pendingWatchFeedback?: PendingWatchFeedback; // opsiyonel — C.4 "dün izledin mi?"
}

/**
 * "Dün izledin mi?" sorusu — dünün gauntlet'i champion'a ulaştı ve henüz
 * watch_feedback satırı yok. Yalnızca SORULACAK filmi taşır; bu ekranın
 * kendi gauntlet'iyle karışmaz (ayrı gauntletId).
 */
export interface PendingWatchFeedback {
  gauntletId: string;
  film: GauntletFilm;
}

/**
 * Migration 069'daki `choice_events.outcome` CHECK kısıtıyla birebir aynı küme.
 * Sapma olursa doğrulama katmanı DB'nin kabul etmediği bir değeri geçirir.
 */
export type ChoiceOutcome = 'choice' | 'neither' | 'seen' | 'timeout';

export interface ChoiceSubmission {
  gauntletId: string;
  round: 1 | 2 | 3;
  filmA: string;
  filmB: string;
  winner: string | null;
  outcome: ChoiceOutcome;
  positionOfWinner: 'left' | 'right' | null;
  latencyMs: number;
}

// ─── Çalışma zamanı doğrulaması ──────────────────────────────────────────────
// Dış paket YOK — yalnız typeof/literal kontrolü. Böylece aynı dosya hem RN
// hem Deno tarafında çalışır. B.4'te submit-choice bunu doğrudan import edip
// mevcut errorResponse('INVALID_INPUT', ...) desenine bağlar.

/**
 * Migration 069 `choice_events.outcome` CHECK kısıtıyla birebir.
 * CHECK değişirse burası da değişir — ikisi ayrı yerde senkron tutulur.
 */
export function isValidChoiceOutcome(v: unknown): v is ChoiceOutcome {
  return v === 'choice' || v === 'neither' || v === 'seen' || v === 'timeout';
}

/**
 * Şekil doğrulaması. İŞ KURALI DEĞİL:
 * - `latencyMs` tam sayı ve üst sınır kontrolü burada yok — B.4'te
 *   `Number.isInteger(v) && v <= 600000`, sınırı aşan değer 422 ile
 *   REDDEDİLİR. Clamp edilmez: sessizce veri değiştirmek yasak.
 * - `filmA <> filmB` ve outcome/winner tutarlılığı 069'da DB CHECK olarak var,
 *   burada tekrarlanmaz. B.4 bu ihlalleri yakalayıp 422 döndürür — ham
 *   Postgres hatası istemciye sızmaz.
 */
/**
 * Migration 086'daki `watch_feedback.response` CHECK kısıtıyla birebir aynı küme.
 */
export type WatchFeedbackResponse = 'loved' | 'ok' | 'abandoned' | 'not_watched' | 'skipped';

export function isValidWatchFeedbackResponse(v: unknown): v is WatchFeedbackResponse {
  return (
    v === 'loved' || v === 'ok' || v === 'abandoned' || v === 'not_watched' || v === 'skipped'
  );
}

export function isValidChoiceSubmission(v: unknown): v is ChoiceSubmission {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.gauntletId === 'string' &&
    (s.round === 1 || s.round === 2 || s.round === 3) &&
    typeof s.filmA === 'string' &&
    typeof s.filmB === 'string' &&
    (s.winner === null || typeof s.winner === 'string') &&
    isValidChoiceOutcome(s.outcome) &&
    (s.positionOfWinner === null ||
      s.positionOfWinner === 'left' ||
      s.positionOfWinner === 'right') &&
    typeof s.latencyMs === 'number' &&
    s.latencyMs >= 0
  );
}
