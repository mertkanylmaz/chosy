/**
 * Hızlı mood kartı + AI rızası akışı (saf mantık; RN / Sentry / ağ yok, bağımlılıklar enjekte edilir).
 *
 * Kural: rıza YOKKEN kart dokunuşu rıza YAZMAZ (Apple 5.1.2(i): açık rıza) ve aramayı BAŞLATMAZ.
 * Bunun yerine kart "bekleyen" olur; kullanıcı görünür rıza adımındaki butona basınca rıza yazılır
 * ve bekleyen kartın `quickMoodId`'siyle arama başlar. Rıza okunamazsa (`unknown`) aynı görünür
 * adım açılır — sessiz dönüş yoktur.
 */

export type ConsentReadState = 'granted' | 'denied' | 'unknown';

export interface PendingQuick {
  cardId: string;
  prompt: string;
  label?: string;
}

export interface QuickStartInput {
  text: string;
  quickMoodId: string;
  entry: 'quick';
  label?: string;
}

/** Erken çıkışların izi: hepsi breadcrumb üretir; `consent_*_failed` ayrıca Sentry warning'dir. */
export type ConsentTrace = 'quick_blocked_no_consent' | 'consent_read_failed' | 'consent_save_failed';

export interface QuickConsentDeps {
  readConsent(): Promise<ConsentReadState>;
  recordConsent(): Promise<{ ok: boolean }>;
  start(input: QuickStartInput): void;
  trace(kind: ConsentTrace, data?: Record<string, string>): void;
}

export type QuickTapOutcome =
  | { kind: 'started' }
  | { kind: 'awaiting_consent'; reason: 'denied' | 'read_failed' };

/** `recorded_started`: rıza bu dokunuşla yazıldı (analitik `granted`); `started`: zaten vardı. */
export type ConfirmOutcome = 'recorded_started' | 'started' | 'save_failed';

function toInput(p: PendingQuick): QuickStartInput {
  return { text: p.prompt, quickMoodId: p.cardId, entry: 'quick', label: p.label };
}

/** Kart dokunuşu: rıza varsa başlat; yoksa / okunamadıysa görünür adım iste. */
export async function tapQuick(deps: QuickConsentDeps, card: PendingQuick): Promise<QuickTapOutcome> {
  const state = await deps.readConsent();
  if (state === 'granted') {
    deps.start(toInput(card));
    return { kind: 'started' };
  }
  if (state === 'unknown') {
    deps.trace('consent_read_failed', { source: 'quick' });
    return { kind: 'awaiting_consent', reason: 'read_failed' };
  }
  deps.trace('quick_blocked_no_consent', { card_id: card.cardId });
  return { kind: 'awaiting_consent', reason: 'denied' };
}

/**
 * "Enable AI & Find Movies": rıza yazılır (kullanıcının bilinçli dokunuşu); başarılıysa bekleyen
 * kartla arama başlar. Başarısızsa arama BAŞLAMAZ, çağıran mevcut Alert'i gösterir.
 */
export async function confirmPendingQuick(deps: QuickConsentDeps, pending: PendingQuick): Promise<ConfirmOutcome> {
  const state = await deps.readConsent();
  let recorded = false;
  if (state !== 'granted') {
    const result = await deps.recordConsent();
    if (!result.ok) {
      deps.trace('consent_save_failed', { source: 'quick' });
      return 'save_failed';
    }
    recorded = true;
  }
  deps.start(toInput(pending));
  return recorded ? 'recorded_started' : 'started';
}
