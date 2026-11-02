/**
 * Faz 2-10a: kart açıklaması. Gerekçe (LLM) sunucu korumalarıyla boşalabilir; boş alan yerine filmin
 * kendi `overview` metni gösterilir. Uydurma metin yok. Görsel doğrulama cihazdadır.
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { countDescriptionSources, descriptionFor } from '../../services/moodGauntlet.ts'

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

// ── Faz 2-12a: metadata tutarlılığı. Fixture'lar canlı film_profiles satırlarından (2 Kas 2026) ────
import { buildChips, parseDims } from '../../utils/moodFilmFacts.ts'

const MOONLIGHT = { energy_level: 0.25, pace_preference: 'slow', thematic_depth: 0.9, emotional_state: { sadness: 0.75, joy: 0.35 } }
const SANDLOT = { energy_level: 0.8, pace_preference: 'fast', thematic_depth: 0.65, emotional_state: { joy: 0.85, sadness: 0.35 } }
const MASTER = { energy_level: 0.6, pace_preference: 'slow', thematic_depth: 0.85, emotional_state: { sadness: 0.7, anger: 0.75 } }
const MASTER_OVERVIEW =
  'Freddie, a volatile, heavy-drinking veteran who suffers from post-traumatic stress disorder, finds some semblance of a family when he stumbles onto the ship of Lancaster Dodd, the charismatic leader of a new "religion" he forms after World War II.'

Deno.test('Faz 2-12a: cip enerji eksenidir, duygusal agirlik (sadness / thematic_depth) cipi etkilemez', () => {
  // Moonlight: duygusal olarak agir ama dusuk enerji -> bant 'gentle' (etiket artik "Low energy")
  assertEquals(buildChips(parseDims(MOONLIGHT), 112), { pace: 'slow', energy: 'gentle', runtime: '1h 52m' })
  // Sandlot: yuksek enerji + hizli tempo -> 'intense' bandi (etiket artik "High energy"), tutarli veri gizlenmez
  assertEquals(buildChips(parseDims(SANDLOT), 101), { pace: 'fast', energy: 'intense', runtime: '1h 41m' })
  assertEquals(buildChips(parseDims(MASTER), 137), { pace: 'slow', energy: 'moderate', runtime: '2h 17m' })
  // Duygusal alanlar degisse cip degismez (tek kaynak energy_level)
  const flipped = { ...MOONLIGHT, thematic_depth: 0.1, emotional_state: { sadness: 0.0, joy: 1.0 } }
  assertEquals(buildChips(parseDims(flipped), 112), buildChips(parseDims(MOONLIGHT), 112))
})

Deno.test('Faz 2-12a: enerji cip etiketleri "enerji" der; duygusal ton iddiasi (Gentle / Intense / Sakin / Yogun) yok', () => {
  const en = JSON.parse(read('locales/en.json')).moodGauntlet.chipEnergy
  const tr = JSON.parse(read('locales/tr.json')).moodGauntlet.chipEnergy
  assertEquals(en, { gentle: 'Low energy', moderate: 'Mid energy', intense: 'High energy' })
  assertEquals(tr, { gentle: 'Düşük enerji', moderate: 'Orta enerji', intense: 'Yüksek enerji' })
  for (const v of [...Object.values(en), ...Object.values(tr)] as string[]) {
    assertMatch(v.toLowerCase(), /energ|enerji/)
    assert(!/gentle|intense|^sakin$|^yoğun$/i.test(v), v)
  }
  // kaynak sozlesmesi belgeli
  assertMatch(read('utils/moodFilmFacts.ts'), /`energy_level` DUYGUSAL yoğunluk değil/)
})

Deno.test('Faz 2-12a: The Master (2012) kartinda aciklama bos kalmaz (gercek overview, gerekce yok / var)', () => {
  const four = [{ id: 'm', overview: MASTER_OVERVIEW }]
  assertEquals(descriptionFor({}, 'm', MASTER_OVERVIEW), MASTER_OVERVIEW)
  assertEquals(countDescriptionSources(four, {}), { fallback: 1, empty: 0 })
  assertEquals(descriptionFor({ m: 'Sakin bir akşam için.' }, 'm', MASTER_OVERVIEW), 'Sakin bir akşam için.')
})
