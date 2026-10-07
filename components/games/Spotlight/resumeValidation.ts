/**
 * Spotlight yükleme / resume doğrulaması — saf fonksiyon (React/RN import YOK).
 *
 * Sessiz "taze oyun" ve tam netlik yasak: eksik ya da tutarsız veri oyunu AÇMAZ,
 * çağıran hata durumu + retry gösterir ve `code` ile loglar.
 *
 *   SPOTLIGHT_LETTER_COUNT_INVALID   letter_count tam sayı > 0 değil ya da maskedeki
 *                                    slot sayısıyla uyuşmuyor (blur paydası; 0/yanlış
 *                                    değer görseli baştan net ya da hiç net yapmazdı)
 *   SPOTLIGHT_PROGRESS_FIELDS_MISSING progress var ama resume alanları eksik/bozuk
 *   SPOTLIGHT_RESUME_INCONSISTENT    alanlar var ama birbiriyle/maskeyle çelişiyor
 *
 * Sunucu invariantı: `letter_count === maskedeki slot sayısı` (generate-puzzles).
 * `completed` oyunda hak sayacı yalnız geçerli bir tam sayı olmalı; açık oyunda
 * ayrıca `attempts < maxAttempts` (haklar bitince oyun sunucuda kapanır).
 */

export type ResumeIssueCode =
  | 'SPOTLIGHT_LETTER_COUNT_INVALID'
  | 'SPOTLIGHT_PROGRESS_FIELDS_MISSING'
  | 'SPOTLIGHT_RESUME_INCONSISTENT';

export interface ResumeMaskToken {
  t: 'slot' | 'sep';
}

export interface ResumePuzzleShape {
  title_mask: readonly ResumeMaskToken[];
  letter_count: unknown;
}

export interface ResumeProgressShape {
  attempts?: unknown;
  completed: boolean;
  spotlight_letters?: unknown;
  spotlight_revealed?: unknown;
  spotlight_guesses?: unknown;
}

export type ResumeValidation =
  | { ok: true }
  | { ok: false; code: ResumeIssueCode; detail: string };

const fail = (code: ResumeIssueCode, detail: string): ResumeValidation => ({
  ok: false,
  code,
  detail,
});

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** letter_count: tam sayı > 0 ve maskenin slot sayısına eşit */
export function validateLetterCount(
  letterCount: unknown,
  mask: readonly ResumeMaskToken[],
): ResumeValidation {
  if (typeof letterCount !== 'number' || !Number.isInteger(letterCount) || letterCount <= 0) {
    return fail('SPOTLIGHT_LETTER_COUNT_INVALID', `letter_count=${String(letterCount)}`);
  }
  const slots = mask.filter((tok) => tok.t === 'slot').length;
  if (slots !== letterCount) {
    return fail(
      'SPOTLIGHT_LETTER_COUNT_INVALID',
      `letter_count=${letterCount} maskedeki slot=${slots}`,
    );
  }
  return { ok: true };
}

/** Bulmaca + (varsa) resume ilerlemesi — ilk ihlali döner */
export function validateSpotlightLoad(
  puzzle: ResumePuzzleShape,
  maxAttempts: number,
  progress: ResumeProgressShape | null,
): ResumeValidation {
  const letterCount = validateLetterCount(puzzle.letter_count, puzzle.title_mask);
  if (!letterCount.ok) return letterCount;

  // progress null = oyuncu bu bulmacada henüz hamle yapmadı: geçerli taze oyun
  if (progress === null) return { ok: true };

  if (!isCount(progress.attempts)) {
    return fail('SPOTLIGHT_PROGRESS_FIELDS_MISSING', `attempts=${String(progress.attempts)}`);
  }
  if (!Array.isArray(progress.spotlight_letters)) {
    return fail('SPOTLIGHT_PROGRESS_FIELDS_MISSING', 'spotlight_letters dizi degil');
  }
  if (!Array.isArray(progress.spotlight_revealed)) {
    return fail('SPOTLIGHT_PROGRESS_FIELDS_MISSING', 'spotlight_revealed dizi degil');
  }
  if (progress.spotlight_guesses !== undefined && !Array.isArray(progress.spotlight_guesses)) {
    return fail('SPOTLIGHT_PROGRESS_FIELDS_MISSING', 'spotlight_guesses dizi degil');
  }

  for (const letter of progress.spotlight_letters) {
    if (typeof letter !== 'string' || letter.length === 0) {
      return fail('SPOTLIGHT_RESUME_INCONSISTENT', 'bos ya da dize olmayan harf');
    }
  }

  const seen = new Set<number>();
  for (const item of progress.spotlight_revealed as unknown[]) {
    const entry = item as { pos?: unknown; ch?: unknown } | null;
    const pos = entry?.pos;
    if (typeof pos !== 'number' || !Number.isInteger(pos) || pos < 0 || pos >= puzzle.title_mask.length) {
      return fail('SPOTLIGHT_RESUME_INCONSISTENT', `acik pozisyon maske disinda: ${String(pos)}`);
    }
    if (puzzle.title_mask[pos].t !== 'slot') {
      return fail('SPOTLIGHT_RESUME_INCONSISTENT', `acik pozisyon slot degil: ${pos}`);
    }
    if (typeof entry?.ch !== 'string' || entry.ch.length === 0) {
      return fail('SPOTLIGHT_RESUME_INCONSISTENT', `pozisyon ${pos} harfi bos`);
    }
    if (seen.has(pos)) {
      return fail('SPOTLIGHT_RESUME_INCONSISTENT', `pozisyon tekrar: ${pos}`);
    }
    seen.add(pos);
  }

  // Açık oyun: haklar bitmiş olamaz (sunucu o anda oyunu kapatır) — aksi halde
  // oyuncu 0 hakla kilitli ekranda kalırdı
  if (!progress.completed && progress.attempts >= maxAttempts) {
    return fail(
      'SPOTLIGHT_RESUME_INCONSISTENT',
      `acik oyunda attempts=${progress.attempts} >= max_attempts=${maxAttempts}`,
    );
  }
  return { ok: true };
}
