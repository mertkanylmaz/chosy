/**
 * Açılış saati + ölçüm olaylarının kodda ve G6 dokümanında tutarlılığı (COLD-START-1).
 * Run: deno test --allow-read tests/navigation/bootClock.test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { createBootClock } from '../../utils/bootClock.ts'

Deno.test('elapsedMs sıfır noktasından itibaren sayar, geri gitmez', () => {
  let t = 1000
  const c = createBootClock(() => t)
  assertEquals(c.elapsedMs(), 0)
  t = 1750
  assertEquals(c.elapsedMs(), 750)
  t = 900 // saat geri sarsa bile negatif olmaz
  assertEquals(c.elapsedMs(), 0)
})

Deno.test('markFirstCardsVisible süreç başına yalnız bir kez değer döner', () => {
  let t = 0
  const c = createBootClock(() => t)
  assertEquals(c.isBooting(), true)
  t = 2300
  assertEquals(c.markFirstCardsVisible(), 2300)
  assertEquals(c.isBooting(), false)
  t = 5000
  assertEquals(c.markFirstCardsVisible(), null)
})

const read = (rel: string) => Deno.readTextFile(new URL(`../../${rel}`, import.meta.url))

const EVENTS = [
  'app_boot_started',
  'auth_refresh_ms',
  'boot_ready_ms',
  'boot_failed',
  'boot_recovered',
  'first_cards_visible',
] as const

Deno.test('altı olay kodda ateşleniyor ve G6 dokümanında tanımlı', async () => {
  const code = [
    await read('app/_layout.tsx'),
    await read('app/gate.tsx'),
    await read('components/gauntlet/GauntletShell/index.tsx'),
  ].join('\n')
  const doc = await read('docs/analytics/G6_CEKIRDEK_EVENTLER.md')
  for (const ev of EVENTS) {
    assert(code.includes(`track('${ev}'`), `${ev} kodda ateşlenmiyor`)
    assert(doc.includes(`\`${ev}\``), `${ev} G6 dokümanında yok`)
  }
})

Deno.test('boot_failed üç nedenin üçü de kodda ve dokümanda var', async () => {
  const gate = await read('app/gate.tsx')
  const boot = await read('utils/gateBoot.ts')
  const shell = await read('components/gauntlet/GauntletShell/index.tsx')
  const doc = await read('docs/analytics/G6_CEKIRDEK_EVENTLER.md')
  assert(boot.includes("'auth_timeout'") && boot.includes("'gate_decision_error'"))
  assert(gate.includes("track('boot_failed'"))
  assert(shell.includes("reason: 'shell_load_failed'"))
  for (const r of ['auth_timeout', 'gate_decision_error', 'shell_load_failed']) {
    assert(doc.includes(`\`${r}\``), `${r} dokümanda yok`)
  }
})

Deno.test('G6 dokümanı: gauntlet_viewed notu ve native splash uyarısı var', async () => {
  const doc = await read('docs/analytics/G6_CEKIRDEK_EVENTLER.md')
  assert(doc.includes('kabuk mount oldu'))
  assert(doc.includes('native splash süresi dahil değildir'))
})

Deno.test('gauntlet_viewed çağrısına dokunulmadı: tek, argümansız', async () => {
  const shell = await read('components/gauntlet/GauntletShell/index.tsx')
  const calls = shell.match(/track\('gauntlet_viewed'[^)]*\)/g) ?? []
  assertEquals(calls, ["track('gauntlet_viewed')"])
})

Deno.test('olay özellikleri PII taşımıyor: yalnız ms/etiket alanları', async () => {
  const code = [
    await read('app/_layout.tsx'),
    await read('app/gate.tsx'),
    await read('components/gauntlet/GauntletShell/index.tsx'),
  ].join('\n')
  for (const ev of EVENTS) {
    const m = code.match(new RegExp(`track\\('${ev}'(?:,\\s*\\{([^}]*)\\})?`, 'g')) ?? []
    for (const call of m) {
      assert(!/user|email|auth_?id|film|title|token/i.test(call), `${ev}: şüpheli alan: ${call}`)
    }
  }
})
