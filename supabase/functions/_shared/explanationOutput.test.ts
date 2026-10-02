/**
 * explain-match — dil seçimi ve çıktı doğrulaması.
 *
 * Koşum:  (cd supabase/functions && deno test _shared/explanationOutput.test.ts)
 */

import { assertEquals } from 'jsr:@std/assert@1'

import { resolveLocale, sanitizeExplanations, validateExplanation } from './explanationOutput.ts'

Deno.test('locale opsiyonel: yalnız tr tanınır, gerisi en', () => {
  assertEquals(resolveLocale('tr'), 'tr')
  assertEquals(resolveLocale('en'), 'en')
  assertEquals(resolveLocale(undefined), 'en')
  assertEquals(resolveLocale('de'), 'en')
  assertEquals(resolveLocale(42), 'en')
})

Deno.test('meşru açıklamalar geçer (EN + TR)', () => {
  const ok = [
    "Your reflective mood pairs perfectly with this film's meditative pacing and themes of solitude.",
    'Düşünceli ruh haline, bu filmin sakin temposu ve yalnızlık temaları çok iyi eşlik ediyor.',
    'Eksiksiz kurulmuş bir gerilim; enerjin yüksekken tam aradığın tempo.',
    // Tek kelime kalıpları kaldırıldı — bunlar meşru düzyazı:
    'A slow-burn thriller you cannot look away from, matching your restless mood.',
    'Eksiksiz bir deneyim: düşünceli ruh haline uyan sakin, katmanlı bir anlatı.',
    'Like a missing piece of your evening, this film fills the quiet with warmth.',
  ]
  for (const text of ok) assertEquals(validateExplanation(text), text, text)
})

Deno.test('boş, kısa ve string olmayan atılır', () => {
  for (const raw of [undefined, null, 42, '', '   ', 'Great pick.']) {
    assertEquals(validateExplanation(raw), null, String(raw))
  }
})

Deno.test('reddetme / sistem dili atılır (EN + TR)', () => {
  const bad = [
    'Unable to generate explanation — film profile data is missing',
    'Açıklama üretilemiyor — film profil verisi eksik',
    'I cannot provide an explanation without the film details here.',
    'As an AI, I do not have enough information about this film.',
    "I'm sorry, but there is not enough detail to explain this match.",
    'Bu film için açıklama oluşturulamıyor, lütfen tekrar deneyin.',
    'Yapay zeka olarak bu film hakkında yorum yapamam, üzgünüm.',
    'PROFILE DATA IS MISSING FOR THIS FILM, SO NO EXPLANATION.',
    'AÇIKLAMA ÜRETİLEMİYOR ÇÜNKÜ FİLM BİLGİSİ YOK.',
    'Here is the explanation for filmId abc in the requested format.',
    'The JSON output below describes why this film fits your mood.',
  ]
  for (const text of bad) assertEquals(validateExplanation(text), null, text)
})

Deno.test('sanitize: istenen her film için değer ya da null; uydurma id atılır', () => {
  const parsed = {
    explanations: {
      a: 'Your restless energy meets this thriller’s relentless, twisting momentum.',
      b: 'Unable to generate explanation — film profile data is missing.',
      ghost: 'This id was never requested but the model invented it anyway.',
    },
  }
  const { explanations, rejected } = sanitizeExplanations(parsed, ['a', 'b', 'c'])
  assertEquals(explanations, {
    a: parsed.explanations.a,
    b: null,
    c: null,
  })
  assertEquals(rejected, 2)
})

Deno.test('sanitize: explanations alanı yoksa hepsi null', () => {
  assertEquals(sanitizeExplanations({ foo: 1 }, ['a']).explanations, { a: null })
  assertEquals(sanitizeExplanations(null, ['a']).explanations, { a: null })
})
