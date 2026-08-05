/**
 * Unit tests for spotlightLetters.ts — Spotlight V3 harf eslestirme.
 *
 * Regresyon kaynagi: eslestirme `toLocaleUpperCase('tr-TR')` ile yapiliyordu.
 * Deno tam ICU ile calistigi icin 'i' → 'İ' oluyor, klavyeden gelen 'I' ile
 * eslesmiyordu: "Titanic"te I tusu bos donuyor ve oyuncudan bir hak
 * goturuyordu. Havuzun buyuk cogunlugu en-US baslik oldugu icin bu hata
 * neredeyse her gun tetikleniyordu.
 *
 * To run with Deno: deno test tests/game-system/spotlight.test.ts
 */

// For Deno test runner
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  buildTitleMask,
  classifyChar,
  findLetterPositions,
  normalizeLetter,
} from '../../supabase/functions/_shared/spotlightLetters.ts'

/**
 * Istemcideki `blurForProgress()` ile ayni oran (Spotlight/index.tsx:84).
 * Burada yalnizca ORAN dogrulaniyor: 1.0'a ulasabiliyor mu?
 */
function revealRatio(revealedCount: number, letterCount: number): number {
  if (letterCount <= 0) return 0
  return Math.min(1, revealedCount / letterCount)
}

/** Bir basligin tum slotlarini acmayi simule eder (dogru harfleri sirayla dener) */
function revealAllSlots(title: string): number {
  const letters = new Set([...title].map(normalizeLetter).filter((c) => /^[A-Z]$/.test(c)))
  const positions = new Set<number>()
  for (const letter of letters) {
    for (const pos of findLetterPositions(title, letter)) positions.add(pos)
  }
  return positions.size
}

// ─── normalizeLetter ─────────────────────────────────────────────────────────

Deno.test('normalizeLetter: kucuk harf → buyuk', () => {
  assertEquals(normalizeLetter('i'), 'I')
  assertEquals(normalizeLetter('a'), 'A')
})

Deno.test('normalizeLetter: bosluk temizlenir', () => {
  assertEquals(normalizeLetter('  t '), 'T')
})

Deno.test('normalizeLetter: locale-siz — i asla İ olmaz', () => {
  // tr-TR locale'i burada 'İ' uretirdi; regresyonun kok nedeni.
  assertEquals(normalizeLetter('i'), 'I')
  assertEquals(normalizeLetter('i').length, 1)
})

// ─── Regresyon: i/I eslestirmesi ─────────────────────────────────────────────

Deno.test('findLetterPositions: "Titanic" + I → 2 pozisyon', () => {
  // T(0) i(1) t(2) a(3) n(4) i(5) c(6) — baslikta iki 'i' var.
  assertEquals(findLetterPositions('Titanic', 'I'), [1, 5])
})

Deno.test('findLetterPositions: buyuk ve kucuk i ayni tusla acilir', () => {
  // I(0) t(1) ' '(2) I(3) s(4) ' '(5) T(6) i(7) m(8) e(9)
  assertEquals(findLetterPositions('It Is Time', 'I'), [0, 3, 7])
})

Deno.test('findLetterPositions: "Sicario" + I → 2 pozisyon', () => {
  // S(0) i(1) c(2) a(3) r(4) i(5) o(6)
  assertEquals(findLetterPositions('Sicario', 'I'), [1, 5])
})

Deno.test('findLetterPositions: bas harf ve ic harf birlikte doner', () => {
  // I(0) n(1) c(2) e(3) p(4) t(5) i(6) o(7) n(8)
  assertEquals(findLetterPositions('Inception', 'I'), [0, 6])
})

// ─── ı/I asimetrisi (Turkce basliklar havuzda mevcut) ────────────────────────

Deno.test('findLetterPositions: noktasiz ı, I tusuyla acilir', () => {
  // 'ı'.toUpperCase() === 'I' — klavyede ı tusu yok, I tusu onu acar.
  // A(0) s(1) l(2) a(3) r(4) ı(5) n(6)
  assertEquals(findLetterPositions('Asların', 'I'), [5])
})

Deno.test('findLetterPositions: "Hızlı ve Öfkeli" + I → iki ı pozisyonu', () => {
  // H(0) ı(1) z(2) l(3) ı(4) ' '(5) v(6) e(7) ' '(8) Ö(9) f(10) k(11)
  // e(12) l(13) i(14)  → 'i' de I tusuyla acilir
  assertEquals(findLetterPositions('Hızlı ve Öfkeli', 'I'), [1, 4, 14])
})

Deno.test('findLetterPositions: İ, I tusuyla ACILMAZ', () => {
  // 'İ'.toUpperCase() === 'İ' (U+0130 korunur) — klavyede karsiligi yok.
  //
  // URETIMDE BU DURUM OLUSMAZ: 'İ' artik 'unreachable' siniflaniyor ve
  // iceren basliklar spotlightData()'da reddediliyor. Test, eslestirmenin
  // kendi davranisini kayda geciriyor — bu sinir kalkarsa (ornegin klavyeye
  // Turkce tus eklenirse) once burasi kirilir.
  assertEquals(findLetterPositions('İsyan', 'I'), [])
})

// ─── classifyChar ────────────────────────────────────────────────────────────

Deno.test('classifyChar: A-Z harfleri slot', () => {
  assertEquals(classifyChar('a'), 'slot')
  assertEquals(classifyChar('Z'), 'slot')
})

Deno.test('classifyChar: rakam sep', () => {
  assertEquals(classifyChar('0'), 'sep')
  assertEquals(classifyChar('3'), 'sep')
  assertEquals(classifyChar('9'), 'sep')
})

Deno.test('classifyChar: noktalama ve bosluk sep', () => {
  assertEquals(classifyChar(' '), 'sep')
  assertEquals(classifyChar(':'), 'sep')
  assertEquals(classifyChar('-'), 'sep')
  assertEquals(classifyChar('.'), 'sep')
})

Deno.test('classifyChar: noktasiz ı slot — I tusuyla acilabiliyor', () => {
  // Olcut "ASCII mi" degil, "A-Z'ye dusuyor mu".
  assertEquals(classifyChar('ı'), 'slot')
})

Deno.test('classifyChar: A-Zye dusmeyen harfler unreachable', () => {
  assertEquals(classifyChar('ü'), 'unreachable')
  assertEquals(classifyChar('é'), 'unreachable')
  assertEquals(classifyChar('ş'), 'unreachable')
  assertEquals(classifyChar('İ'), 'unreachable')
  assertEquals(classifyChar('К'), 'unreachable') // Kiril
  assertEquals(classifyChar('尋'), 'unreachable')
})

Deno.test('classifyChar: iki karaktere acilan ß unreachable', () => {
  // 'ß'.toUpperCase() === 'SS' — tek tusla eslesemez.
  assertEquals(classifyChar('ß'), 'unreachable')
})

// ─── buildTitleMask ──────────────────────────────────────────────────────────

Deno.test('buildTitleMask: "Toy Story 3" — rakam gorunur, slot sayisi 8', () => {
  const mask = buildTitleMask('Toy Story 3')
  assertEquals(mask.hasUnreachable, false)
  assertEquals(mask.slotCount, 8) // T,o,y,S,t,o,r,y
  assertEquals(mask.tokens.length, 11) // ayraclar da indeks tuketir
  assertEquals(mask.tokens[10], { t: 'sep', c: '3' })
  assertEquals(mask.tokens[3], { t: 'sep', c: ' ' })
})

Deno.test('buildTitleMask: "Meg 2: The Trench" — 2 ve : gorunur', () => {
  const mask = buildTitleMask('Meg 2: The Trench')
  assertEquals(mask.hasUnreachable, false)
  assertEquals(mask.tokens[4], { t: 'sep', c: '2' })
  assertEquals(mask.tokens[5], { t: 'sep', c: ':' })
  assertEquals(mask.slotCount, 12) // M,e,g,T,h,e,T,r,e,n,c,h
})

Deno.test('buildTitleMask: "Das Glück ist ein Vogerl" — ü unreachable', () => {
  const mask = buildTitleMask('Das Glück ist ein Vogerl')
  assertEquals(mask.hasUnreachable, true)
  assertEquals(mask.unreachableChars, ['ü'])
})

Deno.test('buildTitleMask: "Irmandade: Kardeşlik İsyanı" — ş ve İ unreachable', () => {
  const mask = buildTitleMask('Irmandade: Kardeşlik İsyanı')
  assertEquals(mask.hasUnreachable, true)
  assertEquals(mask.unreachableChars, ['ş', 'İ'])
})

Deno.test('buildTitleMask: sadece ı iceren baslik kabul edilir', () => {
  // 'ı' → 'I' oldugu icin oynanabilir; 'Asların' reddedilmemeli.
  const mask = buildTitleMask('Asların')
  assertEquals(mask.hasUnreachable, false)
  assertEquals(mask.slotCount, 7)
})

// ─── Blur ilerlemesi ─────────────────────────────────────────────────────────

Deno.test('blur: "Toy Story 3" — tum slotlar acilinca oran 1.0', () => {
  const mask = buildTitleMask('Toy Story 3')
  const revealed = revealAllSlots('Toy Story 3')
  // Rakam paydaya girseydi oran 8/9 kalir, gorsel hic netlesmezdi.
  assertEquals(revealed, mask.slotCount)
  assertEquals(revealRatio(revealed, mask.slotCount), 1)
})

Deno.test('blur: rakamli baslikta payda rakami saymaz', () => {
  const mask = buildTitleMask('Detective Chinatown 1900')
  assertEquals(mask.slotCount, 18) // "Detective"(9) + "Chinatown"(9), 4 rakam disarida
  assertEquals(revealRatio(revealAllSlots('Detective Chinatown 1900'), mask.slotCount), 1)
})

Deno.test('blur: her slot bir tusla acilabilir — olu hucre yok', () => {
  // Invariant: slotCount === acilabilir pozisyon sayisi. classifyChar ile
  // findLetterPositions ayni olcutu kullanmazsa bu test kirilir.
  for (const title of ['Sicario', 'Toy Story 3', 'Meg 2: The Trench', 'It Is Time', 'Asların']) {
    const mask = buildTitleMask(title)
    assertEquals(revealAllSlots(title), mask.slotCount, title)
  }
})

// ─── Genel davranis ──────────────────────────────────────────────────────────

Deno.test('findLetterPositions: bulunmayan harf → bos dizi', () => {
  assertEquals(findLetterPositions('Titanic', 'Z'), [])
})

Deno.test('findLetterPositions: pozisyonlar code point indeksi — maske ile ayni', () => {
  // Ayraclar da indeks tuketir; maske tokenleri ile birebir hizalanmali.
  // T(0) o(1) y(2) ' '(3) S(4) t(5) o(6) r(7) y(8) ' '(9) 3(10)
  assertEquals(findLetterPositions('Toy Story 3', 'O'), [1, 6])
  assertEquals(findLetterPositions('Toy Story 3', 'Y'), [2, 8])
})

Deno.test('findLetterPositions: aksanli harf ASCII karsiligiyla acilmaz', () => {
  // 'é'.toUpperCase() === 'É' ≠ 'E'. Mevcut davranisin kaydi.
  assertEquals(findLetterPositions('Amélie', 'E'), [5])
})
