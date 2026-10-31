/**
 * MOOD-VEC-2e-2: parse-mood v2 ölçümü EDGE ÜZERİNDEN (istemci toplam süresi + Server-Timing aşamaları).
 * 7 durum × 2 tekrar = 14 çağrı. Kota tüketir (eval hesabı); rerank ÇAĞIRMAZ.
 *
 *   npx tsx scripts/mood-eval/measure-2e-edge.ts <etiket>      # etiket: before | after
 *
 * Durumlar: cozy/adrenaline quick_mood_id İLE ve İLE OLMADAN, ft_90min, ft_like_interstellar, ft_tr_gerilim.
 * quick_mood_id'li ilk çağrı önbellek ıskası ya da (aynı prompt sürümü daha önce yazıldıysa) isabet olabilir;
 * her satırda cache_hit yazılır.
 */
import * as fs from 'fs';
import * as path from 'path';
import { GAUNTLET_EDGE_REGION } from '../../constants/edgeRegion';
import { envOrThrow, openEvalSession } from './session';

// MEASURE_APP=1: uygulama gibi — x-region + forceFunctionRegion ve client_search_id (claim yolu). Yoksa çıplak çağrı.
const APP_LIKE = process.env.MEASURE_APP === '1';

const CASES: { label: string; mood: string; quick?: string }[] = [
  { label: 'cozy+qid', mood: 'qm_cozy', quick: 'cozy' },
  { label: 'cozy', mood: 'qm_cozy' },
  { label: 'adrenaline+qid', mood: 'qm_adrenaline', quick: 'adrenaline' },
  { label: 'adrenaline', mood: 'qm_adrenaline' },
  { label: 'ft_90min', mood: 'ft_90min' },
  { label: 'ft_like_interstellar', mood: 'ft_like_interstellar' },
  { label: 'ft_tr_gerilim', mood: 'ft_tr_gerilim' },
];
const REPEATS = 2;
const OUT = path.join(__dirname, '..', '..', 'docs', 'investigations', 'mood-vec-2e');

interface Row {
  label: string; run: number; status: number; client_ms: number; cache_hit: boolean | null;
  stages: Record<string, number>; code?: string;
}

function parseServerTiming(h: string | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!h) return out;
  for (const part of h.split(',')) {
    const m = /^\s*([\w-]+);dur=([\d.]+)/.exec(part);
    if (m) out[m[1]] = Number(m[2]);
  }
  return out;
}

const p50 = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
};

async function main(): Promise<void> {
  const tag = process.argv[2];
  if (!tag) throw new Error('etiket gerekli: before | after');
  const url = envOrThrow('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
  const anon = envOrThrow('SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY');
  const session = await openEvalSession();
  const moods = JSON.parse(fs.readFileSync(path.join(__dirname, 'moods.json'), 'utf8')) as { id: string; text: string }[];
  const rows: Row[] = [];

  for (const c of CASES) {
    const mood = moods.find((m) => m.id === c.mood);
    if (!mood) throw new Error(`mood yok: ${c.mood}`);
    for (let run = 1; run <= REPEATS; run++) {
      const body = {
        raw_input: mood.text, schema_version: 2,
        ...(c.quick ? { quick_mood_id: c.quick } : {}),
        ...(APP_LIKE ? { client_search_id: crypto.randomUUID() } : {}),
      };
      const t0 = Date.now();
      const res = await fetch(`${url}/functions/v1/parse-mood${APP_LIKE ? `?forceFunctionRegion=${GAUNTLET_EDGE_REGION}` : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}`, apikey: anon,
          ...(APP_LIKE ? { 'x-region': GAUNTLET_EDGE_REGION } : {}),
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as Record<string, unknown>;
      const row: Row = {
        label: c.label, run, status: res.status, client_ms: Date.now() - t0,
        cache_hit: typeof json.cache_hit === 'boolean' ? json.cache_hit : null,
        stages: parseServerTiming(res.headers.get('server-timing')),
        ...(res.status === 200 ? {} : { code: String(json.code) }),
      };
      rows.push(row);
      console.log(`${c.label} #${run}: ${row.status} ${row.client_ms} ms hit=${String(row.cache_hit)} ${JSON.stringify(row.stages)}`);
    }
  }

  const ok = rows.filter((r) => r.status === 200);
  const summary = {
    tag,
    uncached_p50_ms: p50(ok.filter((r) => r.cache_hit === false).map((r) => r.client_ms)),
    cached_p50_ms: p50(ok.filter((r) => r.cache_hit === true).map((r) => r.client_ms)),
    uncached_n: ok.filter((r) => r.cache_hit === false).length,
    cached_n: ok.filter((r) => r.cache_hit === true).length,
    failures: rows.filter((r) => r.status !== 200).length,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `edge-${tag}.json`), JSON.stringify({ summary, rows }, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
