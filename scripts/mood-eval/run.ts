#!/usr/bin/env tsx
/**
 * MOOD-VEC-1 — mood öneri hattı çevrimdışı değerlendirme betiği.
 *
 * Uygulamanın (b38b9d6 sonrası) ilk-batch hattını soğuk başlangıç, filtresiz,
 * exclude'suz koşturur: parse-mood → tasteProfileToVector → match_films_v3
 * (gevşetme zinciri) → rerank-films → kalite süzgeci. Puanlama YAPMAZ.
 *
 * Kullanım (hepsi devam ettirilebilir; var olan çıktı yeniden üretilmez):
 *   npx tsx scripts/mood-eval/run.ts --limit 1
 *   npx tsx scripts/mood-eval/run.ts --variant V0,V2
 *   npx tsx scripts/mood-eval/run.ts --variant V1 --stage rpc
 *   npx tsx scripts/mood-eval/run.ts --variant V1 --stage rerank     (ertesi UTC günü)
 *   npx tsx scripts/mood-eval/run.ts --report                        (yalnız rapor)
 * Bayraklar: --reparse (parse'ı zorla), --limit N, --mood <id>, --variant, --stage rpc|rerank|all.
 *
 * 2d (V4 = V3 + önbellekli parse, 6 öneri, rerank 20 aday/15 kelime; DEPLOY SONRASI koşulur):
 *   MOOD_EVAL_OUT=docs/investigations/mood-vec-2d/eval npx tsx scripts/mood-eval/run.ts --variant V4
 *   MOOD_EVAL_OUT=docs/investigations/mood-vec-2d/eval npx tsx scripts/mood-eval/run.ts --cached-pass
 *   MOOD_EVAL_OUT=docs/investigations/mood-vec-2d/eval npx tsx scripts/mood-eval/summary-2d.ts
 *   --cached-pass: yalnız 8 quick mood; parse-mood'u AYNI metinle ikinci kez çağırır (cache_hit şart),
 *   RPC + rerank'i (yerel rerank önbelleği KAPALI) yeniden ölçer. Her çağrı arama kotası tüketir.
 *
 * Kimlik: kalıcı anonim eval hesabı (session.ts, .session.json — repoya girmez).
 * Gizli bilgi loglanmaz. Service role kullanılmaz.
 *
 * ── Kopya notu ────────────────────────────────────────────────────────────
 * Uygulama modülleri (AsyncStorage / Sentry RN / posthog) Node'da yüklenemez ve
 * ilgili fonksiyonlar export edilmez; bu yüzden aşağıdaki parçalar kopyalanmıştır.
 * Kaynak karşılıkları (b38b9d6 sonrası):
 *   callMatchFilmsV3 + argümanlar ...... services/recommendations.ts:616-647
 *   getFilmsWithRelaxation ............. services/recommendations.ts:903-958
 *   callRerankFilms gövdesi ............ services/recommendations.ts:791-831
 *   reorderByRerankedIds ............... services/recommendations.ts:867-889 (common.ts)
 *   rerank → kalite süzgeci sırası ..... services/recommendations.ts:1261-1331
 *   validateAndNormalize ............... services/tasteParser.ts:186-255
 *   parse-mood isteği .................. services/tasteParser.ts:122-133
 * Doğrudan import: vectorEncoder, relaxationChain, moodQualityGate (aynı kod).
 * Kopyanın eskimesini `parityCheck()` açılışta kaynak dosyalardan doğrular.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { GAUNTLET_EDGE_REGION } from '../../constants/edgeRegion';
import { FINAL_CAP, RELATIVE_QUALITY_FLOOR } from '../../utils/moodQualityGate';
import { DEFAULT_BASE_RATING, buildRelaxationSteps } from '../../utils/relaxationChain';
import { VECTOR_DIM, VECTOR_LAYOUT, tasteProfileToVector, type TasteProfile } from '../../services/vectorEncoder';

import {
  ALL_VARIANTS, CACHED_PASS_DIR, CACHE_DIR, LEDGER_FILE, LEGACY_PARSED_DIR, PARSED_DIR, PARSED_V2_DIR,
  PARSED_V4_DIR, RAW_DIR, VARIANTS,
  loadMoods, rawFile, readJson, writeJson,
  type CachedPassRecord, type Ledger, type Mood, type ParsedFile, type RawRecord, type RerankRecord, type Row,
  type Variant,
} from './common';
import { buildReports } from './report';
import { envOrThrow, openEvalSession, type EvalSession } from './session';

// ─── Betik sabitleri (parityCheck uygulamayla karşılaştırır) ─────────────────

const C = {
  FIRST_BATCH_MATCH_COUNT: 30,
  RERANK_COUNT: 8,
  RERANK_OVERVIEW_MAX: 150,
  APP_RERANK_TIMEOUT_MS: 6_000,
  PER_DIRECTOR_CAP: 1,
  TARGET_COUNT: 8,
  V2_RERANK_CANDIDATES: 20,
  V2_OVERVIEW_MAX: 100,
  V3_MATCH_COUNT: 40,
  V3_RERANK_COUNT: 4,
  MIN_LLM_GAP_MS: 6_500,
  RPC_GAP_MS: 1_500,
  CAP_PARSE_TOTAL: 25,
  CAP_PARSE_CACHED_TOTAL: 10,
  CAP_RERANK_TOTAL: 50,
  CAP_RERANK_PER_UTC_DAY: 55,
  HTTP_TIMEOUT_MS: 40_000,
  TOKEN_MAX_AGE_MS: 40 * 60_000,
} as const;

class StopError extends Error {}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ─── Argümanlar ──────────────────────────────────────────────────────────────

interface Args {
  limit: number | null;
  mood: string | null;
  variants: Variant[];
  stage: 'rpc' | 'rerank' | 'all';
  reparse: boolean;
  reportOnly: boolean;
  cachedPass: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | null => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
  };
  const vRaw = get('--variant');
  const variants = vRaw ? (vRaw.split(',') as Variant[]) : [...VARIANTS];
  for (const v of variants) if (!ALL_VARIANTS.includes(v)) throw new Error(`Bilinmeyen varyant: ${v}`);
  const stage = (get('--stage') ?? 'all') as Args['stage'];
  if (!['rpc', 'rerank', 'all'].includes(stage)) throw new Error(`Bilinmeyen stage: ${stage}`);
  const limit = get('--limit');
  return {
    limit: limit ? Number(limit) : null,
    mood: get('--mood'),
    variants,
    stage,
    reparse: argv.includes('--reparse'),
    reportOnly: argv.includes('--report'),
    cachedPass: argv.includes('--cached-pass'),
  };
}

// ─── Parite kontrolü ─────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

interface Check { name: string; expected: string; actual: string }

function firstMatch(src: string, re: RegExp): string {
  const m = re.exec(src);
  return m ? (m[1] ?? 'var') : 'YOK';
}

async function parityCheck(moods: Mood[], session: EvalSession): Promise<void> {
  const rec = read('services/recommendations.ts');
  const parser = read('services/tasteParser.ts');
  const rerankFn = read('supabase/functions/rerank-films/index.ts');
  const blend = read('services/userVectorRefresh.ts');
  const screen = read('components/Home/MoodSearchScreen/index.tsx');
  const v3Start = rec.indexOf('async function callMatchFilmsV3');
  const v3Body = rec.slice(v3Start, rec.indexOf('async function callMatchFilmsV1'));
  const steps = buildRelaxationSteps(null, null);
  const checks: Check[] = [];
  const add = (name: string, expected: unknown, actual: unknown): void => {
    checks.push({ name, expected: String(expected), actual: String(actual) });
  };

  add('FIRST_BATCH_MATCH_COUNT', C.FIRST_BATCH_MATCH_COUNT, firstMatch(rec, /const FIRST_BATCH_MATCH_COUNT = (\d+)/));
  add('RERANK_TIMEOUT_MS (app)', C.APP_RERANK_TIMEOUT_MS, firstMatch(rec, /const RERANK_TIMEOUT_MS = ([\d_]+)/).replace(/_/g, ''));
  add('TARGET_COUNT', C.TARGET_COUNT, firstMatch(rec, /const TARGET_COUNT = (\d+)/));
  add('getRecommendations limit varsayılanı = rerank count', C.RERANK_COUNT,
    firstMatch(rec, /export async function getRecommendations\(\s*profile: TasteProfile,\s*limit = (\d+)/));
  add('rerank çağrısı count=limit', 'var', /callRerankFilms\(\s*moodText,\s*data,\s*limit,?\s*\)/.test(rec) ? 'var' : 'YOK');
  add('rerank overview kırpma', C.RERANK_OVERVIEW_MAX, firstMatch(rec, /overview: \(c\.overview \?\? ''\)\.slice\(0, (\d+)\)/));
  add('rerank gövde alanları', 'var',
    /id: c\.id,\s*title: c\.title,\s*overview:[^\n]*\n\s*genres: c\.genres,\s*year: c\.year,\s*similarity: c\.similarity,/.test(rec) ? 'var' : 'YOK');
  add('per_director_cap (v3)', C.PER_DIRECTOR_CAP, firstMatch(rec, /per_director_cap: (\d+),\s*\/\/ v3/));
  add('tier_boost kaynağı', 'var', /tier_boost: V2_CONFIG\.tier_boost/.test(v3Body) ? 'var' : 'YOK');
  add('V2_CONFIG.tier_boost', 'true', firstMatch(rec, /tier_boost: (true|false),\s*\/\/ Phase 2/));
  add('exclude_archive', 'true', firstMatch(v3Body, /exclude_archive: (true|false)/));
  add('RPC adı', 'var', /supabase\.rpc\('match_films_v3'/.test(v3Body) ? 'var' : 'YOK');
  add('RPC argüman anahtarları', 'tamam',
    ['query_vector', 'user_vector', 'mood_weight', 'user_weight', 'match_count', 'min_similarity', 'min_rating',
      'year_from', 'year_to', 'exclude_ids', 'search_keywords', 'per_director_cap', 'tier_boost', 'exclude_archive']
      .every((k) => v3Body.includes(k)) ? 'tamam' : 'EKSİK');
  add('era yalnız filtreden (year_from/year_to)', 'var',
    /const era\s*=\s*filters\?\.yearRange \? yearRangeToEra\(filters\.yearRange\) : null/.test(rec) ? 'var' : 'YOK');
  add('soğuk başlangıç ağırlıkları (<6 sinyal)', 'var',
    /if \(signalCount < 6\) return \{ moodWeight: 1\.0, userWeight: 0\.0 \}/.test(blend) ? 'var' : 'YOK');
  add('kalite süzgeci rerank SONRASI', 'doğru',
    rec.indexOf('await callRerankFilms(') > 0 && rec.indexOf('applyQualityGate(data)') > rec.indexOf('await callRerankFilms(') ? 'doğru' : 'YANLIŞ');
  add('rerank edge aday üst sınırı', 50, firstMatch(rerankFn, /body\.candidates\.slice\(0, (\d+)\)/));
  add('rerank edge overview kırpma (v1 yolu)', C.RERANK_OVERVIEW_MAX, firstMatch(rerankFn, /const overviewMax = withReason \? REASON_OVERVIEW_MAX : (\d+)/));
  add('rerank edge overview kırpma (reason yolu)', C.V2_OVERVIEW_MAX, firstMatch(rerankFn, /const REASON_OVERVIEW_MAX = (\d+)/));
  add('rerank edge reason aday sınırı', C.V2_RERANK_CANDIDATES, firstMatch(rerankFn, /const REASON_MAX_CANDIDATES = (\d+)/));
  add('rerank edge reason kelime sınırı', 15, firstMatch(rerankFn, /const REASON_MAX_WORDS = (\d+)/));
  {
    const idsSrc = firstMatch(read('supabase/functions/_shared/moodParseCache.ts'), /QUICK_MOOD_IDS[^=]*=\s*\[([^\]]*)\]/);
    const ids = [...idsSrc.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort().join(',');
    add('sunucu QUICK_MOOD_IDS ↔ eval eşlemesi', Object.values(QUICK_MOOD_CLIENT_ID).sort().join(','), ids);
  }
  add('parse-mood v2 MAX_SUGGESTED', 6, firstMatch(read('supabase/functions/_shared/moodV2.ts'), /const MAX_SUGGESTED = (\d+)/));
  add('era varsayılanı from', 1970, firstMatch(parser, /era_preference\?\.from === 'number'\s*\?\s*raw\.era_preference\.from\s*:\s*(\d+)/));
  add('era varsayılanı to', 2025, firstMatch(parser, /raw\.era_preference\.to\s*:\s*(\d+)/));
  add('parse gövdesi', 'var', /\{ raw_input: input \}/.test(parser) ? 'var' : 'YOK');
  add('mood metni rerank için trimmed', 'var', /setPendingMoodText\(trimmed\)/.test(screen) ? 'var' : 'YOK');

  // Doğrudan import edilen sabitler (kaynak = uygulama kodu)
  add('relaxation[0] sim/puan', '0.45/6.5', `${steps[0].minSimilarity}/${steps[0].minRating}`);
  add('relaxation[1] sim/puan', '0.42/6', `${steps[1].minSimilarity}/${steps[1].minRating}`);
  add('relaxation[2] sim/puan', '0.4/5.5', `${steps[2].minSimilarity}/${steps[2].minRating}`);
  add('relaxation[3] sim/puan', '0.38/null', `${steps[3].minSimilarity}/${steps[3].minRating}`);
  add('DEFAULT_BASE_RATING', 6.5, DEFAULT_BASE_RATING);
  add('RELATIVE_QUALITY_FLOOR', 0.55, RELATIVE_QUALITY_FLOOR);
  add('FINAL_CAP', C.RERANK_COUNT, FINAL_CAP);
  add('era segmenti', '184-199', `${VECTOR_LAYOUT.era_preference.start}-${VECTOR_LAYOUT.era_preference.end}`);
  add('VECTOR_DIM', 384, VECTOR_DIM);

  // moods.json quick metinleri ↔ locales/en.json
  const en = JSON.parse(read('locales/en.json')) as { mood: Record<string, string> };
  const quickKeys: Record<string, string> = {
    qm_rainy: 'quickRainyPrompt', qm_mindbending: 'quickDeepPrompt', qm_date: 'quickDatePrompt',
    qm_adrenaline: 'quickThrillPrompt', qm_comedy: 'quickLaughPrompt', qm_nostalgia: 'quickNostalgiaPrompt',
    qm_cozy: 'quickChillPrompt', qm_emotional: 'quickCryPrompt',
  };
  for (const m of loadMoods().filter((x) => x.kind === 'quick')) {
    add(`${m.id} metni = en.json mood.${quickKeys[m.id]}`, 'eşit', m.text === en.mood[quickKeys[m.id]] ? 'eşit' : 'FARKLI');
  }
  add('mood sayısı', 25, loadMoods().length);

  // Canlı bayraklar: hat v3 + rerank değilse farklı bir hat ölçülür.
  const { data: cfg, error } = await session.supabase
    .from('app_config')
    .select('key, value')
    .in('key', ['use_match_films_v2', 'use_hybrid_recommendation', 'use_llm_reranker']);
  if (error || !cfg) throw new StopError(`app_config okunamadı: ${error?.message ?? 'veri yok'}`);
  for (const k of ['use_hybrid_recommendation', 'use_llm_reranker']) {
    const v = (cfg as { key: string; value: unknown }[]).find((r) => r.key === k)?.value;
    add(`canlı bayrak ${k}`, 'true', String(v));
  }

  const bad = checks.filter((c) => c.expected !== c.actual);
  for (const c of checks) {
    console.log(`  ${c.expected === c.actual ? 'OK  ' : 'FAIL'} ${c.name}: beklenen=${c.expected} bulunan=${c.actual}`);
  }
  if (bad.length > 0) {
    throw new StopError(`PARİTE KONTROLÜ BAŞARISIZ (${bad.length}/${checks.length}); koşu başlatılmadı.`);
  }
  console.log(`Parite kontrolü yeşil (${checks.length}/${checks.length}). moods=${moods.length}`);
}

// ─── Defter (kotalar) ────────────────────────────────────────────────────────

function loadLedger(): Ledger {
  return fs.existsSync(LEDGER_FILE)
    ? readJson<Ledger>(LEDGER_FILE)
    : { parse_total: 0, rerank_total: 0, rerank_by_day: {}, last_llm_at: 0, mood_searches_rows: [] };
}
const utcDay = (): string => new Date().toISOString().slice(0, 10);

interface Ctx {
  session: EvalSession;
  sessionOpenedAt: number;
  ledger: Ledger;
  calls: number;
  failures: number;
}

async function token(ctx: Ctx): Promise<string> {
  if (Date.now() - ctx.sessionOpenedAt > C.TOKEN_MAX_AGE_MS) {
    ctx.session = await openEvalSession();
    ctx.sessionOpenedAt = Date.now();
  }
  return ctx.session.accessToken;
}

async function llmGate(ctx: Ctx): Promise<void> {
  const wait = ctx.ledger.last_llm_at + C.MIN_LLM_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  ctx.ledger.last_llm_at = Date.now();
  writeJson(LEDGER_FILE, ctx.ledger);
}

function noteFailure(ctx: Ctx, what: string): void {
  ctx.failures += 1;
  console.error(`  HATA: ${what}`);
  if (ctx.failures / Math.max(1, ctx.calls) > 0.1) {
    throw new StopError(`Hata oranı %10'u aştı (${ctx.failures}/${ctx.calls}); durduruldu. Kısmi sonuçlar saklandı.`);
  }
}

function httpStop(status: number, what: string): void {
  if (status === 429) throw new StopError(`${what}: HTTP 429 — durduruldu, kısmi sonuçlar saklandı.`);
  if (status === 401) throw new StopError(`${what}: HTTP 401 — durduruldu.`);
}

// ─── Parse ───────────────────────────────────────────────────────────────────

/** services/tasteParser.ts:186-255 `validateAndNormalize` kopyası. */
function validateAndNormalize(raw: Record<string, unknown>): TasteProfile {
  const clamp = (v: unknown, fb = 0.5): number => Math.min(1, Math.max(0, typeof v === 'number' ? v : fb));
  const oneOf = <T extends string>(v: unknown, opts: readonly T[], fb: T): T => (opts.includes(v as T) ? (v as T) : fb);
  const es = (raw.emotional_state ?? {}) as Record<string, unknown>;
  const era = (raw.era_preference ?? {}) as Record<string, unknown>;
  return {
    emotional_state: {
      joy: clamp(es.joy), sadness: clamp(es.sadness), anger: clamp(es.anger), fear: clamp(es.fear),
      surprise: clamp(es.surprise), disgust: clamp(es.disgust), anticipation: clamp(es.anticipation), trust: clamp(es.trust),
    },
    energy_level: clamp(raw.energy_level),
    pace_preference: oneOf(raw.pace_preference, ['slow', 'medium', 'fast'] as const, 'medium'),
    visual_style: oneOf(raw.visual_style, ['minimalist', 'cinematic', 'experimental', 'lush', 'raw'] as const, 'cinematic'),
    thematic_depth: clamp(raw.thematic_depth),
    ending_preference: oneOf(raw.ending_preference, ['hopeful', 'bittersweet', 'open', 'tragic', 'triumphant'] as const, 'open'),
    era_preference: {
      from: typeof era.from === 'number' ? era.from : 1970,
      to: typeof era.to === 'number' ? era.to : 2025,
    },
    cultural_context: Array.isArray(raw.cultural_context) ? (raw.cultural_context as string[]) : [],
    avoid_signals: Array.isArray(raw.avoid_signals) ? (raw.avoid_signals as string[]) : [],
    narrative_style: oneOf(raw.narrative_style, ['linear', 'nonlinear', 'anthology', 'dialogue-driven'] as const, 'linear'),
    social_context: oneOf(raw.social_context, ['alone', 'couple', 'friends', 'family'] as const, 'alone'),
    rewatch_tolerance: typeof raw.rewatch_tolerance === 'boolean' ? raw.rewatch_tolerance : false,
  };
}

async function ensureParsed(
  ctx: Ctx, mood: Mood, force: boolean, schemaV2 = false, dir: string = schemaV2 ? PARSED_V2_DIR : PARSED_DIR,
): Promise<ParsedFile> {
  const file = path.join(dir, `${mood.id}.json`);
  if (!force && fs.existsSync(file)) return readJson<ParsedFile>(file);
  const legacy = path.join(LEGACY_PARSED_DIR, `${mood.id}.json`);
  if (!schemaV2 && !force && fs.existsSync(legacy)) return readJson<ParsedFile>(legacy);

  if (ctx.ledger.parse_total + 1 > C.CAP_PARSE_TOTAL) {
    throw new StopError(`parse tavanı (${C.CAP_PARSE_TOTAL}) aşılacak; durduruldu.`);
  }
  await llmGate(ctx);
  ctx.ledger.parse_total += 1;
  writeJson(LEDGER_FILE, ctx.ledger);
  ctx.calls += 1;

  const url = envOrThrow('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
  const anon = envOrThrow('SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), C.HTTP_TIMEOUT_MS);
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/parse-mood?forceFunctionRegion=${GAUNTLET_EDGE_REGION}`, {
      method: 'POST',
      headers: {
        'x-region': GAUNTLET_EDGE_REGION,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await token(ctx)}`,
        apikey: anon,
      },
      body: JSON.stringify(schemaV2 ? parseV2Body(mood) : { raw_input: mood.text }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    noteFailure(ctx, `parse ${mood.id}: ${String(e)}`);
    throw new StopError(`parse ${mood.id} ağ hatası: ${String(e)}`);
  }
  clearTimeout(timer);
  const ms = Date.now() - t0;
  ctx.ledger.last_llm_at = Date.now();
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  httpStop(res.status, `parse ${mood.id}`);
  if (!res.ok) {
    noteFailure(ctx, `parse ${mood.id}: HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    throw new StopError(`parse ${mood.id} başarısız (HTTP ${res.status}).`);
  }
  const searchId = typeof body.search_id === 'string' ? body.search_id : null;
  if (searchId) ctx.ledger.mood_searches_rows.push(searchId);
  const parsed: ParsedFile = {
    mood_id: mood.id,
    text: mood.text,
    ms,
    http_status: res.status,
    response: body,
    profile: validateAndNormalize(body) as unknown as Record<string, unknown>,
    search_id: searchId,
    search_keywords: Array.isArray(body.search_keywords) ? (body.search_keywords as string[]) : [],
    limit: typeof body.limit === 'number' ? body.limit : null,
    remaining: typeof body.remaining === 'number' ? body.remaining : null,
    ...(typeof body.cache_hit === 'boolean' ? { cache_hit: body.cache_hit } : {}),
  };
  writeJson(file, parsed);
  writeJson(LEDGER_FILE, ctx.ledger);
  console.log(`  parse ${mood.id}: ${ms} ms, limit=${parsed.limit}, remaining=${parsed.remaining}, search_id=${searchId ?? 'yok'}`);
  return parsed;
}

// ─── Vektör ve RPC ───────────────────────────────────────────────────────────

function buildVector(parsed: ParsedFile, v: Variant): number[] {
  const vec = tasteProfileToVector(parsed.profile as unknown as TasteProfile);
  if (v === 'V1') {
    // V1: era segmenti (vectorEncoder.ts:180-182) sıfırlanır; year_from/year_to null kalır.
    for (let i = VECTOR_LAYOUT.era_preference.start; i <= VECTOR_LAYOUT.era_preference.end; i++) vec[i] = 0;
  }
  return vec;
}

function trimRow(r: Record<string, unknown>): Row {
  return {
    id: r.id as string,
    tmdb_id: r.tmdb_id as number,
    title: r.title as string,
    year: (r.year as number | null) ?? null,
    overview: (r.overview as string | null) ?? null,
    genres: (r.genres as string[] | null) ?? null,
    runtime: (r.runtime as number | null) ?? null,
    vote_average: (r.vote_average as number | null) ?? null,
    director: (r.director as string | null) ?? null,
    similarity: r.similarity as number,
    curation_tier: (r.curation_tier as string | null) ?? null,
    match_reason: (r.match_reason as string | null) ?? null,
    ...(Array.isArray(r.channels) ? { channels: r.channels as string[] } : {}),
  };
}

/** services/recommendations.ts:903-958 `getFilmsWithRelaxation` + 616-647 `callMatchFilmsV3` (userVector null, filtre yok). */
async function runRpc(ctx: Ctx, parsed: ParsedFile, v: Variant): Promise<RawRecord['rpc']> {
  const vectorString = `[${buildVector(parsed, v).join(',')}]`;
  const kw = parsed.search_keywords;
  const steps = buildRelaxationSteps(null, null);
  const attempts: RawRecord['rpc']['attempts'] = [];
  let paramsFirst: Record<string, unknown> = {};

  const attempt = async (i: number): Promise<Row[]> => {
    const step = steps[i];
    const args = {
      query_vector: vectorString,
      user_vector: null,
      mood_weight: 1.0,
      user_weight: 0.0,
      match_count: C.FIRST_BATCH_MATCH_COUNT,
      min_similarity: step.minSimilarity,
      ...(step.minRating != null ? { min_rating: step.minRating } : {}),
      ...(step.era ? { year_from: step.era.from, year_to: step.era.to } : {}),
      ...(kw.length > 0 ? { search_keywords: kw } : {}),
      per_director_cap: C.PER_DIRECTOR_CAP,
      tier_boost: true,
      exclude_archive: true,
    };
    if (i === 0) paramsFirst = { ...args, query_vector: `[${VECTOR_DIM} boyut]` };
    const t0 = Date.now();
    const { data, error } = await ctx.session.supabase.rpc('match_films_v3', args);
    const ms = Date.now() - t0;
    ctx.calls += 1;
    if (error) {
      noteFailure(ctx, `RPC ${error.message}`);
      throw new StopError(`match_films_v3 hatası: ${error.message}`);
    }
    const rows = ((data ?? []) as Record<string, unknown>[]).map(trimRow);
    attempts.push({ min_similarity: step.minSimilarity, min_rating: step.minRating, ms, n_rows: rows.length });
    return rows;
  };

  let rows = await attempt(0);
  for (let i = 0; ; i++) {
    if (rows.length >= C.TARGET_COUNT) break;
    if (i === steps.length - 1) break;
    await sleep(C.RPC_GAP_MS);
    rows = await attempt(i + 1);
  }
  return { rows, attempts, total_ms: attempts.reduce((s, a) => s + a.ms, 0), params_first: paramsFirst };
}

/** V3: parse-mood v2 alanları + match_films_v4 (tek çağrı, 40 aday; gevşetme zinciri yok — ilk basamak). */
async function runRpcV4(ctx: Ctx, parsed: ParsedFile): Promise<RawRecord['rpc']> {
  const vectorString = `[${buildVector(parsed, 'V3').join(',')}]`;
  const kw = parsed.search_keywords;
  const step = buildRelaxationSteps(null, null)[0];
  const r = parsed.response;
  const args = {
    query_vector: vectorString,
    user_vector: null,
    mood_weight: 1.0,
    user_weight: 0.0,
    match_count: C.V3_MATCH_COUNT,
    min_similarity: step.minSimilarity,
    ...(step.minRating != null ? { min_rating: step.minRating } : {}),
    ...(kw.length > 0 ? { search_keywords: kw } : {}),
    per_director_cap: C.PER_DIRECTOR_CAP,
    tier_boost: true,
    exclude_archive: true,
    genres_include: Array.isArray(r.genres_include) ? r.genres_include : [],
    genres_exclude: Array.isArray(r.genres_exclude) ? r.genres_exclude : [],
    max_runtime: typeof r.max_runtime === 'number' ? r.max_runtime : null,
    reference_titles: Array.isArray(r.reference_titles) ? r.reference_titles : [],
    suggested_titles: Array.isArray(r.suggested_titles) ? r.suggested_titles : [],
    // 2d: parse-mood v2 yanıtındaki kişisel tekrar dışlama (soğuk eval hesabında boş → anahtar eklenmez).
    ...(Array.isArray(r.exclude_recent_ids) && r.exclude_recent_ids.length > 0
      ? { exclude_ids: r.exclude_recent_ids }
      : {}),
  };
  const t0 = Date.now();
  const { data, error } = await ctx.session.supabase.rpc('match_films_v4', args);
  const ms = Date.now() - t0;
  ctx.calls += 1;
  if (error) {
    noteFailure(ctx, `RPC v4 ${error.message}`);
    throw new StopError(`match_films_v4 hatası: ${error.message}`);
  }
  const rows = ((data ?? []) as Record<string, unknown>[]).map(trimRow);
  return {
    rows,
    attempts: [{ min_similarity: step.minSimilarity, min_rating: step.minRating, ms, n_rows: rows.length }],
    total_ms: ms,
    params_first: { ...args, query_vector: `[${VECTOR_DIM} boyut]` },
  };
}

// ─── Rerank ──────────────────────────────────────────────────────────────────

async function runRerank(
  ctx: Ctx, mood: Mood, v: Variant, rows: Row[], bypassLocalCache = false,
): Promise<RerankRecord | null> {
  if (rows.length === 0) return null;
  const isV3 = v === 'V3' || v === 'V4'; // reason:true yolu (V4 = V3 + 2d)
  const sent = v === 'V2' || v === 'V4' ? rows.slice(0, C.V2_RERANK_CANDIDATES) : rows;
  const overviewMax = v === 'V2' || isV3 ? C.V2_OVERVIEW_MAX : C.RERANK_OVERVIEW_MAX;
  const rerankCount = isV3 ? C.V3_RERANK_COUNT : C.RERANK_COUNT;
  const body = {
    mood_text: mood.text.trim(),
    candidates: sent.map((c) => ({
      id: c.id, title: c.title, overview: (c.overview ?? '').slice(0, overviewMax),
      genres: c.genres, year: c.year, similarity: c.similarity,
    })),
    count: rerankCount,
    ...(isV3 ? { reason: true } : {}),
  };
  const hash = crypto.createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 16);
  const cacheFile = path.join(CACHE_DIR, `${hash}.json`);
  if (!bypassLocalCache && fs.existsSync(cacheFile)) {
    const hit = readJson<RerankRecord>(cacheFile);
    console.log(`  rerank ${mood.id}/${v}: önbellek (${hash})`);
    return { ...hit, cached: true };
  }

  const day = utcDay();
  const today = ctx.ledger.rerank_by_day[day] ?? 0;
  if (ctx.ledger.rerank_total + 1 > C.CAP_RERANK_TOTAL) throw new StopError(`rerank toplam tavanı (${C.CAP_RERANK_TOTAL}) aşılacak; durduruldu.`);
  if (today + 1 > C.CAP_RERANK_PER_UTC_DAY) throw new StopError(`UTC ${day} rerank tavanı (${C.CAP_RERANK_PER_UTC_DAY}) aşılacak; durduruldu.`);

  await llmGate(ctx);
  ctx.ledger.rerank_total += 1;
  ctx.ledger.rerank_by_day[day] = today + 1;
  writeJson(LEDGER_FILE, ctx.ledger);
  ctx.calls += 1;

  const url = envOrThrow('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
  const anon = envOrThrow('SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), C.HTTP_TIMEOUT_MS);
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/rerank-films`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token(ctx)}`, apikey: anon },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    noteFailure(ctx, `rerank ${mood.id}/${v}: ${String(e)}`);
    return null;
  }
  clearTimeout(timer);
  const ms = Date.now() - t0;
  ctx.ledger.last_llm_at = Date.now();
  httpStop(res.status, `rerank ${mood.id}/${v}`);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !Array.isArray(json.reranked_ids)) {
    noteFailure(ctx, `rerank ${mood.id}/${v}: HTTP ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
    return null;
  }
  const rec: RerankRecord = {
    payload_hash: hash,
    cached: false,
    candidates_sent: sent.length,
    overview_max: overviewMax,
    count: rerankCount,
    ms,
    http_status: res.status,
    reranked_ids: json.reranked_ids as string[],
    server_fallback: json.fallback === true,
    error_detail: typeof json.error_detail === 'string' ? json.error_detail : null,
    exceeded_app_timeout: ms > C.APP_RERANK_TIMEOUT_MS,
    ...(isV3 && json.reasons && typeof json.reasons === 'object' ? { reasons: json.reasons as Record<string, string> } : {}),
    ...(isV3 && typeof json.reasons_dropped === 'number' ? { reasons_dropped: json.reasons_dropped } : {}),
  };
  if (!bypassLocalCache) writeJson(cacheFile, rec);
  console.log(`  rerank ${mood.id}/${v}: HTTP ${res.status}, ${ms} ms, ${rec.reranked_ids.length} id, fallback=${rec.server_fallback}`);
  return rec;
}

// ─── V4 önbellekli geçiş (2d) ────────────────────────────────────────────────

/** parse-mood v2'yi bir kez çağırır; yanıt gövdesini ve süreyi döner (önbellek isabeti çağıranda denetlenir). */
/** moods.json qm_* kimlikleri → istemci MOOD_CARDS id'leri (= sunucu QUICK_MOOD_IDS). */
const QUICK_MOOD_CLIENT_ID: Record<string, string> = {
  qm_rainy: 'rainy', qm_mindbending: 'mindbending', qm_date: 'datenight', qm_adrenaline: 'adrenaline',
  qm_comedy: 'laugh', qm_nostalgia: 'nostalgia', qm_cozy: 'cozy', qm_emotional: 'emotional',
};

/** parse-mood v2 gövdesi; quick mood ise quick_mood_id eklenir (sunucu önbelleği yalnız bununla çalışır). */
function parseV2Body(mood: Mood): Record<string, unknown> {
  const quickId = mood.kind === 'quick' ? QUICK_MOOD_CLIENT_ID[mood.id] : undefined;
  return { raw_input: mood.text, schema_version: 2, ...(quickId ? { quick_mood_id: quickId } : {}) };
}

async function callParseV2(ctx: Ctx, mood: Mood): Promise<{ body: Record<string, unknown>; ms: number }> {
  const url = envOrThrow('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
  const anon = envOrThrow('SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), C.HTTP_TIMEOUT_MS);
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/parse-mood?forceFunctionRegion=${GAUNTLET_EDGE_REGION}`, {
      method: 'POST',
      headers: {
        'x-region': GAUNTLET_EDGE_REGION,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await token(ctx)}`,
        apikey: anon,
      },
      body: JSON.stringify(parseV2Body(mood)),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    noteFailure(ctx, `cached-pass parse ${mood.id}: ${String(e)}`);
    throw new StopError(`cached-pass parse ${mood.id} ağ hatası: ${String(e)}`);
  }
  clearTimeout(timer);
  const ms = Date.now() - t0;
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  httpStop(res.status, `cached-pass parse ${mood.id}`);
  if (!res.ok) {
    noteFailure(ctx, `cached-pass parse ${mood.id}: HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    throw new StopError(`cached-pass parse ${mood.id} başarısız (HTTP ${res.status}).`);
  }
  return { body, ms };
}

/**
 * Quick mood'lar için ikinci geçiş: aynı metin → parse-mood önbellekten (0 Haiku), sonra RPC + rerank.
 * Önbellek isabet ETMEZSE Haiku harcanmıştır: deftere işlenir ve koşu durur (sessiz devam yok).
 */
async function runCachedPass(ctx: Ctx, quick: Mood[]): Promise<void> {
  for (const mood of quick) {
    const out = path.join(CACHED_PASS_DIR, `${mood.id}.json`);
    if (fs.existsSync(out)) {
      console.log(`  ${mood.id}: cached-pass kaydı var, atlandı`);
      continue;
    }
    if (!fs.existsSync(path.join(PARSED_V4_DIR, `${mood.id}.json`))) {
      throw new StopError(`${mood.id}: önce --variant V4 koşulmalı (önbellek dolmadı).`);
    }
    if ((ctx.ledger.parse_cached_total ?? 0) + 1 > C.CAP_PARSE_CACHED_TOTAL) {
      throw new StopError(`cached-pass parse tavanı (${C.CAP_PARSE_CACHED_TOTAL}) aşılacak; durduruldu.`);
    }
    await sleep(C.RPC_GAP_MS);
    ctx.calls += 1;
    ctx.ledger.parse_cached_total = (ctx.ledger.parse_cached_total ?? 0) + 1;
    const { body, ms } = await callParseV2(ctx, mood);
    const hit = body.cache_hit === true;
    if (!hit) ctx.ledger.parse_total += 1; // Haiku çağrıldı
    writeJson(LEDGER_FILE, ctx.ledger);
    console.log(`  parse(2.) ${mood.id}: ${ms} ms, cache_hit=${String(body.cache_hit)}`);
    if (!hit) {
      throw new StopError(`${mood.id}: parse-mood önbellek isabet etmedi (cache_hit=${String(body.cache_hit)}); durduruldu.`);
    }

    const parsed: ParsedFile = {
      mood_id: mood.id, text: mood.text, ms, http_status: 200, response: body,
      profile: validateAndNormalize(body) as unknown as Record<string, unknown>,
      search_id: typeof body.search_id === 'string' ? body.search_id : null,
      search_keywords: Array.isArray(body.search_keywords) ? (body.search_keywords as string[]) : [],
      limit: typeof body.limit === 'number' ? body.limit : null,
      remaining: typeof body.remaining === 'number' ? body.remaining : null,
      cache_hit: true,
    };
    if (parsed.search_id) ctx.ledger.mood_searches_rows.push(parsed.search_id);

    await sleep(C.RPC_GAP_MS);
    const rpc = await runRpcV4(ctx, parsed);
    const rerank = await runRerank(ctx, mood, 'V4', rpc.rows, true);
    const rec: CachedPassRecord = { mood_id: mood.id, parse_ms: ms, parse_cache_hit: true, rpc, rerank };
    writeJson(out, rec);
    console.log(`  cached-pass ${mood.id}: parse ${ms} + rpc ${rpc.total_ms} + rerank ${rerank?.ms ?? 'yok'} ms`);
  }
}

// ─── Ana akış ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.reportOnly) {
    await buildReports(await openEvalSession());
    return;
  }

  let moods = loadMoods();
  if (args.mood) moods = moods.filter((m) => m.id === args.mood);
  if (args.limit) moods = moods.slice(0, args.limit);

  const session = await openEvalSession();
  console.log(`Eval hesabı: auth_uid=${session.authUid} users.id=${session.appUserId}`);
  console.log('Parite kontrolü:');
  await parityCheck(moods, session);

  const ctx: Ctx = { session, sessionOpenedAt: Date.now(), ledger: loadLedger(), calls: 0, failures: 0 };
  const doRpc = args.stage !== 'rerank';
  const doRerank = args.stage !== 'rpc';
  const t0 = Date.now();

  try {
    if (args.cachedPass) {
      await runCachedPass(ctx, moods.filter((m) => m.kind === 'quick'));
      return;
    }
    for (const mood of moods) {
      console.log(`[${mood.id}]`);
      let parsed: ParsedFile | null = null;
      let parsedV2: ParsedFile | null = null;
      let parsedV4: ParsedFile | null = null;

      for (const v of args.variants) {
        const f = rawFile(mood.id, v);
        let rec: RawRecord | null = fs.existsSync(f) ? readJson<RawRecord>(f) : null;
        if (doRpc && (!rec || args.reparse)) {
          if (v === 'V3') {
            if (!parsedV2) parsedV2 = await ensureParsed(ctx, mood, args.reparse, true);
          } else if (v === 'V4') {
            if (!parsedV4) parsedV4 = await ensureParsed(ctx, mood, args.reparse, true, PARSED_V4_DIR);
          } else if (!parsed) {
            parsed = await ensureParsed(ctx, mood, args.reparse);
          }
          await sleep(C.RPC_GAP_MS);
          const rpc = v === 'V3' && parsedV2
            ? await runRpcV4(ctx, parsedV2)
            : v === 'V4' && parsedV4
              ? await runRpcV4(ctx, parsedV4)
              : await runRpc(ctx, parsed as ParsedFile, v);
          rec = { mood_id: mood.id, variant: v, rpc };
          writeJson(f, rec);
          console.log(`  rpc ${mood.id}/${v}: ${rpc.rows.length} satır, ${rpc.attempts.length} deneme, ${rpc.total_ms} ms`);
        }
        if (doRerank) {
          if (!rec) throw new StopError(`${mood.id}/${v}: rerank için önce RPC aşaması gerekli.`);
          if (!rec.rerank) {
            const rr = await runRerank(ctx, mood, v, rec.rpc.rows);
            if (rr) {
              rec.rerank = rr;
              writeJson(f, rec);
            }
          }
        }
      }
    }
  } finally {
    writeJson(LEDGER_FILE, ctx.ledger);
    console.log(`Çağrı: ${ctx.calls}, hata: ${ctx.failures}, süre: ${((Date.now() - t0) / 1000).toFixed(1)} sn`);
    console.log(`Defter: parse=${ctx.ledger.parse_total}/${C.CAP_PARSE_TOTAL}, rerank=${ctx.ledger.rerank_total}/${C.CAP_RERANK_TOTAL}, bugün(${utcDay()})=${ctx.ledger.rerank_by_day[utcDay()] ?? 0}/${C.CAP_RERANK_PER_UTC_DAY}`);
  }
  await buildReports(ctx.session);
}

main().catch((e: unknown) => {
  console.error(e instanceof StopError ? `DUR: ${e.message}` : e);
  process.exit(1);
});
