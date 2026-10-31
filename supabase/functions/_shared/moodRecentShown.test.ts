import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { collectRecentShown } from './moodRecentShown.ts'

const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ids = (from: number, count: number): string[] => Array.from({ length: count }, (_, i) => id(from + i))

Deno.test('her aramanın yalnız ilk 4 filmi alınır', () => {
  assertEquals(collectRecentShown([{ recommended_film_ids: ids(1, 8) }]), ids(1, 4))
})

Deno.test('yalnız son 5 arama sayılır', () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({ recommended_film_ids: [id(100 + i)] }))
  assertEquals(collectRecentShown(rows), [100, 101, 102, 103, 104].map(id))
})

Deno.test('aramalar arası tekrar bir kez döner, sıra korunur', () => {
  const rows = [
    { recommended_film_ids: [id(1), id(2)] },
    { recommended_film_ids: [id(2), id(3)] },
  ]
  assertEquals(collectRecentShown(rows), [id(1), id(2), id(3)])
})

Deno.test('null / boş / dizi olmayan satırlar ve bozuk elemanlar atlanır', () => {
  const rows = [
    { recommended_film_ids: null },
    { recommended_film_ids: [] },
    { recommended_film_ids: 'x' },
    { recommended_film_ids: [7, null, 'not-a-uuid', id(9)] },
  ]
  assertEquals(collectRecentShown(rows), [id(9)])
})

Deno.test('büyük harfli UUID küçük harfe iner ve tekrar sayılır', () => {
  const upper = id(5).toUpperCase()
  assertEquals(collectRecentShown([{ recommended_film_ids: [id(5), upper] }]), [id(5)])
})

Deno.test('satır yok → boş liste', () => {
  assertEquals(collectRecentShown([]), [])
})
