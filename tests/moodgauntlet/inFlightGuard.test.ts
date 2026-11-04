/**
 * Uçuştaki istek kilidi (Another four + Calmer / More intense çift dokunuş): saf yardımcı + kaynak sözleşmesi.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { createInFlightGuard } from '../../utils/inFlightGuard.ts'

const read = (p: string): string => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url))

Deno.test('kilit: ikinci tryAcquire false (çift dokunuş)', () => {
  const g = createInFlightGuard()
  assertEquals(g.tryAcquire(1), true)
  assertEquals(g.tryAcquire(2), false)
})

Deno.test('kilit: release yanlış id ile açmaz, sahip id ile açar', () => {
  const g = createInFlightGuard()
  g.tryAcquire(1)
  g.release(2)
  assertEquals(g.tryAcquire(3), false)
  g.release(1)
  assertEquals(g.tryAcquire(3), true)
})

Deno.test('kilit: clear sonrası yeni id alınır; iptal edilen eski isteğin release’i yeni kilidi açmaz', () => {
  const g = createInFlightGuard()
  g.tryAcquire(1)
  g.clear()
  assertEquals(g.tryAcquire(2), true)
  g.release(1) // eski istek finally’si
  assertEquals(g.tryAcquire(3), false)
})

Deno.test('kaynak sözleşmesi: loadAnother ve intensify başında tryAcquire, start ve reset içinde clear', () => {
  const hook = read('components/MoodGauntlet/useMoodGauntlet.ts')
  assertMatch(hook, /import \{ createInFlightGuard \} from '@\/utils\/inFlightGuard'/)
  // Kilit tek yerde (acquireOrTrace) alınır; ikisi de aynı yardımcıyı kullanır
  assertEquals((hook.match(/inFlight\.current\.tryAcquire\(/g) ?? []).length, 1)
  assertMatch(hook, /acquireOrTrace\(id, 'another_four'\)/)
  assertMatch(hook, /acquireOrTrace\(id, 'intensity'\)/)
  // runId, kilit alındıktan SONRA artar (reddedilen dokunuş uçuştaki isteği geçersiz kılmaz)
  assertMatch(hook, /const id = runId\.current \+ 1;\s*if \(!acquireOrTrace\(id, 'another_four'\)\) return;\s*runId\.current = id;/)
  assertMatch(hook, /const id = runId\.current \+ 1;\s*if \(!acquireOrTrace\(id, 'intensity'\)\) return;\s*runId\.current = id;/)
  // Analitik olay kilitten SONRA
  assert(hook.indexOf("acquireOrTrace(id, 'intensity')") < hook.indexOf('trackMoodEvent(intensityEvent(direction))'))
  assert(hook.indexOf("acquireOrTrace(id, 'another_four')") < hook.indexOf('onAcquired?.()'))
  assert(!/trackMoodEvent\(anotherFourEvent\(\)\);\s*void loadAnother\(\)/.test(hook), 'olay kilitten önce atılmamalı')
  // finally’de yalnız sahip bırakır
  assertEquals((hook.match(/inFlight\.current\.release\(id\)/g) ?? []).length, 2)
  // start ve reset kilidi düşürür
  assertMatch(hook, /const start = useCallback\(\s*async \(input: StartInput, carryShown: readonly string\[\] = \[\]\) => \{\s*inFlight\.current\.clear\(\);/)
  assertMatch(hook, /const reset = useCallback\(\(\) => \{\s*inFlight\.current\.clear\(\);/)
  // Sessiz çıkış yok: breadcrumb
  assertMatch(hook, /message: 'duplicate_tap_ignored'/)
})
