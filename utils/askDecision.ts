/**
 * Ask kararı — saf mantık (champion sonrası tek modal istem).
 *
 * `services/askCoordinator.ts` girdileri toplar (AsyncStorage, oturum,
 * `daily_gauntlets`, Spotlight ilerlemesi) ve kararı BURAYA sorar. Burada
 * supabase / AsyncStorage / React Native bağımlılığı YOKTUR; saat ve gün
 * anahtarı enjekte edilir ki her dal cihaz gerektirmeden test edilebilsin
 * (`tests/gauntlet/askDecision.test.ts`).
 *
 * ── Ürün kuralı (CTO kararı, 3 Eki 2026) ───────────────────────────────────
 * Bir champion oturumunda TEK modal ask; hiçbir ask Spotlight'ı örtmez,
 * oyun sırasında hiçbir ask çıkmaz. Günde en fazla bir ask (yerel gün).
 *   · Gün 1  → bildirim izni (hiç sorulmadıysa)
 *   · Gün 2+ → auth (anonim ∧ girişe dönüşmemiş ∧ count < 3 ∧ son
 *              gösterimden ≥ 3 gün), değilse bildirim izni (hiç sorulmadıysa)
 *   · Spotlight yarıda (in_progress) → ask yok
 */

/** Gösterilebilecek ask türü. */
export type AskType = 'notif' | 'auth';

/** Askı tetikleyen an — analytics `trigger` prop'u. */
export type AskTrigger = 'spotlight_return' | 'dwell';

/** Bugünkü Spotlight bulmacasının durumu. */
export type SpotlightState = 'not_started' | 'in_progress' | 'completed';

/** Auth askı "Not now" sonrası bekleme süresi. */
export const AUTH_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

/** Auth askının toplam gösterim üst sınırı. */
export const AUTH_MAX_SHOWS = 3;

/** `chosy_ask_state` AsyncStorage değeri. */
export interface AskState {
  /** Son askın gösterildiği YEREL gün (YYYY-MM-DD) — günde 1 ask kuralı. */
  lastAskDay: string | null;
  auth: {
    /** Auth askının toplam gösterim sayısı. */
    count: number;
    /** Son auth gösteriminin epoch ms'i. */
    lastAt: number | null;
  };
}

export const EMPTY_ASK_STATE: AskState = {
  lastAskDay: null,
  auth: { count: 0, lastAt: null },
};

/** `shouldShowAsk` girdileri — hepsi çağıran tarafından toplanır. */
export interface AskInputs {
  /** Bugünün YEREL gün anahtarı (YYYY-MM-DD). */
  today: string;
  /** Epoch ms. */
  now: number;
  /** Kişisel champion günü sayısı (bugün dahil). */
  dayIndex: number;
  spotlightState: SpotlightState;
  askState: AskState;
  /** Oturum anonim mi. */
  isAnonymous: boolean;
  /** `users.auth_prompt_seen` — yalnız gerçek giriş tamamlanınca true. */
  authConverted: boolean;
  /** Bildirim izni bu cihazda zaten soruldu (ya da verildi). */
  notifAsked: boolean;
}

/** Bugün bir ask zaten gösterildi mi. */
export function askedToday(state: AskState, today: string): boolean {
  return state.lastAskDay === today;
}

/** Auth askı şu an uygun mu (gün 2+ koşulları hariç). */
function authEligible(input: AskInputs): boolean {
  if (!input.isAnonymous || input.authConverted) return false;
  const { count, lastAt } = input.askState.auth;
  if (count >= AUTH_MAX_SHOWS) return false;
  if (lastAt !== null && input.now - lastAt < AUTH_COOLDOWN_MS) return false;
  return true;
}

/** Tek karar fonksiyonu. `null` → hiçbir ask gösterilmez. */
export function shouldShowAsk(input: AskInputs): AskType | null {
  if (askedToday(input.askState, input.today)) return null;
  if (input.spotlightState === 'in_progress') return null;
  // Champion ekranındayken 0 olamaz; sayım gecikirse güvenli taraf: ask yok.
  if (input.dayIndex < 1) return null;

  if (input.dayIndex === 1) {
    return input.notifAsked ? null : 'notif';
  }

  if (authEligible(input)) return 'auth';
  return input.notifAsked ? null : 'notif';
}

/** Gösterilen askı duruma işler. Auth sayacı yalnız auth'ta artar. */
export function recordAskShown(
  state: AskState,
  type: AskType,
  today: string,
  now: number,
): AskState {
  return {
    lastAskDay: today,
    auth:
      type === 'auth'
        ? { count: state.auth.count + 1, lastAt: now }
        : { ...state.auth },
  };
}

/**
 * AsyncStorage ham değerini çözer. Değer yoksa boş durum; bozuksa HATA
 * fırlatır — çağıran Sentry'ye yazar ve ask göstermez (sessiz sıfırlama
 * cooldown'u ve 3 gösterim sınırını delerdi).
 */
export function parseAskState(raw: string | null): AskState {
  if (raw === null) return EMPTY_ASK_STATE;
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null) {
    throw new Error('chosy_ask_state: nesne değil');
  }
  const { lastAskDay, auth } = value as { lastAskDay?: unknown; auth?: unknown };
  if (lastAskDay !== null && typeof lastAskDay !== 'string') {
    throw new Error('chosy_ask_state: lastAskDay geçersiz');
  }
  if (typeof auth !== 'object' || auth === null) {
    throw new Error('chosy_ask_state: auth geçersiz');
  }
  const { count, lastAt } = auth as { count?: unknown; lastAt?: unknown };
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw new Error('chosy_ask_state: auth.count geçersiz');
  }
  if (lastAt !== null && typeof lastAt !== 'number') {
    throw new Error('chosy_ask_state: auth.lastAt geçersiz');
  }
  return { lastAskDay, auth: { count, lastAt } };
}

/** `get-daily-challenge` ilerlemesinden Spotlight durumu. */
export function spotlightStateFrom(
  progress: { completed: boolean } | null | undefined,
): SpotlightState {
  if (!progress) return 'not_started';
  return progress.completed ? 'completed' : 'in_progress';
}

/** YEREL gün anahtarı, sıfır dolgulu YYYY-MM-DD. */
export function localDayKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Dwell fallback ölçüsü: Spotlight kartı görünür alanda TAMAMEN mi. */
export interface CardViewport {
  /** Kartın kaydırma içeriğindeki üst kenarı. */
  cardY: number;
  cardHeight: number;
  scrollY: number;
  viewportHeight: number;
  /** Altta içeriği örten pay (yüzen tab bar + home indicator). */
  bottomInset: number;
}

export function isCardFullyVisible(v: CardViewport): boolean {
  if (v.cardHeight <= 0 || v.viewportHeight <= 0) return false;
  const top = v.scrollY;
  const bottom = v.scrollY + v.viewportHeight - v.bottomInset;
  return v.cardY >= top && v.cardY + v.cardHeight <= bottom;
}
