/** Edge Function: pgvector ile film önerisi döndürür (Deno) */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { tasteProfileToVector } from "../../../services/vectorEncoder.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { requireUser, unauthorizedResponse } from "../_shared/auth.ts";

// ─── Tipler ──────────────────────────────────────────────────────────────────

interface EmotionalState {
  joy: number;
  sadness: number;
  anger: number;
  fear: number;
  surprise: number;
  disgust: number;
  anticipation: number;
  trust: number;
}

type PacePreference = "slow" | "medium" | "fast";
type VisualStyle = "minimalist" | "cinematic" | "experimental" | "lush" | "raw";
type EndingPreference = "hopeful" | "bittersweet" | "open" | "tragic" | "triumphant";
type NarrativeStyle = "linear" | "nonlinear" | "anthology" | "dialogue-driven";
type SocialContext = "alone" | "couple" | "friends" | "family";

interface EraPreference {
  from: number;
  to: number;
}

interface TasteProfile {
  emotional_state: EmotionalState;
  energy_level: number;
  pace_preference: PacePreference;
  visual_style: VisualStyle;
  thematic_depth: number;
  ending_preference: EndingPreference;
  era_preference: EraPreference;
  cultural_context: string[];
  avoid_signals: string[];
  narrative_style: NarrativeStyle;
  social_context: SocialContext;
  rewatch_tolerance: boolean;
}

interface Film {
  id: string;
  tmdb_id: number;
  title: string;
  year: number;
  poster_url: string;
  backdrop_url: string;
  overview: string;
  genres: string[];
  runtime: number;
  vote_average: number;
}

interface RecommendRequest {
  profile: TasteProfile;
  limit?: number;
  exclude_ids?: string[];
  /**
   * Opsiyonel: users tablosundaki dahili UUID.
   * Verilirse session kaydedilir ve preferences_vector hybrid scoring'de kullanılır.
   */
  user_id?: string;
}

interface FilmRecommendation {
  film: Film;
  similarity: number;
  reason: string;
}

interface RecommendResponse {
  films: FilmRecommendation[];
  session_id?: string;
}

interface ErrorResponse {
  error: string;
  code: string;
}

interface RawFilmRow {
  id: string;
  tmdb_id: number;
  title: string;
  year: number;
  poster_url: string;
  backdrop_url: string;
  overview: string;
  genres: string[];
  runtime: number;
  vote_average: number;
  dimensions_json: unknown;
  similarity: number;
}

// ─── Sabitler ────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** Hybrid scoring ağırlıkları — services/userProfile.ts ile senkronize tutulmalı */
const TASTE_WEIGHT = 0.7;
const PREFERENCE_WEIGHT = 0.3;

// ─── Veritabanı Sorguları ─────────────────────────────────────────────────────

/**
 * pgvector cosine similarity ile en yakın filmleri döndürür.
 *
 * Hybrid scoring:
 *   final_score = 0.7 * taste_similarity + 0.3 * pref_similarity
 *
 * userPrefVector yoksa her iki ağırlık taste_vector üzerinden hesaplanır
 * (0.7 + 0.3 = 1.0 × taste_similarity), böylece cold-start'ta davranış
 * bozulmaz.
 *
 * SQL parametreleri:
 *   $1 — tasteVector (her zaman)
 *   $2 — userPrefVector veya tasteVector (fallback)
 *   $3 — limit
 *   $4+ — excludeIds
 */
async function queryFilms(
  db: Client,
  tasteVector: number[],
  limit: number,
  excludeIds: string[],
  userPrefVector?: number[],
): Promise<RawFilmRow[]> {
  const tasteLiteral = `[${tasteVector.join(",")}]`;
  // userPrefVector yoksa tasteVector'ü kullan → 0.7*taste + 0.3*taste = 1.0*taste
  const prefLiteral = userPrefVector
    ? `[${userPrefVector.join(",")}]`
    : tasteLiteral;

  const params: unknown[] = [tasteLiteral, prefLiteral, limit];

  let excludeClause = "";
  if (excludeIds.length > 0) {
    const placeholders = excludeIds.map((_, i) => `$${i + 4}`).join(", ");
    excludeClause = `AND f.id NOT IN (${placeholders})`;
    params.push(...excludeIds);
  }

  const result = await db.queryObject<RawFilmRow>(`
    SELECT
      f.id,
      f.tmdb_id,
      f.title,
      f.year,
      f.poster_url,
      f.backdrop_url,
      f.overview,
      f.genres,
      f.runtime,
      f.vote_average,
      fp.dimensions_json,
      ${TASTE_WEIGHT} * (1 - (fp.profile_vector <=> $1::vector))
      + ${PREFERENCE_WEIGHT} * (1 - (fp.profile_vector <=> $2::vector))
        AS similarity
    FROM film_profiles fp
    JOIN films f ON f.id = fp.film_id
    WHERE fp.profile_vector IS NOT NULL
      ${excludeClause}
    ORDER BY similarity DESC
    LIMIT $3
  `, params);

  return result.rows;
}

/**
 * users tablosundan kullanıcının preferences_vector'ünü getirir.
 * Kullanıcı bulunamazsa veya vektör henüz oluşturulmamışsa null döner.
 *
 * @param db     - Açık veritabanı bağlantısı
 * @param userId - users tablosundaki dahili UUID
 */
async function fetchUserPreferenceVector(
  db: Client,
  userId: string,
): Promise<number[] | null> {
  const result = await db.queryObject<{ preferences_vector: number[] | null }>(
    `SELECT preferences_vector FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  return result.rows[0]?.preferences_vector ?? null;
}

/**
 * Öneri session'ını sessions tablosuna kaydeder.
 */
async function saveSession(
  db: Client,
  userId: string,
  profile: TasteProfile,
): Promise<string> {
  const result = await db.queryObject<{ id: string }>(
    `INSERT INTO sessions (user_id, parsed_profile_json)
     VALUES ($1, $2)
     RETURNING id`,
    [userId, JSON.stringify(profile)],
  );
  return result.rows[0].id;
}

// ─── Claude Açıklama Üretimi ──────────────────────────────────────────────────

/**
 * Tüm filmler için tek bir Claude API çağrısıyla "neden bu film" açıklamaları üretir.
 * Hata durumunda her film için varsayılan açıklama döner.
 */
async function generateReasons(
  profile: TasteProfile,
  films: RawFilmRow[],
): Promise<string[]> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY ortam değişkeni eksik");

  const filmList = films
    .map((f, i) => `${i + 1}. "${f.title}" (${f.year}) — ${(f.overview ?? "").slice(0, 150)}`)
    .join("\n");

  const profileSummary = [
    `Duygular: joy=${profile.emotional_state.joy.toFixed(2)}, sadness=${profile.emotional_state.sadness.toFixed(2)}, trust=${profile.emotional_state.trust.toFixed(2)}`,
    `Enerji: ${profile.energy_level.toFixed(2)}, Hız: ${profile.pace_preference}, Görsel: ${profile.visual_style}`,
    `Tematik derinlik: ${profile.thematic_depth.toFixed(2)}, Bitiş: ${profile.ending_preference}`,
    `Anlatı: ${profile.narrative_style}, Ortam: ${profile.social_context}`,
  ].join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system:
        "Sen bir film öneri asistanısın. Kullanıcı profiline göre her film için 1-2 cümlelik kısa Türkçe açıklama yaz. Sadece JSON array döndür, başka açıklama ekleme.",
      messages: [
        {
          role: "user",
          content: `Kullanıcı Profili:\n${profileSummary}\n\nFilmler:\n${filmList}\n\nHer film için "Bu filmi sana şu yüzden önerdim: ..." formatında 1-2 cümle yaz.\nYalnızca şu JSON formatında döndür:\n["açıklama1", "açıklama2", ...]`,
        },
      ],
    }),
  });

  if (!response.ok) {
    if (__DEV__) console.error("[recommend] Claude API hatası:", response.status);
    return films.map(() => "Bu film profiliyle uyumlu.");
  }

  const data = await response.json();
  const content: string = data.content?.[0]?.text ?? "[]";
  const jsonMatch = content.match(/\[[\s\S]*\]/);

  if (!jsonMatch) return films.map(() => "Bu film profiliyle uyumlu.");

  try {
    const reasons: string[] = JSON.parse(jsonMatch[0]);
    return films.map((_, i) => reasons[i] ?? "Bu film profiliyle uyumlu.");
  } catch {
    return films.map(() => "Bu film profiliyle uyumlu.");
  }
}

// ─── Ana Handler ──────────────────────────────────────────────────────────────

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Sadece POST destekleniyor", code: "METHOD_NOT_ALLOWED" } satisfies ErrorResponse),
      { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // ── Kimlik + rate limit ─────────────────────────────────────────────────────
  // Bu fonksiyonun istemcide çağıranı YOK (8 Ağu 2026 taraması) ama deploy
  // edilmiş ve `api.anthropic.com`'a istek atıyor. Çağrılmıyor olması koruma
  // değildir — kapı açık kaldığı sürece maliyet yüzeyidir.
  const auth = await requireUser(req);
  if (!auth.ok) {
    return unauthorizedResponse(auth, CORS_HEADERS);
  }

  try {
    await checkRateLimit(auth.authUserId, "recommend");
  } catch (err) {
    return rateLimitResponse(err, CORS_HEADERS);
  }

  let body: RecommendRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Geçersiz JSON gövdesi", code: "INVALID_JSON" } satisfies ErrorResponse),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const { profile, limit: rawLimit, exclude_ids = [], user_id } = body;

  if (!profile || typeof profile !== "object") {
    return new Response(
      JSON.stringify({ error: "'profile' alanı zorunlu", code: "MISSING_PROFILE" } satisfies ErrorResponse),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const limit = Math.min(
    typeof rawLimit === "number" && rawLimit > 0 ? rawLimit : DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return new Response(
      JSON.stringify({ error: "Veritabanı bağlantısı yapılandırılmamış", code: "DB_NOT_CONFIGURED" } satisfies ErrorResponse),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const db = new Client(dbUrl);

  try {
    await db.connect();

    const tasteVector = tasteProfileToVector(profile);

    // Kullanıcı varsa preferences_vector ve session kaydını paralel başlat
    const [userPrefVector, session_id] = await Promise.all([
      user_id ? fetchUserPreferenceVector(db, user_id) : Promise.resolve(null),
      user_id ? saveSession(db, user_id, profile) : Promise.resolve(undefined),
    ]);

    const rawFilms = await queryFilms(
      db,
      tasteVector,
      limit,
      exclude_ids,
      userPrefVector ?? undefined,
    );

    if (rawFilms.length === 0) {
      const emptyResponse: RecommendResponse = { films: [] };
      return new Response(
        JSON.stringify(emptyResponse),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const reasons = await generateReasons(profile, rawFilms);

    const films: FilmRecommendation[] = rawFilms.map((row, i) => ({
      film: {
        id: row.id,
        tmdb_id: Number(row.tmdb_id),
        title: row.title,
        year: Number(row.year),
        poster_url: row.poster_url,
        backdrop_url: row.backdrop_url,
        overview: row.overview,
        genres: row.genres ?? [],
        runtime: Number(row.runtime),
        vote_average: Number(row.vote_average),
      },
      similarity: Number(row.similarity),
      reason: reasons[i],
    }));

    const responseBody: RecommendResponse = {
      films,
      ...(session_id ? { session_id } : {}),
    };

    return new Response(
      JSON.stringify(responseBody),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    if (__DEV__) console.error("[recommend] Hata:", message);

    return new Response(
      JSON.stringify({ error: "Öneri alınamadı. Lütfen tekrar dene.", code: "RECOMMEND_FAILED" } satisfies ErrorResponse),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } finally {
    await db.end();
  }
});

// Deno ortamında __DEV__ tanımı
declare const __DEV__: boolean;
