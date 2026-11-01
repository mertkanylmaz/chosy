/**
 * Faz 2-4d: fragman seçimi + düğme gizleme + olay gizliliği.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { assertNoFreeText, trailerClickedEvent } from '../../utils/moodGauntletAnalytics.ts'
import { pickTrailerKey, trailerUrl, type TrailerCandidate } from '../../utils/trailerPick.ts'

const v = (o: Partial<TrailerCandidate> & { key: string }): TrailerCandidate => ({
  site: 'YouTube', type: 'Trailer', official: true, iso_639_1: 'en', published_at: '2020-01-01T00:00:00.000Z', ...o,
})
const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

Deno.test('official önce gelir (resmi olmayan daha yeni olsa da)', () => {
  assertEquals(pickTrailerKey([v({ key: 'fan', official: false, published_at: '2024-01-01T00:00:00Z' }), v({ key: 'off' })], 'en'), 'off')
})

Deno.test('dil: tr uygulama dilinde tr video önde, yoksa en yedeği', () => {
  const vids = [v({ key: 'en1' }), v({ key: 'tr1', iso_639_1: 'tr' })]
  assertEquals(pickTrailerKey(vids, 'tr'), 'tr1')
  assertEquals(pickTrailerKey([v({ key: 'en1' }), v({ key: 'de1', iso_639_1: 'de' })], 'tr'), 'en1')
  assertEquals(pickTrailerKey(vids, 'en'), 'en1')
})

Deno.test('aynı sınıfta en yeni published_at kazanır', () => {
  assertEquals(pickTrailerKey([v({ key: 'old' }), v({ key: 'new', published_at: '2023-05-05T00:00:00Z' })], 'en'), 'new')
})

Deno.test('Trailer yoksa Teaser; ikisi de yoksa / YouTube değilse null', () => {
  assertEquals(pickTrailerKey([v({ key: 'tz', type: 'Teaser' }), v({ key: 'clip', type: 'Clip' })], 'en'), 'tz')
  assertEquals(pickTrailerKey([v({ key: 'tr', type: 'Trailer', official: false }), v({ key: 'tz', type: 'Teaser' })], 'en'), 'tr')
  assertEquals(pickTrailerKey([v({ key: 'clip', type: 'Clip' }), v({ key: 'vim', site: 'Vimeo' })], 'en'), null)
  assertEquals(pickTrailerKey([], 'tr'), null)
})

Deno.test('trailerUrl YouTube watch adresi', () => {
  assertEquals(trailerUrl('abc'), 'https://www.youtube.com/watch?v=abc')
})

Deno.test('trailer_clicked: sabit prop seti, film_id UUID geçer, başlık/serbest metin atar', () => {
  const ok = trailerClickedEvent({ filmId: '123e4567-e89b-12d3-a456-426614174000', setIndex: 2, hasProviderCta: false, lang: 'tr' })
  assertNoFreeText(ok)
  assertEquals(ok.props.surface, 'mood_result')
  assertThrows(() => assertNoFreeText({ name: 'trailer_clicked', props: { film_id: 'Perfect Days' } }))
})

Deno.test('düğme gizleme: anahtar null iken Trailer düğmesi çizilmez; ana CTA altın kalır', () => {
  const src = read('components/MoodGauntlet/ResultStage.tsx')
  assert(/\{trailerKey !== null && \(\s*<View style=\{styles\.actionRow\}>\s*<OutlineAction\s+label=\{t\('moodGauntlet\.trailer'\)\}/.test(src))
  assert(src.includes('variant="gold"'))
  assert(read('components/MoodGauntlet/useTrailer.ts').includes('useState<string | null>(memo.get(k) ?? null)'))
})
