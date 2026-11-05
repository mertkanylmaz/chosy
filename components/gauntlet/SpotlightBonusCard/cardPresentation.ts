/**
 * Spotlight Home kartı: durum → içerik eşlemesi (Home-B1, Alternatif A). Saf modül —
 * React/RN import YOK, Deno okur (`tests/gauntlet/spotlightCardPresentation.test.ts`).
 *
 * Bileşen yalnız çizer; hangi durumda hangi satır/görsel/CTA/dokunma hedefi olduğu burada.
 * Metinler anahtar olarak tarif edilir (`Segment`); `t()` bileşende çağrılır, böylece bu modül
 * i18n'e bağlanmaz.
 *
 * Kartın TEK vurgu rengi (altın) yalnız PLAY / CONTINUE metnindedir (`gold`). Bitmiş, loading ve
 * error durumlarında altın yok. Bitmiş durumda görsel yok ve kart küçülür; loading, oynanabilir
 * yükseklikte durur (düzen zıplamasın). Cevap kartta HİÇBİR durumda gösterilmez.
 */
import {
  validateSpotlightLoad,
  type ResumeMaskToken,
  type ResumeProgressShape,
} from '../../games/Spotlight/resumeValidation';
import { isSpotlightPlayable, spotlightCardStateFrom, type SpotlightCardState } from './cardState';

// ─── Veri tipi (hook ve kart ortak) ────────────────────────────────────────────

export type SpotlightCardData =
  | {
      status: 'loading';
      /** Yenileme sırasında aynı günün önceki karesi — çerçeve boş kalıp titremesin. */
      backdropUrl?: string;
    }
  | { status: 'error' }
  | { status: 'unavailable' }
  | {
      status: 'ready';
      state: SpotlightCardState;
      /** Bugünün karesi — kart onu MAX_BLUR'da gösterir; oynanabilir durumda boş OLAMAZ. */
      backdropUrl: string;
      maxAttempts: number;
    };

/** Analytics etiketi (`spotlight_card_viewed` / `spotlight_card_visible` ortak değer kümesi). */
export type SpotlightStateLabel = SpotlightCardState | 'unknown';

export function spotlightStateLabel(data: SpotlightCardData): SpotlightStateLabel {
  return data.status === 'ready' ? data.state : 'unknown';
}

/**
 * `spotlight_card_viewed` ne zaman (yeniden) atılır: durum çözüldüyse (`loading`/`unavailable`
 * hariç) ve etiket son atılandan farklıysa. İlk çözülme `prev === null`. Oyundan dönüşte durum
 * değiştiyse (ör. not_started → solved) yeni etiketle tekrar atılır; aynı etiket tekrar atılmaz.
 */
export function shouldTrackViewed(prev: SpotlightStateLabel | null, data: SpotlightCardData): boolean {
  if (data.status === 'loading' || data.status === 'unavailable') return false;
  return prev !== spotlightStateLabel(data);
}

// ─── Doğrulanmış bulmaca ───────────────────────────────────────────────────────

/** `get-daily-challenge` yanıtının kartın okuduğu parçası (yeni alan/API YOK). */
export interface SpotlightChallengeShape {
  puzzle: {
    id: unknown;
    max_attempts: unknown;
    puzzle_data: Record<string, unknown>;
  };
  progress: (ResumeProgressShape & { won: boolean }) | null | undefined;
}

export type SpotlightVerifyIssue =
  | 'SPOTLIGHT_CARD_PUZZLE_ID_MISSING'
  | 'SPOTLIGHT_CARD_FORMAT_STALE'
  | 'SPOTLIGHT_CARD_MAX_ATTEMPTS_INVALID'
  | 'SPOTLIGHT_CARD_BACKDROP_MISSING'
  | 'SPOTLIGHT_LETTER_COUNT_INVALID'
  | 'SPOTLIGHT_PROGRESS_FIELDS_MISSING'
  | 'SPOTLIGHT_RESUME_INCONSISTENT';

export type SpotlightVerified =
  | {
      ok: true;
      state: SpotlightCardState;
      backdropUrl: string;
      maxAttempts: number;
    }
  | { ok: false; code: SpotlightVerifyIssue; detail: string };

const bad = (code: SpotlightVerifyIssue, detail: string): SpotlightVerified => ({ ok: false, code, detail });

/**
 * Kart, belirli bir bulmacaya ancak bu doğrulama geçerse götürür: bulmaca kimliği, V3 biçimi
 * (oyun ekranının kapısıyla aynı), geçerli hak sayısı, oyun ekranıyla AYNI yükleme/resume doğrulayıcısı
 * (`validateSpotlightLoad`) ve oynanabilir durumda kare görseli. Başarısızsa çağıran `error`'a düşer.
 */
export function spotlightPuzzleVerified(challenge: SpotlightChallengeShape): SpotlightVerified {
  const { puzzle } = challenge;
  if (typeof puzzle.id !== 'string' || puzzle.id === '') {
    return bad('SPOTLIGHT_CARD_PUZZLE_ID_MISSING', `id=${String(puzzle.id)}`);
  }
  const pd = puzzle.puzzle_data;
  const mask = pd?.title_mask;
  const version = pd?.v;
  if (!Array.isArray(mask) || typeof version !== 'number' || version < 3) {
    return bad('SPOTLIGHT_CARD_FORMAT_STALE', `v=${String(version)} title_mask=${Array.isArray(mask)}`);
  }
  const max = puzzle.max_attempts;
  if (typeof max !== 'number' || !Number.isFinite(max) || max < 1) {
    return bad('SPOTLIGHT_CARD_MAX_ATTEMPTS_INVALID', `max_attempts=${String(max)}`);
  }
  const progress = challenge.progress ?? null;
  const validation = validateSpotlightLoad(
    { title_mask: mask as ResumeMaskToken[], letter_count: pd.letter_count },
    max,
    progress,
  );
  if (!validation.ok) return bad(validation.code, validation.detail);

  const state = spotlightCardStateFrom(progress);
  const backdrop = pd.backdrop_url;
  const backdropUrl = typeof backdrop === 'string' ? backdrop : '';
  if (isSpotlightPlayable(state) && backdropUrl === '') {
    return bad('SPOTLIGHT_CARD_BACKDROP_MISSING', 'oynanabilir durumda backdrop_url bos');
  }
  return { ok: true, state, backdropUrl, maxAttempts: max };
}

// ─── Durum → içerik ────────────────────────────────────────────────────────────

/** Bir metin parçası: `t(key, { count })`; `sentence` → büyük harfli sonuç sözlüğü cümle harfine iner. */
export interface Segment {
  key: string;
  count?: number;
  sentence?: boolean;
}

export type CardKind =
  | 'hidden'
  | 'loading'
  | 'error'
  | 'playable'
  | 'continue'
  | 'solved'
  | 'failed';

/** Dokunma hedefi: oyun ekranı, sonuç ekranı (aynı rota — oyun `completed` açar), yeniden okuma ya da yok. */
export type CardTarget = 'game' | 'result' | 'retry' | null;

/** `tall` = 72 pt (kare 56 + 2×space.sm), `compact` = 56 pt. */
export type CardHeight = 'tall' | 'compact';

export interface CardPresentation {
  kind: CardKind;
  /** Eyebrow: `gauntlet.bonus.label` + (bitmişte) " · " + `gauntlet.bonus.doneEyebrow`. */
  eyebrowDone: boolean;
  /** Ana satır parçaları (" · " ile birleşir). */
  main: Segment[];
  /** İkincil satır parçaları; `null` → yok (loading: iskelet çubuğu çizilir). */
  secondary: Segment[] | null;
  /** `frame` = bulanık kare; `placeholder` = loading'de nötr kutu; `none` = görsel yok. */
  image: 'frame' | 'placeholder' | 'none';
  /** PLAY / CONTINUE fiili; yoksa null. */
  cta: 'play' | 'continue' | null;
  /** Altın yalnız CTA metninde. */
  gold: boolean;
  target: CardTarget;
  /** Bitmiş karta sessiz chevron (sonuç ekranına giriş). */
  chevron: boolean;
  /** Erişilebilirlik ipucu anahtarı; bitmiş/error/loading'de yok. */
  hintKey: string | null;
  height: CardHeight;
}

const T = 'gauntlet.bonus.';
const R = 'games.spotlight.';

const HIDDEN: CardPresentation = {
  kind: 'hidden',
  eyebrowDone: false,
  main: [],
  secondary: null,
  image: 'none',
  cta: null,
  gold: false,
  target: null,
  chevron: false,
  hintKey: null,
  height: 'tall',
};

export function spotlightCardPresentation(data: SpotlightCardData): CardPresentation {
  if (data.status === 'unavailable') return HIDDEN;

  if (data.status === 'loading') {
    return { ...HIDDEN, kind: 'loading', main: [{ key: `${T}title` }], image: 'placeholder' };
  }

  if (data.status === 'error') {
    return {
      ...HIDDEN,
      kind: 'error',
      main: [{ key: `${T}title` }],
      secondary: [{ key: `${T}loadError` }, { key: 'gauntlet.retry' }],
      target: 'retry',
    };
  }

  const playableBase = {
    ...HIDDEN,
    main: [{ key: `${T}title` }, { key: `${T}nameTheFilm` }],
    secondary: [{ key: `${T}chancesFromFrame`, count: data.maxAttempts }],
    image: 'frame' as const,
    gold: true,
    target: 'game' as const,
    hintKey: `${T}a11yHint`,
  };

  if (data.state === 'not_started') return { ...playableBase, kind: 'playable', cta: 'play' };
  if (data.state === 'in_progress') return { ...playableBase, kind: 'continue', cta: 'continue' };

  const solved = data.state === 'solved';
  return {
    ...HIDDEN,
    kind: solved ? 'solved' : 'failed',
    eyebrowDone: true,
    main: [
      { key: `${R}${solved ? 'result_found' : 'result_out_of_chances'}`, sentence: true },
      { key: `${R}result_next_film`, sentence: true },
    ],
    target: 'result',
    chevron: true,
    height: 'compact',
  };
}

/** "FOUND IT" → "Found it"; TR "HAKLARIN BİTTİ" → "Hakların bitti" (locale'li küçük harf: i/İ doğru). */
export function sentenceCase(text: string, locale: string): string {
  const lower = text.toLocaleLowerCase(locale);
  return lower.charAt(0).toLocaleUpperCase(locale) + lower.slice(1);
}
