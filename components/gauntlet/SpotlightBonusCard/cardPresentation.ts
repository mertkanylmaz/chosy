/**
 * Spotlight Home kartı: durum → içerik eşlemesi (Home-B1 A → Home-B1.2 B+ Cinematic Spotlight). Saf modül —
 * React/RN import YOK, Deno okur (`tests/gauntlet/spotlightCardPresentation.test.ts`).
 *
 * Bileşen yalnız çizer; hangi durumda hangi satır/görsel/CTA/dokunma hedefi olduğu burada.
 * Metinler anahtar olarak tarif edilir (`Segment`); `t()` bileşende çağrılır, böylece bu modül
 * i18n'e bağlanmaz.
 *
 * B+ kararı (5 Kas 2026): film karesi TÜM kartı kaplar. Oynanabilir/devam/loading'de kare oyunun
 * başlangıç bulanıklığında ve hafif karartılmış (`blur`); bulundu/haklar bitti'de AYNI kare net.
 * Kart tüm durumlarda aynı yükseklikte (72 pt) — durum değişince zıplama yok.
 *
 * Altın (`gold`): oynanabilir/devamda yalnız PLAY/CONTINUE hapı (`cta`); bulunduda yalnız
 * "✓ FOUND IT" eyebrow'u (`eyebrow`); haklar bittide, loading'de ve error'da altın YOK.
 * Cevap, oyunu bitirmemiş kullanıcıya kartta HİÇBİR durumda gösterilmez: `title` yalnız
 * sunucunun `revealed_solution`'ından, yani tamamlanmış oyunda gelir.
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
      /** Çözüm film adı — YALNIZ bitmiş oyunda (`revealed_solution.title`); aksi halde ya da eksikse null. */
      title: string | null;
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
  /** Yalnız tamamlanmış oyunda gelir (mevcut alan, yeni API YOK). */
  revealed_solution?: { title?: unknown } | null;
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
      title: string | null;
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
  const rawTitle = challenge.revealed_solution?.title;
  const title = typeof rawTitle === 'string' && rawTitle.trim() !== '' ? rawTitle.trim() : null;
  return { ok: true, state, backdropUrl, maxAttempts: max, title: isSpotlightPlayable(state) ? null : title };
}

// ─── Durum → içerik ────────────────────────────────────────────────────────────

/** Bir metin parçası: `t(key, { count })` ya da `literal`; `sentence` → büyük harfli sonuç sözlüğü cümle harfine iner. */
export interface Segment {
  key: string;
  count?: number;
  sentence?: boolean;
  /** Çevrilmeyen veri metni (film adı): doluysa `key` yok sayılır. */
  literal?: string;
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

/** B+ : kart her durumda 72 pt (`tall`); bitmiş artık kısalmaz. */
export type CardHeight = 'tall';

/** Eyebrow satırı: metin anahtarı + (bulundu) onay ikonu. */
export interface CardEyebrow {
  key: string;
  /** Başında ✓ ikonu — yalnız bulundu. */
  check: boolean;
}

/** Altının yer aldığı TEK öğe: PLAY/CONTINUE hapı, bulunduda eyebrow, ya da hiçbiri. */
export type GoldOn = 'cta' | 'eyebrow' | null;

export interface CardPresentation {
  kind: CardKind;
  eyebrow: CardEyebrow;
  /** Ana satır parçaları (" · " ile birleşir). */
  main: Segment[];
  /** İkincil satır parçaları; `null` → yok (loading: iskelet çubuğu çizilir). */
  secondary: Segment[] | null;
  /** `frame` = tam kart kare; `placeholder` = loading'de (varsa aynı günün karesi); `none` = görsel yok. */
  image: 'frame' | 'placeholder' | 'none';
  /** Kare bulanık + hafif karartılmış (oyunun başlangıç görüntüsü). Bitmişte false → net kare. */
  blur: boolean;
  /** PLAY / CONTINUE fiili (hap); yoksa null. */
  cta: 'play' | 'continue' | null;
  /** Altın hangi öğede (en fazla BİR yerde). */
  gold: GoldOn;
  target: CardTarget;
  /** Bitmiş karta chevron (sonuç ekranına giriş). */
  chevron: boolean;
  /** Erişilebilirlik ipucu anahtarı; bitmiş/error/loading'de yok. */
  hintKey: string | null;
  height: CardHeight;
  /** Bitmişte film adı eksikti → B1 metnine düşüldü (çağıran Sentry'ye yazar). */
  titleMissing: boolean;
}

const T = 'gauntlet.bonus.';
const R = 'games.spotlight.';

const SPOTLIGHT_EYEBROW: CardEyebrow = { key: `${T}spotlightEyebrow`, check: false };

const HIDDEN: CardPresentation = {
  kind: 'hidden',
  eyebrow: SPOTLIGHT_EYEBROW,
  main: [],
  secondary: null,
  image: 'none',
  blur: false,
  cta: null,
  gold: null,
  target: null,
  chevron: false,
  hintKey: null,
  height: 'tall',
  titleMissing: false,
};

export function spotlightCardPresentation(data: SpotlightCardData): CardPresentation {
  if (data.status === 'unavailable') return HIDDEN;

  // Loading: yenilemede aynı günün bulanık karesi (varsa) kalır; ilk okumada koyu zemin + iskelet.
  if (data.status === 'loading') return { ...HIDDEN, kind: 'loading', image: 'placeholder', blur: true };

  if (data.status === 'error') {
    return {
      ...HIDDEN,
      kind: 'error',
      main: [{ key: `${T}loadError` }, { key: 'gauntlet.retry' }],
      target: 'retry',
    };
  }

  const playableBase = {
    ...HIDDEN,
    main: [{ key: `${T}guessTheFilm` }],
    secondary: [{ key: `${T}chancesFromFrame`, count: data.maxAttempts }],
    image: 'frame' as const,
    blur: true,
    gold: 'cta' as const,
    target: 'game' as const,
    hintKey: `${T}a11yHint`,
  };

  if (data.state === 'not_started') return { ...playableBase, kind: 'playable', cta: 'play' };
  if (data.state === 'in_progress') return { ...playableBase, kind: 'continue', cta: 'continue' };

  const solved = data.state === 'solved';
  const titleMissing = data.title === null;
  const resultKey = `${R}${solved ? 'result_found' : 'result_out_of_chances'}`;
  return {
    ...HIDDEN,
    kind: solved ? 'solved' : 'failed',
    eyebrow: solved ? { key: `${R}result_found`, check: true } : { key: `${T}revealedEyebrow`, check: false },
    // Film adı varsa ana satır odur; yoksa B1 metni (Found it / Out of chances).
    main: titleMissing ? [{ key: resultKey, sentence: true }] : [{ key: '', literal: data.title ?? '' }],
    secondary: [{ key: `${R}result_next_film`, sentence: true }],
    image: 'frame',
    gold: solved ? 'eyebrow' : null,
    target: 'result',
    chevron: true,
    titleMissing,
  };
}

/** "FOUND IT" → "Found it"; TR "HAKLARIN BİTTİ" → "Hakların bitti" (locale'li küçük harf: i/İ doğru). */
export function sentenceCase(text: string, locale: string): string {
  const lower = text.toLocaleLowerCase(locale);
  return lower.charAt(0).toLocaleUpperCase(locale) + lower.slice(1);
}
