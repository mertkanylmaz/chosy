/**
 * Unit tests — FilmSearchInput sonuc listesi acik/kapali durumu (P-3).
 *
 * Bu testler `listState.ts` reducer'ini olay DIZILERIYLE dogrular; RN dokunma
 * sistemini calistirmaz. "Satir cizili kaldikca onPress tetiklenebilir" varsayimi
 * RN'in davranisidir — cihaz dogrulamasi TestFlight N13'te.
 *
 * Run: npm run test:film-search
 */

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  INITIAL_SEARCH_LIST,
  isTriedFilm,
  reduceSearchList,
  type SearchListEvent,
  type SearchListState,
} from '../../components/games/FilmSearchInput/listState.ts'
import { createSearchGate } from '../../components/games/FilmSearchInput/searchGate.ts'

function run(events: SearchListEvent[], listControls: boolean): SearchListState {
  return events.reduce((s, e) => reduceSearchList(s, e, listControls), INITIAL_SEARCH_LIST)
}

/** Kullanici yazdi, input odakta, 3 sonuc geldi — klavye acik */
const OPEN_WITH_KEYBOARD: SearchListEvent[] = [
  { type: 'focus' },
  { type: 'results', count: 3 },
]

/**
 * Bir satir dokunusu tahmin gonderir ancak `select` geldigi anda satirlar hala
 * ciziliyse (liste acik). Liste once sokulurse onPress hic tetiklenmez.
 */
function selectReachesRow(events: SearchListEvent[], listControls: boolean): boolean {
  let s = INITIAL_SEARCH_LIST
  for (const e of events) {
    if (e.type === 'select' && !s.open) return false
    s = reduceSearchList(s, e, listControls)
  }
  return events.some((e) => e.type === 'select')
}

// ─── Spotlight (listControls) ────────────────────────────────────────────────

Deno.test('klavye acik + satira dokunus (handled: blur onPress SONRASI) → tahmin gider, liste kapanir', () => {
  const events: SearchListEvent[] = [
    ...OPEN_WITH_KEYBOARD,
    { type: 'rowPressIn' },
    { type: 'rowPressOut' },
    { type: 'select' },
    { type: 'blur' }, // handleSelect → Keyboard.dismiss
  ]
  assert(selectReachesRow(events, true))
  assertEquals(run(events, true).open, false)
})

Deno.test('TUZAK: blur onPress ONCESI gelse de (basis surerken) liste sokulmez → tahmin gider', () => {
  const events: SearchListEvent[] = [
    ...OPEN_WITH_KEYBOARD,
    { type: 'rowPressIn' },
    { type: 'blur' },
    { type: 'select' },
    { type: 'rowPressOut' },
  ]
  assert(selectReachesRow(events, true))
  assertEquals(run(events, true).open, false)
})

Deno.test('TUZAK: blur, basis surerken gelir, sira pressOut → select ise de tahmin gider', () => {
  const events: SearchListEvent[] = [
    ...OPEN_WITH_KEYBOARD,
    { type: 'rowPressIn' },
    { type: 'blur' },
    { type: 'rowPressOut' },
    { type: 'select' },
  ]
  assert(selectReachesRow(events, true))
})

Deno.test('dışarı dokunus (ust bolge klavyeyi kapatir → blur) listeyi kapatir', () => {
  const s = run([...OPEN_WITH_KEYBOARD, { type: 'blur' }], true)
  assertEquals(s.open, false)
  assertEquals(s.focused, false)
})

Deno.test('Kapat satiri listeyi kapatir, odak korunur', () => {
  const s = run([...OPEN_WITH_KEYBOARD, { type: 'dismiss' }], true)
  assertEquals(s.open, false)
  assertEquals(s.focused, true)
})

Deno.test('Kapat sonrasi yazmaya devam → yeni sonuc listeyi yeniden acar', () => {
  const s = run([...OPEN_WITH_KEYBOARD, { type: 'dismiss' }, { type: 'results', count: 2 }], true)
  assertEquals(s.open, true)
})

Deno.test('odak yokken donen gec sonuc listeyi acmaz', () => {
  const s = run([{ type: 'focus' }, { type: 'blur' }, { type: 'results', count: 4 }], true)
  assertEquals(s.open, false)
})

Deno.test('0 sonuc listeyi acmaz', () => {
  assertEquals(run([{ type: 'focus' }, { type: 'results', count: 0 }], true).open, false)
})

Deno.test('kaydirmayla iptal edilen basis listeyi kapatmaz', () => {
  const s = run([...OPEN_WITH_KEYBOARD, { type: 'rowPressIn' }, { type: 'rowPressOut' }], true)
  assertEquals(s.open, true)
  assertEquals(s.rowPressActive, false)
})

Deno.test('bilinen sinir: basis sirasinda blur + kaydirma iptali → liste acik, odaksiz kalir (Kapat satiri cikis)', () => {
  const s = run(
    [...OPEN_WITH_KEYBOARD, { type: 'rowPressIn' }, { type: 'blur' }, { type: 'rowPressOut' }],
    true,
  )
  assertEquals(s.open, true)
  assertEquals(s.focused, false)
  assertEquals(reduceSearchList(s, { type: 'dismiss' }, true).open, false)
})

// ─── Donmus oyunlar (listControls kapali) — P-3 oncesi davranis ─────────────

Deno.test('regresyon: listControls kapali → blur listeyi KAPATMAZ', () => {
  assertEquals(run([...OPEN_WITH_KEYBOARD, { type: 'blur' }], false).open, true)
})

Deno.test('regresyon: listControls kapali → sonuc odaktan bagimsiz acar (eski setShowDropdown(n > 0))', () => {
  assertEquals(run([{ type: 'results', count: 3 }], false).open, true)
  assertEquals(run([{ type: 'focus' }, { type: 'blur' }, { type: 'results', count: 3 }], false).open, true)
  assertEquals(run([{ type: 'results', count: 0 }], false).open, false)
})

Deno.test('regresyon: listControls kapali → secim ve dismiss eskisi gibi kapatir', () => {
  assertEquals(run([{ type: 'results', count: 3 }, { type: 'select' }], false).open, false)
  assertEquals(run([{ type: 'results', count: 3 }, { type: 'dismiss' }], false).open, false)
})

Deno.test('regresyon: listControls kapali → basis olaylari acik/kapali durumunu degistirmez', () => {
  const base = run([{ type: 'results', count: 3 }], false)
  const pressed = run(
    [{ type: 'results', count: 3 }, { type: 'rowPressIn' }, { type: 'rowPressOut' }],
    false,
  )
  assertEquals(pressed.open, base.open)
})

// ─── Arama kapisi (P-3 A3) ──────────────────────────────────────────────────

Deno.test('A3: yazdiktan sonra X → yoldaki yanit bayat, liste yeniden acilmaz', () => {
  const gate = createSearchGate()
  const ticket = gate.ticket() // "ar" yazildi, 300 ms zamanlayici kuruldu
  gate.cancel() // X
  assertEquals(gate.isCurrent(ticket), false)
})

Deno.test('A3: satir secimi yoldaki aramayi bayatlatir', () => {
  const gate = createSearchGate()
  gate.cancel() // onceki harf
  const ticket = gate.ticket() // 3. harf
  gate.cancel() // eski listeden hemen secim
  assertEquals(gate.isCurrent(ticket), false)
})

Deno.test('A3: sira disi donen eski yanit yeni sorguyu ezmez', () => {
  const gate = createSearchGate()
  gate.cancel()
  const old = gate.ticket() // "ar"
  gate.cancel()
  const fresh = gate.ticket() // "arr"
  assertEquals(gate.isCurrent(old), false)
  assertEquals(gate.isCurrent(fresh), true)
})

Deno.test('A3: araya bir sey girmezse yanit uygulanir', () => {
  const gate = createSearchGate()
  gate.cancel()
  const ticket = gate.ticket()
  assert(gate.isCurrent(ticket))
})

// ─── Denenmis filmler (P-3 madde 3) ─────────────────────────────────────────

Deno.test('denenmis film uuid eslesmesiyle isaretlenir', () => {
  assert(isTriedFilm('a', ['a', 'b']))
  assertEquals(isTriedFilm('c', ['a', 'b']), false)
})

Deno.test('uuid icermeyen sonuc asla denendi sayilmaz', () => {
  assertEquals(isTriedFilm(undefined, ['a']), false)
})

Deno.test('regresyon: triedFilmIds verilmezse (donmus oyunlar) hicbir satir etkilenmez', () => {
  assertEquals(isTriedFilm('a', undefined), false)
})
