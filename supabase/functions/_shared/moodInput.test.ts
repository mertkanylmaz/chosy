/**
 * Unit tests — parse-mood girdi doğrulaması (MONEY-1C).
 * Run: cd supabase/functions && deno test _shared/moodInput.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { MAX_INPUT_CHARS, validateRawInput } from './moodInput.ts'

Deno.test('normal cümle → olduğu gibi döner', () => {
  assertEquals(validateRawInput('I had a bad day'), 'I had a bad day')
})

Deno.test('Türkçe girdi → geçerli', () => {
  assertEquals(validateRawInput('ayrılık acısı'), 'ayrılık acısı')
})

Deno.test('emoji tek başına → geçerli (içerik yargılanmaz)', () => {
  assertEquals(validateRawInput('😭😭'), '😭😭')
})

Deno.test('boş string → null', () => {
  assertEquals(validateRawInput(''), null)
})

Deno.test('yalnız boşluk → null', () => {
  assertEquals(validateRawInput('   \n\t '), null)
})

Deno.test('tek karakter → null', () => {
  assertEquals(validateRawInput('a'), null)
  assertEquals(validateRawInput('  a  '), null)
})

Deno.test('iki karakter → geçerli (alt sınır)', () => {
  assertEquals(validateRawInput('ab'), 'ab')
})

Deno.test('tam 500 karakter → geçerli, 501 → null', () => {
  assertEquals(validateRawInput('x'.repeat(MAX_INPUT_CHARS)), 'x'.repeat(MAX_INPUT_CHARS))
  assertEquals(validateRawInput('x'.repeat(MAX_INPUT_CHARS + 1)), null)
})

Deno.test('string olmayan → null', () => {
  assertEquals(validateRawInput(undefined), null)
  assertEquals(validateRawInput(null), null)
  assertEquals(validateRawInput(42), null)
  assertEquals(validateRawInput({ raw_input: 'x' }), null)
  assertEquals(validateRawInput(['a', 'b']), null)
})
