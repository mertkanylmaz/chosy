/**
 * Mood Gauntlet gerçek bağımlılıkları (Faz 2-1). `services/moodGauntlet.ts` saf kalır;
 * ağ / Supabase / Sentry bağlaması BURADA.
 *
 * AI rızası: parse-mood ve rerank-films'e mood metni gider → `hasAiConsent()` son kapıdır
 * (CLAUDE.md: Pro Mode metni yalnız services/aiConsent.ts kapısından sonra Anthropic'e gider).
 */
import * as Sentry from '@sentry/react-native';
import * as ExpoCrypto from 'expo-crypto';
import { Image } from 'expo-image';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../constants/config';
import { GAUNTLET_EDGE_REGION } from '../constants/edgeRegion';
import { logger } from '../utils/logger';
import { normalizePosterUrl } from '../utils/posterUrl';
import { hasAiConsent } from './aiConsent';
import { ensureAuthSession, getFreshSession } from './authSession';
import {
  type FallbackStage,
  type MatchRow,
  type MatchV4Args,
  type MoodFourInput,
  type MoodFourOutcome,
  type MoodGauntletDeps,
  type ParsedMoodV2,
  type RerankOutcome,
  type TitleRef,
} from './moodGauntlet';
import { posthogAnalytics } from './posthog';
import { parseMoodFourServerTiming } from '../utils/serverTimingHeader';
import { supabase } from './supabase';
import { MoodParseError, validateAndNormalize, type EdgeResponse } from './tasteParser';
import { tasteProfileToVector } from './vectorEncoder';
import { getWatchedFilmIds, getWatchlistFilmIds } from './watchlist';

const PARSE_TIMEOUT_MS = 15_000;
const RERANK_IDS_TIMEOUT_MS = 8_000;
const RERANK_REASONS_TIMEOUT_MS = 10_000;
/** mood-four: v4 (gevşetme zinciri dahil) + id-rerank tek istekte. */
const MOOD_FOUR_TIMEOUT_MS = 14_000;
const RERANK_OVERVIEW_MAX = 120;

type V2Response = EdgeResponse & {
  genres_include?: unknown;
  genres_exclude?: unknown;
  max_runtime?: unknown;
  reference_titles?: unknown;
  suggested_titles?: unknown;
  exclude_recent_ids?: unknown;
  cache_hit?: unknown;
};

const stringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const titleRefs = (v: unknown): TitleRef[] =>
  Array.isArray(v)
    ? v
        .map((x) => {
          const t = (x as { title?: unknown } | null)?.title;
          const y = (x as { year?: unknown } | null)?.year;
          return typeof t === 'string' && t.length > 0
            ? { title: t, year: typeof y === 'number' ? y : null }
            : null;
        })
        .filter((x): x is TitleRef => x !== null)
    : [];

async function authHeaders(): Promise<Record<string, string>> {
  const session = await getFreshSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
  };
}

async function parseV2(input: {
  text: string;
  quickMoodId?: string;
  clientSearchId: string;
}): Promise<ParsedMoodV2> {
  if (!(await hasAiConsent())) {
    throw new MoodParseError('AI_CONSENT_REQUIRED', 'AI suggestions are turned off.');
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PARSE_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/parse-mood?forceFunctionRegion=${GAUNTLET_EDGE_REGION}`, {
      method: 'POST',
      headers: { ...(await authHeaders()), 'x-region': GAUNTLET_EDGE_REGION },
      body: JSON.stringify({
        raw_input: input.text,
        schema_version: 2,
        client_search_id: input.clientSearchId,
        ...(input.quickMoodId ? { quick_mood_id: input.quickMoodId } : {}),
      }),
      signal: controller.signal,
    });
  } catch (networkError) {
    throw new MoodParseError('NETWORK_ERROR', 'Check your internet connection and try again.', networkError);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const errorData: unknown = await res.json().catch(() => ({}));
    const rawCode = (errorData as { code?: unknown } | null)?.code;
    const code = typeof rawCode === 'string' ? rawCode : '';
    // Bilinen kodlar tasteParser ile aynı adlarla yüzeye çıkar (UI sınıflandırması ortak).
    throw new MoodParseError(code || 'PARSE_FAILED', 'Could not analyze your mood right now.', errorData);
  }

  const raw = (await res.json()) as V2Response;
  return {
    profile: validateAndNormalize(raw),
    searchId: raw.search_id ?? null,
    searchKeywords: stringArray(raw.search_keywords),
    profileName: typeof raw.profile_name === 'string' && raw.profile_name.trim() ? raw.profile_name.trim() : null,
    genresInclude: stringArray(raw.genres_include),
    genresExclude: stringArray(raw.genres_exclude),
    maxRuntime: typeof raw.max_runtime === 'number' ? raw.max_runtime : null,
    referenceTitles: titleRefs(raw.reference_titles),
    suggestedTitles: titleRefs(raw.suggested_titles),
    excludeRecentIds: stringArray(raw.exclude_recent_ids),
    // Replay yanıtında alan hiç yok (parse-mood claim replay): hat önceki denemenin listesine bakar.
    ...(raw.exclude_recent_ids === undefined ? { excludeRecentIdsMissing: true } : {}),
    cacheHit: raw.cache_hit === true,
  };
}

async function matchV4(args: MatchV4Args): Promise<MatchRow[]> {
  const vector = tasteProfileToVector(args.profile as Parameters<typeof tasteProfileToVector>[0]);
  const { data, error } = await supabase.rpc('match_films_v4', {
    query_vector: `[${vector.join(',')}]`,
    user_vector: null,
    mood_weight: 1.0,
    user_weight: 0.0,
    match_count: args.matchCount,
    min_similarity: args.minSimilarity,
    ...(args.minRating != null ? { min_rating: args.minRating } : {}),
    ...(args.searchKeywords.length > 0 ? { search_keywords: args.searchKeywords } : {}),
    ...(args.excludeIds.length > 0 ? { exclude_ids: args.excludeIds } : {}),
    per_director_cap: 1,
    tier_boost: true,
    exclude_archive: true,
    genres_include: args.genresInclude,
    genres_exclude: args.genresExclude,
    max_runtime: args.maxRuntime,
    reference_titles: args.referenceTitles,
    suggested_titles: args.suggestedTitles,
  });
  if (error) {
    // Hata gizlenmez: Sentry + çağırana fırlat (UI hata durumu).
    logger.error('[moodGauntlet] match_films_v4 basarisiz', new Error(error.message), {
      code: 'MOOD_GAUNTLET_V4_FAILED',
    });
    throw new Error(`match_films_v4: ${error.message}`);
  }
  return (data ?? []) as MatchRow[];
}

/**
 * Tek istekte dörtlü: v4 gevşetme zinciri + id-rerank sunucuda (us-west-1, DB ile aynı bölge).
 * Sorgu vektörü İSTEMCİDE üretilir (vectorEncoder tek kaynak). Başarısızlık `ok:false` döner;
 * çağıran eski 2 çağrılı yola düşer (hata Sentry'ye servis katmanında yazılır).
 */
async function moodFour(input: MoodFourInput): Promise<MoodFourOutcome> {
  if (!(await hasAiConsent())) return { ok: false, failure: 'no_consent' };
  const vector = tasteProfileToVector(input.profile as Parameters<typeof tasteProfileToVector>[0]);
  const { parsed } = input;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MOOD_FOUR_TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/mood-four?forceFunctionRegion=${GAUNTLET_EDGE_REGION}`, {
      method: 'POST',
      headers: { ...(await authHeaders()), 'x-region': GAUNTLET_EDGE_REGION },
      body: JSON.stringify({
        mood_text: input.moodText,
        query_vector: `[${vector.join(',')}]`,
        exclude_ids: input.excludeIds,
        search_keywords: parsed.searchKeywords,
        genres_exclude: parsed.genresExclude,
        reference_titles: parsed.referenceTitles,
        suggested_titles: parsed.suggestedTitles,
        attempts: input.attempts.map((a) => ({
          min_similarity: a.minSimilarity,
          min_rating: a.minRating,
          genres_include: a.includeGenres ? parsed.genresInclude : [],
          max_runtime: a.keepRuntime ? parsed.maxRuntime : null,
        })),
        match_count: input.matchCount,
        rerank_candidates: input.rerankCandidates,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, failure: `http_${res.status}` };
    const data = (await res.json()) as { pool?: unknown; attempt_index?: unknown; reranked_ids?: unknown };
    if (!Array.isArray(data.pool)) return { ok: false, failure: 'bad_body' };
    const attemptIndex = typeof data.attempt_index === 'number' ? data.attempt_index : 0;
    const ids = Array.isArray(data.reranked_ids) ? stringArray(data.reranked_ids) : null;
    return {
      ok: true,
      pool: data.pool as MatchRow[],
      attemptIndex,
      rerankedIds: ids,
      serverMs: parseMoodFourServerTiming(res.headers.get('server-timing')),
    };
  } catch (err) {
    if (controller.signal.aborted) return { ok: false, failure: 'timeout' };
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function rerank(input: {
  moodText: string;
  candidates: MatchRow[];
  count: number;
  withReasons: boolean;
  genresExclude?: readonly string[];
}): Promise<RerankOutcome> {
  if (!(await hasAiConsent())) return { ok: false, failure: 'no_consent' };
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    input.withReasons ? RERANK_REASONS_TIMEOUT_MS : RERANK_IDS_TIMEOUT_MS,
  );
  try {
    // Uygulama modu: parse-mood ile aynı bölge sabitleme (başlık + forceFunctionRegion sorgusu).
    const res = await fetch(`${SUPABASE_URL}/functions/v1/rerank-films?forceFunctionRegion=${GAUNTLET_EDGE_REGION}`, {
      method: 'POST',
      headers: { ...(await authHeaders()), 'x-region': GAUNTLET_EDGE_REGION },
      body: JSON.stringify({
        mood_text: input.moodText,
        candidates: input.candidates.map((c) => ({
          id: c.id,
          title: c.title,
          overview: (c.overview ?? '').slice(0, RERANK_OVERVIEW_MAX),
          genres: c.genres,
          year: c.year,
          runtime: c.runtime,
          similarity: c.similarity,
        })),
        count: input.count,
        reason: input.withReasons,
        ...(input.genresExclude && input.genresExclude.length > 0 ? { genres_exclude: input.genresExclude } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, failure: `http_${res.status}` };
    const data = (await res.json()) as { reranked_ids?: unknown; reasons?: unknown; fallback?: unknown };
    if (!Array.isArray(data.reranked_ids)) return { ok: false, failure: 'bad_body' };
    if (data.fallback === true) return { ok: false, failure: 'server_fallback' };
    const reasons: Record<string, string> = {};
    if (data.reasons && typeof data.reasons === 'object') {
      for (const [k, v] of Object.entries(data.reasons as Record<string, unknown>)) {
        if (typeof v === 'string') reasons[k] = v;
      }
    }
    return { ok: true, ids: stringArray(data.reranked_ids), reasons };
  } catch (err) {
    if (controller.signal.aborted) return { ok: false, failure: 'timeout' };
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function loadExclusions(): Promise<string[]> {
  const [watchlist, watched] = await Promise.all([getWatchlistFilmIds(), getWatchedFilmIds()]);
  return [...new Set([...watchlist, ...watched])];
}

async function recordRecommended(searchId: string, ids: string[]): Promise<void> {
  await ensureAuthSession();
  const { error } = await supabase
    .from('mood_searches')
    .update({ recommended_film_ids: ids, rpc_version: 'v4' })
    .eq('id', searchId);
  if (error) throw new Error(`mood_searches update: ${error.message}`);
}

/** Poster ön-yükleme: en iyi çaba. Başarısızlık akışı bozmaz ama iz bırakır (breadcrumb). */
function prefetchPosters(rows: readonly MatchRow[]): void {
  const urls = rows
    .map((r) => normalizePosterUrl(r.poster_url))
    .filter((u): u is string => u !== null && u.length > 0);
  if (urls.length === 0) return;
  void Image.prefetch(urls).catch((err: unknown) => {
    Sentry.addBreadcrumb({
      category: 'mood_gauntlet',
      level: 'info',
      message: 'poster prefetch basarisiz',
      data: { count: urls.length, error: err instanceof Error ? err.message : String(err) },
    });
  });
}

/** Üretim bağlaması. Ham mood metni hiçbir olaya girmez. */
export function createMoodGauntletDeps(): MoodGauntletDeps {
  return {
    parse: parseV2,
    matchV4,
    rerank,
    moodFour,
    loadExclusions,
    recordRecommended,
    newId: () => ExpoCrypto.randomUUID(),
    now: () => Date.now(),
    prefetch: prefetchPosters,
    onFallback: (stage: FallbackStage) => {
      posthogAnalytics.track('mood_pipeline_fallback', { stage });
    },
    onError: (stage: FallbackStage, err: unknown) => {
      Sentry.captureException(err, {
        level: 'warning',
        tags: { flow: 'mood_gauntlet', step: stage },
      });
    },
    trace: (message: string, data?: Record<string, string | number | boolean>) => {
      Sentry.addBreadcrumb({ category: 'mood_gauntlet', level: 'info', message, data });
    },
  };
}
