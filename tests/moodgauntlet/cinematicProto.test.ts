/**
 * PROTOTİP — Cinematic Discovery Loading (proto/cinematic-loading). Kaynak sözleşmesi + saf
 * geometri. Animasyonun görünümü ve FPS cihazda ölçülür; burada yalnız koddan ispatlanabilenler:
 * prod kilidi, production akışına bağlanmama, sahte ilerleme yokluğu, ≤ 600 ms çıkış bütçesi,
 * şeritteki pozun matematiği.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertAlmostEquals, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  angleAt,
  gridSlots,
  pointAt,
  STRIP_T,
  stripCurve,
  stripMetrics,
  stripPose,
} from '../../components/MoodGauntlet/proto/CinematicLoading/geometry.ts'
import { isProtoAccessible } from '../../utils/protoAccessDecision.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const PROTO_DIR = 'components/MoodGauntlet/proto'
const ROUTE = 'app/dev-cinematic-loading.tsx'

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of Deno.readDirSync(new URL(`../../${dir}`, import.meta.url))) {
    const p = `${dir}/${e.name}`
    if (e.isDirectory) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}

Deno.test('erisim karari: production kanalinda kapali, yalniz __DEV__ ya da preview acik', () => {
  assertEquals(isProtoAccessible(false, 'production'), false)
  assertEquals(isProtoAccessible(false, null), false)
  assertEquals(isProtoAccessible(false, undefined), false)
  assertEquals(isProtoAccessible(false, ''), false)
  assertEquals(isProtoAccessible(false, 'Preview'), false)
  assertEquals(isProtoAccessible(false, 'development'), false)
  assertEquals(isProtoAccessible(false, 'preview'), true)
  assertEquals(isProtoAccessible(true, 'production'), true)
  assertEquals(isProtoAccessible(true, null), true)
  // Uygulama getter'i kanali calisma zamaninda okur ve bu saf karari kullanir (modul seviyesi sabit yok).
  const acc = strip(read('utils/protoAccess.ts'))
  assert(/import \{ isProtoAccessible \} from '@\/utils\/protoAccessDecision';/.test(acc))
  assert(/return isProtoAccessible\(__DEV__, Updates\.channel\);/.test(acc))
  assert(!/^(export )?const /m.test(acc), 'modul seviyesi sabit YOK')
})

Deno.test('rota: prod kilidi — erisim yoksa Redirect, laboratuvar yalniz erisim dalinda require edilir', () => {
  const src = strip(read(ROUTE))
  assert(/import \{ canAccessProto \} from '@\/utils\/protoAccess';/.test(src))
  assert(/const Lab = canAccessProto\(\)\s*\?\s*\(require\('@\/components\/MoodGauntlet\/proto\/CinematicLoadingLab'\)/.test(src))
  assert(/if \(Lab === null\) return <Redirect href="\/" \/>/.test(src))
  assert(!/^import .*proto\//m.test(src), 'statik import YOK (production kanalinda degerlendirilmez)')
})

Deno.test('production akisi prototipe baglanmaz: proto/ yalniz rota + proto klasoru icinden referanslanir', () => {
  const offenders: string[] = []
  for (const root of ['app', 'components', 'services', 'hooks', 'contexts', 'utils']) {
    for (const f of walk(root)) {
      if (f === ROUTE || f.startsWith(`${PROTO_DIR}/`)) continue
      if (/MoodGauntlet\/proto\//.test(read(f))) offenders.push(f)
    }
  }
  assertEquals(offenders, [])
  // Profil girisi yalniz canAccessProto() blogu icinde rota adini iter, modulu import etmez.
  const profile = read('app/(tabs)/profile.tsx')
  const i = profile.indexOf("'/dev-cinematic-loading'")
  assert(i > 0)
  assertEquals(profile.indexOf("'/dev-cinematic-loading'", i + 1), -1, 'tek giris noktasi')
  const gate = profile.lastIndexOf('{canAccessProto() && (', i)
  assert(gate > 0 && i - gate < 600, 'giris canAccessProto() blogunun icinde')
  assert(!profile.slice(gate, i).includes(')}'), 'giris ile kapi arasinda blok kapanmaz')
})

Deno.test('sahte ilerleme yok: sahnede gorunur metin yalniz Your four basligi; yuzde / asama metni yok', () => {
  for (const f of walk(`${PROTO_DIR}/CinematicLoading`)) {
    const src = strip(read(f))
    // Gorunur metin yalniz asagidaki anahtar listesinden gelir; ayrica ilerleme durumu tutulmaz.
    assert(!/\bprogress\b|percent/i.test(src), `${f}: ilerleme gostergesi`)
    assert(!/<Text[^>]*>\s*[^<{\s]/.test(src), `${f}: t() disi sabit metin`)
    const keys = [...src.matchAll(/\bt\('([^']+)'\)/g)].map((m) => m[1])
    for (const k of keys) {
      assert(
        ['moodGauntlet.yourFour', 'moodGauntlet.fourIntroTitle', 'moodGauntlet.fourIntroCta', 'moodGauntlet.yourFourA11y', 'moodGauntlet.loadingAnother', 'moodGauntlet.loadingFinding'].includes(k),
        `${f}: beklenmeyen metin anahtari ${k}`,
      )
    }
  }
  for (const lang of ['en', 'tr']) {
    const j = JSON.parse(read(`locales/${lang}.json`))
    const text = JSON.stringify(j.devProto).toLowerCase()
    for (const banned of ['discovering', 'almost ready', 'keşfed', 'neredeyse hazır']) {
      assert(!text.includes(banned), `${lang}: storyboard altyazisi UI'a girmez (${banned})`)
    }
  }
})

Deno.test('sure tokenlari: sahnede sayisal duration/delay yok; cikis butcesi <= 600 ms', () => {
  for (const f of walk(`${PROTO_DIR}/CinematicLoading`)) {
    const src = strip(read(f))
    assert(!/duration:\s*\d/.test(src), `${f}: sabit duration`)
    assert(!/\.(delay|duration)\(\d/.test(src), `${f}: sabit layout animasyonu suresi`)
    assert(!/withDelay\(\s*\d/.test(src), `${f}: sabit gecikme`)
  }
  const motion = read('constants/design/motion.ts')
  const block = motion.slice(motion.indexOf('export const CINEMATIC_PROTO_MOTION'))
  const num = (k: string) => Number(new RegExp(`${k}: (\\d+)`).exec(block)?.[1])
  const stage = Number(/stageTransition: (\d+)/.exec(motion)?.[1])
  assertEquals(stage, 300)
  assert(/exitFrames: MOOD_MOTION\.stageTransition/.test(block))
  const lastPosterEnd = num('exitPosterDelay') + 3 * num('exitPosterStagger') + stage
  const chromeEnd = num('exitChromeDelay') + stage
  assert(lastPosterEnd <= 600, `son poster ${lastPosterEnd} ms`)
  assert(chromeEnd <= 600, `baslik/CTA ${chromeEnd} ms`)
  assert(stage <= 600)
})

Deno.test('Reduce Motion: sahne kendi suresini yonetir (ReduceMotion.Never) ve capraz gecis tokenini kullanir', () => {
  const scene = strip(read(`${PROTO_DIR}/CinematicLoading/index.tsx`))
  const frame = strip(read(`${PROTO_DIR}/CinematicLoading/FrameGrid.tsx`))
  for (const src of [scene, frame]) {
    assert(/const RM = ReduceMotion\.Never/.test(src))
    assert(/REDUCED_MOTION_DURATION\.crossFade/.test(src))
  }
  // Statik sahne: Reduce Motion'da donguler baslatilmaz.
  assert(/if \(reduced\) \{\s*stopLoops\(\);/.test(scene))
})

Deno.test('poster hatasi: mevcut PosterTile kullanilir (retry/placeholder aynen), bulanik kat hata verirse kalkar', () => {
  const frame = strip(read(`${PROTO_DIR}/CinematicLoading/FrameGrid.tsx`))
  assert(/<PosterTile film=\{film\} interactive=\{false\} metaMode="yearOnly" \/>/.test(frame))
  assert(/onError=\{\(\) => \{\s*o\.value = 0;\s*onError\(\);/.test(frame))
})

Deno.test('analitik sozlesmesi degismez: prototip olay gondermez', () => {
  for (const f of walk(PROTO_DIR)) {
    const src = read(f)
    assert(!/moodGauntletAnalytics|posthog|trackEvent|capture\(/i.test(src), `${f}: analitik`)
  }
})

// ── Saf geometri ──

const BOX = { x: 16, y: 80, w: 343, h: 460 }
const CELL = 140
const GAP = 12
const META = 70

Deno.test('gridSlots: 2x2, kutuda ortali, sabit tile yuksekligi', () => {
  const s = gridSlots(BOX, CELL, GAP, META)
  assertEquals(s.length, 4)
  assertEquals(s[1].x - s[0].x, CELL + GAP)
  assertEquals(s[2].y - s[0].y, CELL * 1.5 + META + GAP)
  const left = s[0].x - BOX.x
  const right = BOX.x + BOX.w - (s[1].x + CELL)
  assertAlmostEquals(left, right, 1e-9)
  const top = s[0].y - BOX.y
  const bottom = BOX.y + BOX.h - (s[2].y + s[2].tileH)
  assertAlmostEquals(top, bottom, 1e-9)
  assertEquals(gridSlots(BOX, 0, GAP, META), [])
})

Deno.test('stripPose: poster alaninin merkezi serit noktasina oturur (RN transform sirasi)', () => {
  const slots = gridSlots(BOX, CELL, GAP, META)
  const curve = stripCurve(375, 300, 30)
  STRIP_T.forEach((t, i) => {
    const slot = slots[i]
    const target = pointAt(curve, t)
    const deg = angleAt(curve, t)
    const scale = 0.42
    const pose = stripPose(slot, target, deg, scale)
    // Ileri hesap: merkez + translate, sonra merkez etrafinda rotate·scale uygulanmis poster merkezi.
    const cx = slot.x + slot.w / 2 + pose.tx
    const cy = slot.y + slot.tileH / 2 + pose.ty
    const dy0 = slot.posterH / 2 - slot.tileH / 2
    const rad = (deg * Math.PI) / 180
    const px = cx + -Math.sin(rad) * dy0 * scale
    const py = cy + Math.cos(rad) * dy0 * scale
    assertAlmostEquals(px, target.x, 1e-6)
    assertAlmostEquals(py, target.y, 1e-6)
  })
})

Deno.test('stripMetrics: serit = kucuk poster + iki perforasyon bandi; delikler bandin icinde', () => {
  const m = stripMetrics(210, 0.42, 8)
  assertAlmostEquals(m.width, 210 * 0.42 + m.perfBand * 2, 1e-9)
  assert(m.holeW < m.perfBand)
  assert(m.perfOffset + m.holeW / 2 <= m.width / 2)
})
