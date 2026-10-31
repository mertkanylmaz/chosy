import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { createTiming, timingBreadcrumbs } from './serverTiming.ts'

Deno.test('measure: süreyi kaydeder, değeri döner; hata fırlatsa da kaydeder', async () => {
  let t = 0
  const timing = createTiming(() => t)
  const v = await timing.measure('auth', async () => { t += 12.34; return 'x' })
  assertEquals(v, 'x')
  let thrown = false
  try {
    await timing.measure('claim', async () => { t += 5; throw new Error('boom') })
  } catch { thrown = true }
  assertEquals(thrown, true)
  assertEquals(timing.entries(), [{ name: 'auth', ms: 12.3 }, { name: 'claim', ms: 5 }])
})

Deno.test('header: Server-Timing biçimi; boşsa boş string', () => {
  const timing = createTiming()
  assertEquals(timing.header(), '')
  timing.add('llm_a', 4361.04)
  timing.add('llm_b', 2131)
  assertEquals(timing.header(), 'llm_a;dur=4361.0, llm_b;dur=2131.0')
})

Deno.test('timingBreadcrumbs: aşama başına bir kayıt', () => {
  assertEquals(timingBreadcrumbs([{ name: 'auth', ms: 3 }]), [
    { category: 'timing', message: 'auth', level: 'info', data: { ms: 3 } },
  ])
})
