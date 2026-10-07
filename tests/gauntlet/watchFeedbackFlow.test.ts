/**
 * Watch-feedback akışı (T3) — durum geçişleri, hangi olayın hangi satırı
 * yazdığı, gönderim yeniden denemesi, poster ölçüsü.
 *
 * Koşum: npm run test:watch-feedback
 *
 * Not: repoda React Native render altyapısı (jest/RNTL) YOK; bileşenin
 * davranışı saf mantığa (`feedbackFlow.ts`) çıkarıldı ve burada test edilir.
 * "Unmount satır yazmaz" garantisi yapısaldır: kartın `onRespond`'u yalnız
 * `reduceFlow`'un `emit` değerinden çağrılır ve modülde unmount/blur diye bir
 * olay YOKTUR (aşağıda ilk iki test).
 */
import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  INITIAL_FLOW,
  RETRY_DELAY_MS,
  RetryExhaustedError,
  posterSize,
  reduceFlow,
  shownEvents,
  submitWithRetry,
  type FlowEvent,
  type FlowState,
} from '../../components/gauntlet/PendingWatchFeedbackCard/feedbackFlow.ts';

const FILM = 'film-1';

/** Olayları sırayla uygular; her adımdaki sonucu döner. */
function run(events: FlowEvent[], from: FlowState = INITIAL_FLOW) {
  let state = from;
  const emitted: (string | null)[] = [];
  const tracked: string[] = [];
  for (const e of events) {
    const r = reduceFlow(state, e, FILM);
    state = r.state;
    emitted.push(r.emit);
    r.events.forEach((t) => tracked.push(t.name));
  }
  return { state, emitted, tracked };
}

// ─── State geçişleri ─────────────────────────────────────────────────────────

Deno.test('Yes tek başına satır YAZMAZ, State 2\'ye geçer', () => {
  const r = reduceFlow(INITIAL_FLOW, 'yes', FILM);
  assertEquals(r.emit, null);
  assertEquals(r.state, { step: 'satisfaction', submitted: false });
  assertEquals(r.accepted, true);
  assertEquals(r.events, []);
});

Deno.test('hiç cevap yok (unmount / sekme değişimi): hiçbir emit yok', () => {
  // Kart yalnızca mount olur ve `shownEvents` atar; emit kaynağı yalnız reduceFlow.
  assertEquals(shownEvents(FILM).map((e) => e.name), ['outcome_shown', 'watched_prompted']);
  // Yes → (kullanıcı Profile'a gider, hiçbir şey olmaz): durum satisfaction, emit yok.
  const { emitted, state } = run(['yes']);
  assertEquals(emitted, [null]);
  assertEquals(state.submitted, false);
});

Deno.test('Back State 1\'e döner; satır yazılmaz', () => {
  const { state, emitted } = run(['yes', 'back']);
  assertEquals(state, { step: 'outcome', submitted: false });
  assertEquals(emitted, [null, null]);
});

Deno.test('State 2\'de Skip YOK: skip / not_yet / yes yok sayılır', () => {
  for (const e of ['skip', 'not_yet', 'yes'] as const) {
    const r = reduceFlow({ step: 'satisfaction', submitted: false }, e, FILM);
    assertEquals(r.accepted, false, e);
    assertEquals(r.emit, null, e);
  }
});

Deno.test('State 1\'de satisfaction ve back yok sayılır', () => {
  for (const e of ['loved', 'ok', 'disliked', 'back'] as const) {
    const r = reduceFlow(INITIAL_FLOW, e, FILM);
    assertEquals(r.accepted, false, e);
    assertEquals(r.emit, null, e);
  }
});

// ─── Yazım matrisi (K-29) ────────────────────────────────────────────────────

Deno.test('Not yet → not_watched · Skip → skipped (ayrı değerler, birleşmez)', () => {
  assertEquals(reduceFlow(INITIAL_FLOW, 'not_yet', FILM).emit, 'not_watched');
  assertEquals(reduceFlow(INITIAL_FLOW, 'skip', FILM).emit, 'skipped');
});

Deno.test('Yes → satisfaction: loved / ok / disliked eşlemesi (abandoned YOK)', () => {
  const sat: Record<string, string | null> = {};
  for (const e of ['loved', 'ok', 'disliked'] as const) {
    sat[e] = run(['yes', e]).emitted[1];
  }
  assertEquals(sat, { loved: 'loved', ok: 'ok', disliked: 'disliked' });
  // Kullanıcı arayüzünden `abandoned` üretecek bir olay yok.
  const all: FlowEvent[] = ['yes', 'not_yet', 'skip', 'back', 'loved', 'ok', 'disliked'];
  for (const e of all) {
    assertEquals(run([e]).emitted.includes('abandoned'), false);
    assertEquals(run(['yes', e]).emitted.includes('abandoned'), false);
  }
});

Deno.test('Çift tap: ilk cevaptan sonra her olay yok sayılır (tek emit)', () => {
  const { emitted } = run(['not_yet', 'not_yet', 'skip', 'yes']);
  assertEquals(emitted, ['not_watched', null, null, null]);
  const sat = run(['yes', 'loved', 'loved', 'disliked']);
  assertEquals(sat.emitted, [null, 'loved', null, null]);
});

Deno.test('Back sonrası Skip mümkün (State 1\'e dönüldü)', () => {
  assertEquals(run(['yes', 'back', 'skip']).emitted, [null, null, 'skipped']);
});

// ─── Analitik ────────────────────────────────────────────────────────────────

Deno.test('disliked: watched_confirmed kolu (T0 hatası: watched_not_yet\'e düşmemeli)', () => {
  const r = reduceFlow({ step: 'satisfaction', submitted: false }, 'disliked', FILM);
  const names = r.events.map((e) => e.name);
  assertEquals(names, ['outcome_answered', 'satisfaction_answered', 'watched_confirmed']);
  assertEquals(names.includes('watched_not_yet'), false);
  assertEquals(r.events[0].props, { film_id: FILM, type: 'watched' });
  assertEquals(r.events[1].props, { film_id: FILM, value: 'disliked' });
  assertEquals(r.events[2].props, { response: 'disliked' });
});

Deno.test('Not yet ve Skip olayları', () => {
  const ny = reduceFlow(INITIAL_FLOW, 'not_yet', FILM);
  assertEquals(ny.events.map((e) => e.name), ['outcome_answered', 'watched_not_yet']);
  assertEquals(ny.events[0].props, { film_id: FILM, type: 'not_yet' });

  const sk = reduceFlow(INITIAL_FLOW, 'skip', FILM);
  // Skip yalnızca outcome_answered(type: skipped) atar — ayrı bir outcome_skipped YOK.
  assertEquals(sk.events.map((e) => e.name), ['outcome_answered', 'watched_not_yet']);
  assertEquals(sk.events[0].props, { film_id: FILM, type: 'skipped' });
});

Deno.test('yok sayılan olay analitik üretmez', () => {
  const r = reduceFlow({ step: 'outcome', submitted: true }, 'skip', FILM);
  assertEquals(r.events, []);
});

// ─── Gönderim yeniden denemesi (B1) ──────────────────────────────────────────

Deno.test('submitWithRetry: ilk deneme başarılıysa beklemez, tek çağrı', async () => {
  let calls = 0;
  const sleeps: number[] = [];
  const v = await submitWithRetry(
    () => {
      calls++;
      return Promise.resolve('ok');
    },
    { sleep: (ms) => { sleeps.push(ms); return Promise.resolve(); } },
  );
  assertEquals(v, 'ok');
  assertEquals(calls, 1);
  assertEquals(sleeps, []);
});

Deno.test('submitWithRetry: ilk hata → backoff → ikinci deneme başarılı', async () => {
  let calls = 0;
  const sleeps: number[] = [];
  const v = await submitWithRetry(
    () => {
      calls++;
      return calls === 1 ? Promise.reject(new Error('503')) : Promise.resolve('ok');
    },
    { sleep: (ms) => { sleeps.push(ms); return Promise.resolve(); } },
  );
  assertEquals(v, 'ok');
  assertEquals(calls, 2);
  assertEquals(sleeps, [RETRY_DELAY_MS]);
});

Deno.test('submitWithRetry: iki hata → RetryExhaustedError, ikisi de taşınır, yutulmaz', async () => {
  let calls = 0;
  const err = await assertRejects(
    () =>
      submitWithRetry(
        () => {
          calls++;
          return Promise.reject(new Error(`fail-${calls}`));
        },
        { sleep: () => Promise.resolve() },
      ),
    RetryExhaustedError,
  );
  assertEquals(calls, 2); // en fazla BİR yeniden deneme
  assertEquals((err.first as Error).message, 'fail-1');
  assertEquals((err.last as Error).message, 'fail-2');
});

// ─── Poster (küçük ekran) ────────────────────────────────────────────────────

Deno.test('posterSize: 2:3 sabit, kalan yükseklikten türer', () => {
  // SE sınıfı: dar yükseklik slotu → poster yüksekliği slota eşit, oran 2:3.
  const small = posterSize(311, 180);
  assertEquals(small.height, 180);
  assertEquals(small.width, 120);

  // Geniş slot: genişlik oranı (0.6) üst sınırdır, poster slotu doldurmaz.
  const big = posterSize(311, 600);
  assertEquals(big.height, Math.floor(311 * 0.6 * 1.5));
  assertEquals(big.width, Math.floor((big.height * 2) / 3));
});

Deno.test('posterSize: ölçülmemiş slot (0) → boyutsuz, çökmez', () => {
  assertEquals(posterSize(0, 0), { width: 0, height: 0 });
  assertEquals(posterSize(300, 0), { width: 0, height: 0 });
});
