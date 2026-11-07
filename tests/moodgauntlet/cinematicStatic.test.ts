/**
 * PROTOTİP — sinematik yükleme STATİK onay kapısı (07.11.2026). Koddan ispatlanabilenler:
 * sahneler hareketsiz, asgari hücre koruması (96 pt) görünür uyarıyla, panel sahne ölçümüne
 * girmez, metin anahtarları onaylı listeden, saf ışık/şerit geometrisi.
 * Görünüm cihazda (preview) değerlendirilir.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  beamTowards,
  beamWedge,
  cubicPoint,
  dustMotes,
  guardCell,
  MIN_CELL,
  ribbon,
  sceneLayout,
  type Cubic,
} from '../../components/MoodGauntlet/proto/CinematicStatic/geometry.ts'
import { gridSlots } from '../../components/MoodGauntlet/proto/CinematicLoading/geometry.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const STATIC_DIR = 'components/MoodGauntlet/proto/CinematicStatic'
const STATIC_FILES = ['geometry.ts', 'Backdrop.tsx', 'index.tsx', 'styles.ts'].map((f) => `${STATIC_DIR}/${f}`)
const LAB = 'components/MoodGauntlet/proto/CinematicLoadingLab.tsx'

Deno.test('asgari hucre: 96 pt; altinda ok=false (cizilmez), hucre kuculterek gizlenmez', () => {
  assertEquals(MIN_CELL, 96)
  assertEquals(guardCell(95), { cell: 95, ok: false })
  assertEquals(guardCell(96), { cell: 96, ok: true })
  assertEquals(guardCell(25), { cell: 25, ok: false }) // 917 kaydindaki panel-acik durum
  assertEquals(guardCell(0).ok, false)
  const scene = strip(read(`${STATIC_DIR}/index.tsx`))
  assert(/guard\.ok \? gridSlots\(/.test(scene), 'izgara yalniz guard.ok iken kurulur')
  assert(/!guard\.ok && \(/.test(scene), 'koruma devreye girince gorunur uyari')
  assert(/t\('devProto\.cinematic\.cellGuard', \{ cell: guard\.cell, min: MIN_CELL \}\)/.test(scene))
})

Deno.test('hareketsiz: statik sahnede Reanimated, zamanlayici, dongu yok', () => {
  for (const f of STATIC_FILES) {
    const src = strip(read(f))
    assert(!/react-native-reanimated/.test(src), `${f}: Reanimated`)
    assert(!/\b(setTimeout|setInterval|requestAnimationFrame|withTiming|withRepeat|withDelay|Animated\.)/.test(src), `${f}: hareket`)
    assert(!/\bprogress\b|percent/i.test(src), `${f}: ilerleme gostergesi`)
  }
})

Deno.test('metin: yalniz onayli anahtarlar; t() disi sabit metin yok', () => {
  const allowed = [
    'devProto.cinematic.findingYourFour',
    'devProto.cinematic.cellGuard',
    'moodGauntlet.yourFour',
    'moodGauntlet.fourIntroTitle',
    'moodGauntlet.fourIntroCta',
    'moodGauntlet.yourFourA11y',
    'moodGauntlet.loadingFinding',
  ]
  for (const f of STATIC_FILES) {
    const src = strip(read(f))
    assert(!/<Text[^>]*>\s*[^<{\s]/.test(src), `${f}: t() disi sabit metin`)
    for (const m of src.matchAll(/\bt\('([^']+)'/g)) assert(allowed.includes(m[1]), `${f}: beklenmeyen anahtar ${m[1]}`)
  }
})

Deno.test('kapsam: statik sahne FourIntro/StatusStage icini degistirmez, yalniz fourCellWidth + stilleri okur', () => {
  const scene = read(`${STATIC_DIR}/index.tsx`)
  assert(/import \{ fourCellWidth \} from '@\/components\/MoodGauntlet\/FourIntro';/.test(scene))
  assert(!/StatusStage/.test(scene))
  assert(/<PosterTile film=\{films\[i\]\} interactive=\{false\} metaMode="yearOnly" \/>/.test(scene), 'poster hata yolu aynen PosterTile')
  const four = strip(read('components/MoodGauntlet/FourIntro.tsx'))
  assert(/const byHeight = \(\(boxH - space\.md\) \/ 2 - POSTER_META_BLOCK_HEIGHT\) \* \(2 \/ 3\);/.test(four), 'fourCellWidth degismedi')
})

Deno.test('lab: panel varsayilan gizli, sahnenin ustunde yuzer (mutlak) — olcume girmez; varsayilan sahne (a)', () => {
  const src = strip(read(LAB))
  assert(/const \[panelOpen, setPanelOpen\] = useState\(false\);/.test(src))
  assert(/const \[scene, setScene\] = useState<Scene>\('waiting'\);/.test(src))
  const panel = /\n  panel: \{([\s\S]*?)\n  \},/.exec(src)?.[1] ?? ''
  assert(/position: 'absolute'/.test(panel), 'panel mutlak konumlu')
  const toggle = /\n  toggle: \{([\s\S]*?)\n  \},/.exec(src)?.[1] ?? ''
  assert(/position: 'absolute'/.test(toggle), 'aç/kapa mutlak konumlu')
  // Sahne, panelden ONCE ve kardes olarak cizilir; panel acikken sahne kutusu degismez.
  assert(src.indexOf('<StaticScene') < src.indexOf('{panelOpen && ('))
})

Deno.test('i18n: devProto.cinematic en = tr; TR "Dortlunu buluyoruz"', () => {
  const en = JSON.parse(read('locales/en.json')).devProto.cinematic
  const tr = JSON.parse(read('locales/tr.json')).devProto.cinematic
  assertEquals(Object.keys(en).sort(), Object.keys(tr).sort())
  assertEquals(en.findingYourFour, 'Finding your four')
  assertEquals(tr.findingYourFour, 'Dörtlünü buluyoruz')
  assert(en.cellGuard.includes('%{cell}') && en.cellGuard.includes('%{min}'))
  assert(tr.cellGuard.includes('%{cell}') && tr.cellGuard.includes('%{min}'))
})

// ── Saf geometri ──

Deno.test('sceneLayout: dort cerceve yoksa null; bekleme = 2 serit, final = serit yok', () => {
  const slots = gridSlots({ x: 16, y: 155, w: 361, h: 607 }, 150, 12, 72)
  assertEquals(sceneLayout(393, 852, [], true), null)
  assertEquals(sceneLayout(0, 852, slots, true), null)
  assertEquals(sceneLayout(393, 852, slots, true)?.ribbons.length, 2)
  assertEquals(sceneLayout(393, 852, slots, false)?.ribbons.length, 0)
})

Deno.test('ribbon: delik ve pencere koseleri serit genisliginin icinde', () => {
  const c: Cubic = { p0: { x: -40, y: 300 }, p1: { x: 120, y: 220 }, p2: { x: 260, y: 360 }, p3: { x: 430, y: 280 } }
  const w0 = 20
  const w1 = 44
  const r = ribbon(c, w0, w1)
  assert(r.holes.length > 20 && r.windows.length > 3)
  assert(r.outline.startsWith('M ') && r.outline.endsWith(' Z'))
  const samples = Array.from({ length: 401 }, (_, i) => cubicPoint(c, i / 400))
  const nearest = (x: number, y: number) => Math.min(...samples.map((p) => Math.hypot(p.x - x, p.y - y)))
  for (const poly of [...r.holes, ...r.windows]) {
    for (const pair of poly.split(' ')) {
      const [x, y] = pair.split(',').map(Number)
      assert(nearest(x, y) <= w1 / 2 + 0.5, `kose seridin disinda: ${pair}`)
    }
  }
})

Deno.test('toz: deterministik ve huzme kamasinin icinde', () => {
  const b = beamTowards({ x: -30, y: 600 }, { x: 370, y: 200 }, 700)
  const a = dustMotes(b, 16, 42, 7112026)
  assertEquals(a, dustMotes(b, 16, 42, 7112026))
  assertEquals(a.length, 42)
  for (const m of a) {
    const ang = Math.atan2(m.y - b.apex.y, m.x - b.apex.x) - b.dir
    assert(Math.abs(ang) <= (16 * Math.PI) / 180 + 1e-9)
    assert(m.o > 0 && m.o <= 1 && m.r > 0)
  }
  assertEquals(beamWedge(b, 10, 4).length, 4)
})
