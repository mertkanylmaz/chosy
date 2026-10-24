/**
 * Çıkış duraklatma koruyucusu + teklif yüzeyi kapısı (MONEY-1C B-1, B-2).
 * Run: npm run test:mood-offer
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { createExitGuard, isOfferSurfaceMounted } from '../../utils/moodExitGuard.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

Deno.test('duraklatılan çıkış bir kez sürdürülür', () => {
  const g = createExitGuard()
  let calls = 0
  assertEquals(g.begin(() => calls++), true)
  assertEquals(g.isPending(), true)
  assertEquals(g.release(), true)
  assertEquals(calls, 1)
  // paywall kapandı + "gösterilmedi" yolu birlikte gelse bile ikinci resume yok
  assertEquals(g.release(), false)
  assertEquals(calls, 1)
  assertEquals(g.isPending(), false)
})

Deno.test('çift dokunuş: duraklatma sürerken ikinci çıkış yok sayılır, resume yenilenmez', () => {
  const g = createExitGuard()
  const log: string[] = []
  assertEquals(g.begin(() => log.push('first')), true)
  assertEquals(g.begin(() => log.push('second')), false)
  g.release()
  assertEquals(log, ['first'])
})

Deno.test('unmount sonrası release resume ÇAĞIRMAZ (çift pop / dismissTo yok)', () => {
  const g = createExitGuard()
  let calls = 0
  g.begin(() => calls++)
  g.unmount()
  assertEquals(g.isPending(), false)
  assertEquals(g.release(), false)
  assertEquals(calls, 0)
})

Deno.test('unmount ile release yarışı: bekleyen varken unmount, sonra gelen release no-op', () => {
  const g = createExitGuard()
  let calls = 0
  g.begin(() => calls++)
  g.release()
  g.unmount()
  assertEquals(g.release(), false)
  assertEquals(calls, 1)
})

Deno.test('mount tekrar çağrılırsa (efekt yeniden kurulumu) koruyucu yeniden çalışır', () => {
  const g = createExitGuard()
  g.unmount()
  g.mount()
  let calls = 0
  g.begin(() => calls++)
  g.release()
  assertEquals(calls, 1)
})

Deno.test('teklif yüzeyi: yalnız özet veya dolu deste dalında çizilir', () => {
  assertEquals(isOfferSurfaceMounted({ deckComplete: false, deckLength: 0 }), false) // yükleniyor / hata / boş
  assertEquals(isOfferSurfaceMounted({ deckComplete: false, deckLength: 4 }), true) // ana deste
  assertEquals(isOfferSurfaceMounted({ deckComplete: true, deckLength: 4 }), true) // özet
  assertEquals(isOfferSurfaceMounted({ deckComplete: true, deckLength: 0 }), true)
})

Deno.test('discover: beforeRemove yüzey kapısı + ikinci çıkış yok sayma + unmount koruması bağlı', () => {
  const d = read('app/discover.tsx')
  assertMatch(d, /if \(!offerEligible \|\| !offerSurfaceMounted\) return;/)
  assertMatch(d, /if \(exitGuard\.isPending\(\)\) \{\s*e\.preventDefault\(\);\s*return;\s*\}/)
  assertMatch(d, /exitGuard\.begin\(\(\) => navigation\.dispatch\(e\.data\.action\)\)/)
  assertMatch(d, /exitGuard\.unmount\(\)/)
  assert(!d.includes('pendingExit'))
  const hook = read('components/paywalls/useContextualPaywall.ts')
  assertMatch(hook, /if \(!mountedRef\.current\) return false;/)
})
