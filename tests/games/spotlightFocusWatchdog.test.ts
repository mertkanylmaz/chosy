/**
 * Unit tests — FocusStill yükleme zaman aşımı bekçisi (saf mantık, sahte saat).
 *
 * Run: npm run test:spotlight-layout
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  createFocusState,
  createLoadWatchdog,
  focusReduce,
  otherLayer,
  type FocusEffect,
  type FocusEvent,
  type FocusState,
  type Scheduler,
} from '../../components/games/Spotlight/focusWatchdog.ts'

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

// ── Kat durum makinesi ────────────────────────────────────────────────────────

/** Olayları sırayla uygular; tüm etkileri toplar */
function run(events: FocusEvent[], from: FocusState = createFocusState()) {
  let state = from
  const effects: FocusEffect[] = []
  for (const e of events) {
    const step = focusReduce(state, e)
    state = step.state
    effects.push(...step.effects)
  }
  return { state, effects }
}
const hides = (effects: FocusEffect[]) => effects.filter((e) => e.type === 'hide')
const fades = (effects: FocusEffect[]) => effects.filter((e) => e.type === 'startFade')
const logs = (effects: FocusEffect[]) => effects.filter((e) => e.type === 'log')

Deno.test('makine: normal yükleme — terfi, belirme bitince eski kat gizlenir', () => {
  const r = run([
    { type: 'retarget' },
    { type: 'load', layer: 1, ticket: 1 },
    { type: 'fadeDone', layer: 1 },
  ])
  assertEquals(fades(r.effects), [{ type: 'startFade', layer: 1 }])
  assertEquals(hides(r.effects), [{ type: 'hide', layer: 0, reason: 'settled' }])
  assertEquals(r.state.front, 1)
  assertEquals(r.state.incoming, null)
  assertEquals(logs(r.effects), [])
})

Deno.test('makine: normal yolda belirme bitmeden eski kat gizlenmez', () => {
  const r = run([{ type: 'retarget' }, { type: 'load', layer: 1, ticket: 1 }])
  assertEquals(hides(r.effects), [])
  assertEquals(r.state.front, 0)
})

Deno.test('makine: zaman aşımı → terfi eder ama eski kat opak kalır', () => {
  const r = run([{ type: 'retarget' }, { type: 'timeout' }, { type: 'fadeDone', layer: 1 }])
  assertEquals(fades(r.effects), [{ type: 'startFade', layer: 1 }])
  assertEquals(hides(r.effects), [])
  assertEquals(logs(r.effects), [{ type: 'log', code: 'SPOTLIGHT_STILL_LOAD_TIMEOUT', layer: 1 }])
  assertEquals(r.state.front, 0)
  assertEquals(r.state.incoming, 1)
  assertEquals(r.state.status[1], 'pending')
})

Deno.test('makine: zaman aşımından SONRA gelen geç yükleme kabul edilir, eski kat o zaman gizlenir', () => {
  // belirme zaten bitmişti → yükleme anında yerleşir
  const a = run([
    { type: 'retarget' },
    { type: 'timeout' },
    { type: 'fadeDone', layer: 1 },
    { type: 'load', layer: 1, ticket: 1 },
  ])
  assertEquals(hides(a.effects), [{ type: 'hide', layer: 0, reason: 'settled' }])
  assertEquals(a.state.front, 1)
  // belirme sürerken geldi → fadeDone yerleştirir
  const b = run([
    { type: 'retarget' },
    { type: 'timeout' },
    { type: 'load', layer: 1, ticket: 1 },
  ])
  assertEquals(hides(b.effects), [])
  const b2 = run([{ type: 'fadeDone', layer: 1 }], b.state)
  assertEquals(hides(b2.effects), [{ type: 'hide', layer: 0, reason: 'settled' }])
  assertEquals(b2.state.front, 1)
})

Deno.test('makine: zaman aşımı, yükleme hiç gelmez → eski kat asla gizlenmez', () => {
  const r = run([{ type: 'retarget' }, { type: 'timeout' }, { type: 'fadeDone', layer: 1 }])
  assertEquals(hides(r.effects), [])
  assertEquals(r.state.status[r.state.front], 'loaded')
})

Deno.test('makine: hata → başarısız işaretlenir, eski kat görünür kalır, kayıt düşer', () => {
  const r = run([{ type: 'retarget' }, { type: 'error', layer: 1, ticket: 1 }])
  assertEquals(r.state.status[1], 'failed')
  assertEquals(r.state.front, 0)
  assertEquals(r.state.incoming, null)
  assertEquals(logs(r.effects), [{ type: 'log', code: 'SPOTLIGHT_STILL_LOAD', layer: 1 }])
  // yalnız başarısız gelen kat gizlenir, ön kat asla
  assertEquals(hides(r.effects), [{ type: 'hide', layer: 1, reason: 'failed' }])
  assert(r.effects.some((e) => e.type === 'cancelWatchdog'))
})

Deno.test('makine: hatadan sonra yeniden hedefleme temiz başlar', () => {
  const r = run([
    { type: 'retarget' },
    { type: 'error', layer: 1, ticket: 1 },
    { type: 'retarget' },
    { type: 'load', layer: 1, ticket: 2 },
    { type: 'fadeDone', layer: 1 },
  ])
  assertEquals(r.state.front, 1)
  assertEquals(r.state.status[1], 'loaded')
})

Deno.test('makine: zaman aşımından sonra hata → ön kat kalır', () => {
  const r = run([
    { type: 'retarget' },
    { type: 'timeout' },
    { type: 'fadeDone', layer: 1 },
    { type: 'error', layer: 1, ticket: 1 },
  ])
  assertEquals(r.state.front, 0)
  assertEquals(r.state.incoming, null)
  assertEquals(hides(r.effects), [{ type: 'hide', layer: 1, reason: 'failed' }])
})

Deno.test('makine: bekleme sürerken yeniden hedefleme — aynı kat yeni bilet alır, eski yükleme elenir', () => {
  const r = run([
    { type: 'retarget' }, // ticket[1]=1
    { type: 'retarget' }, // ticket[1]=2
    { type: 'load', layer: 1, ticket: 1 }, // bayat
  ])
  assertEquals(r.state.ticket[1], 2)
  assertEquals(r.state.status[1], 'pending')
  assertEquals(fades(r.effects), [])
  const ok = run([{ type: 'load', layer: 1, ticket: 2 }], r.state)
  assertEquals(fades(ok.effects), [{ type: 'startFade', layer: 1 }])
})

Deno.test('makine: yeniden hedefleme taze bekçi ister', () => {
  const r = run([{ type: 'retarget' }, { type: 'retarget' }])
  assertEquals(r.effects.filter((e) => e.type === 'armWatchdog').length, 2)
})

Deno.test('makine A5: (eski yüklü, yeni bekliyor) → zaman aşımı → daha yeni hedef → sırasız geç yüklemeler', () => {
  let s = run([{ type: 'retarget' }, { type: 'timeout' }, { type: 'fadeDone', layer: 1 }]).state
  assertEquals(s.front, 0) // eski kat opak
  // daha yeni düzey: aynı gelen kat yeniden hedeflenir, eski kat hâlâ yerinde
  const re = run([{ type: 'retarget' }], s)
  s = re.state
  assertEquals(s.incoming, 1)
  assertEquals(s.ticket[1], 2)
  assertEquals(hides(re.effects), [])
  // geç yükleme (bilet 1) bayat → yok sayılır, kimse yerleşmez
  const stale = run([{ type: 'load', layer: 1, ticket: 1 }], s)
  assertEquals(stale.effects, [])
  assertEquals(stale.state.front, 0)
  // bilet 2 gelince yeni düzey yüklendi: terfi + yerleşme
  const ok = run([{ type: 'load', layer: 1, ticket: 2 }, { type: 'fadeDone', layer: 1 }], stale.state)
  assertEquals(ok.state.front, 1)
  assertEquals(hides(ok.effects), [{ type: 'hide', layer: 0, reason: 'settled' }])
  // en geç gelen bayat olay yerleşmiş durumu bozmaz
  const late = run([{ type: 'load', layer: 1, ticket: 1 }, { type: 'error', layer: 1, ticket: 1 }], ok.state)
  assertEquals(late.effects, [])
  assertEquals(late.state.front, 1)
})

Deno.test('makine A5: yerleştikten sonra ters yöne yeniden hedefleme (kat 0 gelen olur)', () => {
  const settled = run([
    { type: 'retarget' },
    { type: 'load', layer: 1, ticket: 1 },
    { type: 'fadeDone', layer: 1 },
  ]).state
  assertEquals(settled.front, 1)
  const r = run(
    [
      { type: 'retarget' },
      { type: 'load', layer: 0, ticket: 1 },
      { type: 'fadeDone', layer: 0 },
    ],
    settled,
  )
  assertEquals(r.state.front, 0)
  assertEquals(hides(r.effects), [{ type: 'hide', layer: 1, reason: 'settled' }])
})

Deno.test('makine: belirme sürerken yeniden hedefleme — eski belirme bitişi yerleştirmez', () => {
  const r = run([
    { type: 'retarget' },
    { type: 'load', layer: 1, ticket: 1 },
    { type: 'retarget' }, // belirme sürüyor, yeni düzey bekliyor
    { type: 'fadeDone', layer: 1 }, // eski belirmenin bitişi
  ])
  assertEquals(hides(r.effects), [])
  assertEquals(r.state.front, 0)
})

Deno.test('makine: hatadan sonra gelen geç yükleme ön katı bozmaz', () => {
  const r = run([
    { type: 'retarget' },
    { type: 'error', layer: 1, ticket: 1 },
    { type: 'load', layer: 1, ticket: 1 }, // gelen kat yok
    { type: 'fadeDone', layer: 1 },
  ])
  assertEquals(r.state.front, 0)
  assertEquals(fades(r.effects), [])
})

Deno.test('makine: ön katın kendi olayları ön katı bozmaz', () => {
  const r = run([
    { type: 'load', layer: 0, ticket: 0 },
    { type: 'error', layer: 0, ticket: 0 },
    { type: 'timeout' },
    { type: 'fadeDone', layer: 0 },
  ])
  assertEquals(r.effects, [])
  assertEquals(r.state.front, 0)
})

Deno.test('makine: unmount sonrası hiçbir olay etki üretmez', () => {
  const un = run([{ type: 'retarget' }, { type: 'unmount' }])
  assert(un.state.disposed)
  assert(un.effects.some((e) => e.type === 'cancelWatchdog'))
  const after = run(
    [
      { type: 'load', layer: 1, ticket: 1 },
      { type: 'timeout' },
      { type: 'error', layer: 1, ticket: 1 },
      { type: 'fadeDone', layer: 1 },
      { type: 'retarget' },
    ],
    un.state,
  )
  assertEquals(after.effects, [])
})

Deno.test('makine + bekçi: yükleme gelince bekçi iptal, zaman aşımı olayı üretilmez', () => {
  const clock = fakeClock()
  const wd = createLoadWatchdog(clock.scheduler, 1200)
  let state = createFocusState()
  const apply = (e: FocusEvent): void => {
    const step = focusReduce(state, e)
    state = step.state
    for (const eff of step.effects) {
      if (eff.type === 'armWatchdog') wd.arm(() => apply({ type: 'timeout' }))
      if (eff.type === 'cancelWatchdog') wd.cancel()
    }
  }
  apply({ type: 'retarget' })
  clock.advance(500)
  apply({ type: 'load', layer: 1, ticket: 1 })
  clock.advance(5000)
  assert(state.promoted)
  assertEquals(clock.pending(), 0)
})

Deno.test('makine + bekçi: süre dolarsa zaman aşımı olayı terfi ettirir, ön kat kalır', () => {
  const clock = fakeClock()
  const wd = createLoadWatchdog(clock.scheduler, 1200)
  let state = createFocusState()
  const seen: FocusEffect[] = []
  const apply = (e: FocusEvent): void => {
    const step = focusReduce(state, e)
    state = step.state
    seen.push(...step.effects)
    for (const eff of step.effects) {
      if (eff.type === 'armWatchdog') wd.arm(() => apply({ type: 'timeout' }))
      if (eff.type === 'cancelWatchdog') wd.cancel()
    }
  }
  apply({ type: 'retarget' })
  clock.advance(1200)
  assert(state.promoted)
  assertEquals(fades(seen), [{ type: 'startFade', layer: 1 }])
  assertEquals(state.front, 0)
})

/** Deterministik PRNG */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

Deno.test('makine değişmezi: rastgele olay dizilerinde eski kat yüklenmemiş katın uğruna gizlenmez', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rnd = mulberry32(seed)
    let state = createFocusState()
    for (let i = 0; i < 60; i++) {
      const layer = (rnd() < 0.5 ? 0 : 1) as 0 | 1
      // bilet: çoğunlukla güncel, bazen bayat
      const ticket = rnd() < 0.7 ? state.ticket[layer] : Math.max(0, state.ticket[layer] - 1)
      const pick = rnd()
      const event: FocusEvent =
        pick < 0.25 ? { type: 'retarget' }
        : pick < 0.5 ? { type: 'load', layer, ticket }
        : pick < 0.6 ? { type: 'error', layer, ticket }
        : pick < 0.75 ? { type: 'timeout' }
        : { type: 'fadeDone', layer }
      const before = state
      const step = focusReduce(state, event)
      state = step.state
      for (const eff of step.effects) {
        if (eff.type === 'hide' && eff.reason === 'settled') {
          // yerleşme: gizlenen kat önceki ön kat, öne geçen kat YÜKLÜ olmalı
          assertEquals(eff.layer, before.front)
          assertEquals(state.status[otherLayer(eff.layer)], 'loaded')
          assertEquals(state.front, otherLayer(eff.layer))
        }
        if (eff.type === 'hide' && eff.reason === 'failed') {
          // başarısız kat gizlenirken ön kat yerinde
          assert(eff.layer !== state.front)
        }
      }
      // ön kat daima yüklü; gelen kat ön kat olamaz
      assertEquals(state.status[state.front], 'loaded')
      assert(state.incoming !== state.front)
    }
  }
})
