/**
 * MOOD-VEC-1 ortak tipler, yollar ve saf yardımcılar (run.ts + report.ts).
 */
import * as fs from 'fs';
import * as path from 'path';

import { applyQualityGate } from '../../utils/moodQualityGate';

// MOOD_EVAL_OUT: çıktı klasörünü değiştirir (2c: docs/investigations/mood-vec-2c/eval); varsayılan mood-vec-1.
export const OUT_DIR = process.env.MOOD_EVAL_OUT
  ? path.resolve(process.env.MOOD_EVAL_OUT)
  : path.resolve(__dirname, '../../docs/investigations/mood-vec-1');
export const PARSED_DIR = path.join(OUT_DIR, 'parsed');
/** V3: parse-mood schema_version:2 yanıtları (v1 parse dosyalarıyla karışmaz). */
/** MOOD_EVAL_OUT başka klasördeyse V0 yeniden koşusu v1 parse'ı buradan okur (0 parse harcanır). */
export const LEGACY_PARSED_DIR = path.resolve(__dirname, '../../docs/investigations/mood-vec-1/parsed');
export const PARSED_V2_DIR = path.join(OUT_DIR, 'parsed-v2');
/** V4 (2d): 6 öneri + önbellekli parse-mood v2; V3 parse'ıyla karışmaz (prompt farklı). */
export const PARSED_V4_DIR = path.join(OUT_DIR, 'parsed-v4');
/** V4 önbellekli ikinci geçiş (yalnız quick mood'lar): parse-mood önbellek isabeti + RPC + rerank. */
export const CACHED_PASS_DIR = path.join(OUT_DIR, 'raw-v4-cached');
export const RAW_DIR = path.join(OUT_DIR, 'raw');
export const CACHE_DIR = path.join(OUT_DIR, 'rerank-cache');
export const LEDGER_FILE = path.join(OUT_DIR, 'ledger.json');
export const META_FILE = path.join(OUT_DIR, 'films-meta.json');

export type Variant = 'V0' | 'V1' | 'V2' | 'V3' | 'V4' | 'V5';
/** Varsayılan koşu/rapor kümesi (2c). V4 (2d) yalnız --variant V4 ile açıkça istenir. */
export const VARIANTS: readonly Variant[] = ['V0', 'V1', 'V2', 'V3'];
export const ALL_VARIANTS: readonly Variant[] = [...VARIANTS, 'V4', 'V5'];

export interface Mood {
  id: string;
  text: string;
  lang: 'en' | 'tr';
  kind: 'quick' | 'free';
}

/** match_films_v3 satırından saklanan alanlar (dimensions/poster atılır). */
export interface Row {
  id: string;
  tmdb_id: number;
  title: string;
  year: number | null;
  overview: string | null;
  genres: string[] | null;
  runtime: number | null;
  vote_average: number | null;
  director: string | null;
  similarity: number;
  curation_tier: string | null;
  match_reason: string | null;
  /** match_films_v4 kanal etiketi ('v' | 'a' | 'c'); yalnız V3. */
  channels?: string[];
}

export interface RpcAttempt {
  min_similarity: number;
  min_rating: number | null;
  ms: number;
  n_rows: number;
}

export interface RpcRecord {
  rows: Row[];
  attempts: RpcAttempt[];
  total_ms: number;
  params_first: Record<string, unknown>;
}

export interface RerankRecord {
  payload_hash: string;
  cached: boolean;
  candidates_sent: number;
  overview_max: number;
  count: number;
  /** Sunucuya gidiş-dönüş süresi (önbellekteyse ilk çağrının süresi). */
  ms: number;
  http_status: number;
  reranked_ids: string[];
  server_fallback: boolean;
  error_detail: string | null;
  /** Uygulamanın 6 sn zaman aşımı aşıldı mı (uygulamada RPC sırasına dönülürdü). */
  exceeded_app_timeout: boolean;
  /** reason:true istendiyse film id → tek cümle gerekçe (yalnız V3). */
  reasons?: Record<string, string>;
  /** Sunucu TR sızıntı denetiminde boşaltılan gerekçe sayısı (yalnız V4). */
  reasons_dropped?: number;
}

/** V4 önbellekli geçiş kaydı: tek mood için ikinci parse + RPC + rerank ölçümü. */
export interface CachedPassRecord {
  mood_id: string;
  parse_ms: number;
  /** parse-mood yanıtındaki cache_hit (true olmak zorunda; değilse koşu durur). */
  parse_cache_hit: boolean;
  rpc: RpcRecord;
  rerank: RerankRecord | null;
}

export interface RawRecord {
  mood_id: string;
  variant: Variant;
  rpc: RpcRecord;
  rerank?: RerankRecord;
}

export interface ParsedFile {
  mood_id: string;
  text: string;
  ms: number;
  http_status: number;
  response: Record<string, unknown>;
  profile: Record<string, unknown>;
  search_id: string | null;
  search_keywords: string[];
  limit: number | null;
  remaining: number | null;
  /** parse-mood v2 yanıtı: önbellek isabeti (V4). */
  cache_hit?: boolean | null;
}

export interface Ledger {
  parse_total: number;
  rerank_total: number;
  rerank_by_day: Record<string, number>;
  /** V4 önbellekli geçişte yapılan parse-mood HTTP çağrıları (Haiku harcamaz; isabet şartı). */
  parse_cached_total?: number;
  last_llm_at: number;
  mood_searches_rows: string[];
}

export interface FilmMeta {
  imdb_rating: number | null;
  imdb_votes: number | null;
}

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function loadMoods(): Mood[] {
  return readJson<Mood[]>(path.join(__dirname, 'moods.json'));
}

export function rawFile(moodId: string, v: Variant): string {
  return path.join(RAW_DIR, `${moodId}.${v}.json`);
}

/** services/recommendations.ts:867-889 `reorderByRerankedIds` kopyası. */
export function reorderByRerankedIds(rows: Row[], rerankedIds: string[]): Row[] {
  const idToRow = new Map(rows.map((r) => [r.id, r]));
  const result: Row[] = [];
  const used = new Set<string>();
  for (const id of rerankedIds) {
    const row = idToRow.get(id);
    if (row) {
      result.push(row);
      used.add(id);
    }
  }
  for (const row of rows) if (!used.has(row.id)) result.push(row);
  return result;
}

export interface FinalList {
  /** Rerank (uygulandıysa) sonrası tüm sıra, süzgeçten önce */
  ordered: Row[];
  /** Kalite süzgeci + FINAL_CAP sonrası */
  top: Row[];
  rerankApplied: boolean;
  /** film id → 1 tabanlı rerank sırası */
  rerankRank: Map<string, number>;
}

/** services/recommendations.ts:1261-1331 sırası: rerank (şartlıysa uygula) → kalite süzgeci. */
export function computeFinal(rec: RawRecord): FinalList {
  const rr = rec.rerank;
  const applied = !!rr && !rr.server_fallback && rr.reranked_ids.length > 0;
  const ordered = applied ? reorderByRerankedIds(rec.rpc.rows, rr.reranked_ids) : rec.rpc.rows;
  const rerankRank = new Map<string, number>();
  if (applied) rr.reranked_ids.forEach((id, i) => rerankRank.set(id, i + 1));
  return { ordered, top: applyQualityGate(ordered).rows, rerankApplied: applied, rerankRank };
}

/** RPC sırası (rerank'siz) + kalite süzgeci. */
export function computeRpcOrderTop(rec: RawRecord): Row[] {
  return applyQualityGate(rec.rpc.rows).rows;
}
