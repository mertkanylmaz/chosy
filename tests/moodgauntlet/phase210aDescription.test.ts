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
