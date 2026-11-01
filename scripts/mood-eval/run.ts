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
 * V5 (istemci hattı, DEPLOY SONRASI koşulur): services/moodGauntlet.ts'in saf hattı DOĞRUDAN kullanılır
 *   (parse v2 + quick_mood_id → match_films_v4 → id-rerank {count:4, reason:false, ilk 20} → reasons {reason:true, yalnız 4 film});
 *   aşama süreleri parse / v4 / pick / reasons ayrı ölçülür (eval pacing sanal saatle düşülür).
 *   MOOD_EVAL_OUT=docs/investigations/mood-vec-2e/eval npx tsx scripts/mood-eval/run.ts --variant V5
 *   MOOD_EVAL_OUT=docs/investigations/mood-vec-2e/eval npx tsx scripts/mood-eval/run.ts --cached-pass
 *   MOOD_EVAL_OUT=docs/investigations/mood-vec-2e/eval npx tsx scripts/mood-eval/summary-2d.ts
 *   --cached-pass: yalnız 8 quick mood; parse-mood'u AYNI metinle ikinci kez çağırır (cache_hit şart),
 *   tüm V5 hattını yeniden ölçer. Kotalar AYRI sayaçlarla: id-rerank 25+8, reasons 25+8 (günlük sınır 60 altında).
 *   Yoğunluk ve "Başka bir dörtlü" eval'de yoktur.
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
// V5 hattı: istemcinin SAF orkestrasyonu doğrudan kullanılır (RN/ağ yok; bağımlılıklar aşağıda enjekte edilir).
import {
  FOUR, RERANK_CANDIDATES, V4_MATCH_COUNT, fetchReasons, startMoodGauntlet,
  type FallbackStage, type MatchRow, type MatchV4Args, type MoodGauntletDeps, type ParsedMoodV2,
  type PipelineStageName, type RerankOutcome, type TitleRef,
} from '../../services/moodGauntlet';

import {
  ALL_VARIANTS, CACHED_PASS_DIR, CACHE_DIR, LEDGER_FILE, LEGACY_PARSED_DIR, PARSED_DIR, PARSED_V2_DIR,
  PARSED_V4_DIR, RAW_DIR, VARIANTS,
  loadMoods, rawFile, readJson, writeJson,
  type CachedPassRecord, type Ledger, type Mood, type ParsedFile, type RawRecord, type RerankRecord, type Row,
  type RpcAttempt, type V5Block, type V5Call, type Variant,
} from './common';
import { buildReports, loadMeta } from './report';
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
  // V5 (istemci hattı): iki AYRI sunucu sayacı (rerank-films-daily / rerank-films-reasons-daily),
  // her biri 25 mood + 8 önbellekli geçiş = 33; günlük sınır (premium/legacy 60) altında kalır.
  CAP_IDS_TOTAL: 33,
  CAP_REASONS_TOTAL: 33,
  CAP_IDS_PER_UTC_DAY: 55,
  CAP_REASONS_PER_UTC_DAY: 55,
  // services/moodGauntletDeps.ts sabitleri (parityCheck kaynaktan doğrular)
  CLIENT_PARSE_TIMEOUT_MS: 15_000,
  CLIENT_RERANK_IDS_TIMEOUT_MS: 8_000,
  CLIENT_RERANK_REASONS_TIMEOUT_MS: 10_000,
  CLIENT_RERANK_OVERVIEW_MAX: 120,
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
  // 2-1b: reason sabitleri ve sayaç adları saf modüle taşındı (index.ts yalnız içe aktarır).
  const reasonMod = read('supabase/functions/_shared/rerankReason.ts');
  const clientDeps = read('services/moodGauntletDeps.ts');
  const clientPipe = read('services/moodGauntlet.ts');
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
  add('rerank edge overview kırpma (reason yolu)', C.V2_OVERVIEW_MAX, firstMatch(reasonMod, /export const REASON_OVERVIEW_MAX = (\d+)/));
  add('rerank edge reason aday sınırı', C.V2_RERANK_CANDIDATES, firstMatch(reasonMod, /export const REASON_MAX_CANDIDATES = (\d+)/));
  add('rerank edge reason kelime sınırı', 12, firstMatch(reasonMod, /export const REASON_MAX_WORDS = (\d+)/));
  // V5 sayaçları: id-rerank ve gerekçe AYRI sayaç; ikisi de index.ts'te dailyCounterKey(withReason) ile seçilir.
  add('sayaç adı: id-rerank (pick)', 'rerank-films-daily', firstMatch(reasonMod, /export const RERANK_IDS_DAILY_KEY = '([^']+)'/));
  add('sayaç adı: gerekçe (reasons)', 'rerank-films-reasons-daily', firstMatch(reasonMod, /export const RERANK_REASONS_DAILY_KEY = '([^']+)'/));
  add('sayaç seçimi index.ts (dailyCounterKey(withReason))', 'var',
    /checkDailyLimit\(auth\.authUserId, dailyCounterKey\(withReason\), maxPerDay\)/.test(rerankFn) ? 'var' : 'YOK');
  // V5 istemci hattı: sabitler kaynaktan, çağrı biçimi regex ile doğrulanır.
  add('istemci RERANK_CANDIDATES (id-rerank adayları)', C.V2_RERANK_CANDIDATES, RERANK_CANDIDATES);
  add('istemci V4_MATCH_COUNT', C.V3_MATCH_COUNT, V4_MATCH_COUNT);
  add('istemci FOUR', C.V3_RERANK_COUNT, FOUR);
  add('istemci rerank overview kırpma', C.CLIENT_RERANK_OVERVIEW_MAX, firstMatch(clientDeps, /const RERANK_OVERVIEW_MAX = (\d+)/));
  add('istemci parse zaman aşımı', C.CLIENT_PARSE_TIMEOUT_MS, firstMatch(clientDeps, /const PARSE_TIMEOUT_MS = ([\d_]+)/).replace(/_/g, ''));
  add('istemci id-rerank zaman aşımı', C.CLIENT_RERANK_IDS_TIMEOUT_MS, firstMatch(clientDeps, /const RERANK_IDS_TIMEOUT_MS = ([\d_]+)/).replace(/_/g, ''));
  add('istemci gerekçe zaman aşımı', C.CLIENT_RERANK_REASONS_TIMEOUT_MS, firstMatch(clientDeps, /const RERANK_REASONS_TIMEOUT_MS = ([\d_]+)/).replace(/_/g, ''));
  add('istemci pick: id-rerank reason:false', 'var',
    /count: FOUR, withReasons: false \}/.test(clientPipe) ? 'var' : 'YOK');
  add('istemci reasons: yalnız dörtlü, reason:true', 'var',
    /candidates: set\.four, count: FOUR, withReasons: true \}/.test(clientPipe) ? 'var' : 'YOK');
  add('istemci rerank gövdesi (reason: input.withReasons, count)', 'var',
    /count: input\.count,\s*reason: input\.withReasons,/.test(clientDeps) ? 'var' : 'YOK');
  add('istemci rerank bölge sabitleme (forceFunctionRegion + x-region)', 'var',
    /rerank-films\?forceFunctionRegion=\$\{GAUNTLET_EDGE_REGION\}[\s\S]{0,200}'x-region': GAUNTLET_EDGE_REGION/.test(clientDeps) ? 'var' : 'YOK');
  add('istemci parse gövdesi (schema_version:2, client_search_id, quick_mood_id)', 'var',
    /schema_version: 2,\s*client_search_id: input\.clientSearchId,[\s\S]{0,80}quick_mood_id: input\.quickMoodId/.test(clientDeps) ? 'var' : 'YOK');
  add('istemci match_films_v4 argüman anahtarları', 'tamam',
    ['query_vector', 'user_vector', 'match_count', 'min_similarity', 'exclude_ids', 'per_director_cap', 'tier_boost',
      'exclude_archive', 'genres_include', 'genres_exclude', 'max_runtime', 'reference_titles', 'suggested_titles']
      .every((k) => clientDeps.includes(k)) ? 'tamam' : 'EKSİK');
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
  /** V5 sanal saat: eval'in kendi bekleme süreleri (pacing) toplamı; aşama süreleri bunu düşer. */
  slept: number;
  /**
   * V5: istemci hattı rerank hatalarını yutar (yedek yola düşer). 429/tavan gibi DUR koşulları bu yüzden
   * burada işaretlenir; hat bitince çağıran StopError fırlatır.
   */
  stopMsg: string | null;
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
  if (wait > 0) {
    await sleep(wait);
    ctx.slept += wait;
  }
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
  const isV3 = v === 'V3' || v === 'V4' || v === 'V5'; // reason:true yolu (V4 = V3 + 2d)
  const sent = v === 'V2' || v === 'V4' || v === 'V5' ? rows.slice(0, C.V2_RERANK_CANDIDATES) : rows;
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

// ─── Yardımcılar (V3/V4 parse gövdesi) ───────────────────────────────────────

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

// ─── V5: istemci hattı (services/moodGauntlet.ts DOĞRUDAN) ───────────────────

/**
 * Hat kopyalanmaz: `startMoodGauntlet` + `fetchReasons` uygulamadakiyle AYNI koddur. Yalnız
 * `MoodGauntletDeps` (ağ bağlaması) burada Node için yeniden yazıldı; kaynak karşılığı
 * services/moodGauntletDeps.ts (parityCheck sabitleri ve çağrı biçimini kaynaktan doğrular).
 * Eval farkları (bilinçli): yoğunluk / "Başka bir dörtlü" yok; loadExclusions soğuk hesapta boş
 * (V3 ile aynı); poster prefetch yok (bloklamaz). Eval'in kendi bekleme süreleri (pacing) sanal
 * saatle aşama sürelerinden düşülür.
 */

interface V5Capture {
  calls: V5Call[];
  fallbacks: string[];
  errors: string[];
  attempts: RpcAttempt[];
  searchId: string | null;
  parseMs: number;
  parseCacheHit: boolean;
  parsedBody: Record<string, unknown> | null;
}

const stringArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const titleRefsOf = (v: unknown): TitleRef[] =>
  Array.isArray(v)
    ? v
        .map((x) => {
          const t = (x as { title?: unknown } | null)?.title;
          const y = (x as { year?: unknown } | null)?.year;
          return typeof t === 'string' && t.length > 0 ? { title: t, year: typeof y === 'number' ? y : null } : null;
        })
        .filter((x): x is TitleRef => x !== null)
    : [];

function bump(map: Record<string, number> | undefined, day: string): Record<string, number> {
  const out = { ...(map ?? {}) };
  out[day] = (out[day] ?? 0) + 1;
  return out;
}

function makeEvalDeps(
  ctx: Ctx, mood: Mood, cap: V5Capture, opts: { cached: boolean; savePrimary: boolean },
): MoodGauntletDeps {
  const url = envOrThrow('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
  const anon = envOrThrow('SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY');

  const parse = async (input: { text: string; quickMoodId?: string; clientSearchId: string }): Promise<ParsedMoodV2> => {
    if (opts.cached) {
      if ((ctx.ledger.parse_cached_total ?? 0) + 1 > C.CAP_PARSE_CACHED_TOTAL) {
        throw new StopError(`cached-pass parse tavanı (${C.CAP_PARSE_CACHED_TOTAL}) aşılacak; durduruldu.`);
      }
    } else if (ctx.ledger.parse_total + 1 > C.CAP_PARSE_TOTAL) {
      throw new StopError(`parse tavanı (${C.CAP_PARSE_TOTAL}) aşılacak; durduruldu.`);
    }
    await llmGate(ctx);
    ctx.calls += 1;
    if (opts.cached) ctx.ledger.parse_cached_total = (ctx.ledger.parse_cached_total ?? 0) + 1;
    else ctx.ledger.parse_total += 1;
    writeJson(LEDGER_FILE, ctx.ledger);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), C.CLIENT_PARSE_TIMEOUT_MS);
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
        body: JSON.stringify({
          raw_input: input.text,
          schema_version: 2,
          client_search_id: input.clientSearchId,
          ...(input.quickMoodId ? { quick_mood_id: input.quickMoodId } : {}),
        }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      noteFailure(ctx, `parse ${mood.id}: ${String(e)}`);
      throw new StopError(`parse ${mood.id} ağ hatası/zaman aşımı: ${String(e)}`);
    }
    clearTimeout(timer);
    cap.parseMs = Date.now() - t0;
    ctx.ledger.last_llm_at = Date.now();
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    httpStop(res.status, `parse ${mood.id}`);
    if (!res.ok) {
      noteFailure(ctx, `parse ${mood.id}: HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
      throw new StopError(`parse ${mood.id} başarısız (HTTP ${res.status}).`);
    }
    cap.parsedBody = body;
    cap.parseCacheHit = body.cache_hit === true;
    cap.searchId = typeof body.search_id === 'string' ? body.search_id : null;
    if (cap.searchId) ctx.ledger.mood_searches_rows.push(cap.searchId);
    if (opts.cached && !cap.parseCacheHit) {
      ctx.ledger.parse_total += 1; // Haiku çağrıldı
      writeJson(LEDGER_FILE, ctx.ledger);
      throw new StopError(`${mood.id}: parse-mood önbellek isabet etmedi (cache_hit=${String(body.cache_hit)}); durduruldu.`);
    }
    if (opts.savePrimary) {
      const parsedFile: ParsedFile = {
        mood_id: mood.id, text: mood.text, ms: cap.parseMs, http_status: res.status, response: body,
        profile: validateAndNormalize(body) as unknown as Record<string, unknown>,
        search_id: cap.searchId,
        search_keywords: stringArr(body.search_keywords),
        limit: typeof body.limit === 'number' ? body.limit : null,
        remaining: typeof body.remaining === 'number' ? body.remaining : null,
        ...(typeof body.cache_hit === 'boolean' ? { cache_hit: body.cache_hit } : {}),
      };
      writeJson(path.join(PARSED_V4_DIR, `${mood.id}.json`), parsedFile);
    }
    writeJson(LEDGER_FILE, ctx.ledger);
    return {
      profile: validateAndNormalize(body),
      searchId: cap.searchId,
      searchKeywords: stringArr(body.search_keywords),
      profileName: typeof body.profile_name === 'string' && body.profile_name.trim() ? body.profile_name.trim() : null,
      genresInclude: stringArr(body.genres_include),
      genresExclude: stringArr(body.genres_exclude),
      maxRuntime: typeof body.max_runtime === 'number' ? body.max_runtime : null,
      referenceTitles: titleRefsOf(body.reference_titles),
      suggestedTitles: titleRefsOf(body.suggested_titles),
      excludeRecentIds: stringArr(body.exclude_recent_ids),
      cacheHit: cap.parseCacheHit,
    };
  };

  const matchV4 = async (args: MatchV4Args): Promise<MatchRow[]> => {
    await sleep(C.RPC_GAP_MS);
    ctx.slept += C.RPC_GAP_MS;
    const vector = tasteProfileToVector(args.profile as TasteProfile);
    const t0 = Date.now();
    const { data, error } = await ctx.session.supabase.rpc('match_films_v4', {
      query_vector: `[${vector.join(',')}]`,
      user_vector: null,
      mood_weight: 1.0,
      user_weight: 0.0,
      match_count: args.matchCount,
      min_similarity: args.minSimilarity,
      ...(args.minRating != null ? { min_rating: args.minRating } : {}),
      ...(args.searchKeywords.length > 0 ? { search_keywords: args.searchKeywords } : {}),
      ...(args.excludeIds.length > 0 ? { exclude_ids: args.excludeIds } : {}),
      per_director_cap: C.PER_DIRECTOR_CAP,
      tier_boost: true,
      exclude_archive: true,
      genres_include: args.genresInclude,
      genres_exclude: args.genresExclude,
      max_runtime: args.maxRuntime,
      reference_titles: args.referenceTitles,
      suggested_titles: args.suggestedTitles,
    });
    const ms = Date.now() - t0;
    ctx.calls += 1;
    if (error) throw new Error(`match_films_v4: ${error.message}`);
    const rows = (data ?? []) as MatchRow[];
    cap.attempts.push({ min_similarity: args.minSimilarity, min_rating: args.minRating, ms, n_rows: rows.length });
    return rows;
  };

  const rerank = async (input: {
    moodText: string; candidates: MatchRow[]; count: number; withReasons: boolean;
  }): Promise<RerankOutcome> => {
    const withReasons = input.withReasons;
    const call: V5Call = {
      with_reasons: withReasons, ms: 0, http_status: null, timeout: false, failure: null,
      server_fallback: false, error_detail: null, reranked_ids: [], reasons: {}, reasons_dropped: null, reason_model: null,
    };
    if (ctx.stopMsg) return { ok: false, failure: 'eval_stopped' };

    // Sayaçlar AYRI ve sunucuyla aynı ayrım: id-rerank → rerank-films-daily, gerekçe → rerank-films-reasons-daily.
    const day = utcDay();
    const total = withReasons ? (ctx.ledger.rerank_reasons_total ?? 0) : (ctx.ledger.rerank_ids_total ?? 0);
    const today = (withReasons ? ctx.ledger.rerank_reasons_by_day : ctx.ledger.rerank_ids_by_day)?.[day] ?? 0;
    const capTotal = withReasons ? C.CAP_REASONS_TOTAL : C.CAP_IDS_TOTAL;
    const capDay = withReasons ? C.CAP_REASONS_PER_UTC_DAY : C.CAP_IDS_PER_UTC_DAY;
    const label = withReasons ? 'reasons' : 'id-rerank';
    if (total + 1 > capTotal) {
      ctx.stopMsg = `${label} toplam tavanı (${capTotal}) aşılacak; durduruldu.`;
      return { ok: false, failure: 'eval_cap' };
    }
    if (today + 1 > capDay) {
      ctx.stopMsg = `UTC ${day} ${label} tavanı (${capDay}) aşılacak; durduruldu.`;
      return { ok: false, failure: 'eval_cap' };
    }
    await llmGate(ctx);
    if (withReasons) {
      ctx.ledger.rerank_reasons_total = total + 1;
      ctx.ledger.rerank_reasons_by_day = bump(ctx.ledger.rerank_reasons_by_day, day);
    } else {
      ctx.ledger.rerank_ids_total = total + 1;
      ctx.ledger.rerank_ids_by_day = bump(ctx.ledger.rerank_ids_by_day, day);
    }
    ctx.ledger.rerank_total += 1;
    writeJson(LEDGER_FILE, ctx.ledger);
    ctx.calls += 1;

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      withReasons ? C.CLIENT_RERANK_REASONS_TIMEOUT_MS : C.CLIENT_RERANK_IDS_TIMEOUT_MS,
    );
    const t0 = Date.now();
    try {
      const res = await fetch(`${url}/functions/v1/rerank-films?forceFunctionRegion=${GAUNTLET_EDGE_REGION}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await token(ctx)}`,
          apikey: anon,
          'x-region': GAUNTLET_EDGE_REGION,
        },
        body: JSON.stringify({
          mood_text: input.moodText,
          candidates: input.candidates.map((c) => ({
            id: c.id,
            title: c.title,
            overview: (c.overview ?? '').slice(0, C.CLIENT_RERANK_OVERVIEW_MAX),
            genres: c.genres,
            year: c.year,
            similarity: c.similarity,
          })),
          count: input.count,
          reason: withReasons,
        }),
        signal: controller.signal,
      });
      call.ms = Date.now() - t0;
      call.http_status = res.status;
      ctx.ledger.last_llm_at = Date.now();
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.status === 429 || res.status === 401) {
        ctx.stopMsg = `${label} ${mood.id}: HTTP ${res.status} — durduruldu, kısmi sonuçlar saklandı.`;
        call.failure = `http_${res.status}`;
        return { ok: false, failure: call.failure };
      }
      call.error_detail = typeof json.error_detail === 'string' ? json.error_detail : null;
      call.server_fallback = json.fallback === true;
      call.reason_model = typeof json.reason_model === 'string' ? json.reason_model : null;
      call.reasons_dropped = typeof json.reasons_dropped === 'number' ? json.reasons_dropped : null;
      if (!res.ok) {
        call.failure = `http_${res.status}`;
        return { ok: false, failure: call.failure };
      }
      if (!Array.isArray(json.reranked_ids)) {
        call.failure = 'bad_body';
        return { ok: false, failure: 'bad_body' };
      }
      if (call.server_fallback) {
        call.failure = 'server_fallback';
        return { ok: false, failure: 'server_fallback' };
      }
      const reasons: Record<string, string> = {};
      if (json.reasons && typeof json.reasons === 'object') {
        for (const [k, v] of Object.entries(json.reasons as Record<string, unknown>)) {
          if (typeof v === 'string') reasons[k] = v;
        }
      }
      call.reranked_ids = stringArr(json.reranked_ids);
      call.reasons = reasons;
      return { ok: true, ids: call.reranked_ids, reasons };
    } catch (err) {
      call.ms = Date.now() - t0;
      if (controller.signal.aborted) {
        call.timeout = true;
        call.failure = 'timeout';
        return { ok: false, failure: 'timeout' };
      }
      call.failure = 'network';
      throw err; // istemci gibi: hat onError + yedek yol; hata cap.errors'a düşer
    } finally {
      clearTimeout(timer);
      cap.calls.push(call);
    }
  };

  return {
    parse,
    matchV4,
    rerank,
    // Soğuk eval hesabı: watchlist/izlenen yok (V3 ölçümüyle aynı); istemcide bu iki liste hesaba bağlı.
    loadExclusions: async () => [],
    recordRecommended: async (searchId: string, ids: string[]): Promise<void> => {
      const { error } = await ctx.session.supabase
        .from('mood_searches')
        .update({ recommended_film_ids: ids, rpc_version: 'v4' })
        .eq('id', searchId);
      if (error) throw new Error(`mood_searches update: ${error.message}`);
    },
    newId: () => crypto.randomUUID(),
    now: () => Date.now() - ctx.slept,
    onFallback: (stage: FallbackStage) => {
      cap.fallbacks.push(stage);
      console.log(`  yedek yol: ${stage}`);
    },
    onError: (stage: FallbackStage, err: unknown) => {
      cap.errors.push(`${stage}: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`  hat hatası (${stage}): ${err instanceof Error ? err.message : String(err)}`);
    },
  };
}

/** Tek mood için istemci hattının tamamı: parse → v4 → pick (id-rerank) → [dörtlü görünür] → reasons. */
async function runV5Mood(
  ctx: Ctx, mood: Mood, opts: { cached: boolean },
): Promise<RawRecord> {
  const cap: V5Capture = {
    calls: [], fallbacks: [], errors: [], attempts: [], searchId: null, parseMs: 0, parseCacheHit: false, parsedBody: null,
  };
  const deps = makeEvalDeps(ctx, mood, cap, { cached: opts.cached, savePrimary: !opts.cached });
  const stages: Partial<Record<PipelineStageName, number>> = {};
  const quickId = mood.kind === 'quick' ? QUICK_MOOD_CLIENT_ID[mood.id] : undefined;

  const start = await startMoodGauntlet(deps, {
    text: mood.text,
    ...(quickId ? { quickMoodId: quickId } : {}),
    onTiming: (stage, ms) => {
      stages[stage] = ms;
    },
  });
  if (ctx.stopMsg) throw new StopError(ctx.stopMsg);

  let reasons: Record<string, string> = {};
  let reasonsMs: number | null = null;
  let four: MatchRow[] = [];
  let reranked = false;
  if (start.status === 'ok') {
    four = start.set.four;
    reranked = start.set.reranked;
    const t0 = deps.now ? deps.now() : Date.now();
    reasons = await fetchReasons(deps, start.session, start.set);
    reasonsMs = (deps.now ? deps.now() : Date.now()) - t0;
    if (ctx.stopMsg) throw new StopError(ctx.stopMsg);
    // reranked=false → fetchReasons çağrı yapmaz; süre anlamsız
    if (!reranked) reasonsMs = null;
  }

  // Hata oranı muhasebesi (hat içinde yutulanlar dahil): StopError hat dışında, burada.
  for (const c of cap.calls) if (c.failure !== null) noteFailure(ctx, `${mood.id} ${c.with_reasons ? 'reasons' : 'id-rerank'}: ${c.failure}`);

  const pool = start.session.pool;
  const rpcMs = cap.attempts.reduce((s, a) => s + a.ms, 0);
  const parse = stages.parse ?? 0;
  const v4 = stages.v4 ?? 0;
  const pick = stages.pick ?? 0;
  const v5: V5Block = {
    status: start.status === 'ok' ? 'ok' : 'insufficient',
    stages_ms: { parse, v4, pick, reasons: reasonsMs },
    visible_ms: parse + v4 + pick,
    parse_cache_hit: cap.parseCacheHit,
    four: four.map((r) => r.id),
    reranked,
    reasons,
    fallbacks: cap.fallbacks,
    errors: cap.errors,
    notices: start.session.notices,
    calls: cap.calls,
  };
  return {
    mood_id: mood.id,
    variant: 'V5',
    rpc: {
      rows: pool.map((r) => trimRow(r as unknown as Record<string, unknown>)),
      attempts: cap.attempts,
      total_ms: rpcMs,
      params_first: { match_count: V4_MATCH_COUNT, note: 'istemci hattı (fetchPool) — bkz. services/moodGauntlet.ts' },
    },
    v5,
  };
}

/** V5 çıktısında geçen dörtlü film kimlikleri için imdb_votes/imdb_rating meta'sını OUT_DIR'a yazar. */
async function ensureFourMeta(ctx: Ctx, recs: RawRecord[]): Promise<void> {
  const ids = new Set<string>();
  for (const r of recs) for (const id of r.v5?.four ?? []) ids.add(id);
  if (ids.size > 0) await loadMeta(ctx.session, [...ids]);
}

// ─── Önbellekli ikinci geçiş (quick mood'lar) ────────────────────────────────

/**
 * Quick mood'lar için ikinci geçiş: aynı metin → parse-mood önbellekten (cache_hit şart), sonra tüm V5 hattı.
 * Önbellek isabet ETMEZSE Haiku harcanmıştır: deftere işlenir ve koşu durur (sessiz devam yok).
 */
async function runCachedPass(ctx: Ctx, quick: Mood[]): Promise<void> {
  const done: RawRecord[] = [];
  for (const mood of quick) {
    const out = path.join(CACHED_PASS_DIR, `${mood.id}.json`);
    if (fs.existsSync(out)) {
      console.log(`  ${mood.id}: cached-pass kaydı var, atlandı`);
      continue;
    }
    if (!fs.existsSync(path.join(PARSED_V4_DIR, `${mood.id}.json`))) {
      throw new StopError(`${mood.id}: önce --variant V5 koşulmalı (önbellek dolmadı).`);
    }
    const rec = await runV5Mood(ctx, mood, { cached: true });
    writeJson(out, rec);
    writeJson(LEDGER_FILE, ctx.ledger);
    done.push(rec);
    const s = rec.v5?.stages_ms;
    console.log(`  cached-pass ${mood.id}: parse ${s?.parse} + v4 ${s?.v4} + pick ${s?.pick} = görünür ${rec.v5?.visible_ms} ms; reasons ${s?.reasons ?? 'yok'} ms`);
  }
  await ensureFourMeta(ctx, done);
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

  const ctx: Ctx = { session, sessionOpenedAt: Date.now(), ledger: loadLedger(), calls: 0, failures: 0, slept: 0, stopMsg: null };
  const doRpc = args.stage !== 'rerank';
  const doRerank = args.stage !== 'rpc';
  const t0 = Date.now();
  const v5Done: RawRecord[] = [];

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
        if (v === 'V5') {
          // V5 = istemci hattının tamamı (parse → v4 → pick → reasons); aşamalı (--stage) çalışmaz.
          if (args.stage !== 'all') throw new StopError('V5 --stage desteklemez (hat bütündür).');
          if (fs.existsSync(f) && !args.reparse) {
            console.log(`  ${mood.id}/V5: kayıt var, atlandı`);
            continue;
          }
          const rec5 = await runV5Mood(ctx, mood, { cached: false });
          writeJson(f, rec5);
          v5Done.push(rec5);
          const st = rec5.v5?.stages_ms;
          console.log(`  V5 ${mood.id}: parse ${st?.parse} + v4 ${st?.v4} + pick ${st?.pick} = görünür ${rec5.v5?.visible_ms} ms; reasons ${st?.reasons ?? 'yok'} ms; ${Object.keys(rec5.v5?.reasons ?? {}).length}/4 gerekçe`);
          continue;
        }
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
    // V5: dörtlü filmlerin imdb_votes meta'sı (summary-2d okur). Mevcut kayıtlar atlanmışsa da hepsi taranır.
    if (args.variants.includes('V5')) {
      const all: RawRecord[] = [...v5Done];
      for (const mood of moods) {
        const f = rawFile(mood.id, 'V5');
        if (fs.existsSync(f) && !v5Done.some((r) => r.mood_id === mood.id)) all.push(readJson<RawRecord>(f));
      }
      await ensureFourMeta(ctx, all);
    }
  } finally {
    writeJson(LEDGER_FILE, ctx.ledger);
    console.log(`Çağrı: ${ctx.calls}, hata: ${ctx.failures}, süre: ${((Date.now() - t0) / 1000).toFixed(1)} sn`);
    console.log(`Defter: parse=${ctx.ledger.parse_total}/${C.CAP_PARSE_TOTAL}, rerank=${ctx.ledger.rerank_total}/${C.CAP_RERANK_TOTAL}, bugün(${utcDay()})=${ctx.ledger.rerank_by_day[utcDay()] ?? 0}/${C.CAP_RERANK_PER_UTC_DAY}`);
    console.log(`V5 sayaçlar: id-rerank=${ctx.ledger.rerank_ids_total ?? 0}/${C.CAP_IDS_TOTAL}, reasons=${ctx.ledger.rerank_reasons_total ?? 0}/${C.CAP_REASONS_TOTAL}, parse-önbellek=${ctx.ledger.parse_cached_total ?? 0}/${C.CAP_PARSE_CACHED_TOTAL}`);
  }
  // V4/V5 koşuları MOOD-VEC-1 raporlarını (V0-V3) üretmez; V5 özeti summary-2d.ts'tedir.
  if (args.variants.every((v) => v === 'V4' || v === 'V5')) return;
  await buildReports(ctx.session);
}

main().catch((e: unknown) => {
  console.error(e instanceof StopError ? `DUR: ${e.message}` : e);
  process.exit(1);
});
