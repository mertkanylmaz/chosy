/**
 * Watch-feedback akışının SAF mantığı (T3) — render ve ağdan bağımsız, birim
 * testli (`tests/gauntlet/watchFeedbackFlow.test.ts`). Bileşen yalnızca bunu
 * çağırır; hangi olayın hangi satırı yazdığı BURADA kilitlidir.
 *
 * Kilitli semantik (Bible v1.46, K-29):
 *   Yes tek başına satır YAZMAZ — State 2'ye geçer. Satır, satisfaction
 *   (`loved` | `ok` | `disliked`) seçilince yazılır.
 *   Not yet → `not_watched` · Skip → `skipped` (ayrı değerler, `answered_at`
 *   ayrımı sunucuda). `abandoned` yeni UI'da YOK.
 *   Skip yalnız State 1'de vardır; State 2'de yalnız Back.
 *   Unmount / sekme değişimi hiçbir olay üretmez: bu modülde "unmount" diye
 *   bir olay yoktur, dolayısıyla satır yazılamaz.
 *
 * Bu dosya `@/` takma adı KULLANMAZ (deno testi doğrudan import eder).
 */
import type { WatchFeedbackResponse } from '../../../types/gauntlet';

export type FlowStep = 'outcome' | 'satisfaction';

/** Kullanıcının dokunabileceği şeyler. */
export type FlowEvent = 'yes' | 'not_yet' | 'skip' | 'back' | 'loved' | 'ok' | 'disliked';

export interface FlowState {
  step: FlowStep;
  /** Bir cevap gönderildi — sonraki her olay yok sayılır (çift tap koruması). */
  submitted: boolean;
}

export const INITIAL_FLOW: FlowState = { step: 'outcome', submitted: false };

export type EventProps = Record<string, string | number | boolean | null>;

export interface TrackedEvent {
  name: string;
  props: EventProps;
}

export interface FlowResult {
  state: FlowState;
  /** Sunucuya yazılacak değer; `null` = yazım yok. */
  emit: WatchFeedbackResponse | null;
  /** Olay kabul edildi mi (yok sayıldıysa haptik/analitik/geçiş yok). */
  accepted: boolean;
  events: TrackedEvent[];
}

const IGNORED = (state: FlowState): FlowResult => ({
  state,
  emit: null,
  accepted: false,
  events: [],
});

/**
 * Kart ekrana geldi. Yeni `outcome_shown` + süreklilik için eski
 * `watched_prompted` (G6 E-07 paydası) birlikte atılır.
 */
export function shownEvents(filmId: string): TrackedEvent[] {
  return [
    { name: 'outcome_shown', props: { film_id: filmId } },
    { name: 'watched_prompted', props: { film_id: filmId } },
  ];
}

export function reduceFlow(state: FlowState, event: FlowEvent, filmId: string): FlowResult {
  if (state.submitted) return IGNORED(state);

  if (state.step === 'outcome') {
    switch (event) {
      case 'yes':
        // Satır YAZILMAZ. Analitik de yok: nihai tip satisfaction anında atılır.
        return {
          state: { step: 'satisfaction', submitted: false },
          emit: null,
          accepted: true,
          events: [],
        };
      case 'not_yet':
        return {
          state: { step: 'outcome', submitted: true },
          emit: 'not_watched',
          accepted: true,
          events: [
            { name: 'outcome_answered', props: { film_id: filmId, type: 'not_yet' } },
            // Eski olay: izlenmemiş kolu (G6 #8) — disliked hatası değil, süreklilik.
            { name: 'watched_not_yet', props: { response: 'not_watched' } },
          ],
        };
      case 'skip':
        return {
          state: { step: 'outcome', submitted: true },
          emit: 'skipped',
          accepted: true,
          events: [
            { name: 'outcome_answered', props: { film_id: filmId, type: 'skipped' } },
            { name: 'outcome_skipped', props: { film_id: filmId } },
            { name: 'watched_not_yet', props: { response: 'skipped' } },
          ],
        };
      default:
        // back / satisfaction değerleri State 1'de yok.
        return IGNORED(state);
    }
  }

  // step === 'satisfaction' — Skip YOK.
  switch (event) {
    case 'back':
      return {
        state: { step: 'outcome', submitted: false },
        emit: null,
        accepted: true,
        events: [],
      };
    case 'loved':
    case 'ok':
    case 'disliked':
      return {
        state: { step: 'satisfaction', submitted: true },
        emit: event,
        accepted: true,
        events: [
          { name: 'outcome_answered', props: { film_id: filmId, type: 'watched' } },
          { name: 'satisfaction_answered', props: { film_id: filmId, value: event } },
          // T0 bulgusu: `disliked` eskiden watched_not_yet koluna düşüyordu.
          // İzlenmiş kolu K-29 ile aynı küme: loved/ok/disliked (abandoned legacy).
          { name: 'watched_confirmed', props: { response: event } },
        ],
      };
    default:
      return IGNORED(state);
  }
}

// ─── Gönderim: bir kez yeniden deneme (B1) ───────────────────────────────────

/** İki deneme de düştü. `last` ikinci hata, `first` ilki — ikisi de Sentry'ye gider. */
export class RetryExhaustedError extends Error {
  readonly first: unknown;
  readonly last: unknown;

  constructor(first: unknown, last: unknown) {
    super(
      `watch feedback gönderimi iki denemede de başarısız: ${
        last instanceof Error ? last.message : String(last)
      }`,
    );
    this.name = 'RetryExhaustedError';
    this.first = first;
    this.last = last;
  }
}

export const RETRY_DELAY_MS = 1500;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `fn`'i çağırır; düşerse `delayMs` bekleyip BİR kez daha dener. İkinci hata
 * `RetryExhaustedError` olarak fırlar — yutulmaz. Sunucu idempotent
 * (`already_answered`), yeniden deneme çift satır üretmez.
 */
export async function submitWithRetry<T>(
  fn: () => Promise<T>,
  opts: { delayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const delayMs = opts.delayMs ?? RETRY_DELAY_MS;
  const sleep = opts.sleep ?? defaultSleep;
  try {
    return await fn();
  } catch (first) {
    await sleep(delayMs);
    try {
      return await fn();
    } catch (last) {
      throw new RetryExhaustedError(first, last);
    }
  }
}

// ─── Poster ölçüsü (küçük ekran) ─────────────────────────────────────────────

/** Poster, slot genişliğinin en çok bu oranı kadar olabilir. */
export const POSTER_MAX_WIDTH_RATIO = 0.6;

/**
 * Poster 2:3 SABİT, kırpma yok. Yükseklik slotun KALAN alanından hesaplanır
 * (onLayout) — sabit değer yok; genişlik oranı da üst sınırdır.
 */
export function posterSize(slotWidth: number, slotHeight: number): { width: number; height: number } {
  if (!(slotWidth > 0) || !(slotHeight > 0)) return { width: 0, height: 0 };
  const maxHeightByWidth = (slotWidth * POSTER_MAX_WIDTH_RATIO * 3) / 2;
  const height = Math.floor(Math.min(slotHeight, maxHeightByWidth));
  return { width: Math.floor((height * 2) / 3), height };
}
