/**
 * Unit tests — FocusStill yükleme zaman aşımı bekçisi (saf mantık, sahte saat).
 *
 * Run: npm run test:spotlight-layout
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { createLoadWatchdog, type Scheduler } from '../../components/games/Spotlight/focusWatchdog.ts'

/** Elle ilerletilen saat */
function fakeClock() {
  let now = 0
  let nextId = 1
  const timers = new Map<number, { at: number; cb: () => void }>()
  const scheduler: Scheduler<number> = {
    set(cb, ms) {
      const id = nextId++
      timers.set(id, { at: now + ms, cb })
      return id
    },
    clear(id) {
      timers.delete(id)
    },
  }
  return {
    scheduler,
    pending: () => timers.size,
    advance(ms: number) {
      now += ms
      for (const [id, t] of [...timers]) {
        if (t.at <= now) {
          timers.delete(id)
          t.cb()
        }
      }
    },
  }
}

Deno.test('süre dolunca geri çağrı bir kez çalışır', () => {
  const clock = fakeClock()
  const wd = createLoadWatchdog(clock.scheduler, 1200)
  let fired = 0
  wd.arm(() => fired++)
  clock.advance(1199)
  assertEquals(fired, 0)
  clock.advance(1)
  assertEquals(fired, 1)
  clock.advance(5000)
  assertEquals(fired, 1)
  assert(!wd.isArmed())
})

Deno.test('cancel: yükleme geldi → terfi yok', () => {
  const clock = fakeClock()
  const wd = createLoadWatchdog(clock.scheduler, 1200)
  let fired = 0
  wd.arm(() => fired++)
  wd.cancel()
  clock.advance(5000)
  assertEquals(fired, 0)
  assertEquals(clock.pending(), 0)
})

Deno.test('yeniden hedefleme: eski zamanlayıcı iptal, yenisi taze süreyle', () => {
  const clock = fakeClock()
  const wd = createLoadWatchdog(clock.scheduler, 1200)
  const calls: string[] = []
  wd.arm(() => calls.push('old'))
  clock.advance(800)
  wd.arm(() => calls.push('new'))
  clock.advance(800) // eski süre dolmuş olurdu (1600 > 1200) — bayat terfi olmamalı
  assertEquals(calls, [])
  clock.advance(400)
  assertEquals(calls, ['new'])
  assertEquals(clock.pending(), 0)
})

Deno.test('unmount: cancel sonrası zamanlayıcı kalmaz, ikinci cancel zararsız', () => {
  const clock = fakeClock()
  const wd = createLoadWatchdog(clock.scheduler, 1200)
  wd.arm(() => {})
  wd.cancel()
  wd.cancel()
  assertEquals(clock.pending(), 0)
  assert(!wd.isArmed())
})

Deno.test('süre dolduktan sonra yeniden arm edilebilir', () => {
  const clock = fakeClock()
  const wd = createLoadWatchdog(clock.scheduler, 1200)
  let fired = 0
  wd.arm(() => fired++)
  clock.advance(1200)
  wd.arm(() => fired++)
  clock.advance(1200)
  assertEquals(fired, 2)
})
