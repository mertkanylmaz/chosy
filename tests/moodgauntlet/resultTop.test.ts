/**
 * Result-1: sonuç ekranı üst bölümü sözleşmeleri.
 * Run: npm run test:mood-gauntlet
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { buildMetaLine } from '../../utils/moodFilmFacts.ts'

Deno.test('buildMetaLine: yıl · süre, eksik alanda ayraç boşta kalmaz', () => {
  assertEquals(buildMetaLine(2019, 121), '2019 · 2h 1m')
  assertEquals(buildMetaLine(2019, null), '2019')
  assertEquals(buildMetaLine(null, 95), '1h 35m')
  assertEquals(buildMetaLine(0, 0), null)
  assertEquals(buildMetaLine(undefined, undefined), null)
  assertEquals(buildMetaLine(NaN, -5), null)
})

import { assert, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')
const stage = read('components/MoodGauntlet/ResultStage.tsx')

Deno.test('gerekçe başlığı: yalnız gerekçe varken / yüklenirken, 600 ms grubunda, overview yedeği yok', () => {
  assertMatch(stage, /const showWhy = reason !== null \|\| reasonsLoading/)
  assertMatch(stage, /\{showWhy && \(\s*<View style=\{styles\.resultWhy\}>\s*<Text style=\{styles\.resultWhyTitle\}/)
  // başlık tek kez, yalnız showWhy içinde; insight (b) başlığın altında değil
  assertEquals((stage.match(/resultWhyTitle'\)/g) ?? []).length, 1)
  const details = stage.indexOf('<Animated.View style={detailsStyle}>')
  const why = stage.indexOf('styles.resultWhyTitle')
  const insight = stage.indexOf('styles.insight')
  assert(details >= 0 && details < why && why < insight, 'başlık detailsStyle içinde, insight başlıktan sonra')
  assert(stage.indexOf('styles.resultChips') < insight, 'insight çiplerin altında')
  assert(!/descriptionFor|overview/.test(stage), 'overview yedeği eklenmez')
})

Deno.test('Winner Reveal kademe bağları korunur', () => {
  assertMatch(stage, /titleOpacity\.value = withDelay\(delays\.title/)
  assertMatch(stage, /metaOpacity\.value = withDelay\(delays\.meta/)
  assertMatch(stage, /detailsOpacity\.value = withDelay\(delays\.details/)
  assertMatch(stage, /posterOpacity\.value = withTiming\(1, fade\)/)
  assertMatch(stage, /posterScale\.value = 1\.04/)
  assertMatch(stage, /styles\.resultTitle, titleStyle\]\} numberOfLines=\{3\}/)
})

Deno.test('i18n: resultWhyTitle en+tr', () => {
  const en = JSON.parse(read('locales/en.json'))
  const tr = JSON.parse(read('locales/tr.json'))
  assertEquals(en.moodGauntlet.resultWhyTitle, 'Why this fits tonight')
  assertEquals(tr.moodGauntlet.resultWhyTitle, 'Bu akşama neden uygun')
})

import { buildKickerLine } from '../../utils/moodFilmFacts.ts'

Deno.test('buildKickerLine: mood varsa "KICKER · mood", boşsa yalnız kicker', () => {
  assertEquals(buildKickerLine('YOUR PICK', 'Rainy Day'), 'YOUR PICK · Rainy Day')
  assertEquals(buildKickerLine('YOUR PICK', '  Rainy Day '), 'YOUR PICK · Rainy Day')
  assertEquals(buildKickerLine('YOUR PICK', ''), 'YOUR PICK')
  assertEquals(buildKickerLine('YOUR PICK', '   '), 'YOUR PICK')
  assertEquals(buildKickerLine('YOUR PICK', null), 'YOUR PICK')
  assertEquals(buildKickerLine('SENİN SEÇİMİN', undefined), 'SENİN SEÇİMİN')
})

Deno.test('üst satır tek satır; poster gerçek 2:3 sabit yükseklik; hiyerarşi sırası', () => {
  assertMatch(stage, /<Text style=\{styles\.kicker\} numberOfLines=\{1\} ellipsizeMode="tail"/)
  assert(!/styles\.resultMood/.test(stage), 'ayrı mood başlığı kalktı')
  const st = read('components/MoodGauntlet/styles.ts')
  assertMatch(st, /const RESULT_POSTER_HEIGHT = 280/)
  assertMatch(st, /hero: \{ height: RESULT_POSTER_HEIGHT, aspectRatio: 2 \/ 3,/)
  assert(!/hero: \{[^}]*maxHeight/.test(st), 'maxHeight kırpması kalktı')
  const order = ['styles.kicker', 'styles.hero', 'styles.resultTitle', 'styles.resultMeta', 'styles.resultWhyTitle', 'styles.resultChips', 'styles.insight', '<WatchOptionsCard']
    .map((s) => stage.indexOf(s))
  assert(order.every((i) => i >= 0))
  assertEquals(order, [...order].sort((a, b) => a - b))
  const en = JSON.parse(read('locales/en.json'))
  const tr = JSON.parse(read('locales/tr.json'))
  assertEquals(en.moodGauntlet.resultKicker, 'YOUR PICK')
  assertEquals(tr.moodGauntlet.resultKicker, 'SENİN SEÇİMİN')
})
