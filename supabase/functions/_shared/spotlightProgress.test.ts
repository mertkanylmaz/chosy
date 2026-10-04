/**
 * Unit tests — get-daily-challenge Spotlight progress alanlari (P-3d).
 *
 * Asil iddia: yanit govdesinde baslik ve acilmamis harf YOK; yalniz oyuncunun
 * denedigi harfler ve kendi actigi pozisyonlar var.
 *
 * Run: npm run test:spotlight-progress
 *      (supabase/functions icinden: deno test _shared/spotlightProgress.test.ts)
 */

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { findLetterPositions } from './spotlightLetters.ts'
import { spotlightProgressFields } from './spotlightProgress.ts'

const TITLE = 'Stand by Me'

/**
 * submit-guess harf dalinin yazdigi progress_json'in taklidi
 * (submit-guess/index.ts:492-520): her denemede harf eklenir, isabet
 * pozisyonlari `spotlight_revealed`'a girer.
 */
function progressAfter(letters: string[]): Record<string, unknown> {
  const chars = [...TITLE]
  const revealed: { pos: number; ch: string }[] = []
  for (const l of letters) {
    for (const pos of findLetterPositions(TITLE, l)) {
      if (!revealed.some((r) => r.pos === pos)) revealed.push({ pos, ch: chars[pos] })
    }
  }
  return {
    guesses: [],
    guess_timestamps: [],
    completed: false,
    won: false,
    revealed_count: 0,
    spotlight_letters: letters,
    spotlight_revealed: revealed,
  }
}

/** get-daily-challenge'in istemciye yazdigi govdenin ilgili parcasi */
function responseBody(progressJson: unknown): string {
  const { fields } = spotlightProgressFields(progressJson)
  return JSON.stringify({ progress: { ...fields, attempts: 1 } })
}

Deno.test('denenen harfler isabet + iska sirasiyla doner', () => {
  const { fields, dropped } = spotlightProgressFields(progressAfter(['S', 'X', 'E']))
  assertEquals(fields.spotlight_letters, ['S', 'X', 'E'])
  assertEquals(dropped, 0)
})

Deno.test('yalniz acilmis pozisyonlar doner — {pos, ch}', () => {
  const { fields } = spotlightProgressFields(progressAfter(['S', 'E']))
  // "Stand by Me": S@0, e@10
  assertEquals(fields.spotlight_revealed, [{ pos: 0, ch: 'S' }, { pos: 10, ch: 'e' }])
})

Deno.test('HARD RULE 1: govdede baslik yok', () => {
  for (const letters of [[], ['S'], ['S', 'T', 'A', 'N'], ['S', 'T', 'A', 'N', 'D', 'B', 'Y', 'M', 'E']]) {
    const body = responseBody(progressAfter(letters)).toLowerCase()
    assert(!body.includes('stand'), `${letters.join('')}: "stand" sizdi`)
    assert(!body.includes(TITLE.toLowerCase()), `${letters.join('')}: baslik sizdi`)
  }
})

Deno.test('HARD RULE 1: acilmamis harf govdede yok', () => {
  const tried = ['S', 'X']
  const { fields } = spotlightProgressFields(progressAfter(tried))
  const chars = [...TITLE]
  const openPositions = new Set(
    tried.flatMap((l) => findLetterPositions(TITLE, l)),
  )
  for (const r of fields.spotlight_revealed) {
    assert(openPositions.has(r.pos), `pos ${r.pos} acilmamisti`)
    assertEquals(r.ch, chars[r.pos])
  }
  // Basligin denenmemis harfleri (t, a, n, d, b, y, m, e) hicbir ch'de yok
  const revealedChars = new Set(fields.spotlight_revealed.map((r) => r.ch.toUpperCase()))
  for (const untried of ['T', 'A', 'N', 'D', 'B', 'Y', 'M', 'E']) {
    assert(!revealedChars.has(untried), `${untried} acilmadan dondu`)
  }
})

Deno.test('beyaz liste: progress_json\'daki baska alanlar ve ek anahtarlar gecmez', () => {
  const pj = {
    ...progressAfter(['S']),
    solution_title: TITLE,
    title: TITLE,
    spotlight_revealed: [{ pos: 0, ch: 'S', title: TITLE, full: TITLE }],
  }
  const body = responseBody(pj)
  assert(!body.includes(TITLE), 'ek alan uzerinden baslik sizdi')
  assertEquals(spotlightProgressFields(pj).fields.spotlight_revealed, [{ pos: 0, ch: 'S' }])
  assertEquals(
    Object.keys(spotlightProgressFields(pj).fields).sort(),
    ['spotlight_letters', 'spotlight_revealed'],
  )
})

Deno.test('bozuk ogeler dusurulur ve SAYILIR (sessiz yutma yok)', () => {
  const { fields, dropped } = spotlightProgressFields({
    spotlight_letters: ['S', 'st', 7, null, 'x'],
    spotlight_revealed: [{ pos: 0, ch: 'S' }, { pos: -1, ch: 'a' }, { pos: 1.5, ch: 't' }, { pos: 2, ch: 'and' }, 'x'],
  })
  assertEquals(fields.spotlight_letters, ['S'])
  assertEquals(fields.spotlight_revealed, [{ pos: 0, ch: 'S' }])
  assertEquals(dropped, 4 + 4)
})

Deno.test('alan yoksa ya da progress_json null ise bos diziler, 0 dusen', () => {
  for (const pj of [null, undefined, {}, { guesses: [] }]) {
    const { fields, dropped } = spotlightProgressFields(pj)
    assertEquals(fields, { spotlight_letters: [], spotlight_revealed: [] })
    assertEquals(dropped, 0)
  }
})
