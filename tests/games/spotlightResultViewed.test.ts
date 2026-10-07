/**
 * spotlight_result_viewed tek-atış koruması — puzzle_id başına bir kez.
 * Run: npm run test:spotlight-result
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { shouldFireResultViewed } from '../../components/games/Spotlight/resultViewed.ts'

Deno.test('aynı puzzle_id ikinci çağrıda false', () => {
  const seen = new Set<string>()
  assertEquals(shouldFireResultViewed(seen, 'p1'), true)
  assertEquals(shouldFireResultViewed(seen, 'p1'), false)
  assertEquals(shouldFireResultViewed(seen, 'p1'), false)
})

Deno.test('farklı puzzle_id true', () => {
  const seen = new Set<string>()
  assertEquals(shouldFireResultViewed(seen, 'p1'), true)
  assertEquals(shouldFireResultViewed(seen, 'p2'), true)
  assertEquals(shouldFireResultViewed(seen, 'p1'), false)
})

Deno.test('boş puzzle_id hiç ateşlemez ve kümeyi kirletmez', () => {
  const seen = new Set<string>()
  assertEquals(shouldFireResultViewed(seen, ''), false)
  assertEquals(seen.size, 0)
})
