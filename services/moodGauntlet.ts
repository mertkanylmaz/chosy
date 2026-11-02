/**
 * Mood Gauntlet v2 hattı (Faz 2-1) — saf orkestrasyon. RN / Supabase / ağ YOK:
 * bağımlılıklar `MoodGauntletDeps` ile enjekte edilir (gerçek bağlama
 * `services/moodGauntletDeps.ts`). Böylece yedek yolları deno ile test edilir.
 *
 * Hat: parse-mood {schema_version:2} → match_films_v4 → rerank-films {count:4, reason:false}
 *   → dörtlü HEMEN (gerekçesiz). Gerekçe AYRI, paralel bir çağrıdır (`fetchReasons`: yalnız bu 4
 *   film, reason:true); gelirse UI'a solarak girer, gelmezse satır yok.
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
import type { MoodFourPath } from '../utils/moodGauntletAnalytics';
import type { MoodFourServerMs } from '../utils/serverTimingHeader';
import { applyIntensity, clampIntensityStep, MAX_INTENSITY_STEPS } from '../utils/moodIntensity';
import { buildRelaxationSteps } from '../utils/relaxationChain';

export const FOUR = 4;
export const MAX_BACKUPS = 3;
/** Rerank'a giden en çok aday (rerank-films reason yolu da 20'de keser). */
export const RERANK_CANDIDATES = 20;
/** v4 aday sayısı. */
export const V4_MATCH_COUNT = 40;
/** v4 döner dönmez ön-yüklenen poster sayısı (rerank beklenirken). */
export const PREFETCH_POOL = 8;
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

/** Rerank çağrısı: `withReasons:false` → yalnız sıralı id'ler (hızlı); `true` → id + gerekçe. */
export type RerankOutcome =
  | { ok: true; ids: string[]; reasons: Record<string, string> }
  | { ok: false; failure: string };

export type FallbackStage =
  | 'rerank'
  | 'genres_relaxed'
  | 'similarity_relaxed'
  | 'max_runtime_dropped'
  | 'record_ids'
  | 'reasons'
  | 'mood_four';

/** `mood-four` çağrısı (Faz 2-3): v4 gevşetme zinciri + id-rerank TEK istekte. */
export interface MoodFourInput {
  moodText: string;
  profile: unknown;
  excludeIds: string[];
  parsed: ParsedMoodV2;
  attempts: AttemptPlan[];
  matchCount: number;
  rerankCandidates: number;
}

export type MoodFourOutcome =
  | {
      ok: true;
      pool: MatchRow[];
      /** Havuzu veren basamak (0 = gevşetme yok). */
      attemptIndex: number;
      /** null → rerank atlandı/başarısız: havuz sırasıyla ilk 4. */
      rerankedIds: string[] | null;
      /** Sunucu aşama süreleri (Server-Timing: auth, v4_rpc, pick_llm, total; ms). */
      serverMs?: MoodFourServerMs;
    }
  | { ok: false; failure: string };

export interface MoodGauntletDeps {
  parse(input: { text: string; quickMoodId?: string; clientSearchId: string }): Promise<ParsedMoodV2>;
  /** Hata → throw (sessiz boş dönüş yok). */
  matchV4(args: MatchV4Args): Promise<MatchRow[]>;
  rerank(input: {
    moodText: string;
    candidates: MatchRow[];
    count: number;
    withReasons: boolean;
    /** parse'taki genres_exclude; dörtlü seçiminde (reason:false) sunucu prompt'una ihlal yasağı olarak gider. */
    genresExclude?: readonly string[];
  }): Promise<RerankOutcome>;
  /**
   * Opsiyonel: tek istekte v4 + dörtlü seçimi. Yoksa ya da `ok:false` / hata dönerse eski 2 çağrılı
   * yola (matchV4 → rerank) düşülür (`onFallback('mood_four')`).
   */
  moodFour?(input: MoodFourInput): Promise<MoodFourOutcome>;
  /** watchlist + izlenen film kimlikleri. */
  loadExclusions(): Promise<string[]>;
  /** mood_searches.recommended_film_ids (four + backups, gösterim sırası). */
  recordRecommended(searchId: string, ids: string[]): Promise<void>;
  newId(): string;
  /** Aşama süresi ölçümü için saat; yoksa Date.now (testte enjekte edilir). */
  now?(): number;
  /** Poster ön-yükleme (en iyi çaba, bloklamaz). */
  prefetch?(rows: readonly MatchRow[]): void;
  /** Telemetri: bir yedek yola düşüldü (ham metin taşımaz). */
  onFallback(stage: FallbackStage): void;
  /** Yutulan (hattı durdurmayan) hata — gerçek bağlama Sentry'ye yazar. */
  onError(stage: FallbackStage, err: unknown): void;
}

export type MoodNotice = 'max_runtime_dropped';

export interface MoodSession {
  moodText: string;
  parsed: ParsedMoodV2;
  /** Sorgu profili: başta parse'ınki; yoğunluk kaydırılınca kaydırılmış kopya (parsed.profile özgün kalır). */
  profile: unknown;
  /** Özgün profile uygulanan yoğunluk adımı (−MAX..+MAX); 0 = parse'ın kendisi. */
  intensityStep: number;
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
  /** film id → gerekçe. Dörtlü gösterilirken BOŞ başlar; `fetchReasons` ayrıca doldurur. */
  reasons: Record<string, string>;
  backups: MatchRow[];
  /** Rerank sonuç verdi mi (false = v4 sırası, gerekçesiz). */
  reranked: boolean;
}

export type StartResult =
  | { status: 'ok'; session: MoodSession; set: MoodSet; path?: MoodFourPath }
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
 * Kart açıklaması: LLM gerekçesi varsa o; yoksa (sunucu koruması boşalttı / rerank düştü) filmin kendi
 * `overview` metni. Uydurma yok — yalnız veritabanındaki özet. İkisi de yoksa null.
 */
export function descriptionFor(
  reasons: Record<string, string> | undefined,
  id: string,
  overview: string | null | undefined,
): string | null {
  const reason = reasonFor(reasons, id);
  if (reason !== null) return reason;
  const o = typeof overview === 'string' ? overview.trim() : '';
  return o.length > 0 ? o : null;
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

export interface AttemptPlan {
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

/**
 * genres_exclude ihlali (Faz 2-5, P0-2): film türlerinden biri dışlanan türlerle kesişiyorsa true.
 * Sunucu (match_films_v4) zaten dışlar; bu istemci kapısı ikinci savunmadır — dörtlüye de
 * "If not this one" yedeklerine de dışlanan türde film ASLA girmez. Büyük/küçük harf duyarsız.
 */
export function violatesGenresExclude(row: Pick<MatchRow, 'genres'>, genresExclude: readonly string[]): boolean {
  if (genresExclude.length === 0 || !row.genres) return false;
  const banned = new Set(genresExclude.map((g) => g.trim().toLowerCase()));
  return row.genres.some((g) => banned.has(g.trim().toLowerCase()));
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

/**
 * Dörtlü seçimi: reason:false (yalnız id) — hızlı yol. Başarısızsa v4 sırası (`onFallback('rerank')`).
 */
async function rerankOrNull(
  deps: MoodGauntletDeps,
  moodText: string,
  pool: readonly MatchRow[],
  genresExclude: readonly string[],
): Promise<RerankOutcome | null> {
  const candidates = pool.slice(0, RERANK_CANDIDATES) as MatchRow[];
  try {
    const out = await deps.rerank({ moodText, candidates, count: FOUR, withReasons: false, genresExclude });
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

/**
 * Gerekçeler: dörtlü ekrandayken ARKADA çalışır; yalnız gösterilen 4 film gönderilir
 * (reason:true). Başarısızsa `{}` döner — UI satırı hiç çizmez; hata Sentry/PostHog'a gider.
 * Rerank zaten v4 sırasına düştüyse (rerank-films kapalı/limitte) tekrar denenmez.
 */
export async function fetchReasons(
  deps: MoodGauntletDeps,
  session: Pick<MoodSession, 'moodText'>,
  set: Pick<MoodSet, 'four' | 'reranked'>,
): Promise<Record<string, string>> {
  if (!set.reranked) return {};
  try {
    const out = await deps.rerank({ moodText: session.moodText, candidates: set.four, count: FOUR, withReasons: true });
    if (!out.ok) {
      deps.onFallback('reasons');
      return {};
    }
    const reasons: Record<string, string> = {};
    for (const f of set.four) {
      const r = reasonFor(out.reasons, f.id);
      if (r) reasons[f.id] = r;
    }
    return reasons;
  } catch (err) {
    deps.onError('reasons', err);
    deps.onFallback('reasons');
    return {};
  }
}

export type StageEvent = { stage: 'parsed'; profileName: string | null } | { stage: 'picking' };

export type PipelineStageName = 'parse' | 'exclusions' | 'v4' | 'pick' | 'four';
export type TimingEvent = (stage: PipelineStageName, ms: number, serverMs?: MoodFourServerMs) => void;

const clock = (deps: MoodGauntletDeps): number => (deps.now ? deps.now() : Date.now());

/**
 * v4 çağrısı + gevşetme zinciri. `profile` mevcut (kaydırılmış olabilir) sorgu profilidir;
 * genres_exclude her basamakta korunur, max_runtime yalnız en son basamakta düşer (görünür not).
 */
async function fetchPool(
  deps: MoodGauntletDeps,
  parsed: ParsedMoodV2,
  profile: unknown,
  excludeIds: string[],
): Promise<{ pool: MatchRow[]; notices: MoodNotice[] }> {
  const attempts = buildV4Attempts(parsed.genresInclude.length > 0, parsed.maxRuntime != null);
  let pool: MatchRow[] = [];
  const notices: MoodNotice[] = [];
  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i];
    const rows = await deps.matchV4({
      profile,
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
      notices.push(...noteRelaxation(deps, parsed, attempts, i));
      break;
    }
  }
  return { pool, notices };
}

/** Gevşetme basamağı `i` (>0) kullanıldıysa telemetri + görünür not (max_runtime düştüyse). */
function noteRelaxation(
  deps: MoodGauntletDeps,
  parsed: ParsedMoodV2,
  attempts: readonly AttemptPlan[],
  i: number,
): MoodNotice[] {
  const notices: MoodNotice[] = [];
  if (i <= 0) return notices;
  const a = attempts[i];
  if (!a.includeGenres && parsed.genresInclude.length > 0) deps.onFallback('genres_relaxed');
  if (a.minSimilarity < attempts[0].minSimilarity) deps.onFallback('similarity_relaxed');
  if (!a.keepRuntime) {
    deps.onFallback('max_runtime_dropped');
    notices.push('max_runtime_dropped');
  }
  return notices;
}

/**
 * Yeni arama: parse ∥ dışlama listesi (paralel) → dörtlü. Dörtlü önce tek istekte (`mood-four`: v4 +
 * id-rerank); o yoksa/başarısızsa eski yol: v4 (gevşetme zinciri) → id-rerank. `carryShown` önceki
 * aramalardan taşınan dışlamadır.
 */
export async function startMoodGauntlet(
  deps: MoodGauntletDeps,
  input: {
    text: string;
    quickMoodId?: string;
    carryShown?: readonly string[];
    /** Yükleme ekranı için aşama bildirimi (profile_name geldiğinde 'parsed'). */
    onStage?: (e: StageEvent) => void;
    /** Aşama süreleri (parse, exclusions, v4, pick, four) — metin taşımaz. */
    onTiming?: TimingEvent;
  },
): Promise<StartResult> {
  const t00 = clock(deps);
  // Parse ve dışlama sorguları birbirine bağlı değil: aynı anda başlar (toplam = en yavaşı).
  const parsePart = async (): Promise<ParsedMoodV2> => {
    const p = await deps.parse({ text: input.text, quickMoodId: input.quickMoodId, clientSearchId: deps.newId() });
    input.onTiming?.('parse', clock(deps) - t00);
    input.onStage?.({ stage: 'parsed', profileName: p.profileName });
    return p;
  };
  const exclusionsPart = async (): Promise<string[]> => {
    const l = await deps.loadExclusions();
    input.onTiming?.('exclusions', clock(deps) - t00);
    return l;
  };
  const [parsed, library] = await Promise.all([parsePart(), exclusionsPart()]);
  const shown = [...(input.carryShown ?? [])];
  const excludeIds = mergeExclusions({ shown, recent: parsed.excludeRecentIds, library });

  const baseSession = (pool: MatchRow[], notices: MoodNotice[]): MoodSession => ({
    moodText: input.text,
    parsed,
    profile: parsed.profile,
    intensityStep: 0,
    pool,
    shown,
    setCount: 0,
    notices,
    recorded: [],
  });

  // ── Tek istek yolu ────────────────────────────────────────────────────────
  if (deps.moodFour) {
    const attempts = buildV4Attempts(parsed.genresInclude.length > 0, parsed.maxRuntime != null);
    const tFour = clock(deps);
    let out: MoodFourOutcome | null = null;
    try {
      out = await deps.moodFour({
        moodText: input.text,
        profile: parsed.profile,
        excludeIds,
        parsed,
        attempts,
        matchCount: V4_MATCH_COUNT,
        rerankCandidates: RERANK_CANDIDATES,
      });
    } catch (err) {
      // Sessiz değil: Sentry (deps.onError), sonra eski yol.
      deps.onError('mood_four', err);
    }
    if (out && out.ok) {
      input.onTiming?.('four', clock(deps) - tFour, out.serverMs);
      const pool = uniqueById(out.pool);
      const notices = noteRelaxation(deps, parsed, attempts, out.attemptIndex);
      const session = baseSession(pool, notices);
      if (pool.length < FOUR) return { status: 'insufficient', session };
      const pre: RerankOutcome | null =
        out.rerankedIds && out.rerankedIds.length > 0 ? { ok: true, ids: out.rerankedIds, reasons: {} } : null;
      if (pre === null) deps.onFallback('rerank');
      const combined = await buildSet(deps, session, pre);
      return combined.status === 'ok'
        ? { ...combined, path: 'combined' }
        : { status: 'insufficient', session: combined.session };
    }
    deps.onFallback('mood_four');
  }

  // ── Eski yol: v4 → rerank ─────────────────────────────────────────────────
  let t0 = clock(deps);
  const { pool, notices } = await fetchPool(deps, parsed, parsed.profile, excludeIds);
  input.onTiming?.('v4', clock(deps) - t0);

  const session = baseSession(pool, notices);
  if (pool.length < FOUR) return { status: 'insufficient', session };
  deps.prefetch?.(pool.slice(0, PREFETCH_POOL));
  input.onStage?.({ stage: 'picking' });
  t0 = clock(deps);
  const built = await buildSet(deps, session);
  input.onTiming?.('pick', clock(deps) - t0);
  // Taşınan dışlamalar havuzu 4'ün altına indirdiyse: yeni aramada da yeterli aday yok demektir.
  return built.status === 'ok' ? { ...built, path: 'legacy' } : { status: 'insufficient', session: built.session };
}

/** `preRerank` verilirse (mood-four) dörtlü seçimi için ayrı çağrı yapılmaz; null = v4 sırası. */
async function buildSet(
  deps: MoodGauntletDeps,
  session: MoodSession,
  preRerank?: RerankOutcome | null,
): Promise<NextResult> {
  // Yedekler (If not this one) ve dörtlü YALNIZ bu aramanın havuzundan gelir; dışlanan türdekiler elenir.
  const available = session.pool.filter(
    (r) => !session.shown.includes(r.id) && !violatesGenresExclude(r, session.parsed.genresExclude),
  );
  if (available.length < FOUR) return { status: 'exhausted', session };
  const rerank = preRerank !== undefined
    ? preRerank
    : await rerankOrNull(deps, session.moodText, available, session.parsed.genresExclude);
  const picked = pickFour(available, rerank);
  const set: MoodSet = {
    setId: deps.newId(),
    setIndex: session.setCount,
    four: picked.four,
    reasons: {},
    backups: picked.backups,
    reranked: picked.reranked,
  };
  deps.prefetch?.([...set.four, ...set.backups]);
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

export type IntensityDirection = 'lighter' | 'stronger';

/** Özgün profile göre yeni toplam adım: hafif −1, yoğun +1 (±MAX ile sınırlı). */
export function nextIntensityStep(current: number, direction: IntensityDirection): number {
  return clampIntensityStep(current + (direction === 'stronger' ? 1 : -1));
}

export function canShiftIntensity(current: number, direction: IntensityDirection): boolean {
  return direction === 'stronger' ? current < MAX_INTENSITY_STEPS : current > -MAX_INTENSITY_STEPS;
}

/**
 * "Daha hafif / Daha yoğun": parse TEKRARLANMAZ (kota düşmez, ~4 sn tasarruf). Özgün profilin
 * energy / thematic_depth / pace boyutları kaydırılır, vektör yeniden üretilir, v4 + rerank
 * yeniden çalışır. genres_include/exclude, max_runtime, referanslar, dışlamalar aynen taşınır.
 * Aynı mood_search_id: seçim kayıtları ve recommended_film_ids aynı aramaya yazılmaya devam eder.
 */
export async function intensifyMoodGauntlet(
  deps: MoodGauntletDeps,
  session: MoodSession,
  direction: IntensityDirection,
  hooks?: { onStage?: (e: StageEvent) => void; onTiming?: TimingEvent },
): Promise<StartResult> {
  const step = nextIntensityStep(session.intensityStep, direction);
  const profile = applyIntensity(session.parsed.profile, step);
  if (profile === null) {
    // Beklenmeyen profil biçimi: sessiz geçiş yok → çağıran hata durumuna düşer ve Sentry'ye yazar.
    throw new Error('intensity: profil yogunluk boyutlarini tasimiyor');
  }
  const library = await deps.loadExclusions();
  const excludeIds = mergeExclusions({ shown: session.shown, recent: session.parsed.excludeRecentIds, library });
  let t0 = clock(deps);
  const { pool, notices } = await fetchPool(deps, session.parsed, profile, excludeIds);
  hooks?.onTiming?.('v4', clock(deps) - t0);
  const next: MoodSession = { ...session, profile, intensityStep: step, pool, notices };
  if (pool.length < FOUR) return { status: 'insufficient', session: next };
  deps.prefetch?.(pool.slice(0, PREFETCH_POOL));
  hooks?.onStage?.({ stage: 'picking' });
  t0 = clock(deps);
  const built = await buildSet(deps, next);
  hooks?.onTiming?.('pick', clock(deps) - t0);
  return built.status === 'ok' ? built : { status: 'insufficient', session: built.session };
}

/** Sonuç ekranında yedekler görüldü: sonraki dörtlülerde tekrar çıkmasın. */
export function noteBackupsShown(session: MoodSession, backups: readonly MatchRow[]): MoodSession {
  const shown = [...session.shown];
  for (const b of backups) if (!shown.includes(b.id)) shown.push(b.id);
  return { ...session, shown };
}
