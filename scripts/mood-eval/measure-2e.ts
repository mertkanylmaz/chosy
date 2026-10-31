/**
 * MOOD-VEC-2e ölçümü — Edge Function DIŞINDA, doğrudan Anthropic API (Haiku 4.5).
 * 5 mood × 2 tekrar: A (profil, tool_use), B (v2 alanları, tool_use), max(A,B) ve eski tek-çağrı
 * v2 (metin JSON) referansı. Ayrıca prompt caching eşiği yoklaması.
 *
 * Çalıştır: npx tsx scripts/mood-eval/measure-2e.ts
 * Ücret: ~40 küçük Haiku çağrısı. Sunucu kotasına dokunmaz (Edge'e gitmez).
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { V2_PROMPT_ADDENDUM } from '../../supabase/functions/_shared/moodV2';

// moodParseTools.ts Deno için '.ts' uzantılı import kullanır; kök tsc bunu kabul etmez → dinamik yükleme.
interface Tools {
  runParseV2: (create: CreateFn, systemA: string, raw: string) => Promise<{
    a: { ms: number; tokensIn: number; tokensOut: number; schemaFailures: number; value: unknown };
    b: { ms: number; tokensIn: number; tokensOut: number; schemaFailures: number; value: unknown };
    totalMs: number;
  }>;
  PROFILE_TOOL: unknown;
}
type CreateFn = (params: Record<string, unknown>, timeoutMs: number) => Promise<{
  usage?: { input_tokens?: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null };
}>;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Anthropic = require('@anthropic-ai/sdk').default ?? require('@anthropic-ai/sdk');

const MOOD_IDS = ['qm_cozy', 'qm_adrenaline', 'ft_90min', 'ft_like_interstellar', 'ft_tr_gerilim'];
const REPEATS = 2;
const OUT = path.join(__dirname, '..', '..', 'docs', 'investigations', 'mood-vec-2e');

function systemPromptFromServer(): string {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'functions', 'parse-mood', 'index.ts'), 'utf8');
  const m = /const SYSTEM_PROMPT = `([\s\S]*?)`\r?\n\r?\n\/\/ ─── Quota Check/.exec(src);
  if (!m) throw new Error('SYSTEM_PROMPT parse-mood/index.ts içinde bulunamadı');
  return m[1];
}

const p50 = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
};

interface Row {
  mood: string; run: number; a_ms: number; b_ms: number; max_ms: number; old_ms: number;
  a_in: number; a_out: number; b_in: number; b_out: number; old_in: number; old_out: number;
  a_schema_fail: number; b_schema_fail: number; a_ok: boolean; b_ok: boolean;
}

async function main(): Promise<void> {
  const toolsPath = '../../supabase/functions/_shared/moodParseTools';
  const { runParseV2, PROFILE_TOOL } = (await import(toolsPath)) as Tools;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY (.env) yok');
  const client = new Anthropic({ apiKey: key, timeout: 25_000, maxRetries: 0 });
  const systemA = systemPromptFromServer();
  const moods = (JSON.parse(fs.readFileSync(path.join(__dirname, 'moods.json'), 'utf8')) as { id: string; text: string }[])
    .filter((m) => MOOD_IDS.includes(m.id));
  if (moods.length !== MOOD_IDS.length) throw new Error('moods.json beklenen 5 mood yok');

  const create: CreateFn = (params, timeoutMs) => client.messages.create(params, { timeout: timeoutMs });
  const rows: Row[] = [];

  for (const mood of moods) {
    for (let run = 1; run <= REPEATS; run++) {
      const r = await runParseV2(create, systemA, mood.text);
      // Eski referans: tek çağrı, metin JSON (2d yolu).
      const t0 = Date.now();
      const old = await client.messages.create({
        model: 'claude-haiku-4-5', max_tokens: 1280, system: systemA + V2_PROMPT_ADDENDUM,
        messages: [{ role: 'user', content: mood.text }],
      });
      const oldMs = Date.now() - t0;
      rows.push({
        mood: mood.id, run, a_ms: r.a.ms, b_ms: r.b.ms, max_ms: r.totalMs, old_ms: oldMs,
        a_in: r.a.tokensIn, a_out: r.a.tokensOut, b_in: r.b.tokensIn, b_out: r.b.tokensOut,
        old_in: old.usage.input_tokens, old_out: old.usage.output_tokens,
        a_schema_fail: r.a.schemaFailures, b_schema_fail: r.b.schemaFailures,
        a_ok: r.a.value !== null, b_ok: r.b.value !== null,
      });
      console.log(`${mood.id} #${run}: A ${r.a.ms} ms, B ${r.b.ms} ms, max ${r.totalMs} ms, eski ${oldMs} ms`);
    }
  }

  // Prompt caching yoklaması: A sistem prompt'u cache_control ile iki kez.
  const probe: Record<string, number>[] = [];
  for (let i = 0; i < 2; i++) {
    const msg = await create(
      {
        model: 'claude-haiku-4-5', max_tokens: 1024,
        system: [{ type: 'text', text: systemA, cache_control: { type: 'ephemeral' } }],
        tools: [PROFILE_TOOL],
        tool_choice: { type: 'tool', name: 'emit_taste_profile' },
        messages: [{ role: 'user', content: moods[0].text }],
      },
      25_000,
    );
    probe.push({
      input_tokens: msg.usage?.input_tokens ?? 0,
      cache_creation: msg.usage?.cache_creation_input_tokens ?? 0,
      cache_read: msg.usage?.cache_read_input_tokens ?? 0,
    });
  }

  const col = (f: (r: Row) => number): number => p50(rows.map(f));
  const summary = {
    n: rows.length,
    p50: { a_ms: col((r) => r.a_ms), b_ms: col((r) => r.b_ms), max_ms: col((r) => r.max_ms), old_ms: col((r) => r.old_ms) },
    schema_failures: { a: rows.reduce((s, r) => s + r.a_schema_fail, 0), b: rows.reduce((s, r) => s + r.b_schema_fail, 0) },
    unrecovered: { a: rows.filter((r) => !r.a_ok).length, b: rows.filter((r) => !r.b_ok).length },
    cache_probe: probe,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'measure.json'), JSON.stringify({ summary, rows }, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
