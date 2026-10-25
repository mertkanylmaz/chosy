/**
 * claim_mood_search GERÇEK eşzamanlılık testi (MONEY-1C, migration 139).
 *
 * Dry-run (BEGIN…ROLLBACK) tek işlemde koşar, eşzamanlılığı test EDEMEZ; bu test ayrı
 * bağlantılarla 10 paralel RPC çağırır.
 *
 * YALNIZ YEREL `supabase start` ÜZERİNDE KOŞAR. Canlıya karşı koşmaz:
 *   - `LOCAL_SUPABASE_URL` yoksa test ATLANIR (ignore) — `npm run test:mood-claim` ile karışmaz,
 *   - URL localhost/127.0.0.1 değilse test BAŞLAMADAN hata verir.
 *
 * Koşturma (yerel yığın migration 139'u içermelidir: `supabase db reset` / `supabase start`):
 *   $env:LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
 *   $env:LOCAL_SUPABASE_SERVICE_ROLE_KEY = '<supabase status çıktısındaki service_role key>'
 *   npm run test:mood-claim-concurrency
 *
 * Geçici test kullanıcısı oluşturur ve sonunda siler (user_daily_quotas / mood_searches cascade).
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

const URL_ENV = Deno.env.get('LOCAL_SUPABASE_URL')
const KEY_ENV = Deno.env.get('LOCAL_SUPABASE_SERVICE_ROLE_KEY')
const PARALLEL = 10

function assertLocal(url: string): void {
  const host = new URL(url).hostname
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`Eszamanlilik testi yalniz yerel Supabase'e karsi kosar; verilen host: ${host}`)
  }
}

async function makeClient() {
  assertLocal(URL_ENV!)
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
  return createClient(URL_ENV!, KEY_ENV!, { auth: { persistSession: false, autoRefreshToken: false } })
}

type Client = Awaited<ReturnType<typeof makeClient>>

async function withTempUser(fn: (db: Client, userId: string) => Promise<void>): Promise<void> {
  const db = await makeClient()
  const { data, error } = await db.from('users').insert({ auth_id: crypto.randomUUID() }).select('id').single()
  if (error || !data) throw new Error(`test kullanicisi olusturulamadi: ${error?.message}`)
  const userId = (data as { id: string }).id
  try {
    await fn(db, userId)
  } finally {
    const { error: delErr } = await db.from('users').delete().eq('id', userId)
    if (delErr) console.error(`test kullanicisi silinemedi (${userId}): ${delErr.message}`)
  }
}

async function searchesUsed(db: Client, userId: string): Promise<number> {
  const { data, error } = await db
    .from('user_daily_quotas')
    .select('searches_used')
    .eq('user_id', userId)
    .eq('date', new Date().toISOString().slice(0, 10))
    .maybeSingle()
  if (error) throw new Error(`kota okunamadi: ${error.message}`)
  return (data as { searches_used: number } | null)?.searches_used ?? 0
}

function claimAll(db: Client, userId: string, clientSearchId: string) {
  return Promise.all(
    Array.from({ length: PARALLEL }, () =>
      db.rpc('claim_mood_search', {
        p_user_id: userId,
        p_client_search_id: clientSearchId,
        p_mood_text: 'concurrency test',
        p_stale_seconds: 45,
      }),
    ),
  )
}

Deno.test({
  name: 'eszamanli 10 claim (ayni user + id): tam 1 claimed, 9 in_progress, kota tam 1',
  ignore: !URL_ENV || !KEY_ENV,
  async fn() {
    await withTempUser(async (db, userId) => {
      const results = await claimAll(db, userId, crypto.randomUUID())
      const bodies = results.map((r) => {
        assert(!r.error, `RPC hatasi: ${r.error?.message}`)
        return r.data as { result: string }
      })
      const count = (k: string) => bodies.filter((b) => b.result === k).length
      assertEquals(count('claimed'), 1, JSON.stringify(bodies))
      assertEquals(count('in_progress'), PARALLEL - 1, JSON.stringify(bodies))
      assertEquals(await searchesUsed(db, userId), 1)
    })
  },
})

Deno.test({
  name: 'eszamanli 10 bayat yeniden sahiplenme: tam 1 claimed; kota artmaz',
  ignore: !URL_ENV || !KEY_ENV,
  async fn() {
    await withTempUser(async (db, userId) => {
      const id = crypto.randomUUID()
      const first = await db.rpc('claim_mood_search', {
        p_user_id: userId, p_client_search_id: id, p_mood_text: 'x', p_stale_seconds: 45,
      })
      assert(!first.error, first.error?.message)
      // satiri bayatlat
      const { error: ageErr } = await db
        .from('mood_searches')
        .update({ claimed_at: new Date(Date.now() - 100_000).toISOString() })
        .eq('user_id', userId)
        .eq('client_search_id', id)
      assert(!ageErr, ageErr?.message)

      const results = await claimAll(db, userId, id)
      const bodies = results.map((r) => {
        assert(!r.error, `RPC hatasi: ${r.error?.message}`)
        return r.data as { result: string }
      })
      assertEquals(bodies.filter((b) => b.result === 'claimed').length, 1, JSON.stringify(bodies))
      assertEquals(bodies.filter((b) => b.result === 'in_progress').length, PARALLEL - 1, JSON.stringify(bodies))
      assertEquals(await searchesUsed(db, userId), 1) // ilk tuketim; ilk bedava yeniden sahiplenme tuketmez
    })
  },
})

Deno.test({
  name: 'eszamanli 10 FARKLI id (ayni user): kota limiti asilmaz',
  ignore: !URL_ENV || !KEY_ENV,
  async fn() {
    await withTempUser(async (db, userId) => {
      const { data: lim, error: limErr } = await db
        .from('subscription_limits').select('daily_search_limit').eq('tier', 'free').single()
      assert(!limErr && lim, limErr?.message)
      const limit = (lim as { daily_search_limit: number }).daily_search_limit

      const results = await Promise.all(
        Array.from({ length: PARALLEL }, () =>
          db.rpc('claim_mood_search', {
            p_user_id: userId, p_client_search_id: crypto.randomUUID(), p_mood_text: 'x', p_stale_seconds: 45,
          }),
        ),
      )
      const bodies = results.map((r) => {
        assert(!r.error, `RPC hatasi: ${r.error?.message}`)
        return r.data as { result: string }
      })
      assertEquals(bodies.filter((b) => b.result === 'claimed').length, limit, JSON.stringify(bodies))
      assertEquals(bodies.filter((b) => b.result === 'quota_denied').length, PARALLEL - limit, JSON.stringify(bodies))
      assertEquals(await searchesUsed(db, userId), limit)
    })
  },
})
