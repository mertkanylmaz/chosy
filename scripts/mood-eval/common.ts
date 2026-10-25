/**
 * MOOD-VEC-1 ortak tipler, yollar ve saf yardımcılar (run.ts + report.ts).
 */
import * as fs from 'fs';
import * as path from 'path';

import { applyQualityGate } from '../../utils/moodQualityGate';

export const OUT_DIR = path.resolve(__dirname, '../../docs/investigations/mood-vec-1');
export const PARSED_DIR = path.join(OUT_DIR, 'parsed');
export const RAW_DIR = path.join(OUT_DIR, 'raw');
export const CACHE_DIR = path.join(OUT_DIR, 'rerank-cache');
export const LEDGER_FILE = path.join(OUT_DIR, 'ledger.json');
export const META_FILE = path.join(OUT_DIR, 'films-meta.json');

export type Variant = 'V0' | 'V1' | 'V2';
export const VARIANTS: readonly Variant[] = ['V0', 'V1', 'V2'];

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
}

export interface Ledger {
  parse_total: number;
  rerank_total: number;
  rerank_by_day: Record<string, number>;
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
