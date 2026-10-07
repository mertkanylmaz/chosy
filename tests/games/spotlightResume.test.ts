/**
 * Unit tests — Spotlight yükleme / resume doğrulaması (saf fonksiyon).
 *
 * Run: npm run test:spotlight-layout
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  validateLetterCount,
  validateSpotlightLoad,
  type ResumeMaskToken,
  type ResumeProgressShape,
} from '../../components/games/Spotlight/resumeValidation.ts'

// "AB-C D" benzeri: 4 slot, 2 ayraç (indeks 2 ve 4)
const MASK: ResumeMaskToken[] = [
  { t: 'slot' },
  { t: 'slot' },
  { t: 'sep' },
  { t: 'slot' },
  { t: 'sep' },
  { t: 'slot' },
]
const PUZZLE = { title_mask: MASK, letter_count: 4 }

const fresh = (over: Partial<ResumeProgressShape> = {}): ResumeProgressShape => ({
  attempts: 1,
  completed: false,
  spotlight_letters: ['A', 'Z'],
  spotlight_revealed: [{ pos: 0, ch: 'A' }],
  ...over,
})

function code(result: ReturnType<typeof validateSpotlightLoad>) {
  return result.ok ? 'ok' : result.code
}

Deno.test('letter_count: geçerli ve maskeyle tutarlı', () => {
  assertEquals(validateLetterCount(4, MASK), { ok: true })
})

Deno.test('letter_count: eksik, sıfır, negatif, kesirli, sayı olmayan → geçersiz', () => {
  for (const bad of [undefined, null, 0, -1, 2.5, NaN, Infinity, '4']) {
    const r = validateLetterCount(bad, MASK)
    assert(!r.ok, String(bad))
    assertEquals(r.ok ? '' : r.code, 'SPOTLIGHT_LETTER_COUNT_INVALID')
  }
})

Deno.test('letter_count: maskedeki slot sayısıyla uyuşmuyorsa geçersiz', () => {
  assertEquals(validateLetterCount(5, MASK).ok, false)
  assertEquals(validateLetterCount(3, MASK).ok, false)
})

Deno.test('progress null: geçerli taze oyun', () => {
  assertEquals(validateSpotlightLoad(PUZZLE, 6, null), { ok: true })
})

Deno.test('geçerli resume: açık oyun', () => {
  assertEquals(validateSpotlightLoad(PUZZLE, 6, fresh()), { ok: true })
})

Deno.test('geçerli resume: tamamlanmış oyun, haklar bitmiş olabilir', () => {
  assertEquals(validateSpotlightLoad(PUZZLE, 6, fresh({ completed: true, attempts: 6 })), { ok: true })
})

Deno.test('resume alanı eksik: attempts / harfler / açık pozisyonlar → FIELDS_MISSING', () => {
  assertEquals(code(validateSpotlightLoad(PUZZLE, 6, fresh({ attempts: undefined }))), 'SPOTLIGHT_PROGRESS_FIELDS_MISSING')
  assertEquals(code(validateSpotlightLoad(PUZZLE, 6, fresh({ attempts: -1 }))), 'SPOTLIGHT_PROGRESS_FIELDS_MISSING')
  assertEquals(code(validateSpotlightLoad(PUZZLE, 6, fresh({ attempts: 1.5 }))), 'SPOTLIGHT_PROGRESS_FIELDS_MISSING')
  assertEquals(code(validateSpotlightLoad(PUZZLE, 6, fresh({ spotlight_letters: undefined }))), 'SPOTLIGHT_PROGRESS_FIELDS_MISSING')
  assertEquals(code(validateSpotlightLoad(PUZZLE, 6, fresh({ spotlight_revealed: 'x' }))), 'SPOTLIGHT_PROGRESS_FIELDS_MISSING')
  assertEquals(code(validateSpotlightLoad(PUZZLE, 6, fresh({ spotlight_guesses: {} }))), 'SPOTLIGHT_PROGRESS_FIELDS_MISSING')
})

Deno.test('spotlight_guesses yoksa sorun değil (isteğe bağlı)', () => {
  assertEquals(validateSpotlightLoad(PUZZLE, 6, fresh({ spotlight_guesses: undefined })), { ok: true })
  assertEquals(validateSpotlightLoad(PUZZLE, 6, fresh({ spotlight_guesses: [] })), { ok: true })
})

Deno.test('tutarsız: açık pozisyon maske dışı, ayraç, tekrar, boş harf', () => {
  const inc = 'SPOTLIGHT_RESUME_INCONSISTENT'
  assertEquals(code(validateSpotlightLoad(PUZZLE, 6, fresh({ spotlight_revealed: [{ pos: 9, ch: 'A' }] }))), inc)
  assertEquals(code(validateSpotlightLoad(PUZZLE, 6, fresh({ spotlight_revealed: [{ pos: -1, ch: 'A' }] }))), inc)
  assertEquals(code(validateSpotlightLoad(PUZZLE, 6, fresh({ spotlight_revealed: [{ pos: 2, ch: '-' }] }))), inc)
  assertEquals(
    code(validateSpotlightLoad(PUZZLE, 6, fresh({ spotlight_revealed: [{ pos: 0, ch: 'A' }, { pos: 0, ch: 'A' }] }))),
    inc,
  )
  assertEquals(code(validateSpotlightLoad(PUZZLE, 6, fresh({ spotlight_revealed: [{ pos: 0, ch: '' }] }))), inc)
  assertEquals(code(validateSpotlightLoad(PUZZLE, 6, fresh({ spotlight_revealed: [null] }))), inc)
  assertEquals(code(validateSpotlightLoad(PUZZLE, 6, fresh({ spotlight_letters: [''] }))), inc)
})

Deno.test('tutarsız: açık oyunda haklar bitmiş (attempts >= max)', () => {
  assertEquals(code(validateSpotlightLoad(PUZZLE, 6, fresh({ attempts: 6 }))), 'SPOTLIGHT_RESUME_INCONSISTENT')
  assertEquals(code(validateSpotlightLoad(PUZZLE, 6, fresh({ attempts: 7 }))), 'SPOTLIGHT_RESUME_INCONSISTENT')
  assertEquals(validateSpotlightLoad(PUZZLE, 6, fresh({ attempts: 5 })), { ok: true })
})

Deno.test('bozuk letter_count resume alanlarından ÖNCE yakalanır', () => {
  const r = validateSpotlightLoad({ title_mask: MASK, letter_count: 0 }, 6, fresh({ attempts: undefined }))
  assertEquals(code(r), 'SPOTLIGHT_LETTER_COUNT_INVALID')
})
