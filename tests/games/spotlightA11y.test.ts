/**
 * Unit tests — Spotlight erişilebilirlik: maske özeti (maskA11y) ve tuş durumu (keyState).
 * Metinler GERÇEK locales/en.json + tr.json'dan okunur (anahtar eksikse test düşer).
 *
 * Run: npm run test:spotlight-layout
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { groupMaskWords } from '../../components/games/Spotlight/maskLayout.ts'
import { composeMaskLabel, describeMask } from '../../components/games/Spotlight/maskA11y.ts'
import {
  hasHitBar,
  isStruck,
  keyStateFor,
  KEY_A11Y_KEY,
  type KeyState,
} from '../../components/games/Spotlight/keyState.ts'

type Dict = { [k: string]: string | Dict }

function loadLocale(name: 'en' | 'tr'): Dict {
  return JSON.parse(Deno.readTextFileSync(new URL(`../../locales/${name}.json`, import.meta.url)))
}

/** i18n-js davranışı: `count` varsa 0 → zero, 1 → one, aksi other; %{x} enterpolasyonu */
function makeT(locale: Dict) {
  return (key: string, options: Record<string, unknown> = {}): string => {
    let node: string | Dict | undefined = locale
    for (const part of key.split('.')) {
      node = typeof node === 'object' ? node[part] : undefined
    }
    if (node === undefined) throw new Error(`missing i18n key: ${key}`)
    if (typeof node === 'object') {
      const count = options.count
      const form = count === 0 && 'zero' in node ? 'zero' : count === 1 ? 'one' : 'other'
      const picked = node[form]
      if (typeof picked !== 'string') throw new Error(`missing plural form ${form}: ${key}`)
      node = picked
    }
    return node.replace(/%\{(\w+)\}/g, (_m, name: string) => String(options[name]))
  }
}

const en = makeT(loadLocale('en'))
const tr = makeT(loadLocale('tr'))

type Tok = { t: 'slot' | 'sep'; c?: string }
const S: Tok = { t: 'slot' }
const SP: Tok = { t: 'sep', c: ' ' }
const sep = (c: string): Tok => ({ t: 'sep', c })

function words(mask: Tok[]) {
  return groupMaskWords(mask)
}

// "THE DOG" → 3 + 3 slot
const TWO_WORDS: Tok[] = [S, S, S, SP, S, S, S]

Deno.test('tamamen kapalı: kelime sayısı ve uzunluklar, hepsi boş', () => {
  const label = composeMaskLabel(words(TWO_WORDS), new Map(), en)
  assertEquals(
    label,
    'Title. 2 words. Word 1: 3 letters, all blank. Word 2: 3 letters, all blank.',
  )
})

Deno.test('kısmi açık: açık pozisyon harfiyle, kapalılar "blank"', () => {
  const label = composeMaskLabel(words(TWO_WORDS), new Map([[0, 't']]), en)
  assertEquals(
    label,
    'Title. 2 words. Word 1: 3 letters, T, blank, blank. Word 2: 3 letters, all blank.',
  )
})

Deno.test('tamamen açık: her harf sırayla okunur', () => {
  const revealed = new Map([[0, 'T'], [1, 'H'], [2, 'E'], [4, 'D'], [5, 'O'], [6, 'G']])
  const label = composeMaskLabel(words(TWO_WORDS), revealed, en)
  assertEquals(label, 'Title. 2 words. Word 1: 3 letters, T, H, E. Word 2: 3 letters, D, O, G.')
})

Deno.test('tek kelime: tekil kelime/harf biçimi', () => {
  const label = composeMaskLabel(words([S]), new Map(), en)
  assertEquals(label, 'Title. 1 word. Word 1: 1 letter, blank.')
})

Deno.test('görünür ayraç (tire) kelimenin içinde okunur, harf sayısına girmez', () => {
  // "X-MEN": slot, tire, slot, slot, slot
  const mask: Tok[] = [S, sep('-'), S, S, S]
  const d = describeMask(words(mask), new Map([[0, 'x']]))
  assertEquals(d.length, 1)
  assertEquals(d[0].letterCount, 4)
  assertEquals(d[0].allBlank, false)
  assertEquals(
    composeMaskLabel(words(mask), new Map([[0, 'x']]), en),
    'Title. 1 word. Word 1: 4 letters, X, -, blank, blank, blank.',
  )
})

Deno.test('rakam tasarım gereği görünür: kapalı slotlarla birlikte okunur', () => {
  // "SE7EN" → rakam görünür ayraç jetonu
  const mask: Tok[] = [S, S, sep('7'), S, S]
  const label = composeMaskLabel(words(mask), new Map(), en)
  assertEquals(label, 'Title. 1 word. Word 1: 4 letters, blank, blank, 7, blank, blank.')
})

Deno.test('yalnız rakamdan oluşan kelime: "harf yok" biçimi', () => {
  const mask: Tok[] = [sep('3'), sep('0'), sep('0')]
  const label = composeMaskLabel(words(mask), new Map(), en)
  assertEquals(label, 'Title. 1 word. Word 1: no letters, 3, 0, 0.')
})

Deno.test('çoklu boşluk boş kelime üretmez; slot olmayan maske sadece başlık', () => {
  assertEquals(composeMaskLabel(words([S, SP, SP, S]), new Map(), en).startsWith('Title. 2 words.'), true)
  assertEquals(composeMaskLabel(words([]), new Map(), en), 'Title.')
})

Deno.test('ekranda olmayan bilgi sızmaz: açılmamış slot harfi içermez', () => {
  const label = composeMaskLabel(words(TWO_WORDS), new Map([[1, 'h']]), en)
  assertMatch(label, /Word 1: 3 letters, blank, H, blank\./)
})

Deno.test('TR: aynı yapı, doğal metin', () => {
  assertEquals(
    composeMaskLabel(words(TWO_WORDS), new Map([[0, 't']]), tr),
    'Başlık. 2 kelime. Kelime 1: 3 harf, T, boş, boş. Kelime 2: 3 harf, hepsi boş.',
  )
})

Deno.test('tuş durumu: kullanılmamış / başlıkta var / başlıkta yok', () => {
  assertEquals(keyStateFor(false, false), 'available')
  assertEquals(keyStateFor(false, true), 'available')
  assertEquals(keyStateFor(true, true), 'used_hit')
  assertEquals(keyStateFor(true, false), 'used_miss')
})

Deno.test('üç durum renksiz ayırt edilir: çizgi / çubuk işaretleri çakışmaz', () => {
  const states: KeyState[] = ['available', 'used_hit', 'used_miss']
  const sigs = states.map((s) => `${isStruck(s)}|${hasHitBar(s)}`)
  assertEquals(new Set(sigs).size, 3)
  // used & in title ÜSTÜ ÇİZİLMEZ (çelişki giderildi)
  assert(!isStruck('used_hit'))
  assert(hasHitBar('used_hit'))
  assert(isStruck('used_miss'))
})

Deno.test('tuş etiketleri EN ve TR\'de üç durum için var ve birbirinden farklı', () => {
  for (const t of [en, tr]) {
    const labels = (Object.keys(KEY_A11Y_KEY) as KeyState[]).map((s) =>
      t(`games.spotlight.${KEY_A11Y_KEY[s]}`, { letter: 'A' }),
    )
    assertEquals(new Set(labels).size, 3)
    for (const l of labels) assert(l.includes('A'))
  }
  assertEquals(en('games.spotlight.key_a11y_used_hit', { letter: 'A' }), 'Letter A. Used, in the title.')
})

Deno.test('anons ve hak metinleri: çoğul biçimler ve EN/TR parite', () => {
  assertEquals(en('games.spotlight.announce_letter_hit', { letter: 'T' }), 'T is in the title.')
  assertEquals(
    en('games.spotlight.announce_letter_miss', { letter: 'Z', count: 1 }),
    'Z is not in the title. 1 chance left.',
  )
  assertEquals(
    en('games.spotlight.announce_letter_miss', { letter: 'Z', count: 4 }),
    'Z is not in the title. 4 chances left.',
  )
  assertEquals(
    tr('games.spotlight.announce_letter_miss', { letter: 'Z', count: 0 }),
    'Z başlıkta yok. Hak kalmadı.',
  )
  assertEquals(en('games.spotlight.chances_a11y', { left: 3, total: 6 }), 'Chances: 3 of 6 remaining.')
})
