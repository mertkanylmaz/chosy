/**
 * K-29 atomiklik testleri — `syncWatchedFromFeedback` (Karar 6b).
 *
 * Koşum:  cd supabase/functions && deno test --allow-read --allow-net _shared/watchFeedback.test.ts
 *
 * Kanıtlanan: `already_answered` dalının çağırdığı köprü (1) izleme ifade eden
 * kayıtlı cevapta eksik `watched_at`'i yazar — INSERT sonrası `markWatched`
 * hatasından kalan boşluk yeniden denemede kapanır; (2) `watched_at` doluysa
 * hiçbir yazım yapmaz (idempotent); (3) `not_watched`/`skipped`'ta watchlist'e
 * hiç gidilmez.
 *
 * Sahte `SupabaseClient`: `watchlist` satırlarını bellekte tutar, yapılan
 * yazımları (`insert`/`update`) kaydeder.
 */

import { assertEquals, assertRejects } from 'jsr:@std/assert@1'
import { syncWatchedFromFeedback, WATCHLIST_RESPONSES } from './watchFeedback.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

interface WatchRow {
  id: string
  watched_at: string | null
}

interface Fake {
  client: SupabaseClient
  writes: string[]
  touched: string[]
}

function fakeClient(existing: WatchRow | null, opts: { failInsert?: boolean } = {}): Fake {
  const writes: string[] = []
  const touched: string[] = []
  const client = {
    from(table: string) {
      touched.push(table)
      const done = (data: unknown, error: unknown = null) =>
        Promise.resolve({ data, error })
      const readChain = {
        eq: () => readChain,
        maybeSingle: () => done(existing),
      }
      return {
        select: () => readChain,
        insert: (row: Record<string, unknown>) => {
          writes.push(`insert:${String(row.film_id)}:${String(row.watched_source)}`)
          return opts.failInsert ? done(null, { message: 'boom' }) : done(null)
        },
        update: (patch: Record<string, unknown>) => ({
          eq: () => {
            writes.push(`update:${String(patch.watched_source)}`)
            return done(null)
          },
        }),
      }
    },
  }
  return { client: client as unknown as SupabaseClient, writes, touched }
}

Deno.test('WATCHLIST_RESPONSES: K-29 kümesi birebir (loved/ok/disliked/abandoned)', () => {
  assertEquals([...WATCHLIST_RESPONSES].sort(), ['abandoned', 'disliked', 'loved', 'ok'])
})

Deno.test('K-29: disliked → watched_at yazar (satisfaction sinyali, izlenmiş sayılır)', async () => {
  const f = fakeClient(null)
  const marked = await syncWatchedFromFeedback(f.client, 'u1', 'film1', 'disliked')
  assertEquals(marked, true)
  assertEquals(f.writes, ['insert:film1:gauntlet_feedback'])
})

Deno.test('K-29: satır yoksa (önceki markWatched düşmüş) yeniden denemede yazılır', async () => {
  const f = fakeClient(null)
  const marked = await syncWatchedFromFeedback(f.client, 'u1', 'film1', 'loved')
  assertEquals(marked, true)
  assertEquals(f.writes, ['insert:film1:gauntlet_feedback'])
})

Deno.test('K-29: satır var ama watched_at NULL → doldurulur', async () => {
  const f = fakeClient({ id: 'w1', watched_at: null })
  await syncWatchedFromFeedback(f.client, 'u1', 'film1', 'abandoned')
  assertEquals(f.writes, ['update:gauntlet_feedback'])
})

Deno.test('K-29: watched_at zaten dolu → hiçbir yazım yok (idempotent)', async () => {
  const f = fakeClient({ id: 'w1', watched_at: '2026-09-01T20:00:00.000Z' })
  const marked = await syncWatchedFromFeedback(f.client, 'u1', 'film1', 'ok')
  assertEquals(marked, true)
  assertEquals(f.writes, [])
})

Deno.test('K-29: not_watched / skipped → watchlist\'e hiç gidilmez', async () => {
  for (const response of ['not_watched', 'skipped'] as const) {
    const f = fakeClient(null)
    const marked = await syncWatchedFromFeedback(f.client, 'u1', 'film1', response)
    assertEquals(marked, false)
    assertEquals(f.touched, [])
  }
})

// 23505 yarış dalı (submit-watch-feedback/index.ts) `Deno.serve` içinde olduğundan
// doğrudan import edilemez; dal, KAYITLI cevapla bu köprüyü çağırır (already_answered
// dalıyla aynı). Aşağıdaki test o sözleşmeyi her kayıtlı değer için kilitler:
// watch-sınıfı → yazar, not_watched/skipped → watchlist'e hiç gidilmez.
Deno.test('K-29 yarış dalı: kayıtlı cevaba göre sync — watch sınıfı yazar, diğerleri dokunmaz', async () => {
  const cases: [Parameters<typeof syncWatchedFromFeedback>[3], boolean][] = [
    ['loved', true],
    ['ok', true],
    ['disliked', true],
    ['abandoned', true],
    ['not_watched', false],
    ['skipped', false],
  ]
  for (const [recorded, expectWrite] of cases) {
    const f = fakeClient(null)
    const marked = await syncWatchedFromFeedback(f.client, 'u1', 'film1', recorded)
    assertEquals(marked, expectWrite, recorded)
    assertEquals(f.writes.length, expectWrite ? 1 : 0, recorded)
    assertEquals(f.touched.length > 0, expectWrite, recorded)
  }
})

Deno.test('K-29: markWatched hatası yutulmaz (handler 503 döner, istemci yeniden dener)', async () => {
  const f = fakeClient(null, { failInsert: true })
  await assertRejects(
    () => syncWatchedFromFeedback(f.client, 'u1', 'film1', 'loved'),
    Error,
    'boom',
  )
})
