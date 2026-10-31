/**
 * Mood Gauntlet v2 hattı (Faz 2-1) — saf orkestrasyon. RN / Supabase / ağ YOK:
 * bağımlılıklar `MoodGauntletDeps` ile enjekte edilir (gerçek bağlama
 * `services/moodGauntletDeps.ts`). Böylece yedek yolları deno ile test edilir.
 *
 * Hat: parse-mood {schema_version:2} → match_films_v4 → rerank-films {count:4, reason:true}
 *   → { four[], reasons{}, backups[≤3], searchId }.
 *
 * Kurallar:
 *  - exclude_ids = watchlist + izlenenler + parse.exclude_recent_ids + bu oturumda gösterilenler.
 *  - v4 < 4 dönerse: önce genres_include düşer, sonra min_similarity zinciri
 *    (utils/relaxationChain). max_runtime ve genres_exclude SESSİZCE düşürülmez: en son
 *    basamakta max_runtime düşürülürse sonuçta `notices` ile GÖRÜNÜR not taşınır.
 *    genres_exclude hiçbir basamakta düşmez.
 *  - Rerank başarısızsa v4 sırasıyla ilk 4, gerekçesiz (`onFallback('rerank')`).
 *  - "Başka bir dörtlü": aynı parse + kalan v4 adaylarından yeni rerank (YENİ PARSE YOK).
 *    Aday biterse `exhausted` döner (UI yeni arama önerir).
 *  - Ham mood metni analitiğe gitmez (bu dosya analitik atmaz).
 */
import { buildRelaxationSteps } from '../utils/relaxationChain';

export const FOUR = 4;
export const MAX_BACKUPS = 3;
/** Rerank'a giden en çok aday (rerank-films reason yolu da 20'de keser). */
export const RERANK_CANDIDATES = 20;
/** v4 aday sayısı. */
export const V4_MATCH_COUNT = 40;
/** exclude_ids üst sınırı (RPC gövdesi; recommendations.ts ile aynı). */
export const MAX_EXCLUDE_IDS = 500;

// ─── Tipler ──────────────────────────────────────────────────────────────────

export interface TitleRef {
  title: string;
  year: number | null;
}

/** parse-mood v2 yanıtının hat için gereken kısmı (profil yapısı opak taşınır). */
export interface ParsedMoodV2 {
  /** TasteProfile — sorgu vektörü `queryVector` ile deps tarafında üretilir. */
  profile: unknown;
  searchId: string | null;
  searchKeywords: string[];
  /** 2-3 kelimelik özet (yükleme ekranında gösterilir); yoksa null. */
  profileName: string | null;
  genresInclude: string[];
  genresExclude: string[];
  maxRuntime: number | null;
  referenceTitles: TitleRef[];
  suggestedTitles: TitleRef[];
  excludeRecentIds: string[];
  cacheHit: boolean;
}

export interface MatchRow {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  overview: string | null;
  genres: string[] | null;
  runtime: number | null;
  vote_average: number | null;
  director: string | null;
  similarity: number;
  /** match_films_v4 kanal etiketi ('v' | 'a' | 'c'). */
  channels?: string[] | null;
}

export interface MatchV4Args {
  profile: unknown;
  excludeIds: string[];
  searchKeywords: string[];
  genresInclude: string[];
  genresExclude: string[];
  maxRuntime: number | null;
  referenceTitles: TitleRef[];
  suggestedTitles: TitleRef[];
  minSimilarity: number;
  minRating: number | null;
  matchCount: number;
}

export type RerankOutcome =
  | { ok: true; ids: string[]; reasons: Record<string, string> }
  | { ok: false; failure: string };

export type FallbackStage =
  | 'rerank'
  | 'genres_relaxed'
  | 'similarity_relaxed'
  | 'max_runtime_dropped'
  | 'record_ids';

export interface MoodGauntletDeps {
  parse(input: { text: string; quickMoodId?: string; clientSearchId: string }): Promise<ParsedMoodV2>;
  /** Hata → throw (sessiz boş dönüş yok). */
  matchV4(args: MatchV4Args): Promise<MatchRow[]>;
  rerank(input: { moodText: string; candidates: MatchRow[]; count: number }): Promise<RerankOutcome>;
  /** watchlist + izlenen film kimlikleri. */
  loadExclusions(): Promise<string[]>;
  /** mood_searches.recommended_film_ids (four + backups, gösterim sırası). */
  recordRecommended(searchId: string, ids: string[]): Promise<void>;
  newId(): string;
  /** Telemetri: bir yedek yola düşüldü (ham metin taşımaz). */
  onFallback(stage: FallbackStage): void;
  /** Yutulan (hattı durdurmayan) hata — gerçek bağlama Sentry'ye yazar. */
  onError(stage: FallbackStage, err: unknown): void;
}

export type MoodNotice = 'max_runtime_dropped';

export interface MoodSession {
  moodText: string;
  parsed: ParsedMoodV2;
  /** Son v4 sonucu (tüm adaylar, kanal önceliği sırasıyla). */
  pool: MatchRow[];
  /** Oturumda gösterilen film kimlikleri (dörtlüler + görülen yedekler + önceki oturumlardan taşınanlar). */
  shown: string[];
  /** Kaç dörtlü üretildi (0 tabanlı sonraki index için). */
  setCount: number;
  notices: MoodNotice[];
  /** recommended_film_ids birikimi. */
  recorded: string[];
}

export interface MoodSet {
  setId: string;
  setIndex: number;
  four: MatchRow[];
  /** film id → tek cümle gerekçe; boş/yok → gerekçe gösterilmez. */
  reasons: Record<string, string>;
  backups: MatchRow[];
  /** Rerank sonuç verdi mi (false = v4 sırası, gerekçesiz). */
  reranked: boolean;
}

export type StartResult =
  | { status: 'ok'; session: MoodSession; set: MoodSet }
  | { status: 'insufficient'; session: MoodSession };

export type NextResult =
  | { status: 'ok'; session: MoodSession; set: MoodSet }
  | { status: 'exhausted'; session: MoodSession };

// ─── Saf yardımcılar ─────────────────────────────────────────────────────────

/** Gerekçe boş/yalnız boşluk ise null — UI satırı hiç çizmez ("" davranışı). */
export function reasonFor(reasons: Record<string, string> | undefined, id: string): string | null {
  const r = reasons?.[id];
  if (typeof r !== 'string') return null;
  const t = r.trim();
  return t.length > 0 ? t : null;
}

/**
 * Dışlama birleşimi. Öncelik (500 sınırı aşılırsa sondan kesilir): oturumda gösterilenler →
 * kişisel tekrar dışlama → watchlist/izlenenler. Tekrarsız, sıra korunur.
 */
export function mergeExclusions(input: {
  shown: readonly string[];
  recent: readonly string[];
  library: readonly string[];
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of [input.shown, input.recent, input.library]) {
    for (const id of list) {
      if (typeof id !== 'string' || id.length === 0 || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length >= MAX_EXCLUDE_IDS) return out;
    }
  }
  return out;
}

interface AttemptPlan {
  minSimilarity: number;
  minRating: number | null;
  includeGenres: boolean;
  keepRuntime: boolean;
}

/** v4 deneme sırası: tam → genres_include düşer → min_similarity zinciri → (son) max_runtime düşer. */
export function buildV4Attempts(hasGenresInclude: boolean, hasMaxRuntime: boolean): AttemptPlan[] {
  const steps = buildRelaxationSteps(null, null);
  const plans: AttemptPlan[] = [
    { minSimilarity: steps[0].minSimilarity, minRating: steps[0].minRating, includeGenres: true, keepRuntime: true },
  ];
  if (hasGenresInclude) {
    plans.push({ minSimilarity: steps[0].minSimilarity, minRating: steps[0].minRating, includeGenres: false, keepRuntime: true });
  }
  for (let i = 1; i < steps.length; i++) {
    plans.push({ minSimilarity: steps[i].minSimilarity, minRating: steps[i].minRating, includeGenres: false, keepRuntime: true });
  }
  if (hasMaxRuntime) {
    const last = steps[steps.length - 1];
    plans.push({ minSimilarity: last.minSimilarity, minRating: last.minRating, includeGenres: false, keepRuntime: false });
  }
  return plans;
}

/** Aynı id'li tekrarları atar (ilk görülen kalır). */
function uniqueById(rows: readonly MatchRow[]): MatchRow[] {
  const seen = new Set<string>();
  const out: MatchRow[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

/**
 * Havuzdan (zaten dışlanmış) dört + yedek seçer. Rerank sonucu: sıralı id'ler havuzda
 * karşılığı olanlar alınır, eksik kalırsa havuz sırasıyla tamamlanır. Rerank yoksa havuz sırası.
 */
export function pickFour(
  pool: readonly MatchRow[],
  rerank: RerankOutcome | null,
): { four: MatchRow[]; reasons: Record<string, string>; backups: MatchRow[]; reranked: boolean } {
  const byId = new Map(pool.map((r) => [r.id, r]));
  const four: MatchRow[] = [];
  const taken = new Set<string>();
  let reranked = false;
  const reasons: Record<string, string> = {};

  if (rerank && rerank.ok) {
    for (const id of rerank.ids) {
      const row = byId.get(id);
      if (!row || taken.has(id)) continue;
      four.push(row);
      taken.add(id);
      if (four.length === FOUR) break;
    }
    reranked = four.length > 0;
  }
  for (const row of pool) {
    if (four.length === FOUR) break;
    if (taken.has(row.id)) continue;
    four.push(row);
    taken.add(row.id);
  }

  if (reranked && rerank && rerank.ok) {
    for (const row of four) {
      const r = reasonFor(rerank.reasons, row.id);
      if (r) reasons[row.id] = r;
    }
  }

  const backups: MatchRow[] = [];
  for (const row of pool) {
    if (backups.length === MAX_BACKUPS) break;
    if (taken.has(row.id)) continue;
    backups.push(row);
  }
  return { four, reasons, backups, reranked };
}

// ─── Hat ─────────────────────────────────────────────────────────────────────

async function recordIds(deps: MoodGauntletDeps, session: MoodSession, set: MoodSet): Promise<MoodSession> {
  const merged = [...session.recorded];
  for (const r of [...set.four, ...set.backups]) if (!merged.includes(r.id)) merged.push(r.id);
  const next = { ...session, recorded: merged };
  if (session.parsed.searchId) {
    try {
      await deps.recordRecommended(session.parsed.searchId, merged);
    } catch (err) {
      // Sonuç ekranını engellemez ama sessiz değil: hata deps üzerinden Sentry'ye gider.
      deps.onError('record_ids', err);
      deps.onFallback('record_ids');
    }
  }
  return next;
}

async function rerankOrNull(
  deps: MoodGauntletDeps,
  moodText: string,
  pool: readonly MatchRow[],
): Promise<RerankOutcome | null> {
  const candidates = pool.slice(0, RERANK_CANDIDATES) as MatchRow[];
  try {
    const out = await deps.rerank({ moodText, candidates, count: FOUR });
    if (!out.ok || out.ids.length === 0) {
      deps.onFallback('rerank');
      return null;
    }
    return out;
  } catch (err) {
    // Hat v4 sırasıyla sürer; hata Sentry'ye gider (sessiz fallback değil).
    deps.onError('rerank', err);
    deps.onFallback('rerank');
    return null;
  }
}

/** Yeni arama: parse → v4 (gevşetme zinciri) → rerank → dörtlü. `carryShown` önceki aramalardan taşınan dışlamadır. */
export type StageEvent = { stage: 'parsed'; profileName: string | null } | { stage: 'picking' };

export async function startMoodGauntlet(
  deps: MoodGauntletDeps,
  input: {
    text: string;
    quickMoodId?: string;
    carryShown?: readonly string[];
    /** Yükleme ekranı için aşama bildirimi (profile_name geldiğinde 'parsed'). */
    onStage?: (e: StageEvent) => void;
  },
): Promise<StartResult> {
  const parsed = await deps.parse({
    text: input.text,
    quickMoodId: input.quickMoodId,
    clientSearchId: deps.newId(),
  });
  input.onStage?.({ stage: 'parsed', profileName: parsed.profileName });
  const library = await deps.loadExclusions();
  const shown = [...(input.carryShown ?? [])];
  const excludeIds = mergeExclusions({ shown, recent: parsed.excludeRecentIds, library });

  const attempts = buildV4Attempts(parsed.genresInclude.length > 0, parsed.maxRuntime != null);
  let pool: MatchRow[] = [];
  const notices: MoodNotice[] = [];
  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i];
    const rows = await deps.matchV4({
      profile: parsed.profile,
      excludeIds,
      searchKeywords: parsed.searchKeywords,
      genresInclude: a.includeGenres ? parsed.genresInclude : [],
      genresExclude: parsed.genresExclude, // HİÇBİR basamakta düşmez
      maxRuntime: a.keepRuntime ? parsed.maxRuntime : null,
      referenceTitles: parsed.referenceTitles,
      suggestedTitles: parsed.suggestedTitles,
      minSimilarity: a.minSimilarity,
      minRating: a.minRating,
      matchCount: V4_MATCH_COUNT,
    });
    pool = uniqueById(rows);
    if (pool.length >= FOUR) {
      if (i > 0) {
        if (!a.includeGenres && parsed.genresInclude.length > 0) deps.onFallback('genres_relaxed');
        if (a.minSimilarity < attempts[0].minSimilarity) deps.onFallback('similarity_relaxed');
        if (!a.keepRuntime) {
          deps.onFallback('max_runtime_dropped');
          notices.push('max_runtime_dropped');
        }
      }
      break;
    }
  }

  const session: MoodSession = {
    moodText: input.text,
    parsed,
    pool,
    shown,
    setCount: 0,
    notices,
    recorded: [],
  };
  if (pool.length < FOUR) return { status: 'insufficient', session };
  input.onStage?.({ stage: 'picking' });
  const built = await buildSet(deps, session);
  // Taşınan dışlamalar havuzu 4'ün altına indirdiyse: yeni aramada da yeterli aday yok demektir.
  return built.status === 'ok' ? built : { status: 'insufficient', session: built.session };
}

async function buildSet(deps: MoodGauntletDeps, session: MoodSession): Promise<NextResult> {
  const available = session.pool.filter((r) => !session.shown.includes(r.id));
  if (available.length < FOUR) return { status: 'exhausted', session };
  const rerank = await rerankOrNull(deps, session.moodText, available);
  const picked = pickFour(available, rerank);
  const set: MoodSet = {
    setId: deps.newId(),
    setIndex: session.setCount,
    four: picked.four,
    reasons: picked.reasons,
    backups: picked.backups,
    reranked: picked.reranked,
  };
  const shown = [...session.shown];
  for (const r of set.four) if (!shown.includes(r.id)) shown.push(r.id);
  let next: MoodSession = { ...session, shown, setCount: session.setCount + 1 };
  next = await recordIds(deps, next, set);
  return { status: 'ok', session: next, set };
}

/** "Hiçbiri" / "Başka bir dörtlü": YENİ PARSE YOK; kalan v4 adaylarından yeni rerank. */
export async function nextFour(deps: MoodGauntletDeps, session: MoodSession): Promise<NextResult> {
  return buildSet(deps, session);
}

/** Sonuç ekranında yedekler görüldü: sonraki dörtlülerde tekrar çıkmasın. */
export function noteBackupsShown(session: MoodSession, backups: readonly MatchRow[]): MoodSession {
  const shown = [...session.shown];
  for (const b of backups) if (!shown.includes(b.id)) shown.push(b.id);
  return { ...session, shown };
}

/** "Daha hafif / Daha yoğun": mood metnine TEK modifier eklenir (öncekiler birikmez). */
export function withModifier(baseText: string, modifier: string): string {
  const base = baseText.trim();
  const mod = modifier.trim();
  if (mod.length === 0) return base;
  return `${base}. ${mod}`;
}
