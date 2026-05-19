/** Edge Function: Ham metni TasteProfile'a dönüştürür (Deno) */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface ParseTasteRequest {
  raw_input: string;
  mood_emoji?: string;
}

interface ParseTasteResponse {
  profile: TasteProfile;
  confidence: number;
  suggested_films?: string[];
  follow_up_question?: string;
}

interface ErrorResponse {
  error: string;
  code: string;
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MIN_INPUT_LENGTH = 10;

// ─── Sistem Promptu ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sen bir film zevki analiz uzmanısın. Kullanıcının yazdığı serbest metni analiz ederek 12 boyutlu bir film profili çıkarıyorsun.

Görevin:
1. Kullanıcının ruh halini, isteklerini ve tercihlerini metinden çıkar
2. Her boyut için en uygun değeri belirle
3. Belirsiz olan boyutları 0.5 (neutral) olarak bırak
4. Çelişkili istekleri en mantıklı yorumla çöz
5. Kullanıcı belirli bir film adı geçirmişse "suggested_films" alanına ekle
6. Türkçe ve İngilizce girdilerin her ikisini de anlayabilirsin

Çıktı formatı SADECE geçerli JSON olmalı, başka açıklama ekleme:
{
  "profile": {
    "emotional_state": {
      "joy": 0.0-1.0,
      "sadness": 0.0-1.0,
      "anger": 0.0-1.0,
      "fear": 0.0-1.0,
      "surprise": 0.0-1.0,
      "disgust": 0.0-1.0,
      "anticipation": 0.0-1.0,
      "trust": 0.0-1.0
    },
    "energy_level": 0.0-1.0,
    "pace_preference": "slow" | "medium" | "fast",
    "visual_style": "minimalist" | "cinematic" | "experimental" | "lush" | "raw",
    "thematic_depth": 0.0-1.0,
    "ending_preference": "hopeful" | "bittersweet" | "open" | "tragic" | "triumphant",
    "era_preference": { "from": yıl, "to": yıl },
    "cultural_context": ["ülke/bölge listesi"],
    "avoid_signals": ["kaçınılacak tema listesi"],
    "narrative_style": "linear" | "nonlinear" | "anthology" | "dialogue-driven",
    "social_context": "alone" | "couple" | "friends" | "family",
    "rewatch_tolerance": true | false
  },
  "confidence": 0.0-1.0,
  "suggested_films": ["opsiyonel film adları listesi"]
}

Boyut kuralları:
- emotional_state: Toplam 1.0 olması şart değil; her duygu bağımsız [0-1] aralığında
- energy_level: 0.0 = çok sakin/meditasyon gibi, 1.0 = aksiyon dolu/enerjik
- thematic_depth: 0.0 = saf eğlence, 1.0 = felsefi/karmaşık temalar
- era_preference: Belirtilmemişse { "from": 1970, "to": 2025 }
- cultural_context: Belirtilmemişse []
- avoid_signals: Belirtilmemişse []
- confidence: Girdi ne kadar net ve detaylıysa o kadar yüksek (0.3-0.95 arası)`;

// ─── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────

/**
 * Claude API'ye istek atar ve ham profil JSON'ını döndürür
 */
async function callClaudeAPI(
  rawInput: string,
  moodEmoji?: string,
): Promise<{ profile: TasteProfile; confidence: number; suggested_films?: string[] }> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY ortam değişkeni eksik");
  }

  const userMessage = moodEmoji
    ? `Emoji: ${moodEmoji}\nMetin: ${rawInput}`
    : rawInput;

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
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Claude API hatası: ${response.status} — ${errorBody}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text;

  if (!content) {
    throw new Error("Claude API boş yanıt döndürdü");
  }

  // JSON bloğunu çıkar (```json ... ``` bloğu varsa temizle)
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
    content.match(/```\s*([\s\S]*?)\s*```/);
  const jsonString = jsonMatch ? jsonMatch[1] : content.trim();

  let parsed: { profile: TasteProfile; confidence: number; suggested_films?: string[] };
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error("Claude API geçersiz JSON döndürdü");
  }

  return parsed;
}

/**
 * TasteProfile alanlarını doğrular ve gerekirse varsayılanlarla doldurur
 */
function validateAndNormalize(raw: {
  profile: TasteProfile;
  confidence: number;
  suggested_films?: string[];
}): ParseTasteResponse {
  const p = raw.profile;

  const clamp = (v: unknown, fallback = 0.5): number => {
    const n = typeof v === "number" ? v : fallback;
    return Math.min(1, Math.max(0, n));
  };

  const oneOf = <T extends string>(v: unknown, options: T[], fallback: T): T =>
    options.includes(v as T) ? (v as T) : fallback;

  const profile: TasteProfile = {
    emotional_state: {
      joy: clamp(p?.emotional_state?.joy),
      sadness: clamp(p?.emotional_state?.sadness),
      anger: clamp(p?.emotional_state?.anger),
      fear: clamp(p?.emotional_state?.fear),
      surprise: clamp(p?.emotional_state?.surprise),
      disgust: clamp(p?.emotional_state?.disgust),
      anticipation: clamp(p?.emotional_state?.anticipation),
      trust: clamp(p?.emotional_state?.trust),
    },
    energy_level: clamp(p?.energy_level),
    pace_preference: oneOf<PacePreference>(
      p?.pace_preference,
      ["slow", "medium", "fast"],
      "medium",
    ),
    visual_style: oneOf<VisualStyle>(
      p?.visual_style,
      ["minimalist", "cinematic", "experimental", "lush", "raw"],
      "cinematic",
    ),
    thematic_depth: clamp(p?.thematic_depth),
    ending_preference: oneOf<EndingPreference>(
      p?.ending_preference,
      ["hopeful", "bittersweet", "open", "tragic", "triumphant"],
      "open",
    ),
    era_preference: {
      from: typeof p?.era_preference?.from === "number" ? p.era_preference.from : 1970,
      to: typeof p?.era_preference?.to === "number" ? p.era_preference.to : 2025,
    },
    cultural_context: Array.isArray(p?.cultural_context) ? p.cultural_context : [],
    avoid_signals: Array.isArray(p?.avoid_signals) ? p.avoid_signals : [],
    narrative_style: oneOf<NarrativeStyle>(
      p?.narrative_style,
      ["linear", "nonlinear", "anthology", "dialogue-driven"],
      "linear",
    ),
    social_context: oneOf<SocialContext>(
      p?.social_context,
      ["alone", "couple", "friends", "family"],
      "alone",
    ),
    rewatch_tolerance: typeof p?.rewatch_tolerance === "boolean" ? p.rewatch_tolerance : false,
  };

  const confidence = clamp(raw.confidence, 0.5);
  const result: ParseTasteResponse = { profile, confidence };

  if (Array.isArray(raw.suggested_films) && raw.suggested_films.length > 0) {
    result.suggested_films = raw.suggested_films;
  }

  return result;
}

/**
 * Girdinin çok kısa veya boş olup olmadığını kontrol eder
 */
function isInputTooShort(input: string): boolean {
  return input.trim().length < MIN_INPUT_LENGTH;
}

/**
 * Kısa girdi için takip sorusu seçer
 */
function getFollowUpQuestion(input: string): string {
  const trimmed = input.trim().toLowerCase();

  if (trimmed.length === 0) {
    return "Bugün nasıl hissediyorsun? Ruh halini birkaç kelimeyle anlat, sana uygun filmleri bulayım.";
  }
  if (trimmed.length < 5) {
    return "Biraz daha detay verir misin? Örneğin: 'Hüzünlü ama umut verici bir şey istiyorum' veya 'Arkadaşlarla eğlenceli bir film arıyorum'.";
  }
  return "Daha iyi öneri yapabilmem için biraz daha anlatır mısın? Ne hissediyorsun ya da ne tür bir film atmosferi arıyorsun?";
}

// ─── Quota Check Helper ───────────────────────────────────────────────────────

/**
 * JWT'den user_id alip quota kontrolu yapar.
 * allowed=false ise Claude API call engellenir (maliyet tasarrufu).
 */
async function checkSearchQuota(
  req: Request,
): Promise<{ allowed: boolean; quotaResult?: Record<string, unknown> }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { allowed: true };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return { allowed: true };

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!userData) return { allowed: true };

    const { data, error } = await supabaseAdmin.rpc("check_and_consume_quota", {
      p_user_id: userData.id,
      p_quota_type: "search",
    });

    if (error) {
      console.error("[parse-taste] Quota check error:", error.message);
      return { allowed: true };
    }

    const result = data as Record<string, unknown>;
    return { allowed: result.allowed as boolean, quotaResult: result };
  } catch (err) {
    console.error("[parse-taste] Quota check exception:", err);
    return { allowed: true };
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

  // Quota check BEFORE Claude API call
  const quotaCheck = await checkSearchQuota(req);
  if (!quotaCheck.allowed) {
    return new Response(
      JSON.stringify({
        error: "Daily search quota exceeded",
        code: "QUOTA_EXCEEDED",
        ...quotaCheck.quotaResult,
        upgrade_url: "chosy://paywall",
      } satisfies Record<string, unknown> as unknown as ErrorResponse),
      { status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  let body: ParseTasteRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Geçersiz JSON gövdesi", code: "INVALID_JSON" } satisfies ErrorResponse),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const { raw_input, mood_emoji } = body;

  if (typeof raw_input !== "string") {
    return new Response(
      JSON.stringify({ error: "'raw_input' alanı zorunlu ve string olmalı", code: "MISSING_INPUT" } satisfies ErrorResponse),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Kısa girdi edge case
  if (isInputTooShort(raw_input)) {
    const follow_up_question = getFollowUpQuestion(raw_input);
    return new Response(
      JSON.stringify({ error: "Girdi çok kısa", code: "INPUT_TOO_SHORT", follow_up_question }),
      { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  try {
    const rawResult = await callClaudeAPI(raw_input, mood_emoji);
    const result = validateAndNormalize(rawResult);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";

    if (__DEV__) {
      console.error("[parse-taste] Hata:", message);
    }

    return new Response(
      JSON.stringify({ error: "Profil oluşturulamadı. Lütfen tekrar dene.", code: "PARSE_FAILED" } satisfies ErrorResponse),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});

// Deno ortamında __DEV__ tanımı
declare const __DEV__: boolean;
