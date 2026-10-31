/**
 * MOOD-VEC-2d deploy sonrası duman testi (smoke 1-3). Kota tüketir: 5 parse + 1 rerank.
 * Çalıştır: npx tsx scripts/mood-eval/smoke-2d.ts
 */
import { envOrThrow, openEvalSession } from './session';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createClient } = require('@supabase/supabase-js');

type Json = Record<string, unknown>;

async function call(url: string, anon: string, token: string, fn: string, body: Json): Promise<{ status: number; ms: number; json: Json }> {
  const t0 = Date.now();
  const res = await fetch(`${url}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: anon },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Json;
  return { status: res.status, ms: Date.now() - t0, json };
}

async function main(): Promise<void> {
  const url = envOrThrow('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
  const anon = envOrThrow('SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY');
  const admin = createClient(url, envOrThrow('SUPABASE_SECRET_KEY'), { auth: { persistSession: false } });
  const s = await openEvalSession();
  const stamp = Date.now();
  const out: Record<string, unknown> = {};
  const cacheCount = async (): Promise<number> => {
    const { count, error } = await admin.from('mood_parse_cache').select('key', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
    return count ?? 0;
  };
  const lastSearches = async (n: number): Promise<unknown> => {
    const { data, error } = await admin.from('mood_searches').select('id,cache_hit,created_at').eq('user_id', s.appUserId).order('created_at', { ascending: false }).limit(n);
    if (error) throw new Error(error.message);
    return data;
  };
  const brief = (r: { status: number; ms: number; json: Json }): Json => ({
    status: r.status, ms: r.ms, has_cache_hit: 'cache_hit' in r.json, cache_hit: r.json.cache_hit,
    has_exclude_recent_ids: 'exclude_recent_ids' in r.json, titles: Array.isArray(r.json.suggested_titles) ? (r.json.suggested_titles as unknown[]).length : 'yok',
    code: r.json.code,
  });

  // Smoke 1 — v1 gövdesi: cache_hit / exclude_recent_ids YOK, suggested_titles YOK
  const c0 = await cacheCount();
  out.smoke1_v1 = brief(await call(url, anon, s.accessToken, 'parse-mood', { raw_input: `smoke v1 cozy evening ${stamp}` }));
  out.cache_rows_after_v1 = (await cacheCount()) - c0;

  // Smoke 2 — v2 + quick_mood_id, aynı metin iki kez
  const text = `Smoke test: a cozy, calm evening ${stamp}`;
  const q1 = await call(url, anon, s.accessToken, 'parse-mood', { raw_input: text, schema_version: 2, quick_mood_id: 'cozy' });
  const afterQ1 = await cacheCount();
  const q2 = await call(url, anon, s.accessToken, 'parse-mood', { raw_input: text, schema_version: 2, quick_mood_id: 'cozy' });
  out.smoke2_quick_first = brief(q1);
  out.smoke2_quick_second = brief(q2);
  out.cache_rows_delta_quick = afterQ1 - (c0);
  out.cache_rows_after_second = (await cacheCount()) - c0;
  out.searches_after_quick = await lastSearches(2);

  // Smoke 2b — quick_mood_id OLMADAN aynı metin iki kez
  const c1 = await cacheCount();
  const text2 = `Smoke test: free text without quick id ${stamp}`;
  const f1 = await call(url, anon, s.accessToken, 'parse-mood', { raw_input: text2, schema_version: 2 });
  const f2 = await call(url, anon, s.accessToken, 'parse-mood', { raw_input: text2, schema_version: 2 });
  out.smoke2b_free_first = brief(f1);
  out.smoke2b_free_second = brief(f2);
  out.cache_rows_written_free = (await cacheCount()) - c1;
  out.searches_after_free = await lastSearches(2);

  // Smoke 3 — rerank reason:true, TR mood, 30 aday
  const { data: films, error } = await s.supabase.from('films').select('id,title,original_title,overview,genres,year').not('overview', 'is', null).limit(30);
  if (error) throw new Error(error.message);
  const rr = await call(url, anon, s.accessToken, 'rerank-films', {
    mood_text: 'Bugün hafif ve sıcak, güldüren bir şey izlemek istiyorum',
    candidates: (films as Json[]).map((f) => ({ id: f.id, title: f.title, original_title: f.original_title, overview: String(f.overview ?? '').slice(0, 100), genres: f.genres, year: f.year, similarity: 0.5 })),
    count: 4,
    reason: true,
  });
  out.smoke3_rerank = { status: rr.status, ms: rr.ms, original_count: rr.json.original_count, reranked_count: rr.json.reranked_count, reasons_dropped: rr.json.reasons_dropped, reasons: rr.json.reasons };
  const rr1 = await call(url, anon, s.accessToken, 'rerank-films', {
    mood_text: 'a light, warm comedy',
    candidates: (films as Json[]).slice(0, 12).map((f) => ({ id: f.id, title: f.title, overview: String(f.overview ?? '').slice(0, 150), genres: f.genres, year: f.year, similarity: 0.5 })),
    count: 4,
  });
  out.smoke3_rerank_v1 = { status: rr1.status, keys: Object.keys(rr1.json), original_count: rr1.json.original_count };

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
