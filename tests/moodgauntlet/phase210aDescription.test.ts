/**
 * Faz 2-10a: kart açıklaması. Gerekçe (LLM) sunucu korumalarıyla boşalabilir; boş alan yerine filmin
 * kendi `overview` metni gösterilir. Uydurma metin yok. Görsel doğrulama cihazdadır.
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { descriptionFor } from '../../services/moodGauntlet.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

Deno.test('descriptionFor: gerekce varsa gerekce, yoksa overview, ikisi de yoksa null', () => {
  assertEquals(descriptionFor({ a: ' Sakin. ' }, 'a', 'Ozet'), 'Sakin.')
  assertEquals(descriptionFor({ a: '' }, 'a', ' Ozet '), 'Ozet')
  assertEquals(descriptionFor({}, 'a', 'Ozet'), 'Ozet')
  assertEquals(descriptionFor(undefined, 'a', null), null)
  assertEquals(descriptionFor({}, 'a', '   '), null)
})

Deno.test('gauntlet: yuklenirken iskelet (ozet gosterilmez), tur metni acik, Sen sec 1. turda kalir', () => {
  const g = read('components/MoodGauntlet/GauntletStage.tsx')
  assertMatch(g, /reasonsLoading\s*\?\s*reasonFor\(reasons, id\)\s*:\s*descriptionFor\(/)
  assertMatch(g, /t\('moodGauntlet\.roundOf', \{ current: pair\.round, total: 3 \}\)/)
  assertMatch(g, /isFirstRound && \(\s*<OutlineAction label=\{t\('moodGauntlet\.justPick'\)\}/)
  const en = JSON.parse(read('locales/en.json'))
  const tr = JSON.parse(read('locales/tr.json'))
  assertEquals(en.moodGauntlet.roundOf, 'Round %{current} of %{total}')
  assert(typeof tr.moodGauntlet.roundOf === 'string')
})

Deno.test('Faz 2-11a: mood_four_desc_resolved - yalniz iki sayi, 0-4 sinirli, hook gerekce sonrasi atar, G6 belgeli', async () => {
  const { descResolvedEvent } = await import('../../utils/moodGauntletAnalytics.ts')
  const { countDescriptionSources } = await import('../../services/moodGauntlet.ts')
  assertEquals(descResolvedEvent(1, 0), { name: 'mood_four_desc_resolved', props: { desc_fallback: 1, desc_empty: 0 } })
  assertEquals(descResolvedEvent(9, -2).props, { desc_fallback: 4, desc_empty: 0 })
  const four = [
    { id: 'a', overview: 'x' }, // gerekce var
    { id: 'b', overview: 'ozet' }, // yedek
    { id: 'c', overview: '  ' }, // bos
    { id: 'd', overview: null }, // bos
  ]
  assertEquals(countDescriptionSources(four, { a: 'g' }), { fallback: 1, empty: 2 })
  assertEquals(countDescriptionSources(four, {}), { fallback: 2, empty: 2 })
  const hook = read('components/MoodGauntlet/useMoodGauntlet.ts')
  assertMatch(hook, /setReasonsLoading\(false\);\s*const src = countDescriptionSources\(nextSet\.four, r\);\s*trackMoodEvent\(descResolvedEvent\(src\.fallback, src\.empty\)\);/)
  assertMatch(read('docs/analytics/G6_CEKIRDEK_EVENTLER.md'), /`mood_four_desc_resolved` \(`desc_fallback`/)
})
